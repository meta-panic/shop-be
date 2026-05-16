import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

const client = new DynamoDBClient({ region: "eu-central-1" });
const dynamoDB = DynamoDBDocumentClient.from(client);

// Griffon dogs 🐶
const products = [
  {
    id: uuidv4(),
    title: "Brussels Griffon",
    description: "Small brown griffon with expressive eyes",
    price: 1200,
  },
  {
    id: uuidv4(),
    title: "Belgian Griffon",
    description: "Orange-black rough coat companion dog",
    price: 1500,
  },
  {
    id: uuidv4(),
    title: "Wirehaired Griffon",
    description: "Athletic hunting griffon with wiry coat",
    price: 1800,
  },
];
const stocks = products.map((product) => ({
  product_id: product.id,
  count: Math.floor(Math.random() * 10) + 1,
}));

async function seed() {
  for (const product of products) {
    await dynamoDB.send(
      new PutCommand({ TableName: "shop_products", Item: product }),
    );
    console.log(`Added a dog: ${product.title}`);
  }

  for (const stock of stocks) {
    await dynamoDB.send(
      new PutCommand({ TableName: "shop_stock", Item: stock }),
    );
    console.log(`Added stock for a dog: ${stock.product_id}`);
  }

  console.log("Finish!");
}

seed().catch(console.error);
