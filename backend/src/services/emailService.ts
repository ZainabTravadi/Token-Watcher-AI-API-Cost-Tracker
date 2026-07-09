import { getConfig } from "../config/env";

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  id: string | null;
  provider: "resend";
  simulated: boolean;
}

export class EmailProviderError extends Error {
  status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "EmailProviderError";
    this.status = status;
  }
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const config = getConfig();
  if (!config.resendApiKey) {
    if (config.nodeEnv === "production") {
      throw new EmailProviderError("Email provider is not configured. Set RESEND_API_KEY.");
    }
    console.info(`[email:simulated] to=${input.to} subject="${input.subject}"`);
    return { id: null, provider: "resend", simulated: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.resendFromEmail,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: Buffer.isBuffer(attachment.content) ? attachment.content.toString("base64") : Buffer.from(attachment.content).toString("base64"),
        content_type: attachment.contentType,
      })),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const retryHint = response.status === 429 ? " Resend rate limit reached; retry later." : "";
    throw new EmailProviderError(`Resend rejected the email.${retryHint} ${body}`.trim(), response.status);
  }

  const body = await response.json().catch(() => ({}));
  return { id: typeof body?.id === "string" ? body.id : null, provider: "resend", simulated: false };
}
