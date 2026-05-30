import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import * as dotenv from "dotenv";
import * as iam from "aws-cdk-lib/aws-iam";

const dotenvResult = dotenv.config();
const envs: Record<string, string> = dotenvResult.parsed ?? {};

export class AuthorizationServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const basicAuthorizerLambda = new NodejsFunction(this, "basicAuthorizer", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, "lambdas", "basicAuthorizer.ts"),
      handler: "handler",
      environment: {
        ...envs,
      },
    });

    basicAuthorizerLambda.addPermission("ApiGatewayInvoke", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      action: "lambda:InvokeFunction",
    });

    new cdk.CfnOutput(this, "BasicAuthorizerArn", {
      value: basicAuthorizerLambda.functionArn,
      exportName: "BasicAuthorizerArn",
    });
  }
}
