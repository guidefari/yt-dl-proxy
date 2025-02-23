import { convertToMp3 } from "./util";
import type { SQSEvent, SQSHandler, Context } from "aws-lambda";
import {
	sendDownloadLink,
	sendEmailWithAttachment,
	sendFailedProcessing,
} from "./email";
import { s3Service } from "./bucket";

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
	const { url, title, email } = JSON.parse(req.Records[0].body);
	const fileName = title.replace(/[^a-zA-Z0-9.-]/g, "_"); // Sanitize filename
	const s3Key = `${fileName}.mp3`;

	try {
		const fileExists = await s3Service.fileExists(s3Key);

		if (fileExists) {
			console.log(
				`${fileName} exists in S3. using that instead of new download`,
			);
			const fileBuffer = await s3Service.getFileBuffer(s3Key);
			if (fileBuffer) {
				const base64File = Buffer.from(fileBuffer).toString("base64");

				await sendEmailWithAttachment({
					to: email,
					title,
					url,
					attachment: {
						fileName: fileName,
						contentType: "audio/mpeg",
						base64Content: base64File,
					},
				});
			}
		}

		const response = await fetch(url);

		if (!response.ok) {
			console.log(response.status, response.statusText)
			throw new Error("Failed to download file from youtube servers");
		}

		const arrayBuffer = await response.arrayBuffer();
		const fileBuffer = Buffer.from(arrayBuffer);

		if (fileBuffer.byteLength > MAX_FILE_SIZE) {
			const mp3Buffer = await  convertToMp3(fileBuffer);
			await s3Service.uploadFile({
				key: s3Key,
				body: mp3Buffer,
				contentType: "audio/mpeg",
				metadata: {
					title,
					originalUrl: url,
					sentTo: email,
				},
			});

			const downloadUrl = await s3Service.getSignedDownloadUrl(
				s3Key,
				24 * 60 * 60,
			);

			// Send email with download link
			await sendDownloadLink({
				to: email,
				title,
				downloadUrl,
			});
			return;
		}

		// Convert to Base64
		// const base64File = Buffer.from(fileBuffer).toString("base64");
		const mp3Buffer = await convertToMp3(fileBuffer);
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

		await s3Service.uploadFile({
			key: s3Key,
			body: mp3Buffer,
			contentType: "audio/mpeg",
			metadata: {
				title,
				originalUrl: url,
				sentTo: email,
			},
		});
		return;
	} catch (error) {
		if (!(error instanceof Error)) throw new Error(String(error));
		
		await sendFailedProcessing({
			to: email,
			title,
			url,
			error:
				error instanceof Error
					? error.message
					: "Unknown download error occurred",
		});
	}
};
