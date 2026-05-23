import { randomUUID } from "crypto";
import { SQSEvent, SQSBatchResponse } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE!;
const STOCKS_TABLE = process.env.STOCKS_TABLE!;

export interface ProductInput {
  title: string;
  description?: string;
  price: number;
  count: number;
}

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  console.log("SQS event:", JSON.stringify(event));
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body) as ProductInput;

      if (!body.title || typeof body.title !== "string" || body.title.trim() === "") {
        throw new Error("Invalid or missing product title");
      }

      const id = await createProductInDB(body);
      console.log(`Created product by id ${id}\nData: ${JSON.stringify(body)}`);
    } catch (error: any) {
      console.error(
        `Failed to process record ${record.messageId}:`,
        error.message || error,
      );
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};

export async function createProductInDB(
  product: ProductInput,
): Promise<string> {
  const id = randomUUID();

  const { title, description, price, count } = product;

  const item = {
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
            Item: item,
          },
        },
        {
          Put: {
            TableName: STOCKS_TABLE,
            Item: {
              product_id: id,
              count: count,
            },
          },
        },
      ],
    }),
  );

  return id;
}
