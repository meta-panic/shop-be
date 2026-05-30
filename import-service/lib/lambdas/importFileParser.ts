import { S3Event } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Readable } from "stream";
import csv from "csv-parser";

export const handler = async (event: S3Event): Promise<void> => {
  try {
    console.log(
      JSON.stringify({
        type: "REQUEST",
        event,
      }),
    );

    for (const record of event.Records) {
      const bucketName = record.s3.bucket.name;
      const objectKey = decodeURIComponent(
        record.s3.object.key.replace(/\+/g, " "),
      );

      await parseCSV(bucketName, objectKey);
    }
  } catch (e: any) {
    console.log("Some error happened: ", e.message || e);
  }
};

async function parseCSV(bucketName: string, objectKey: string): Promise<void> {
  const s3Client = new S3Client({});
  const sqsClient = new SQSClient({});
  const getCommand = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
  });
  const response = await s3Client.send(getCommand);

  if (!response.Body) {
    throw new Error(`No body found s3://${bucketName}/${objectKey}`);
  }

  const stream = response.Body as Readable;
  const sendPromises: Promise<any>[] = [];

  await new Promise<void>((resolve, reject) => {
    stream
      .pipe(csv())
      .on("data", (data: Record<string, string>) => {
        console.log("CSV chunk:", data);
        const sendPromise = sqsClient.send(
          new SendMessageCommand({
            QueueUrl: process.env.SQS_QUEUE_URL!,
            MessageBody: JSON.stringify(data),
          }),
        );
        sendPromises.push(sendPromise);
      })
      .on("error", (error: Error) => {
        console.error("Parsing error:", error);
        reject(error);
      })
      .on("end", () => {
        Promise.all(sendPromises)
          .then(() => {
            console.log("Parsing finished");
            resolve();
          })
          .catch((error) => {
            console.error("Failed to send some messages to SQS:", error);
            reject(error);
          });
      });
  });
}
