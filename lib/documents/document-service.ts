import type { CitizenDocument, DocumentCategory, DocumentPurpose, DownloadFile } from '@/types/document';
import { getDatabase } from '@/lib/database';
import { getStorage } from '@/lib/storage';
import { id as newId, nowIso } from '@/lib/utils';
import { recordAudit } from '@/lib/security/audit';
import { passbookPdf, applicationPdf, complaintPdf, ticketPdf, walletDocumentPdf } from './generators';
import { demoPassbook, demoPassbookEntries } from '@/data/demo/epfo';
import { getWorkflow } from '@/lib/workflows/definitions';
import type { TrainOption } from '@/types/train';

/**
 * Documents the citizen holds, and the demo files the product generates.
 * Reuse is the point: workflows ask for a PURPOSE and get back a document
 * the citizen already has, instead of asking for another upload.
 */

export async function findDocumentForPurpose(
  userId: string,
  purpose: DocumentPurpose,
): Promise<CitizenDocument | null> {
  const documents = await getDatabase().listDocuments(userId);
  return documents.find((document) => document.purposes.includes(purpose)) ?? null;
}

export async function documentsForPurposes(
  userId: string,
  purposes: DocumentPurpose[],
): Promise<Record<string, CitizenDocument | null>> {
  const documents = await getDatabase().listDocuments(userId);
  const result: Record<string, CitizenDocument | null> = {};
  for (const purpose of purposes) {
    result[purpose] = documents.find((document) => document.purposes.includes(purpose)) ?? null;
  }
  return result;
}

export async function storeUpload(input: {
  userId: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  category: DocumentCategory;
  purposes: DocumentPurpose[];
  name?: string;
}): Promise<CitizenDocument> {
  const storageKey = `${input.userId}/${newId('file')}-${input.fileName}`;
  await getStorage().put(storageKey, {
    bytes: input.bytes,
    mimeType: input.mimeType,
    fileName: input.fileName,
  });

  const document: CitizenDocument = {
    id: newId('doc'),
    userId: input.userId,
    name: input.name?.trim() || input.fileName.replace(/\.[^.]+$/, ''),
    fileName: input.fileName,
    category: input.category,
    purposes: input.purposes,
    source: 'uploaded',
    sourceLabel: 'Uploaded by you',
    issuedOn: null,
    addedAt: nowIso(),
    verification: 'unverified',
    mimeType: input.mimeType,
    sizeLabel: `${Math.max(1, Math.round(input.bytes.byteLength / 1024))} KB`,
    isDemoDocument: true,
    summary: 'Uploaded in this prototype session.',
    storageKey,
  };

  await getDatabase().addDocument(document);
  await recordAudit({
    eventType: 'DOCUMENT_UPLOADED',
    userId: input.userId,
    metadata: { category: input.category },
  });
  return document;
}

export async function registerDownload(input: {
  userId: string;
  fileName: string;
  title: string;
  kind: DownloadFile['kind'];
  documentId?: string;
  taskId?: string;
}): Promise<DownloadFile> {
  const file: DownloadFile = {
    id: newId('dl'),
    userId: input.userId,
    fileName: input.fileName,
    title: input.title,
    kind: input.kind,
    createdAt: nowIso(),
    sizeLabel: '—',
    documentId: input.documentId,
    taskId: input.taskId,
  };
  return getDatabase().addDownload(file);
}

export interface RenderedFile {
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
}

/** Produces the bytes for a stored document, uploading or generating as needed. */
export async function renderDocument(
  userId: string,
  documentId: string,
): Promise<RenderedFile | null> {
  const db = getDatabase();
  const document = await db.getDocument(documentId);
  if (!document || document.userId !== userId) return null;

  if (document.storageKey) {
    const stored = await getStorage().get(document.storageKey);
    if (stored) {
      return { bytes: stored.bytes, mimeType: stored.mimeType, fileName: document.fileName };
    }
  }

  const profile = await db.getProfile(userId);
  return {
    bytes: walletDocumentPdf(profile, document),
    mimeType: 'application/pdf',
    fileName: document.fileName,
  };
}

/** Produces the bytes for an entry in Downloads. */
export async function renderDownload(
  userId: string,
  downloadId: string,
): Promise<RenderedFile | null> {
  const db = getDatabase();
  const file = await db.getDownload(downloadId);
  if (!file || file.userId !== userId) return null;
  const profile = await db.getProfile(userId);

  if (file.kind === 'pf_passbook') {
    return {
      bytes: passbookPdf(profile, demoPassbook, demoPassbookEntries),
      mimeType: 'application/pdf',
      fileName: file.fileName,
    };
  }

  if (file.kind === 'certificate' && file.documentId) {
    const rendered = await renderDocument(userId, file.documentId);
    if (rendered) return { ...rendered, fileName: file.fileName };
  }

  if (file.kind === 'complaint' && file.taskId) {
    const complaints = await db.listComplaints(userId);
    const complaint = complaints.find((item) => item.taskId === file.taskId);
    if (complaint) {
      return {
        bytes: complaintPdf(profile, complaint),
        mimeType: 'application/pdf',
        fileName: file.fileName,
      };
    }
  }

  if (file.kind === 'ticket' && file.taskId) {
    const task = await db.getTask(file.taskId);
    const train = task?.data.train as TrainOption | undefined;
    if (task && train) {
      return {
        bytes: ticketPdf({
          profile,
          train,
          date: String(task.data.date ?? 'Demo date'),
          passengers: Number(task.data.passengers ?? 1),
          reference: task.applicationId ?? 'RAIL-DEMO',
        }),
        mimeType: 'application/pdf',
        fileName: file.fileName,
      };
    }
  }

  if (file.kind === 'application' && file.taskId) {
    const task = await db.getTask(file.taskId);
    if (task) {
      const workflow = getWorkflow(task.workflowId);
      const documents = await Promise.all(task.documents.map((docId) => db.getDocument(docId)));
      const rows: { label: string; value: string }[] = [
        { label: 'Service', value: workflow.serviceLabel },
        { label: 'Status', value: task.status.replace(/_/g, ' ') },
      ];
      if (task.data.schemeName) rows.push({ label: 'Scheme', value: String(task.data.schemeName) });
      if (task.data.amount) {
        rows.push({
          label: 'Amount',
          value: `Rs. ${Number(task.data.amount).toLocaleString('en-IN')}`,
        });
      }
      return {
        bytes: applicationPdf({
          profile,
          title: task.title,
          reference: task.applicationId ?? 'Not submitted',
          serviceName: workflow.serviceLabel,
          sourceName: sourceFor(task.serviceType).name,
          sourceUrl: sourceFor(task.serviceType).url,
          rows,
          documents: documents.filter(Boolean).map((doc) => (doc as CitizenDocument).name),
          note: 'This record came from a practice app. Nothing was sent to a government office. Use the official service to make a real application.',
        }),
        mimeType: 'application/pdf',
        fileName: file.fileName,
      };
    }
  }

  return null;
}

function sourceFor(serviceType: string): { name: string; url: string } {
  switch (serviceType) {
    case 'EPFO':
      return { name: 'Employees Provident Fund Organisation', url: 'https://www.epfindia.gov.in' };
    case 'PASSPORT':
      return { name: 'Passport Seva', url: 'https://www.passportindia.gov.in' };
    case 'COMPLAINT':
      return { name: 'CPGRAMS', url: 'https://pgportal.gov.in' };
    case 'RAIL':
      return { name: 'IRCTC', url: 'https://www.irctc.co.in' };
    default:
      return { name: 'myScheme', url: 'https://www.myscheme.gov.in' };
  }
}
