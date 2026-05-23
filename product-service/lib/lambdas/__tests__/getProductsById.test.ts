import { handler } from "../getProductsById";
import { APIGatewayProxyEvent } from "aws-lambda";

const mockSend = jest.fn();

jest.mock("@aws-sdk/lib-dynamodb", () => {
  return {
    DynamoDBDocumentClient: {
      from: () => ({
        send: (...args: any[]) => mockSend(...args),
      }),
    },
    GetCommand: jest.fn().mockImplementation((input) => ({ input })),
  };
});

const createEvent = (
  overrides?: Partial<APIGatewayProxyEvent>,
): APIGatewayProxyEvent =>
  ({
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: "GET",
    isBase64Encoded: false,
    path: "/products/1",
    pathParameters: { productId: "1" },
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: "",
    requestContext: {} as any,
    ...overrides,
  }) as APIGatewayProxyEvent;

describe("getProductById lambda", () => {
  beforeEach(() => {
    mockSend.mockReset();
    jest.clearAllMocks();
  });

  it("returns 400 if productId is missing", async () => {
    const event = createEvent({
      pathParameters: null,
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: "Missing product id",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns 404 if product is not found in database", async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });

    const event = createEvent({
      pathParameters: { productId: "non-existent-id" },
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    expect(result.body).toContain("not found");
    expect(result.headers).toMatchObject({
      "Content-Type": "application/json",
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("returns 200 and product combined with stock count when found", async () => {
    const mockProduct = {
      id: "1",
      title: "Test Product",
      description: "Test Description",
      price: 15,
    };
    const mockStock = {
      product_id: "1",
      count: 25,
    };

    mockSend
      .mockResolvedValueOnce({ Item: mockProduct })
      .mockResolvedValueOnce({ Item: mockStock });

    const event = createEvent({
      pathParameters: { productId: "1" },
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers).toMatchObject({
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });

    const body = JSON.parse(result.body);
    expect(body).toEqual({
      id: "1",
      title: "Test Product",
      description: "Test Description",
      price: 15,
      count: 25,
    });
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("returns 200 and default count 0 if product is found but stock is missing", async () => {
    const mockProduct = {
      id: "1",
      title: "Test Product",
      description: "Test Description",
      price: 15,
    };

    mockSend
      .mockResolvedValueOnce({ Item: mockProduct })
      .mockResolvedValueOnce({ Item: undefined });

    const event = createEvent({
      pathParameters: { productId: "1" },
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toEqual({
      id: "1",
      title: "Test Product",
      description: "Test Description",
      price: 15,
      count: 0,
    });
  });

  it("handles unexpected errors (500)", async () => {
    mockSend.mockRejectedValueOnce(new Error("DynamoDB Get Error"));

    const event = createEvent();

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      message: "Internal server error",
    });
  });
});
