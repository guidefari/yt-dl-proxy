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

const s3Client = new S3Client({});
const sesClient = new SESv2Client();
const MAX_FILE_SIZE = 40 * 1024 * 1024;

interface ProxyRequest {
	url: string;
	title: string;
	email: string;
}

export async function handler(req) {
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
						fileName: title,
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
		if (error.Code !== "NoSuchKey") {
			console.error("S3 check error:", error);
			throw error;
		}
        console.log("fetchng")
  
		const response = await fetch(url);
		if (!response.ok) {
			return {
				error: `Failed to download file: ${response.status} ${response.statusText}`,
			};
		}

		const fileBuffer = await response.arrayBuffer();
		if (fileBuffer.byteLength > MAX_FILE_SIZE) {
			return {
				error: "File size exceeds maximum allowed size of 40MB",
			};
		}

		// Convert to Base64
		const base64File = Buffer.from(fileBuffer).toString("base64");

		await sendEmailWithAttachment({
			to: email,
			title,
			url,
			attachment: {
				fileName: title,
				contentType:
					response.headers.get("content-type") || "application/octet-stream",
				base64Content: base64File,
			},
		});

		const s3Key = fileName;
		const uploadCommand = new PutObjectCommand({
			Bucket: Resource.YTDLBucket.name,
			Key: s3Key,
			Body: Buffer.from(fileBuffer),
			ContentType:
				response.headers.get("content-type") || "application/octet-stream",
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
				contentType: response.headers.get("content-type"),
				contentLength: fileBuffer.byteLength,
			},
		};
	}

}

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
							`Content-Disposition: attachment; filename="${attachment.fileName}.${attachment.contentType.split("/")[1]}"`,
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
