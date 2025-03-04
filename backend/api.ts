import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { Resource } from "sst";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import ytdl from "@distube/ytdl-core";
import { extractId } from "./util";
import { s3Service } from "./bucket";

const app = new Hono();
const _sqsClient = new SQSClient();

interface ProxyRequest {
	url: string;
	title: string;
	email: string;
}


app.post("/", async (c) => {
	const { url, title, email } = await c.req.json<ProxyRequest>();


	await _sqsClient.send(
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
app.get("/read/:key", async (c) => {
	const key = c.req.param("key");

	try {
		const presignedUrl = await s3Service.getSignedDownloadUrl(key);

		return c.json({
			success: true,
			downloadUrl: presignedUrl,
		});
	} catch (error) {
		console.error("Download URL generation error:", error);
		return c.json({ error: "Failed to generate download URL" }, 500);
	}
});

app.get("/health", async (c) => {
	return c.status(200);
});

app.post("/trigger", async (c) => {
	const { url, action } = await c.req.json();

	if (!url) {
		return c.json({ error: "URL is required" }, 400);
	}

	const videoId = extractId(url);

	// const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip')

	if (!videoId) {
		return c.json({ error: "Invalid YouTube URL" }, 400);
	}

	try {
		const agentOptions = {
			pipelining: 5,
			maxRedirections: 0,
			localAddress: "127.0.0.1",
		};
		const cookies = await s3Service.getFile("cookies.json")
		const cookieString = await cookies.Body?.transformToString()
		const cookiesData = cookieString ? JSON.parse(cookieString) : null;
		const agent = ytdl.createAgent(cookiesData, agentOptions);
		const info = await ytdl.getInfo(url, {agent});
		const audioFormats = ytdl.filterFormats(info.formats, "audioonly");

		const uniqueFormats = new Map(
			audioFormats
				.filter((format) => format.container === "mp4")
				.map((format) => [`${format.container}-${format.codecs}`, format]),
		);
		const { url: dlUrl } = Array.from(uniqueFormats.values()).reduce(
			(prev, current) =>
				(prev.audioBitrate || 0) > (current.audioBitrate || 0) ? prev : current,
		);

		if (action === "download") {
			const response = await app.request("/", {
				method: "POST",
				body: JSON.stringify({
					title: info.videoDetails.title,
					url: dlUrl,
					email: "guideg6@gmail.com",
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			return c.json({
				message: "Download started successfully",
				title: info.videoDetails.title,
				embed: info.videoDetails.embed,
			});
		}

		return c.json({
			title: info.videoDetails.title,
			embed: info.videoDetails.embed,
			formats: Array.from(uniqueFormats.values()).map(
				({
					audioBitrate,
					url,
					contentLength,
					approxDurationMs,
					codecs,
					container,
				}) => ({
					audioBitrate,
					codecs,
					mimeType: container,
					url,
					contentLength,
					approxDurationMs,
				}),
			),
		});
	} catch (err) {
		console.error("Error processing request:", err);
		return c.json(
			{
				error: "Failed to retrieve video information",
				details: err instanceof Error ? err.message : "Unknown error",
			},
			500,
		);
	}
});

export const handler = handle(app);
