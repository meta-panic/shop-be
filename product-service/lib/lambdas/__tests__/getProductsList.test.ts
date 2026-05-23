import { handler } from "../getProductsList";
import { APIGatewayProxyEvent } from "aws-lambda";

const mockSend = jest.fn();

jest.mock("@aws-sdk/lib-dynamodb", () => {
  return {
    DynamoDBDocumentClient: {
      from: () => ({
        send: (...args: any[]) => mockSend(...args),
      }),
    },
    ScanCommand: jest.fn().mockImplementation((input) => ({ input })),
  };
});

describe("getProductsList lambda", () => {
  beforeEach(() => {
    mockSend.mockReset();
    jest.clearAllMocks();
  });

  const createEvent = (): APIGatewayProxyEvent =>
    ({
      body: null,
      headers: {},
      multiValueHeaders: {},
      httpMethod: "GET",
      isBase64Encoded: false,
      path: "/products",
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      resource: "",
      requestContext: {} as any,
    }) as APIGatewayProxyEvent;

  it("returns 200 and all products with stock count", async () => {
    const mockProducts = [
      { id: "1", title: "Product 1", description: "Desc 1", price: 10 },
      { id: "2", title: "Product 2", description: "Desc 2", price: 20 },
    ];
    const mockStocks = [
      { product_id: "1", count: 5 },
      { product_id: "2", count: 10 },
    ];

    mockSend
      .mockResolvedValueOnce({ Items: mockProducts })
      .mockResolvedValueOnce({ Items: mockStocks });

    const event = createEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers).toMatchObject({
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });

    const body = JSON.parse(result.body);
    expect(body).toEqual([
      { id: "1", title: "Product 1", description: "Desc 1", price: 10, count: 5 },
      { id: "2", title: "Product 2", description: "Desc 2", price: 20, count: 10 },
    ]);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("returns products with count 0 if stock is missing", async () => {
    const mockProducts = [
      { id: "1", title: "Product 1", description: "Desc 1", price: 10 },
    ];

    mockSend
      .mockResolvedValueOnce({ Items: mockProducts })
      .mockResolvedValueOnce({ Items: [] });

    const event = createEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toEqual([
      { id: "1", title: "Product 1", description: "Desc 1", price: 10, count: 0 },
    ]);
  });

  it("handles unexpected errors (500)", async () => {
    mockSend.mockRejectedValueOnce(new Error("DynamoDB Scan Error"));

    const event = createEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      message: "Internal server error",
    });
  });
});
