import type {
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from "aws-lambda";

function generatePolicy(
  principalId: string,
  effect: "Allow" | "Deny",
  resource: string,
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };
}

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> => {
  const token = event.authorizationToken;

  if (!token) {
    throw new Error("Unauthorized");
  }

  const { username, password } = parseBasicAuthToken(token);

  const storedPassword = process.env[username];

  console.log("method - ", event.methodArn);
  if (!storedPassword || storedPassword !== password) {
    return generatePolicy(username, "Deny", event.methodArn);
  }

  return generatePolicy(username, "Allow", event.methodArn);
};

function parseBasicAuthToken(token: string): {
  username: string;
  password: string;
} {
  const [scheme, encodedCredentials] = token.split(" ");

  if (!scheme || !encodedCredentials || scheme.toLowerCase() !== "basic") {
    throw new Error("Unauthorized");
  }

  const decodedCredentials = Buffer.from(encodedCredentials, "base64").toString(
    "utf-8",
  );

  const separatorIndex = decodedCredentials.indexOf(":");

  if (separatorIndex === -1) {
    throw new Error("Unauthorized");
  }

  return {
    username: decodedCredentials.substring(0, separatorIndex),
    password: decodedCredentials.substring(separatorIndex + 1),
  };
}
