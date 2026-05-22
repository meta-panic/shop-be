import { S3Event } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import csv from "csv-parser";

export const handler = async (event: S3Event): Promise<void> => {
  try {
    console.log(
      JSON.stringify({
        type: "REQUEST-2",
        event,
      }),
    );

    console.log("S3 event received:", JSON.stringify(event));

    for (const record of event.Records) {
      const bucketName = record.s3.bucket.name;
      const objectKey = decodeURIComponent(
        record.s3.object.key.replace(/\+/g, " "),
      );

      console.log(`Reading file: s3://${bucketName}/${objectKey}`);

      await parseCSV(bucketName, objectKey);
    }
  } catch (e: any) {
    console.log("Some error happened: ", e.message || e);
  }
};

async function parseCSV(bucketName: string, objectKey: string): Promise<void> {
  const s3Client = new S3Client({});
  const getCommand = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
  });
  const response = await s3Client.send(getCommand);

  if (!response.Body) {
    throw new Error(`No body found s3://${bucketName}/${objectKey}`);
  }

  const stream = response.Body as Readable;
  await new Promise<void>((resolve, reject) => {
    stream
      .pipe(csv())
      .on("data", (data: any) => {
        console.log("CSV chunk:", data);
      })
      .on("error", (error: Error) => {
        console.error("Parsing error:", error);
        reject(error);
      })
      .on("end", () => {
        console.log("Parsing finished");
        resolve();
      });
  });
}
