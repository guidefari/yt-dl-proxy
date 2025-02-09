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
    email: string
}

export async function handler(req) {
// console.log('req:', req)
const {url, title, email} = JSON.parse(req.Records[0].body)
console.log('url, title, email:', url, title, email)

try {
    // Download the file
    const response = await fetch(url);
    if (!response.ok) {
      return { 
        error: `Failed to download file: ${response.status} ${response.statusText}` 
      }
    }

    const fileBuffer = await response.arrayBuffer();
    if (fileBuffer.byteLength > MAX_FILE_SIZE) {
      return { 
        error: 'File size exceeds maximum allowed size of 40MB' 
      }
    }

    // Convert to Base64
    const base64File = Buffer.from(fileBuffer).toString('base64');
    const fileName = title.replace(/[^a-zA-Z0-9.-]/g, '_'); // Sanitize filename

    // Send email with attachment
    const emailCommand = new SendEmailCommand({
      FromEmailAddress: "guideg6@gmail.com", // Replace with your verified SES sender
      Destination: {
        ToAddresses: [email],
      },
      Content: {
        Simple: {
          Subject: {
            Data: `Your file: ${title}`,
          },
          Body: {
            Html: {
              Data: `
                <h2>Your file is attached</h2>
                <p>File: ${title}</p>
                <p>Original URL: ${url}</p>
              `,
            },
            Text: {
              Data: `
                Your file is attached
                File: ${title}
                Original URL: ${url}
              `,
            },
          },
        },
        // Raw: {
        //   Data: Buffer.from(
        //     [
        //       'MIME-Version: 1.0',
        //       'Content-Type: multipart/mixed; boundary="boundary"',
        //       '',
        //       '--boundary',
        //       'Content-Type: text/html; charset=utf-8',
        //       '',
        //       `<h2>Your file is attached</h2>
        //        <p>File: ${title}</p>
        //        <p>Original URL: ${url}</p>`,
        //       '',
        //       '--boundary',
        //       `Content-Type: ${response.headers.get('content-type') || 'application/octet-stream'}`,
        //       'Content-Transfer-Encoding: base64',
        //       `Content-Disposition: attachment; filename="${fileName}"`,
        //       '',
        //       base64File,
        //       '',
        //       '--boundary--',
        //     ].join('\r\n')
        //   )
        // }
      },
    });

    await sesClient.send(emailCommand);

    // Optional: Still save to S3 as backup
    const s3Key = `${Date.now()}-${crypto.randomUUID()}`;
    const uploadCommand = new PutObjectCommand({
      Bucket: Resource.YTDLBucket.name,
      Key: s3Key,
      Body: Buffer.from(fileBuffer),
      ContentType: response.headers.get('content-type') || 'application/octet-stream',
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
        contentType: response.headers.get('content-type'),
        contentLength: fileBuffer.byteLength,
      }
    }

  } catch (error) {
    console.error('Processing error:', error);
    return { error: 'Failed to process request' }
  }
// throw new Error("not implemented");
}

// const app = new Hono();


// app.post("/", async (c) => {
// 	const { url, title, email } = await c.req.json<ProxyRequest>();
// 	console.log('in worker', url, title, email)

// 	if (!url || !title) {
// 		return c.json({ error: "Missing required parameters" }, 400);
// 	}

	
// });

// Optional: Add endpoint to get the download URL for a specific key
// app.get('/:key', async (c) => {
//   const key = c.req.param('key');

//   try {
//     const command = new GetObjectCommand({
//       Bucket: Resource.YTDLBucket.name,
//       Key: key,
//     });

//     const presignedUrl = await getSignedUrl(s3Client, command, {
//       expiresIn: 3600, // URL expires in 1 hour
//     });

//     return c.json({
//       success: true,
//       downloadUrl: presignedUrl,
//     });
//   } catch (error) {
//     console.error('Download URL generation error:', error);
//     return c.json({ error: 'Failed to generate download URL' }, 500);
//   }
// });

// export const handler = handle(app);
