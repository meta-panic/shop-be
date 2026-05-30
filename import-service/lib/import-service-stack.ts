import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import { Construct } from "constructs";

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucketName = `aws-griffon-shop-imports-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`;

    const importBucket = s3.Bucket.fromBucketAttributes(this, "ImportBucket", {
      bucketName,
    });

    const catalogItemsQueueArn = cdk.Fn.importValue("CatalogQueueArn");
    const catalogItemsQueueUrl = cdk.Fn.importValue("CatalogQueueUrl");
    const catalogItemsQueue = sqs.Queue.fromQueueArn(
      this,
      "CatalogItemsQueue",
      catalogItemsQueueArn,
    );

    const importProductsFileLambda = new NodejsFunction(
      this,
      "importProductsFile",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(__dirname, "./lambdas/importProductsFile.ts"),
        handler: "handler",
        environment: {
          BUCKET_NAME: importBucket.bucketName,
          REGION: this.region,
        },
      },
    );
    importBucket.grantPut(importProductsFileLambda);

    const parseFileLambda = new NodejsFunction(this, "parseProductsFile", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, "lambdas", "importFileParser.ts"),
      handler: "handler",
      environment: {
        BUCKET_NAME: importBucket.bucketName,
        SQS_QUEUE_URL: catalogItemsQueueUrl,
      },
    });
    importBucket.grantReadWrite(parseFileLambda);
    catalogItemsQueue.grantSendMessages(parseFileLambda);
    importBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      new s3n.LambdaDestination(parseFileLambda),
      { prefix: "uploaded/" },
    );

    const api = new apigateway.RestApi(this, "ImportApi", {
      restApiName: "Import Service API",
      description: "API for product import",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const importResource = api.root.addResource("import");
    importResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(importProductsFileLambda),
    );

    new cdk.CfnOutput(this, "ImportApiUrl", {
      value: api.url,
    });
  }
}
