import type { CitizenProfile, ConnectedService } from '@/types/user';
import type { ChatMessage, Conversation } from '@/types/chat';
import type { CitizenDocument, DigiLockerDocument, DownloadFile } from '@/types/document';
import type { CitizenTask } from '@/types/task';
import type { Complaint } from '@/types/complaint';
import type { CitizenNotification } from '@/types/notification';
import type { TrainSearch } from '@/types/train';
import type { AuditEvent } from '@/types/audit';
import type { DemoEmail } from '@/types/email';

/**
 * The persistence contract for the whole product.
 *
 * Two implementations exist:
 *  - MemoryDatabase   (default for the prototype; seeded synthetic data)
 *  - SupabaseDatabase (Postgres, used when Supabase env vars are present)
 *
 * Application code depends only on this interface.
 */
export interface Database {
  readonly id: string;

  // profile
  getProfile(userId: string): Promise<CitizenProfile>;
  updateProfile(userId: string, patch: Partial<CitizenProfile>): Promise<CitizenProfile>;
  listConnectedServices(userId: string): Promise<ConnectedService[]>;
  touchConnectedService(userId: string, serviceId: string): Promise<void>;

  // conversations + messages
  listConversations(userId: string): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | null>;
  createConversation(userId: string, title: string): Promise<Conversation>;
  updateConversation(id: string, patch: Partial<Conversation>): Promise<Conversation | null>;
  listMessages(conversationId: string): Promise<ChatMessage[]>;
  appendMessage(message: ChatMessage): Promise<ChatMessage>;

  // documents
  listDocuments(userId: string): Promise<CitizenDocument[]>;
  getDocument(id: string): Promise<CitizenDocument | null>;
  addDocument(document: CitizenDocument): Promise<CitizenDocument>;
  listDigiLockerDocuments(userId: string): Promise<DigiLockerDocument[]>;
  markDigiLockerImported(userId: string, digiLockerId: string): Promise<void>;

  // tasks (the citizen task engine)
  listTasks(userId: string): Promise<CitizenTask[]>;
  getTask(id: string): Promise<CitizenTask | null>;
  createTask(task: CitizenTask): Promise<CitizenTask>;
  updateTask(id: string, patch: Partial<CitizenTask>): Promise<CitizenTask | null>;

  // complaints
  listComplaints(userId: string): Promise<Complaint[]>;
  getComplaint(id: string): Promise<Complaint | null>;
  createComplaint(complaint: Complaint): Promise<Complaint>;
  updateComplaint(id: string, patch: Partial<Complaint>): Promise<Complaint | null>;

  // notifications
  listNotifications(userId: string): Promise<CitizenNotification[]>;
  addNotification(notification: CitizenNotification): Promise<CitizenNotification>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;

  // downloads
  listDownloads(userId: string): Promise<DownloadFile[]>;
  getDownload(id: string): Promise<DownloadFile | null>;
  addDownload(file: DownloadFile): Promise<DownloadFile>;

  // train searches
  saveTrainSearch(search: TrainSearch): Promise<TrainSearch>;
  getTrainSearch(id: string): Promise<TrainSearch | null>;

  // emails the product would have sent
  listEmails(userId: string): Promise<DemoEmail[]>;
  addEmail(email: DemoEmail): Promise<DemoEmail>;

  // audit
  addAuditEvent(event: AuditEvent): Promise<void>;
  listAuditEvents(userId: string, limit?: number): Promise<AuditEvent[]>;

  // demo control
  reset(userId: string): Promise<void>;
}
