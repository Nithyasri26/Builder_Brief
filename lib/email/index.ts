import { emailConfig, DEMO_MODE } from '@/lib/config';
import type { EmailReceipt } from '@/types/chat';
import { nowIso } from '@/lib/utils';

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  attachmentName?: string;
  attachment?: Uint8Array;
}

export interface EmailProvider {
  readonly id: string;
  isConfigured(): boolean;
  send(message: EmailMessage): Promise<EmailReceipt>;
}

/**
 * Demo provider. Records the send and reports it honestly as a demo email;
 * nothing leaves the machine.
 */
export class DemoEmailProvider implements EmailProvider {
  readonly id = 'demo';

  isConfigured(): boolean {
    return true;
  }

  async send(message: EmailMessage): Promise<EmailReceipt> {
    return {
      to: message.to,
      subject: message.subject,
      attachment: message.attachmentName,
      status: 'demo_sent',
      sentAt: nowIso(),
    };
  }
}

/**
 * Resend implementation, used when EMAIL_API_KEY is present and demo mode is
 * switched off. Same interface, so no calling code changes.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly id = 'resend';

  isConfigured(): boolean {
    return Boolean(emailConfig().apiKey);
  }

  async send(message: EmailMessage): Promise<EmailReceipt> {
    const config = emailConfig();
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.from,
        to: [message.to],
        subject: message.subject,
        text: message.body,
        ...(message.attachment && message.attachmentName
          ? {
              attachments: [
                {
                  filename: message.attachmentName,
                  content: Buffer.from(message.attachment).toString('base64'),
                },
              ],
            }
          : {}),
      }),
    });
    if (!res.ok) throw new Error(`Email send failed: ${res.status}`);
    return {
      to: message.to,
      subject: message.subject,
      attachment: message.attachmentName,
      status: 'demo_sent',
      sentAt: nowIso(),
    };
  }
}

let provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (provider) return provider;
  const resend = new ResendEmailProvider();
  // Demo mode never sends real email, even if a key is present.
  provider = !DEMO_MODE && resend.isConfigured() ? resend : new DemoEmailProvider();
  return provider;
}
