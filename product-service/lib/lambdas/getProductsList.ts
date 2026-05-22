import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent } from "aws-lambda";

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE!;
const STOCKS_TABLE = process.env.STOCKS_TABLE!;

export const handler = async (event: APIGatewayProxyEvent) => {
  console.log(
    JSON.stringify({
      type: "REQUEST",
      event,
    }),
  );

  try {
    const productsResult = await dynamoDB.send(
      new ScanCommand({ TableName: PRODUCTS_TABLE }),
    );
    const stocksResult = await dynamoDB.send(
      new ScanCommand({ TableName: STOCKS_TABLE }),
    );

    const products = productsResult.Items || [];
    const stocks = stocksResult.Items || [];

    console.log("products:", JSON.stringify(products));
    console.log("stocks:", JSON.stringify(stocks));

    const productsWithStockCount = products.map((product) => ({
      ...product,
      count:
        stocks.find((stock) => stock.product_id === product.id)?.count || 0,
    }));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(productsWithStockCount),
    };
  } catch (error) {
    console.error(error);

    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
