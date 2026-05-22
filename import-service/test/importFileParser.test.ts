import { handler } from "../lib/lambdas/importFileParser";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { S3Event } from "aws-lambda";
import { Readable } from "stream";

const s3Mock = mockClient(S3Client);

describe("importFileParser handler", () => {
  beforeEach(() => {
    s3Mock.reset();
    jest.clearAllMocks();
  });

  it("should parse CSV file from S3 correctly", async () => {
    const bucketName = "test-bucket";
    const objectKey = "uploaded/test.csv";

    const event = {
      Records: [
        {
          s3: {
            bucket: { name: bucketName },
            object: { key: objectKey },
          },
        },
      ],
    } as S3Event;

    // Create a mock stream
    const csvData = "name,price\nProduct 1,10\nProduct 2,20";
    const stream = new Readable();
    stream.push(csvData);
    stream.push(null); // end of stream

    s3Mock.on(GetObjectCommand).resolves({
      Body: stream as any,
    });

    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    await handler(event);

    expect(s3Mock.commandCalls(GetObjectCommand).length).toBe(1);
    expect(s3Mock.commandCalls(GetObjectCommand)[0].args[0].input).toEqual({
      Bucket: bucketName,
      Key: objectKey,
    });

    expect(consoleSpy).toHaveBeenCalledWith("CSV chunk:", {
      name: "Product 1",
      price: "10",
    });
    expect(consoleSpy).toHaveBeenCalledWith("CSV chunk:", {
      name: "Product 2",
      price: "20",
    });
    expect(consoleSpy).toHaveBeenCalledWith("Parsing finished");

    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should handle S3 errors gracefully", async () => {
    const event = {
      Records: [
        {
          s3: {
            bucket: { name: "bucket" },
            object: { key: "key" },
          },
        },
      ],
    } as S3Event;

    s3Mock.on(GetObjectCommand).rejects(new Error("S3 Error"));

    const consoleSpy = jest.spyOn(console, "log").mockImplementation();

    await handler(event);

    expect(consoleSpy).toHaveBeenCalledWith(
      "Some error happened: ",
      expect.stringContaining("S3 Error"),
    );

    consoleSpy.mockRestore();
  });

  it("should throw error if response body is missing", async () => {
    const event = {
      Records: [
        {
          s3: {
            bucket: { name: "bucket" },
            object: { key: "key" },
          },
        },
      ],
    } as S3Event;

    s3Mock.on(GetObjectCommand).resolves({
      Body: undefined,
    });

    const consoleSpy = jest.spyOn(console, "log").mockImplementation();

    await handler(event);

    expect(consoleSpy).toHaveBeenCalledWith(
      "Some error happened: ",
      expect.stringContaining("No body found"),
    );

    consoleSpy.mockRestore();
  });
});
