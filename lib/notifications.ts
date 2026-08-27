import type { CitizenNotification, NotificationTone } from '@/types/notification';
import { getDatabase } from '@/lib/database';
import { id as newId, nowIso } from '@/lib/utils';

/** Creates a citizen-facing notification. Wording stays plain and specific. */
export async function notify(input: {
  userId: string;
  title: string;
  body: string;
  tone?: NotificationTone;
  taskId?: string;
  actionPrompt?: string;
  actionLabel?: string;
}): Promise<CitizenNotification> {
  const notification: CitizenNotification = {
    id: newId('notif'),
    userId: input.userId,
    title: input.title,
    body: input.body,
    tone: input.tone ?? 'info',
    createdAt: nowIso(),
    read: false,
    taskId: input.taskId,
    actionPrompt: input.actionPrompt,
    actionLabel: input.actionLabel,
  };
  return getDatabase().addNotification(notification);
}

export async function unreadCount(userId: string): Promise<number> {
  const notifications = await getDatabase().listNotifications(userId);
  return notifications.filter((notification) => !notification.read).length;
}
