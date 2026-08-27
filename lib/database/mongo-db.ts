import { type Collection } from 'mongodb';
import type { Database } from './types';
import { getDb } from './mongo-client';
import { buildSeed } from './seed';
import { demoCitizen, demoConnectedServices, DEMO_USER_ID } from '@/data/demo/citizen';
import { blankProfile } from '@/lib/auth/blank-profile';
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

/**
 * MongoDB implementation of the Database contract.
 *
 * Each collection stores the typed record as the document itself, with `_id`
 * set to the record's own id. There is no ORM and no mapping layer: what the
 * application works with is what the database holds, which keeps rich nested
 * structures (a chat message's content blocks, a task's timeline and step
 * data) natural rather than something to flatten and rebuild.
 */

const COLLECTIONS = {
  profiles: 'profiles',
  conversations: 'conversations',
  messages: 'messages',
  documents: 'documents',
  digilocker: 'digilocker_documents',
  tasks: 'tasks',
  complaints: 'complaints',
  notifications: 'notifications',
  downloads: 'downloads',
  trainSearches: 'train_searches',
  emails: 'emails',
  auditEvents: 'audit_events',
} as const;

/** A stored record: the domain object plus the _id Mongo requires. */
type Stored<T> = T & { _id: string };

function strip<T>(document: Stored<T> | null): T | null {
  if (!document) return null;
  const { _id: _ignored, ...rest } = document as Stored<T> & { _id: string };
  return rest as T;
}

function stripAll<T>(documents: Stored<T>[]): T[] {
  return documents.map((document) => strip(document) as T);
}

export class MongoDatabase implements Database {
  readonly id = 'mongodb';

  private async collection<T>(name: string): Promise<Collection<Stored<T>>> {
    const db = await getDb();
    return db.collection<Stored<T>>(name as string) as unknown as Collection<Stored<T>>;
  }

  // --- profile ------------------------------------------------------
  async getProfile(userId: string): Promise<CitizenProfile> {
    const profiles = await this.collection<CitizenProfile>(COLLECTIONS.profiles);
    const existing = strip(await profiles.findOne({ _id: userId }));
    if (existing) return existing;

    // The demo citizen is seeded on first access so the "try the demo" path
    // works with zero setup. A registered account, by contrast, has its profile
    // written explicitly at sign-up and must NOT inherit the demo persona.
    if (userId === DEMO_USER_ID) {
      const profile: CitizenProfile = { ...demoCitizen, id: userId };
      await profiles.insertOne({ ...profile, _id: userId } as Stored<CitizenProfile>);
      await this.seedFor(userId);
      return profile;
    }
    return blankProfile(userId);
  }

  async updateProfile(userId: string, patch: Partial<CitizenProfile>): Promise<CitizenProfile> {
    const current = await this.getProfile(userId);
    const next: CitizenProfile = { ...current, ...patch, id: userId, isSyntheticDemoData: true };
    const profiles = await this.collection<CitizenProfile>(COLLECTIONS.profiles);
    await profiles.replaceOne({ _id: userId }, { ...next, _id: userId } as Stored<CitizenProfile>, {
      upsert: true,
    });
    return next;
  }

  /**
   * Connection state belongs to the adapter layer, not to citizen data, so it
   * is served from configuration rather than stored per row.
   */
  async listConnectedServices(): Promise<ConnectedService[]> {
    return demoConnectedServices.map((service) => ({ ...service }));
  }

  async touchConnectedService(): Promise<void> {
    // No stored state for simulated connections.
  }

  // --- conversations + messages -------------------------------------
  async listConversations(userId: string): Promise<Conversation[]> {
    const conversations = await this.collection<Conversation>(COLLECTIONS.conversations);
    const rows = await conversations.find({ userId }).sort({ updatedAt: -1 }).toArray();
    return stripAll(rows);
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    const conversations = await this.collection<Conversation>(COLLECTIONS.conversations);
    return strip(await conversations.findOne({ _id: conversationId }));
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
    const conversations = await this.collection<Conversation>(COLLECTIONS.conversations);
    await conversations.insertOne({ ...conversation, _id: conversation.id } as Stored<Conversation>);
    return conversation;
  }

  async updateConversation(
    conversationId: string,
    patch: Partial<Conversation>,
  ): Promise<Conversation | null> {
    const conversations = await this.collection<Conversation>(COLLECTIONS.conversations);
    const result = await conversations.findOneAndUpdate(
      { _id: conversationId },
      { $set: { ...patch, updatedAt: patch.updatedAt ?? nowIso() } },
      { returnDocument: 'after' },
    );
    return strip(result as Stored<Conversation> | null);
  }

  async listMessages(conversationId: string): Promise<ChatMessage[]> {
    const messages = await this.collection<ChatMessage>(COLLECTIONS.messages);
    const rows = await messages.find({ conversationId }).sort({ createdAt: 1 }).toArray();
    return stripAll(rows);
  }

  async appendMessage(message: ChatMessage): Promise<ChatMessage> {
    const messages = await this.collection<ChatMessage>(COLLECTIONS.messages);
    await messages.insertOne({ ...message, _id: message.id } as Stored<ChatMessage>);
    return message;
  }

  // --- documents ----------------------------------------------------
  async listDocuments(userId: string): Promise<CitizenDocument[]> {
    const documents = await this.collection<CitizenDocument>(COLLECTIONS.documents);
    const rows = await documents.find({ userId }).sort({ addedAt: -1 }).toArray();
    return stripAll(rows);
  }

  async getDocument(documentId: string): Promise<CitizenDocument | null> {
    const documents = await this.collection<CitizenDocument>(COLLECTIONS.documents);
    return strip(await documents.findOne({ _id: documentId }));
  }

  async addDocument(document: CitizenDocument): Promise<CitizenDocument> {
    const documents = await this.collection<CitizenDocument>(COLLECTIONS.documents);
    await documents.replaceOne(
      { _id: document.id },
      { ...document, _id: document.id } as Stored<CitizenDocument>,
      { upsert: true },
    );
    return document;
  }

  async listDigiLockerDocuments(userId: string): Promise<DigiLockerDocument[]> {
    const wallet = await this.collection<DigiLockerDocument & { userId: string }>(
      COLLECTIONS.digilocker,
    );
    const rows = await wallet.find({ userId }).sort({ name: 1 }).toArray();
    return stripAll(rows).map(({ userId: _owner, ...rest }) => rest as DigiLockerDocument);
  }

  async markDigiLockerImported(userId: string, digiLockerId: string): Promise<void> {
    const wallet = await this.collection<DigiLockerDocument & { userId: string }>(
      COLLECTIONS.digilocker,
    );
    await wallet.updateOne({ _id: `${userId}:${digiLockerId}` }, { $set: { imported: true } });
  }

  // --- tasks --------------------------------------------------------
  async listTasks(userId: string): Promise<CitizenTask[]> {
    const tasks = await this.collection<CitizenTask>(COLLECTIONS.tasks);
    const rows = await tasks.find({ userId }).sort({ updatedAt: -1 }).toArray();
    return stripAll(rows);
  }

  async getTask(taskId: string): Promise<CitizenTask | null> {
    const tasks = await this.collection<CitizenTask>(COLLECTIONS.tasks);
    return strip(await tasks.findOne({ _id: taskId }));
  }

  async createTask(task: CitizenTask): Promise<CitizenTask> {
    const tasks = await this.collection<CitizenTask>(COLLECTIONS.tasks);
    await tasks.insertOne({ ...task, _id: task.id } as Stored<CitizenTask>);
    return task;
  }

  async updateTask(taskId: string, patch: Partial<CitizenTask>): Promise<CitizenTask | null> {
    const tasks = await this.collection<CitizenTask>(COLLECTIONS.tasks);
    const result = await tasks.findOneAndUpdate(
      { _id: taskId },
      { $set: { ...patch, updatedAt: nowIso() } },
      { returnDocument: 'after' },
    );
    return strip(result as Stored<CitizenTask> | null);
  }

  // --- complaints ---------------------------------------------------
  async listComplaints(userId: string): Promise<Complaint[]> {
    const complaints = await this.collection<Complaint>(COLLECTIONS.complaints);
    const rows = await complaints.find({ userId }).sort({ createdAt: -1 }).toArray();
    return stripAll(rows);
  }

  async getComplaint(complaintId: string): Promise<Complaint | null> {
    const complaints = await this.collection<Complaint>(COLLECTIONS.complaints);
    return strip(await complaints.findOne({ _id: complaintId }));
  }

  async createComplaint(complaint: Complaint): Promise<Complaint> {
    const complaints = await this.collection<Complaint>(COLLECTIONS.complaints);
    await complaints.insertOne({ ...complaint, _id: complaint.id } as Stored<Complaint>);
    return complaint;
  }

  async updateComplaint(complaintId: string, patch: Partial<Complaint>): Promise<Complaint | null> {
    const complaints = await this.collection<Complaint>(COLLECTIONS.complaints);
    const result = await complaints.findOneAndUpdate(
      { _id: complaintId },
      { $set: { ...patch, updatedAt: nowIso() } },
      { returnDocument: 'after' },
    );
    return strip(result as Stored<Complaint> | null);
  }

  // --- notifications ------------------------------------------------
  async listNotifications(userId: string): Promise<CitizenNotification[]> {
    const notifications = await this.collection<CitizenNotification>(COLLECTIONS.notifications);
    const rows = await notifications.find({ userId }).sort({ createdAt: -1 }).toArray();
    return stripAll(rows);
  }

  async addNotification(notification: CitizenNotification): Promise<CitizenNotification> {
    const notifications = await this.collection<CitizenNotification>(COLLECTIONS.notifications);
    await notifications.insertOne({
      ...notification,
      _id: notification.id,
    } as Stored<CitizenNotification>);
    return notification;
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    const notifications = await this.collection<CitizenNotification>(COLLECTIONS.notifications);
    await notifications.updateOne({ _id: notificationId }, { $set: { read: true } });
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    const notifications = await this.collection<CitizenNotification>(COLLECTIONS.notifications);
    await notifications.updateMany({ userId, read: false }, { $set: { read: true } });
  }

  // --- downloads ----------------------------------------------------
  async listDownloads(userId: string): Promise<DownloadFile[]> {
    const downloads = await this.collection<DownloadFile>(COLLECTIONS.downloads);
    const rows = await downloads.find({ userId }).sort({ createdAt: -1 }).toArray();
    return stripAll(rows);
  }

  async getDownload(downloadId: string): Promise<DownloadFile | null> {
    const downloads = await this.collection<DownloadFile>(COLLECTIONS.downloads);
    return strip(await downloads.findOne({ _id: downloadId }));
  }

  async addDownload(file: DownloadFile): Promise<DownloadFile> {
    const downloads = await this.collection<DownloadFile>(COLLECTIONS.downloads);
    // One entry per generated file: asking for the same document twice should
    // refresh the entry, not fill the list with duplicates.
    const existing = strip(await downloads.findOne({ userId: file.userId, fileName: file.fileName }));
    if (existing) {
      const merged = { ...file, id: existing.id };
      await downloads.replaceOne(
        { _id: existing.id },
        { ...merged, _id: existing.id } as Stored<DownloadFile>,
      );
      return merged;
    }
    await downloads.insertOne({ ...file, _id: file.id } as Stored<DownloadFile>);
    return file;
  }

  // --- train searches -----------------------------------------------
  async saveTrainSearch(search: TrainSearch): Promise<TrainSearch> {
    const searches = await this.collection<TrainSearch>(COLLECTIONS.trainSearches);
    await searches.insertOne({ ...search, _id: search.id } as Stored<TrainSearch>);
    return search;
  }

  async getTrainSearch(searchId: string): Promise<TrainSearch | null> {
    const searches = await this.collection<TrainSearch>(COLLECTIONS.trainSearches);
    return strip(await searches.findOne({ _id: searchId }));
  }

  // --- emails -------------------------------------------------------
  async listEmails(userId: string): Promise<DemoEmail[]> {
    const emails = await this.collection<DemoEmail>(COLLECTIONS.emails);
    const rows = await emails.find({ userId }).sort({ createdAt: -1 }).toArray();
    return stripAll(rows);
  }

  async addEmail(email: DemoEmail): Promise<DemoEmail> {
    const emails = await this.collection<DemoEmail>(COLLECTIONS.emails);
    await emails.insertOne({ ...email, _id: email.id } as Stored<DemoEmail>);
    return email;
  }

  // --- audit --------------------------------------------------------
  async addAuditEvent(event: AuditEvent): Promise<void> {
    const events = await this.collection<AuditEvent>(COLLECTIONS.auditEvents);
    await events.insertOne({ ...event, _id: event.id } as Stored<AuditEvent>);
  }

  async listAuditEvents(userId: string, limit = 50): Promise<AuditEvent[]> {
    const events = await this.collection<AuditEvent>(COLLECTIONS.auditEvents);
    const rows = await events.find({ userId }).sort({ timestamp: -1 }).limit(limit).toArray();
    return stripAll(rows);
  }

  // --- seeding and demo control -------------------------------------
  /** Writes the starting synthetic data for a citizen. */
  private async seedFor(userId: string): Promise<void> {
    const seed = buildSeed();

    const conversations = await this.collection<Conversation>(COLLECTIONS.conversations);
    const messages = await this.collection<ChatMessage>(COLLECTIONS.messages);
    for (const conversation of seed.conversations) {
      const owned = { ...conversation, userId };
      await conversations.replaceOne(
        { _id: owned.id },
        { ...owned, _id: owned.id } as Stored<Conversation>,
        { upsert: true },
      );
      for (const message of seed.messages[conversation.id] ?? []) {
        await messages.replaceOne(
          { _id: message.id },
          { ...message, _id: message.id } as Stored<ChatMessage>,
          { upsert: true },
        );
      }
    }

    const documents = await this.collection<CitizenDocument>(COLLECTIONS.documents);
    for (const document of seed.documents) {
      const owned = { ...document, userId };
      await documents.replaceOne(
        { _id: owned.id },
        { ...owned, _id: owned.id } as Stored<CitizenDocument>,
        { upsert: true },
      );
    }

    const wallet = await this.collection<DigiLockerDocument & { userId: string }>(
      COLLECTIONS.digilocker,
    );
    for (const walletDocument of seed.digiLocker) {
      const id = `${userId}:${walletDocument.id}`;
      await wallet.replaceOne(
        { _id: id },
        { ...walletDocument, userId, _id: id } as Stored<DigiLockerDocument & { userId: string }>,
        { upsert: true },
      );
    }

    const notifications = await this.collection<CitizenNotification>(COLLECTIONS.notifications);
    for (const notification of seed.notifications) {
      const owned = { ...notification, userId };
      await notifications.replaceOne(
        { _id: owned.id },
        { ...owned, _id: owned.id } as Stored<CitizenNotification>,
        { upsert: true },
      );
    }
  }

  async reset(userId: string): Promise<void> {
    const db = await getDb();

    // "Start again" means the profile comes back as it was too.
    const profiles = await this.collection<CitizenProfile>(COLLECTIONS.profiles);
    await profiles.deleteOne({ _id: userId });

    // Messages belong to the citizen through their conversation.
    const conversationIds = (await this.listConversations(userId)).map(
      (conversation) => conversation.id,
    );
    await db
      .collection(COLLECTIONS.messages)
      .deleteMany({ conversationId: { $in: conversationIds } });

    for (const name of [
      COLLECTIONS.conversations,
      COLLECTIONS.documents,
      COLLECTIONS.digilocker,
      COLLECTIONS.tasks,
      COLLECTIONS.complaints,
      COLLECTIONS.notifications,
      COLLECTIONS.downloads,
      COLLECTIONS.trainSearches,
      COLLECTIONS.emails,
      COLLECTIONS.auditEvents,
    ]) {
      await db.collection(name).deleteMany({ userId });
    }

    await this.seedFor(userId);
    await this.getProfile(userId);
  }
}
