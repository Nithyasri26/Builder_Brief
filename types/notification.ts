export type NotificationTone = 'info' | 'success' | 'warning' | 'action_required';

export interface CitizenNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  tone: NotificationTone;
  createdAt: string;
  read: boolean;
  taskId?: string;
  /** Tapping the notification can drop the citizen back into the conversation. */
  actionPrompt?: string;
  actionLabel?: string;
}
