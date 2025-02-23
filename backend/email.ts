import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";

const sesClient = new SESv2Client();

interface EmailAttachment {
	fileName: string;
	contentType: string;
	base64Content: string;
}

export async function sendEmailWithAttachment({
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

export async function sendDownloadLink({
  to,
  title,
  downloadUrl,
}: {
  to: string;
  title: string;
  downloadUrl: string;
}) {
  const emailCommand = new SendEmailCommand({
    FromEmailAddress: "guideg6@gmail.com",
    Destination: {
      ToAddresses: [to],
    },
    Content: {
      Simple: {
        Subject: {
          Data: `Download Link for ${title}`,
        },
        Body: {
          Html: {
            Data: `
              <h2>Your download is ready</h2>
              <p>File: ${title}</p>
              <p>Your file was too large to send via email. You can download it here:</p>
              <p><a href="${downloadUrl}">Download your file</a></p>
              <p><small>This download link will expire in 24 hours.</small></p>
            `,
          },
          Text: {
            Data: `
              Your download is ready
              File: ${title}
              
              Your file was too large to send via email. You can download it here:
              ${downloadUrl}
              
              This download link will expire in 24 hours.
            `,
          },
        },
      },
    },
  });

  return sesClient.send(emailCommand);
}

export async function sendFailedProcessing({
    to,
    title,
    error,
    url,
  }: {
    to: string;
    title: string;
    error: string;
    url: string;
  }) {
    const emailCommand = new SendEmailCommand({
      FromEmailAddress: "guideg6@gmail.com",
      Destination: {
        ToAddresses: [to],
      },
      Content: {
        Simple: {
          Subject: {
            Data: `Processing Failed: ${title}`,
          },
          Body: {
            Html: {
              Data: `
                <h2>Download Processing Failed</h2>
                <p>We encountered an error while processing your download request.</p>
                
                <h3>Details:</h3>
                <ul>
                  <li><strong>File:</strong> ${title}</li>
                  <li><strong>Source:</strong> ${url}</li>
                  <li><strong>Error:</strong> ${error}</li>
                </ul>
                
                <p>Please try again later or contact support if the issue persists.</p>
                <p><small>If you continue to experience issues, try downloading directly from YouTube.</small></p>
              `,
            },
            Text: {
              Data: `
                Download Processing Failed
                
                We encountered an error while processing your download request.
                
                Details:
                - File: ${title}
                - Source: ${url}
                - Error: ${error}
                
                Please try again later or contact support if the issue persists.
                
                If you continue to experience issues, try downloading directly from YouTube.
              `,
            },
          },
        },
      },
    });
  
    return sesClient.send(emailCommand);
  }