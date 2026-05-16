import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE!;
const STOCKS_TABLE = process.env.STOCKS_TABLE!;

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    console.log(
      JSON.stringify({
        type: "REQUEST",
        event,
      }),
    );

    const productId = event.pathParameters?.productId;

    if (!productId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing product id" }),
      };
    }

    const productResult = await dynamoDB.send(
      new GetCommand({ TableName: PRODUCTS_TABLE, Key: { id: productId } }),
    );

    const product = productResult.Item;

    if (!product) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: `Product with id "${productId} is not found."`,
      };
    }

    const stockResult = await dynamoDB.send(
      new GetCommand({
        TableName: STOCKS_TABLE,
        Key: { product_id: productId },
      }),
    );

    const stock = stockResult.Item || { count: 0 };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ ...product, count: stock.count }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
