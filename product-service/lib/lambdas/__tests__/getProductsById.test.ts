import { handler } from "../getProductsById";
import { APIGatewayProxyEvent } from "aws-lambda";
import { mocks } from "../mocks";

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
  it("returns 400 if productId is missing", async () => {
    const event = createEvent({
      pathParameters: null,
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: "Missing product id",
    });
  });

  it("returns 404 if product is not found", async () => {
    const event = createEvent({
      pathParameters: { productId: "non-existent-id" },
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    expect(result.body).toContain("not found");
    expect(result.headers).toMatchObject({
      "Content-Type": "application/json",
    });
  });

  it("returns 200 and product when found", async () => {
    const existingProduct = mocks[0];

    const event = createEvent({
      pathParameters: { productId: existingProduct.id },
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers).toMatchObject({
      "Content-Type": "application/json",
    });

    const body = JSON.parse(result.body);
    expect(body).toEqual(existingProduct);
  });

  it("handles unexpected errors (500)", async () => {
    const originalFind = mocks.find;
    (mocks as any).find = () => {
      throw new Error("some error");
    };

    const event = createEvent();

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      message: "Internal server error",
    });

    // restore
    (mocks as any).find = originalFind;
  });
});
