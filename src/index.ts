import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { cors } from "hono/cors";
import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Resource } from "sst";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

const app = new Hono();
const s3Client = new S3Client({});
const client = new SQSClient();

interface ProxyRequest {
	url: string;
	title: string;
	email: string;
}

app.post("/", async (c) => {
	const { url, title, email } = await c.req.json<ProxyRequest>();
	await client.send(
		new SendMessageCommand({
			QueueUrl: Resource.YTDLQ.url,
			MessageBody: JSON.stringify({
				url,
				title,
				email,
			}),
		}),
	);

	return c.json({
		body: "download started",
	});
});

// Optional: Add endpoint to get the download URL for a specific key
app.get("/:key", async (c) => {
	const key = c.req.param("key");

	try {
		const command = new GetObjectCommand({
			Bucket: Resource.YTDLBucket.name,
			Key: key,
		});

		const presignedUrl = await getSignedUrl(s3Client, command, {
			expiresIn: 3600, // URL expires in 1 hour
		});

		return c.json({
			success: true,
			downloadUrl: presignedUrl,
		});
	} catch (error) {
		console.error("Download URL generation error:", error);
		return c.json({ error: "Failed to generate download URL" }, 500);
	}
});

export const handler = handle(app);
