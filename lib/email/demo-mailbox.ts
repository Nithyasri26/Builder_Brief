import type { DemoEmail } from '@/types/email';
import { getDatabase } from '@/lib/database';
import { getEmailProvider } from './index';
import { id as newId, nowIso } from '@/lib/utils';

/**
 * Records a message the product would have emailed, and keeps a copy the
 * citizen can actually read inside the app. In a practice app an email that
 * goes nowhere is invisible, and an invisible notification teaches nothing.
 */
export async function sendDemoEmail(input: {
  userId: string;
  to: string;
  subject: string;
  body: string;
  attachment?: string;
  taskId?: string;
}): Promise<DemoEmail> {
  const email: DemoEmail = {
    id: newId('mail'),
    userId: input.userId,
    to: input.to,
    subject: input.subject,
    body: input.body,
    attachment: input.attachment,
    createdAt: nowIso(),
    taskId: input.taskId,
  };

  await getDatabase().addEmail(email);
  try {
    await getEmailProvider().send({
      to: input.to,
      subject: input.subject,
      body: input.body,
      attachmentName: input.attachment,
    });
  } catch {
    // The in-app copy is what the citizen sees; a provider failure is not
    // worth interrupting a workflow for.
  }
  return email;
}
