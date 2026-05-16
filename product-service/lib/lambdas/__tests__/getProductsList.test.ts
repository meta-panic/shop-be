import { handler } from "../getProductsList";
import { mocks } from "../mocks";

describe("getProductsList lambda", () => {
  it("returns 200 and all products", async () => {
    const result = await handler();

    expect(result.statusCode).toBe(200);
    expect(result.headers).toMatchObject({
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });

    const body = JSON.parse(result.body);
    expect(body).toEqual(mocks);
  });

  it("returns empty array if mocks is empty", async () => {
    const originalMocks = [...mocks];
    (mocks as any).length = 0;

    const result = await handler();

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual([]);

    // restore
    (mocks as any).push(...originalMocks);
  });

  it("handles unexpected errors (500)", async () => {
    const original = JSON.stringify;

    const mock = jest
      .spyOn(JSON, "stringify")
      .mockImplementationOnce(() => {
        throw new Error("some error");
      })
      .mockImplementation(original);

    const result1 = await handler();
    expect(result1.statusCode).toBe(500);

    const result2 = await handler();
    expect(result2.statusCode).toBe(200);

    mock.mockRestore();
  });
});
