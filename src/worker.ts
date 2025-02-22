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
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { convertToMp3 } from "./util";
import { exec } from "node:child_process";
import type { SQSEvent, SQSHandler, Context } from "aws-lambda";

const s3Client = new S3Client({});
const sesClient = new SESv2Client();
const MAX_FILE_SIZE = 40 * 1024 * 1024;

interface ProxyRequest {
	url: string;
	title: string;
	email: string;
}

export const handler: SQSHandler = async (
	req: SQSEvent,
	context: Context,
): Promise<void> => {
	console.log("req:", context);
	// console.log(req.requestContext);
	// console.log('req:', req)
	const { url, title, email } = JSON.parse(req.Records[0].body);
	const fileName = title.replace(/[^a-zA-Z0-9.-]/g, "_"); // Sanitize filename

	try {
		const getCommand = new GetObjectCommand({
			Bucket: Resource.YTDLBucket.name,
			Key: fileName,
		});
		const existingFile = await s3Client.send(getCommand);

		if (existingFile) {
			// File exists, get the content and send email
			const fileBuffer = await existingFile.Body?.transformToByteArray();
			if (fileBuffer) {
				const base64File = Buffer.from(fileBuffer).toString("base64");

				await sendEmailWithAttachment({
					to: email,
					title,
					url,
					attachment: {
						fileName: fileName,
						contentType: existingFile.ContentType || "application/octet-stream",
						base64Content: base64File,
					},
				});

				return {
					success: true,
					message: `Existing file sent to ${email}`,
					metadata: {
						s3Key: fileName,
						title,
						originalUrl: url,
						contentType: existingFile.ContentType,
						contentLength: fileBuffer.length,
					},
				};
			}
		}
	} catch (error) {
		if (!(error instanceof Error)) throw new Error(String(error));

		if (!("Code" in error) || error.Code !== "NoSuchKey") {
			console.error("S3 check error:", error);
			throw error;
		}
		console.log("fetchng");

		const response = await fetch(url);
		console.log("response status:", response.status);
		if (!response.ok) {
			return {
				error: `Failed to download file: ${response.status} ${response.statusText}`,
			};
		}

		const arrayBuffer = await response.arrayBuffer();
		const fileBuffer = Buffer.from(arrayBuffer);
		console.log("fileBuffer.byteLength:", fileBuffer.byteLength);
		if (fileBuffer.byteLength > MAX_FILE_SIZE) {
			return {
				error: "File size exceeds maximum allowed size of 40MB",
			};
		}

		// Convert to Base64
		// const base64File = Buffer.from(fileBuffer).toString("base64");
		const mp3Buffer = convertToMp3(fileBuffer);
		console.log("mp3Buffer length:", mp3Buffer.byteLength);
		const base64File = mp3Buffer.toString("base64");

		await sendEmailWithAttachment({
			to: email,
			title,
			url,
			attachment: {
				fileName: `${fileName}.mp3`,
				contentType: "audio/mpeg",
				base64Content: base64File,
			},
		});

		const s3Key = `${fileName}.mp3`;
		const uploadCommand = new PutObjectCommand({
			Bucket: Resource.YTDLBucket.name,
			Key: s3Key,
			Body: mp3Buffer,
			ContentType: "audio/mpeg",
			Metadata: {
				title,
				originalUrl: url,
				sentTo: email,
			},
		});

		await s3Client.send(uploadCommand);

		return {
			success: true,
			message: `File sent to ${email}`,
			metadata: {
				s3Key,
				title,
				originalUrl: url,
				contentType: "audio/mpeg",
				contentLength: mp3Buffer.byteLength,
			},
		};
	}
};

interface EmailAttachment {
	fileName: string;
	contentType: string;
	base64Content: string;
}

async function sendEmailWithAttachment({
	to,
	title,
	url,
	attachment,
}: {
	to: string;
	title: string;
	url: string;
	attachment: EmailAttachment;
}) {
	const emailCommand = new SendEmailCommand({
		FromEmailAddress: "guideg6@gmail.com",
		Destination: {
			ToAddresses: [to],
		},
		Content: {
			Raw: {
				Data: new Uint8Array(
					Buffer.from(
						[
							"From: guideg6@gmail.com",
							`To: ${to}`,
							`Subject: Download ${title}`,
							"MIME-Version: 1.0",
							'Content-Type: multipart/mixed; boundary="boundary"',
							"",
							"--boundary",
							"Content-Type: text/html; charset=utf-8",
							"Content-Transfer-Encoding: 7bit",
							"",
							`<h2>Your file is attached</h2>
                            <p>File: ${title}</p>`,
							"",
							"--boundary",
							`Content-Type: ${attachment.contentType}`,
							"Content-Transfer-Encoding: base64",
							`Content-Disposition: attachment; filename="${attachment.fileName}"`,
							"",
							attachment.base64Content,
							"",
							"--boundary--",
						].join("\r\n"),
					),
				),
			},
		},
	});

	return sesClient.send(emailCommand);
}

export function checkFfmpeg(): Promise<boolean> {
	const command = "which ffmpeg";

	return new Promise((resolve) => {
		exec(command, (error) => {
			resolve(!error);
		});
	});
}
