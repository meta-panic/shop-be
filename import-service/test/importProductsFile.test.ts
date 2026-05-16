import { handler } from "../lib/lambdas/importProductsFile";
import { S3Client } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { APIGatewayProxyEvent } from "aws-lambda";

jest.mock("@aws-sdk/s3-request-presigner");

const s3Mock = mockClient(S3Client);

describe("importProductsFile handler", () => {
  const BUCKET_NAME = "test-bucket";
  const REGION = "eu-west-1";

  beforeEach(() => {
    s3Mock.reset();
    process.env.BUCKET_NAME = BUCKET_NAME;
    process.env.REGION = REGION;
    jest.clearAllMocks();
  });

  it("should return 200 and a signed URL when name is provided", async () => {
    const fileName = "test.csv";
    const event = {
      queryStringParameters: {
        name: fileName,
      },
    } as unknown as APIGatewayProxyEvent;

    const mockSignedUrl = "https://signed-url.com";
    (getSignedUrl as jest.Mock).mockResolvedValue(mockSignedUrl);

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe(mockSignedUrl);
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.any(S3Client),
      expect.objectContaining({
        input: {
          Bucket: BUCKET_NAME,
          Key: `uploaded/${fileName}`,
          ContentType: "text/csv",
        },
      }),
      { expiresIn: 300 },
    );
  });

  it("should return 400 when name query parameter is missing", async () => {
    const event = {
      queryStringParameters: {},
    } as unknown as APIGatewayProxyEvent;

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toBe(
      'Query parameter "name" is missing',
    );
  });

  it("should return 500 when getSignedUrl fails", async () => {
    const event = {
      queryStringParameters: {
        name: "test.csv",
      },
    } as unknown as APIGatewayProxyEvent;

    (getSignedUrl as jest.Mock).mockRejectedValue(new Error("S3 Error"));

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).message).toBe("Internal Server Error");
  });
});
