import { handler } from "../catalogBatchProcess";
import { SQSEvent } from "aws-lambda";

const mockSend = jest.fn();
const mockSnsSend = jest.fn();

jest.mock("@aws-sdk/lib-dynamodb", () => {
  return {
    DynamoDBDocumentClient: {
      from: () => ({
        send: (...args: any[]) => mockSend(...args),
      }),
    },
    TransactWriteCommand: jest.fn().mockImplementation((input) => ({ input })),
  };
});

jest.mock("@aws-sdk/client-sns", () => {
  return {
    SNSClient: jest.fn().mockImplementation(() => ({
      send: (...args: any[]) => mockSnsSend(...args),
    })),
    PublishCommand: jest.fn().mockImplementation((input) => ({ input })),
  };
});

describe("catalogBatchProcess lambda", () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSnsSend.mockReset();
    jest.clearAllMocks();
  });

  const createRecord = (messageId: string, body: any) => ({
    messageId,
    receiptHandle: `handle-${messageId}`,
    body: typeof body === "string" ? body : JSON.stringify(body),
    attributes: {} as any,
    messageAttributes: {},
    md5OfBody: "md5",
    eventSource: "aws:sqs",
    eventSourceARN: "arn:aws:sqs:region:account:queue",
    awsRegion: "eu-central-1",
  });

  it("processes a batch of valid messages and publishes SNS notifications successfully", async () => {
    mockSend.mockResolvedValue({});
    mockSnsSend.mockResolvedValue({});

    const event: SQSEvent = {
      Records: [
        createRecord("msg-1", {
          title: "Product One",
          description: "Description One",
          price: 100,
          count: 10,
        }),
        createRecord("msg-2", {
          title: "Product Two",
          description: "Description Two",
          price: 200,
          count: 20,
        }),
      ],
    };

    const result = await handler(event);

    expect(result).toEqual({ batchItemFailures: [] });
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSnsSend).toHaveBeenCalledTimes(2);
  });

  it("handles malformed JSON body or invalid validation as a partial failure", async () => {
    mockSend.mockResolvedValue({});
    mockSnsSend.mockResolvedValue({});

    const event: SQSEvent = {
      Records: [
        createRecord("msg-1", {
          title: "Valid Product",
          price: 100,
          count: 5,
        }),
        createRecord("msg-2", "{invalid-json}"),
        createRecord("msg-3", {
          price: 150, // Missing title
          count: 12,
        }),
      ],
    };

    const result = await handler(event);

    expect(result).toEqual({
      batchItemFailures: [
        { itemIdentifier: "msg-2" },
        { itemIdentifier: "msg-3" },
      ],
    });
    expect(mockSend).toHaveBeenCalledTimes(1); // Only for msg-1
    expect(mockSnsSend).toHaveBeenCalledTimes(1); // Only for msg-1
  });

  it("handles DynamoDB write errors as partial failures", async () => {
    // Success for first record, failure for the second
    mockSend
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("DynamoDB error"));
    mockSnsSend.mockResolvedValue({});

    const event: SQSEvent = {
      Records: [
        createRecord("msg-1", {
          title: "First Product",
          price: 100,
          count: 5,
        }),
        createRecord("msg-2", {
          title: "Second Product",
          price: 200,
          count: 10,
        }),
      ],
    };

    const result = await handler(event);

    expect(result).toEqual({
      batchItemFailures: [{ itemIdentifier: "msg-2" }],
    });
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSnsSend).toHaveBeenCalledTimes(1); // Only msg-1 should call SNS
  });

  it("handles SNS publishing errors as partial failures", async () => {
    mockSend.mockResolvedValue({});
    // Success for first record, failure for the second
    mockSnsSend
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("SNS publishing failed"));

    const event: SQSEvent = {
      Records: [
        createRecord("msg-1", {
          title: "First Product",
          price: 100,
          count: 5,
        }),
        createRecord("msg-2", {
          title: "Second Product",
          price: 200,
          count: 10,
        }),
      ],
    };

    const result = await handler(event);

    expect(result).toEqual({
      batchItemFailures: [{ itemIdentifier: "msg-2" }],
    });
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSnsSend).toHaveBeenCalledTimes(2);
  });
});
