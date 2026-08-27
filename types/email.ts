/** A message the product would have emailed the citizen. */
export interface DemoEmail {
  id: string;
  userId: string;
  to: string;
  subject: string;
  body: string;
  attachment?: string;
  createdAt: string;
  taskId?: string;
}
