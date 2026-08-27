import type { Database } from './types';
import { buildSeed } from './seed';
import { demoCitizen, demoConnectedServices, DEMO_USER_ID } from '@/data/demo/citizen';
import type { CitizenProfile, ConnectedService } from '@/types/user';
import type { ChatMessage, Conversation } from '@/types/chat';
import type { CitizenDocument, DigiLockerDocument, DownloadFile } from '@/types/document';
import type { CitizenTask } from '@/types/task';
import type { Complaint } from '@/types/complaint';
import type { CitizenNotification } from '@/types/notification';
import type { TrainSearch } from '@/types/train';
import type { AuditEvent } from '@/types/audit';
import type { DemoEmail } from '@/types/email';
import { nowIso } from '@/lib/utils';
import { blankProfile } from '@/lib/auth/blank-profile';

interface Store {
  profiles: Map<string, CitizenProfile>;
  services: Map<string, ConnectedService[]>;
  conversations: Conversation[];
  messages: Map<string, ChatMessage[]>;
  documents: CitizenDocument[];
  digiLocker: DigiLockerDocument[];
  tasks: CitizenTask[];
  complaints: Complaint[];
  notifications: CitizenNotification[];
  downloads: DownloadFile[];
  trainSearches: TrainSearch[];
  emails: DemoEmail[];
  audit: AuditEvent[];
}

function freshStore(): Store {
  const seed = buildSeed();
  return {
    profiles: new Map([[DEMO_USER_ID, { ...demoCitizen }]]),
    services: new Map([[DEMO_USER_ID, demoConnectedServices.map((s) => ({ ...s }))]]),
    conversations: seed.conversations,
    messages: new Map(Object.entries(seed.messages)),
    documents: seed.documents,
    digiLocker: seed.digiLocker,
    tasks: [],
    complaints: [],
    notifications: seed.notifications,
    downloads: [],
    trainSearches: [],
    emails: [],
    audit: [],
  };
}

/**
 * Next.js dev mode re-evaluates modules on hot reload; keeping the store on
 * globalThis means an in-progress demo journey survives a code change.
 */
const globalStore = globalThis as unknown as { __nammasahaayStore?: Store };
if (!globalStore.__nammasahaayStore) {
  globalStore.__nammasahaayStore = freshStore();
}

function store(): Store {
  if (!globalStore.__nammasahaayStore) {
    globalStore.__nammasahaayStore = freshStore();
  }
  return globalStore.__nammasahaayStore;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * In-memory implementation of the Database contract, seeded with synthetic
 * demo data. This is the default for the prototype so that judges can run the
 * whole journey without provisioning any infrastructure.
 */
export class MemoryDatabase implements Database {
  readonly id = 'memory';

  async getProfile(userId: string): Promise<CitizenProfile> {
    const profile = store().profiles.get(userId);
    // A registered account whose in-memory profile was lost to a restart still
    // gets a valid (empty) profile rather than crashing the whole app.
    if (!profile) return blankProfile(userId);
    return clone(profile);
  }

  async updateProfile(userId: string, patch: Partial<CitizenProfile>): Promise<CitizenProfile> {
    const current = store().profiles.get(userId) ?? blankProfile(userId);
    const next = { ...current, ...patch, id: userId, isSyntheticDemoData: true as const };
    store().profiles.set(userId, next);
    return clone(next);
  }

  async listConnectedServices(userId: string): Promise<ConnectedService[]> {
    return clone(store().services.get(userId) ?? []);
  }

  async touchConnectedService(userId: string, serviceId: string): Promise<void> {
    const services = store().services.get(userId);
    if (!services) return;
    const service = services.find((s) => s.id === serviceId);
    if (service) {
      service.lastCheckedAt = new Date().toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
      });
      service.lastCheckedAt = `Today, ${service.lastCheckedAt}`;
    }
  }

  async listConversations(userId: string): Promise<Conversation[]> {
    return clone(
      store()
        .conversations.filter((c) => c.userId === userId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    const found = store().conversations.find((c) => c.id === conversationId);
    return found ? clone(found) : null;
  }

  async createConversation(userId: string, title: string): Promise<Conversation> {
    const conversation: Conversation = {
      id: `conv_${Math.random().toString(36).slice(2, 10)}`,
      userId,
      title,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      preview: '',
    };
    store().conversations.unshift(conversation);
    store().messages.set(conversation.id, []);
    return clone(conversation);
  }

  async updateConversation(
    conversationId: string,
    patch: Partial<Conversation>,
  ): Promise<Conversation | null> {
    const conversation = store().conversations.find((c) => c.id === conversationId);
    if (!conversation) return null;
    Object.assign(conversation, patch, { updatedAt: patch.updatedAt ?? nowIso() });
    return clone(conversation);
  }

  async listMessages(conversationId: string): Promise<ChatMessage[]> {
    return clone(store().messages.get(conversationId) ?? []);
  }

  async appendMessage(message: ChatMessage): Promise<ChatMessage> {
    const list = store().messages.get(message.conversationId) ?? [];
    list.push(message);
    store().messages.set(message.conversationId, list);
    return clone(message);
  }

  async listDocuments(userId: string): Promise<CitizenDocument[]> {
    return clone(
      store()
        .documents.filter((d) => d.userId === userId)
        .sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
    );
  }

  async getDocument(documentId: string): Promise<CitizenDocument | null> {
    const found = store().documents.find((d) => d.id === documentId);
    return found ? clone(found) : null;
  }

  async addDocument(document: CitizenDocument): Promise<CitizenDocument> {
    store().documents.unshift(document);
    return clone(document);
  }

  async listDigiLockerDocuments(): Promise<DigiLockerDocument[]> {
    return clone(store().digiLocker);
  }

  async markDigiLockerImported(_userId: string, digiLockerId: string): Promise<void> {
    const doc = store().digiLocker.find((d) => d.id === digiLockerId);
    if (doc) doc.imported = true;
  }

  async listTasks(userId: string): Promise<CitizenTask[]> {
    return clone(
      store()
        .tasks.filter((t) => t.userId === userId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );
  }

  async getTask(taskId: string): Promise<CitizenTask | null> {
    const found = store().tasks.find((t) => t.id === taskId);
    return found ? clone(found) : null;
  }

  async createTask(task: CitizenTask): Promise<CitizenTask> {
    store().tasks.unshift(task);
    return clone(task);
  }

  async updateTask(taskId: string, patch: Partial<CitizenTask>): Promise<CitizenTask | null> {
    const task = store().tasks.find((t) => t.id === taskId);
    if (!task) return null;
    Object.assign(task, patch, { updatedAt: nowIso() });
    return clone(task);
  }

  async listComplaints(userId: string): Promise<Complaint[]> {
    return clone(store().complaints.filter((c) => c.userId === userId));
  }

  async getComplaint(complaintId: string): Promise<Complaint | null> {
    const found = store().complaints.find((c) => c.id === complaintId);
    return found ? clone(found) : null;
  }

  async createComplaint(complaint: Complaint): Promise<Complaint> {
    store().complaints.unshift(complaint);
    return clone(complaint);
  }

  async updateComplaint(complaintId: string, patch: Partial<Complaint>): Promise<Complaint | null> {
    const complaint = store().complaints.find((c) => c.id === complaintId);
    if (!complaint) return null;
    Object.assign(complaint, patch, { updatedAt: nowIso() });
    return clone(complaint);
  }

  async listNotifications(userId: string): Promise<CitizenNotification[]> {
    return clone(
      store()
        .notifications.filter((n) => n.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }

  async addNotification(notification: CitizenNotification): Promise<CitizenNotification> {
    store().notifications.unshift(notification);
    return clone(notification);
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    const notification = store().notifications.find((n) => n.id === notificationId);
    if (notification) notification.read = true;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    store()
      .notifications.filter((n) => n.userId === userId)
      .forEach((n) => {
        n.read = true;
      });
  }

  async listDownloads(userId: string): Promise<DownloadFile[]> {
    return clone(
      store()
        .downloads.filter((d) => d.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }

  async getDownload(downloadId: string): Promise<DownloadFile | null> {
    const found = store().downloads.find((d) => d.id === downloadId);
    return found ? clone(found) : null;
  }

  async addDownload(file: DownloadFile): Promise<DownloadFile> {
    const existing = store().downloads.find(
      (d) => d.userId === file.userId && d.fileName === file.fileName,
    );
    if (existing) {
      Object.assign(existing, file, { id: existing.id });
      return clone(existing);
    }
    store().downloads.unshift(file);
    return clone(file);
  }

  async saveTrainSearch(search: TrainSearch): Promise<TrainSearch> {
    store().trainSearches.unshift(search);
    return clone(search);
  }

  async getTrainSearch(searchId: string): Promise<TrainSearch | null> {
    const found = store().trainSearches.find((s) => s.id === searchId);
    return found ? clone(found) : null;
  }

  async listEmails(userId: string): Promise<DemoEmail[]> {
    return clone(
      store()
        .emails.filter((email) => email.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }

  async addEmail(email: DemoEmail): Promise<DemoEmail> {
    store().emails.unshift(email);
    return clone(email);
  }

  async addAuditEvent(event: AuditEvent): Promise<void> {
    store().audit.unshift(event);
    if (store().audit.length > 500) store().audit.length = 500;
  }

  async listAuditEvents(userId: string, limit = 50): Promise<AuditEvent[]> {
    return clone(store().audit.filter((e) => e.userId === userId).slice(0, limit));
  }

  async reset(_userId: string): Promise<void> {
    globalStore.__nammasahaayStore = freshStore();
  }
}
