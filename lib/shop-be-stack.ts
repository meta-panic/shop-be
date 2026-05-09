import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "node:path";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

export class ShopBeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const getProductsListLambda = new NodejsFunction(this, "getProductsList", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, "./lambdas/getProductsList.ts"),
      handler: "handler",
    });

    const getProductsByIdLambda = new NodejsFunction(this, "getProductsById", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler",
      entry: path.join(__dirname, "./lambdas/getProductsById.ts"),
    });

    const api = new apigateway.RestApi(this, "ProductsApi", {
      restApiName: "Product Catalog API",
      description: "API for product catalog",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

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

    new cdk.CfnOutput(this, "ProductsApiUrl", {
      value: api.url,
    });
  }
}
