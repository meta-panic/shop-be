import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE!;
const STOCKS_TABLE = process.env.STOCKS_TABLE!;

const productSchema = z.object({
  title: z.string().min(1, "title is required"),
  description: z.string().optional().default(""),
  price: z.number().positive("price must be positive"),
  count: z.number().int().nonnegative("count must be >= 0"),
});

const response = (statusCode: number, body: any): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  console.log(
    JSON.stringify({
      type: "REQUEST",
      event,
    }),
  );

  try {
    if (!event.body) {
      return response(400, { message: "Request body is missing" });
    }

    let parsedBody: unknown;

    try {
      parsedBody = JSON.parse(event.body);
    } catch {
      return response(400, { message: "Invalid JSON body" });
    }

    const result = productSchema.safeParse(parsedBody);

    if (!result.success) {
      return response(400, {
        message: "Validation error",
        errors: result.error.flatten(),
      });
    }

    const { title, description, price, count } = result.data;

    const id = randomUUID();

    const product = {
      id,
      title: title.trim(),
      description,
      price,
    };

    await dynamoDB.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: PRODUCTS_TABLE,
              Item: product,
            },
          },
          {
            Put: {
              TableName: STOCKS_TABLE,
              Item: {
                product_id: id,
                count,
              },
            },
          },
        ],
      }),
    );

    return response(201, { ...product, count });
  } catch (error) {
    console.error("Error:", error);
    return response(500, { message: "Internal Server Error" });
  }
};
