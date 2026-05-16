import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "node:path";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

export class ShopBeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const productsTable = dynamodb.Table.fromTableName(
      this,
      "ProductsTable",
      "shop_products",
    );
    const stocksTable = dynamodb.Table.fromTableName(
      this,
      "StocksTable",
      "shop_stock",
    );

    const getProductsListLambda = new NodejsFunction(this, "getProductsList", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, "./lambdas/getProductsList.ts"),
      handler: "handler",
      environment: {
        PRODUCTS_TABLE: "shop_products",
        STOCKS_TABLE: "shop_stock",
      },
    });

    const getProductsByIdLambda = new NodejsFunction(this, "getProductsById", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler",
      entry: path.join(__dirname, "./lambdas/getProductsById.ts"),
      environment: {
        PRODUCTS_TABLE: "shop_products",
        STOCKS_TABLE: "shop_stock",
      },
    });

    const api = new apigateway.RestApi(this, "ProductsApi", {
      restApiName: "Product Catalog API",
      description: "API for product catalog",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    productsTable.grantReadData(getProductsListLambda);
    stocksTable.grantReadData(getProductsListLambda);
    productsTable.grantReadData(getProductsByIdLambda);
    stocksTable.grantReadData(getProductsByIdLambda);

    const createProductLambda = new NodejsFunction(this, "createProduct", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler",
      entry: path.join(__dirname, "./lambdas/createProduct.ts"),
      environment: {
        PRODUCTS_TABLE: "shop_products",
        STOCKS_TABLE: "shop_stock",
      },
    });
    productsTable.grantWriteData(createProductLambda);
    stocksTable.grantWriteData(createProductLambda);

    const productsResource = api.root.addResource("products");

    productsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getProductsListLambda),
    );

    const singleProductResource = productsResource.addResource("{productId}");

    singleProductResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getProductsByIdLambda),
    );

    productsResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(createProductLambda),
    );

    new cdk.CfnOutput(this, "ProductsApiUrl", {
      value: api.url,
    });
  }
}
