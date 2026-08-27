import type { CitizenTask } from '@/types/task';
import type { CitizenDocument, ResolutionRoute } from '@/types/document';
import { getDatabase } from '@/lib/database';
import { id as newId, nowIso } from '@/lib/utils';
import { notify } from '@/lib/notifications';
import { sendDemoEmail } from '@/lib/email/demo-mailbox';
import { documentDefinition } from '@/data/demo/document-catalogue';
import { advanceTask } from './engine';
import { requirementProgress, updateRequirement } from './requirements';

/**
 * Background completion.
 *
 * When a document goes off to a simulated office, it comes back on its own —
 * the citizen does not have to sit and watch it. Rather than relying on a
 * timer that dies with the process, every task carries `completeAt`, and any
 * read of the citizen's work settles whatever is now due. That keeps progress
 * moving across restarts, and works the same on a serverless host.
 */
export async function settleBackgroundWork(userId: string): Promise<boolean> {
  const db = getDatabase();
  const tasks = await db.listTasks(userId);
  const due = tasks.filter(
    (task) =>
      task.serviceType === 'DOCUMENT' &&
      task.status === 'PROCESSING' &&
      typeof task.completeAt === 'string' &&
      new Date(task.completeAt).getTime() <= Date.now(),
  );
  if (due.length === 0) return false;

  for (const task of due) {
    await completeDocumentTask(task);
  }
  return true;
}

async function completeDocumentTask(task: CitizenTask): Promise<void> {
  const db = getDatabase();
  const documentKey = String(task.data.documentKey ?? '');
  const route = String(task.data.route ?? 'never_applied') as ResolutionRoute;
  const definition = documentDefinition(documentKey);
  const profile = await db.getProfile(task.userId);

  // A retrieval request produces a number, not a paper: share it back.
  if (task.data.mode === 'retrieve_number') {
    const number = String(task.data.shareNumber ?? '');
    const label = String(task.data.shareLabel ?? `${definition.label} number`);
    await advanceTask({
      taskId: task.id,
      complete: ['processing', 'done'],
      currentStep: 'done',
      status: 'COMPLETED',
      completeAt: null,
      timeline: { label: `${label} retrieved`, tone: 'success' },
      nextActionLabel: null,
      nextActionPrompt: null,
    });
    await notify({
      userId: task.userId,
      title: `Your ${label}`,
      body: `${definition.issuedBy} shared your number: ${number}. Please keep it private.`,
      tone: 'success',
      taskId: task.id,
    });
    await sendDemoEmail({
      userId: task.userId,
      to: profile.email,
      subject: `Your ${label}`,
      body: `${definition.issuedBy} has shared your ${label} in response to your request.\n\nYour number: ${number}\n\nPlease keep it private and do not share it with anyone.`,
      taskId: task.id,
    });
    return;
  }

  // A complaint does not produce a paper — it produces an answer.
  if (route === 'problem') {
    await advanceTask({
      taskId: task.id,
      complete: ['processing', 'done'],
      currentStep: 'done',
      status: 'COMPLETED',
      completeAt: null,
      timeline: { label: 'The office answered your complaint', tone: 'success' },
      nextActionLabel: null,
      nextActionPrompt: null,
    });
    if (task.parentTaskId) {
      await updateRequirement(task.parentTaskId, documentKey, {
        state: 'ACTION_REQUIRED',
        note: 'Your complaint was answered. You can try getting this paper again.',
      });
    }
    await notify({
      userId: task.userId,
      title: `Your ${definition.label} complaint was answered`,
      body: `The office has replied. You can now try to get your ${definition.label} again.`,
      tone: 'action_required',
      taskId: task.id,
      actionPrompt: `I need my ${definition.label.toLowerCase()}`,
      actionLabel: 'Try again',
    });
    await sendDemoEmail({
      userId: task.userId,
      to: profile.email,
      subject: `${definition.label} complaint — answered`,
      body: `Your complaint about your ${definition.label} has been answered by ${definition.issuedBy}. You can now try getting the document again inside NammaSahaay.`,
      taskId: task.id,
    });
    return;
  }

  // Everything else ends with the document sitting in the citizen's papers.
  const document: CitizenDocument = {
    id: newId('doc'),
    userId: task.userId,
    name: definition.label,
    fileName: `${definition.label.replace(/\s+/g, '_')}.pdf`,
    category: documentKey === 'aadhaar' ? 'identity' : 'government',
    purposes: [definition.purpose],
    source: 'generated',
    sourceLabel: `From ${definition.issuedBy}`,
    issuedOn: nowIso().slice(0, 10),
    addedAt: nowIso(),
    verification: 'demo_verified',
    mimeType: 'application/pdf',
    sizeLabel: '140 KB',
    isDemoDocument: true,
    summary: `Issued through NammaSahaay after your ${routeWord(route)}.`,
  };
  await db.addDocument(document);

  await advanceTask({
    taskId: task.id,
    complete: ['processing', 'done'],
    currentStep: 'done',
    status: 'COMPLETED',
    completeAt: null,
    documents: [document.id],
    data: { documentId: document.id },
    timeline: { label: `${definition.label} is ready`, tone: 'success' },
    nextActionLabel: null,
    nextActionPrompt: null,
  });

  if (!task.parentTaskId) {
    await notify({
      userId: task.userId,
      title: `Your ${definition.label} is ready`,
      body: `It has been saved with your other papers.`,
      tone: 'success',
      taskId: task.id,
      actionPrompt: 'Show my papers',
      actionLabel: 'See it',
    });
    await sendDemoEmail({
      userId: task.userId,
      to: profile.email,
      subject: `${definition.label} ready`,
      body: `Your ${definition.label} has been added to your papers in NammaSahaay.`,
      taskId: task.id,
    });
    return;
  }

  // Move the parent on, and tell the citizen exactly where it now stands.
  const parent = await updateRequirement(task.parentTaskId, documentKey, {
    state: 'AVAILABLE_AFTER_PROCESSING',
    documentId: document.id,
    note: null,
  });
  if (!parent) return;

  const progress = requirementProgress(parent);
  const remaining = progress.total - progress.ready;

  await notify({
    userId: task.userId,
    title: `Your ${definition.label} is ready`,
    body: progress.allReady
      ? `All ${progress.total} papers for your ${parent.title.toLowerCase()} are now ready.`
      : `${progress.ready} of ${progress.total} papers ready for your ${parent.title.toLowerCase()}. ${remaining} still to come.`,
    tone: progress.allReady ? 'action_required' : 'success',
    taskId: parent.id,
    actionPrompt: `Continue my ${parent.title.toLowerCase()}`,
    actionLabel: progress.allReady ? 'Review it' : 'See progress',
  });

  await sendDemoEmail({
    userId: task.userId,
    to: profile.email,
    subject: progress.allReady
      ? `${parent.title} — all papers ready`
      : `${definition.label} ready`,
    body: progress.allReady
      ? `All ${progress.total} papers for your ${parent.title.toLowerCase()} are now ready.\n\nYour application is ready for you to check and send.`
      : `Your ${definition.label} is ready.\n\nYour ${parent.title.toLowerCase()} is still waiting for ${remaining} more paper${remaining === 1 ? '' : 's'}. Once ${remaining === 1 ? 'it is' : 'they are'} ready, your application will carry on.`,
    taskId: parent.id,
  });
}

function routeWord(route: ResolutionRoute): string {
  switch (route) {
    case 'lost':
      return 'request for a new copy';
    case 'update':
      return 'correction request';
    case 'already_applied':
      return 'earlier application';
    default:
      return 'application';
  }
}

/** Puts a child task into the waiting state, due at the given time. */
export function dueIn(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}
