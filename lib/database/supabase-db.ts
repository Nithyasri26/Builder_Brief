import type { Database } from './types';
import { databaseConfig } from '@/lib/config';
import { buildSeed } from './seed';
import { demoCitizen, demoConnectedServices } from '@/data/demo/citizen';
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

interface PayloadRow<T> {
  payload: T;
}

/**
 * Minimal PostgREST client. Supabase exposes every table over PostgREST, so
 * the adapter needs no vendor SDK — one fetch wrapper keeps the dependency
 * surface (and the cold-start cost) small.
 *
 * Server-side only: the service role key must never reach the browser.
 */
class PostgrestClient {
  constructor(
    private readonly url: string,
    private readonly key: string,
  ) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: this.key,
      Authorization: `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  async select<T>(table: string, query: string): Promise<T[]> {
    const res = await fetch(`${this.url}/rest/v1/${table}?${query}`, {
      headers: this.headers(),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Supabase select ${table} failed: ${res.status}`);
    return (await res.json()) as T[];
  }

  async insert<T>(table: string, row: Record<string, unknown>): Promise<T[]> {
    const res = await fetch(`${this.url}/rest/v1/${table}`, {
      method: 'POST',
      headers: this.headers({ Prefer: 'return=representation,resolution=merge-duplicates' }),
      body: JSON.stringify(row),
    });
    if (!res.ok) throw new Error(`Supabase insert ${table} failed: ${res.status}`);
    return (await res.json()) as T[];
  }

  async update<T>(table: string, filter: string, patch: Record<string, unknown>): Promise<T[]> {
    const res = await fetch(`${this.url}/rest/v1/${table}?${filter}`, {
      method: 'PATCH',
      headers: this.headers({ Prefer: 'return=representation' }),
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`Supabase update ${table} failed: ${res.status}`);
    return (await res.json()) as T[];
  }

  async remove(table: string, filter: string): Promise<void> {
    const res = await fetch(`${this.url}/rest/v1/${table}?${filter}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Supabase delete ${table} failed: ${res.status}`);
  }
}

function first<T>(rows: PayloadRow<T>[]): T | null {
  return rows.length > 0 ? rows[0].payload : null;
}

/**
 * Postgres-backed implementation of the same Database contract used by the
 * in-memory demo store. Selected automatically when the Supabase environment
 * variables are present.
 */
export class SupabaseDatabase implements Database {
  readonly id = 'supabase';
  private readonly client: PostgrestClient;

  constructor() {
    const config = databaseConfig();
    const key = config.serviceRoleKey || config.anonKey;
    this.client = new PostgrestClient(config.url.replace(/\/$/, ''), key);
  }

  // --- profile ------------------------------------------------------
  async getProfile(userId: string): Promise<CitizenProfile> {
    const rows = await this.client.select<PayloadRow<CitizenProfile>>(
      'profiles',
      `user_id=eq.${userId}&select=payload&limit=1`,
    );
    const profile = first(rows);
    if (profile) return profile;
    // First run against an empty database: write the synthetic demo profile.
    await this.writeProfile({ ...demoCitizen, id: userId });
    return { ...demoCitizen, id: userId };
  }

  private async writeProfile(profile: CitizenProfile): Promise<void> {
    await this.client.insert('users', {
      id: profile.id,
      email: profile.email,
      mobile: profile.mobile,
      is_demo: true,
    });
    await this.client.insert('profiles', {
      user_id: profile.id,
      name: profile.name,
      age: profile.age,
      gender: profile.gender,
      state: profile.state,
      city: profile.city,
      marital_status: profile.maritalStatus,
      employment_status: profile.employmentStatus,
      education: profile.education,
      annual_household_income: profile.annualHouseholdIncome,
      payload: profile,
      updated_at: nowIso(),
    });
  }

  async updateProfile(userId: string, patch: Partial<CitizenProfile>): Promise<CitizenProfile> {
    const current = await this.getProfile(userId);
    const next: CitizenProfile = { ...current, ...patch, id: userId, isSyntheticDemoData: true };
    await this.client.update('profiles', `user_id=eq.${userId}`, {
      name: next.name,
      state: next.state,
      city: next.city,
      marital_status: next.maritalStatus,
      employment_status: next.employmentStatus,
      annual_household_income: next.annualHouseholdIncome,
      payload: next,
      updated_at: nowIso(),
    });
    return next;
  }

  /**
   * Connection state is a property of the adapter layer, not citizen data,
   * so it is served from configuration rather than stored per row.
   */
  async listConnectedServices(): Promise<ConnectedService[]> {
    return demoConnectedServices.map((service) => ({ ...service }));
  }

  async touchConnectedService(): Promise<void> {
    // No stored state for simulated connections.
  }

  // --- conversations ------------------------------------------------
  async listConversations(userId: string): Promise<Conversation[]> {
    const rows = await this.client.select<PayloadRow<Conversation>>(
      'conversations',
      `user_id=eq.${userId}&select=payload&order=updated_at.desc`,
    );
    return rows.map((row) => row.payload);
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    const rows = await this.client.select<PayloadRow<Conversation>>(
      'conversations',
      `id=eq.${conversationId}&select=payload&limit=1`,
    );
    return first(rows);
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
    await this.client.insert('conversations', {
      id: conversation.id,
      user_id: userId,
      title,
      preview: '',
      created_at: conversation.createdAt,
      updated_at: conversation.updatedAt,
      payload: conversation,
    });
    return conversation;
  }

  async updateConversation(
    conversationId: string,
    patch: Partial<Conversation>,
  ): Promise<Conversation | null> {
    const current = await this.getConversation(conversationId);
    if (!current) return null;
    const next: Conversation = { ...current, ...patch, updatedAt: patch.updatedAt ?? nowIso() };
    await this.client.update('conversations', `id=eq.${conversationId}`, {
      title: next.title,
      preview: next.preview,
      updated_at: next.updatedAt,
      payload: next,
    });
    return next;
  }

  async listMessages(conversationId: string): Promise<ChatMessage[]> {
    const rows = await this.client.select<PayloadRow<ChatMessage>>(
      'messages',
      `conversation_id=eq.${conversationId}&select=payload&order=created_at.asc`,
    );
    return rows.map((row) => row.payload);
  }

  async appendMessage(message: ChatMessage): Promise<ChatMessage> {
    await this.client.insert('messages', {
      id: message.id,
      conversation_id: message.conversationId,
      role: message.role,
      content: message.content,
      created_at: message.createdAt,
      payload: message,
    });
    return message;
  }

  // --- documents ----------------------------------------------------
  async listDocuments(userId: string): Promise<CitizenDocument[]> {
    const rows = await this.client.select<PayloadRow<CitizenDocument>>(
      'documents',
      `user_id=eq.${userId}&select=payload&order=added_at.desc`,
    );
    if (rows.length === 0) {
      const seed = buildSeed();
      for (const document of seed.documents) {
        await this.addDocument({ ...document, userId });
      }
      return seed.documents.map((document) => ({ ...document, userId }));
    }
    return rows.map((row) => row.payload);
  }

  async getDocument(documentId: string): Promise<CitizenDocument | null> {
    const rows = await this.client.select<PayloadRow<CitizenDocument>>(
      'documents',
      `id=eq.${documentId}&select=payload&limit=1`,
    );
    return first(rows);
  }

  async addDocument(document: CitizenDocument): Promise<CitizenDocument> {
    await this.client.insert('documents', {
      id: document.id,
      user_id: document.userId,
      name: document.name,
      file_name: document.fileName,
      category: document.category,
      source: document.source,
      verification: document.verification,
      purposes: document.purposes,
      added_at: document.addedAt,
      payload: document,
    });
    return document;
  }

  async listDigiLockerDocuments(userId: string): Promise<DigiLockerDocument[]> {
    const rows = await this.client.select<PayloadRow<DigiLockerDocument>>(
      'digilocker_documents',
      `user_id=eq.${userId}&select=payload`,
    );
    if (rows.length === 0) {
      const seed = buildSeed();
      for (const document of seed.digiLocker) {
        await this.client.insert('digilocker_documents', {
          id: `${userId}:${document.id}`,
          user_id: userId,
          name: document.name,
          issuer: document.issuer,
          imported: document.imported,
          payload: document,
        });
      }
      return seed.digiLocker;
    }
    return rows.map((row) => row.payload);
  }

  async markDigiLockerImported(userId: string, digiLockerId: string): Promise<void> {
    const rowId = `${userId}:${digiLockerId}`;
    const rows = await this.client.select<PayloadRow<DigiLockerDocument>>(
      'digilocker_documents',
      `id=eq.${rowId}&select=payload&limit=1`,
    );
    const current = first(rows);
    if (!current) return;
    const next = { ...current, imported: true };
    await this.client.update('digilocker_documents', `id=eq.${rowId}`, {
      imported: true,
      payload: next,
    });
  }

  // --- tasks --------------------------------------------------------
  async listTasks(userId: string): Promise<CitizenTask[]> {
    const rows = await this.client.select<PayloadRow<CitizenTask>>(
      'tasks',
      `user_id=eq.${userId}&select=payload&order=updated_at.desc`,
    );
    return rows.map((row) => row.payload);
  }

  async getTask(taskId: string): Promise<CitizenTask | null> {
    const rows = await this.client.select<PayloadRow<CitizenTask>>(
      'tasks',
      `id=eq.${taskId}&select=payload&limit=1`,
    );
    return first(rows);
  }

  async createTask(task: CitizenTask): Promise<CitizenTask> {
    await this.client.insert('tasks', {
      id: task.id,
      user_id: task.userId,
      conversation_id: task.conversationId,
      service_type: task.serviceType,
      workflow_id: task.workflowId,
      title: task.title,
      status: task.status,
      current_step: task.currentStep,
      application_id: task.applicationId,
      created_at: task.createdAt,
      updated_at: task.updatedAt,
      payload: task,
    });
    return task;
  }

  async updateTask(taskId: string, patch: Partial<CitizenTask>): Promise<CitizenTask | null> {
    const current = await this.getTask(taskId);
    if (!current) return null;
    const next: CitizenTask = { ...current, ...patch, updatedAt: nowIso() };
    await this.client.update('tasks', `id=eq.${taskId}`, {
      status: next.status,
      current_step: next.currentStep,
      application_id: next.applicationId,
      title: next.title,
      updated_at: next.updatedAt,
      payload: next,
    });
    return next;
  }

  // --- complaints ---------------------------------------------------
  async listComplaints(userId: string): Promise<Complaint[]> {
    const rows = await this.client.select<PayloadRow<Complaint>>(
      'complaints',
      `user_id=eq.${userId}&select=payload&order=created_at.desc`,
    );
    return rows.map((row) => row.payload);
  }

  async getComplaint(complaintId: string): Promise<Complaint | null> {
    const rows = await this.client.select<PayloadRow<Complaint>>(
      'complaints',
      `id=eq.${complaintId}&select=payload&limit=1`,
    );
    return first(rows);
  }

  async createComplaint(complaint: Complaint): Promise<Complaint> {
    await this.client.insert('complaints', {
      id: complaint.id,
      user_id: complaint.userId,
      task_id: complaint.taskId,
      department: complaint.department,
      subject: complaint.subject,
      description: complaint.description,
      status: complaint.status,
      reference: complaint.reference,
      created_at: complaint.createdAt,
      updated_at: complaint.updatedAt,
      payload: complaint,
    });
    return complaint;
  }

  async updateComplaint(complaintId: string, patch: Partial<Complaint>): Promise<Complaint | null> {
    const current = await this.getComplaint(complaintId);
    if (!current) return null;
    const next: Complaint = { ...current, ...patch, updatedAt: nowIso() };
    await this.client.update('complaints', `id=eq.${complaintId}`, {
      subject: next.subject,
      description: next.description,
      status: next.status,
      reference: next.reference,
      updated_at: next.updatedAt,
      payload: next,
    });
    return next;
  }

  // --- notifications ------------------------------------------------
  async listNotifications(userId: string): Promise<CitizenNotification[]> {
    const rows = await this.client.select<PayloadRow<CitizenNotification>>(
      'notifications',
      `user_id=eq.${userId}&select=payload&order=created_at.desc`,
    );
    return rows.map((row) => row.payload);
  }

  async addNotification(notification: CitizenNotification): Promise<CitizenNotification> {
    await this.client.insert('notifications', {
      id: notification.id,
      user_id: notification.userId,
      task_id: notification.taskId ?? null,
      title: notification.title,
      body: notification.body,
      tone: notification.tone,
      read: notification.read,
      created_at: notification.createdAt,
      payload: notification,
    });
    return notification;
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    const rows = await this.client.select<PayloadRow<CitizenNotification>>(
      'notifications',
      `id=eq.${notificationId}&select=payload&limit=1`,
    );
    const current = first(rows);
    if (!current) return;
    await this.client.update('notifications', `id=eq.${notificationId}`, {
      read: true,
      payload: { ...current, read: true },
    });
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    const notifications = await this.listNotifications(userId);
    await Promise.all(
      notifications.filter((n) => !n.read).map((n) => this.markNotificationRead(n.id)),
    );
  }

  // --- downloads ----------------------------------------------------
  async listDownloads(userId: string): Promise<DownloadFile[]> {
    const rows = await this.client.select<PayloadRow<DownloadFile>>(
      'downloads',
      `user_id=eq.${userId}&select=payload&order=created_at.desc`,
    );
    return rows.map((row) => row.payload);
  }

  async getDownload(downloadId: string): Promise<DownloadFile | null> {
    const rows = await this.client.select<PayloadRow<DownloadFile>>(
      'downloads',
      `id=eq.${downloadId}&select=payload&limit=1`,
    );
    return first(rows);
  }

  async addDownload(file: DownloadFile): Promise<DownloadFile> {
    await this.client.insert('downloads', {
      id: file.id,
      user_id: file.userId,
      task_id: file.taskId ?? null,
      file_name: file.fileName,
      title: file.title,
      kind: file.kind,
      created_at: file.createdAt,
      payload: file,
    });
    return file;
  }

  // --- train searches -----------------------------------------------
  async saveTrainSearch(search: TrainSearch): Promise<TrainSearch> {
    await this.client.insert('train_searches', {
      id: search.id,
      user_id: search.userId,
      origin: search.from,
      destination: search.to,
      travel_date: search.date,
      passengers: search.passengers,
      created_at: search.createdAt,
      payload: search,
    });
    return search;
  }

  async getTrainSearch(searchId: string): Promise<TrainSearch | null> {
    const rows = await this.client.select<PayloadRow<TrainSearch>>(
      'train_searches',
      `id=eq.${searchId}&select=payload&limit=1`,
    );
    return first(rows);
  }

  // --- emails -------------------------------------------------------
  async listEmails(userId: string): Promise<DemoEmail[]> {
    const rows = await this.client.select<PayloadRow<DemoEmail>>(
      'emails',
      `user_id=eq.${userId}&select=payload&order=created_at.desc`,
    );
    return rows.map((row) => row.payload);
  }

  async addEmail(email: DemoEmail): Promise<DemoEmail> {
    await this.client.insert('emails', {
      id: email.id,
      user_id: email.userId,
      task_id: email.taskId ?? null,
      subject: email.subject,
      created_at: email.createdAt,
      payload: email,
    });
    return email;
  }

  // --- audit --------------------------------------------------------
  async addAuditEvent(event: AuditEvent): Promise<void> {
    await this.client.insert('audit_events', {
      id: event.id,
      user_id: event.userId,
      task_id: event.taskId ?? null,
      event_type: event.eventType,
      metadata: event.metadata,
      created_at: event.timestamp,
    });
  }

  async listAuditEvents(userId: string, limit = 50): Promise<AuditEvent[]> {
    const rows = await this.client.select<{
      id: string;
      user_id: string;
      task_id: string | null;
      event_type: AuditEvent['eventType'];
      metadata: AuditEvent['metadata'];
      created_at: string;
    }>('audit_events', `user_id=eq.${userId}&order=created_at.desc&limit=${limit}`);
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      taskId: row.task_id ?? undefined,
      eventType: row.event_type,
      metadata: row.metadata,
      timestamp: row.created_at,
    }));
  }

  // --- demo control -------------------------------------------------
  async reset(userId: string): Promise<void> {
    const filter = `user_id=eq.${userId}`;
    for (const table of [
      'audit_events',
      'downloads',
      'notifications',
      'train_searches',
      'emails',
      'complaints',
      'scheme_matches',
      'tasks',
      'digilocker_documents',
      'documents',
      'conversations',
    ]) {
      await this.client.remove(table, filter);
    }
    const seed = buildSeed();
    for (const conversation of seed.conversations) {
      await this.client.insert('conversations', {
        id: conversation.id,
        user_id: userId,
        title: conversation.title,
        preview: conversation.preview,
        created_at: conversation.createdAt,
        updated_at: conversation.updatedAt,
        payload: { ...conversation, userId },
      });
      for (const message of seed.messages[conversation.id] ?? []) {
        await this.appendMessage(message);
      }
    }
    for (const document of seed.documents) {
      await this.addDocument({ ...document, userId });
    }
    for (const notification of seed.notifications) {
      await this.addNotification({ ...notification, userId });
    }
  }
}
