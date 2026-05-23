import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "node:path";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";

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

    const itemsQueue = new sqs.Queue(this, "catalogItemsQueue", {});
    const catalogBatchProcessLambda = new NodejsFunction(
      this,
      "catalogBatchProcess",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "handler",
        entry: path.join(__dirname, "./lambdas/catalogBatchProcess.ts"),
        environment: {
          PRODUCTS_TABLE: "shop_products",
          STOCKS_TABLE: "shop_stock",
        },
      },
    );
    productsTable.grantWriteData(catalogBatchProcessLambda);
    stocksTable.grantWriteData(catalogBatchProcessLambda);
    itemsQueue.grantConsumeMessages(catalogBatchProcessLambda);
    catalogBatchProcessLambda.addEventSource(
      new lambdaEventSources.SqsEventSource(itemsQueue, {
        batchSize: 5,
        reportBatchItemFailures: true,
        maxBatchingWindow: cdk.Duration.seconds(30),
      }),
    );

    new cdk.CfnOutput(this, "CatalogQueueUrl", {
      value: itemsQueue.queueUrl,
      exportName: "CatalogQueueUrl",
    });
    new cdk.CfnOutput(this, "CatalogQueueArn", {
      value: itemsQueue.queueArn,
      exportName: "CatalogQueueArn",
    });

    new cdk.CfnOutput(this, "ProductsApiUrl", {
      value: api.url,
    });
  }
}
