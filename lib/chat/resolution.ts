import type { CitizenTask } from '@/types/task';
import type { ContentBlock, ProcessingPlan } from '@/types/chat';
import type { CitizenDocument, ResolutionRoute } from '@/types/document';
import { getDatabase } from '@/lib/database';
import { services } from '@/lib/services/registry';
import { advanceTask, startTask } from '@/lib/workflows/engine';
import { childSteps, processingSeconds, readRequirements, requirementProgress, updateRequirement } from '@/lib/workflows/requirements';
import { dueIn } from '@/lib/workflows/background';
import { documentDefinition, ROUTE_LABELS } from '@/data/demo/document-catalogue';
import { demoReference } from '@/lib/services/types';
import { notify } from '@/lib/notifications';
import { sendDemoEmail } from '@/lib/email/demo-mailbox';
import { recordAudit } from '@/lib/security/audit';
import { formatDate, id as newId, nowIso } from '@/lib/utils';
import { noticeBlock, serverAction, promptAction, linkAction, type AssistantDraft } from './presenters';
import type { HandlerContext } from './handlers';

/**
 * One resolution flow, used for every document.
 *
 * A missing paper is never just "upload it". The citizen may hold it, may have
 * applied already, may never have applied, may have lost it, may need it
 * corrected, or may be stuck. Each of those is a different route through the
 * same child task, and several can run at once.
 */

export const DEMO_OTP = '123456';

/** Which profile identifier(s) back a given document. */
const DOC_IDENTIFIER_KEYS: Record<string, string[]> = {
  aadhaar: ['aadhaar'],
  pan: ['pan'],
  voter: ['voter_id', 'voter'],
  voter_id: ['voter_id', 'voter'],
  passport: ['passport'],
  driving_licence: ['driving_licence', 'dl'],
};

/**
 * The ID number already saved on the account for this document, if any.
 *
 * A registered citizen verified with an ID proof at sign-up, so their Aadhaar /
 * PAN / passport number is on file. The resolution flow must never ask them to
 * hunt for a number the account already holds.
 */
export function storedIdentifier(
  profile: { identifiers?: { key: string; label: string; value: string }[]; verifiedVia?: string },
  documentKey: string,
): { label: string; value: string } | null {
  const ids = profile.identifiers ?? [];
  const keys = DOC_IDENTIFIER_KEYS[documentKey];
  if (keys) {
    const found = ids.find((identifier) => keys.includes(identifier.key));
    if (found?.value) return { label: found.label, value: found.value };
  }
  // Generic "identity proof": use whatever primary ID the account was verified with.
  if (documentKey === 'identity') {
    const preferred = profile.verifiedVia
      ? ids.find((identifier) => identifier.key === profile.verifiedVia)
      : undefined;
    const primary =
      preferred ??
      ids.find((identifier) => ['aadhaar', 'pan', 'passport', 'voter_id'].includes(identifier.key)) ??
      ids[0];
    if (primary?.value) return { label: primary.label, value: primary.value };
  }
  return null;
}

/** A plausible demo number for when the account has nothing on file. */
export function demoIdNumber(documentKey: string): string {
  switch (documentKey) {
    case 'aadhaar':
    case 'identity':
      return 'XXXX XXXX 7391';
    case 'pan':
      return 'AXZPN4521K';
    case 'passport':
      return 'P1234567';
    default:
      return 'XXXX-XXXX';
  }
}

/** The question that opens every document resolution. */
export async function askHowToResolve(
  userId: string,
  documentKey: string,
  parentTaskId: string | null,
): Promise<ContentBlock> {
  const definition = documentDefinition(documentKey);
  return {
    type: 'document_options',
    parentTaskId,
    documentKey,
    label: definition.label,
    why: definition.why,
    options: definition.routes.map((route) => ({
      route,
      label: ROUTE_LABELS[route].label(definition.label),
      hint: ROUTE_LABELS[route].hint,
    })),
  };
}

/** Creates the child task that will carry one document to completion. */
export async function startChildTask(
  ctx: HandlerContext,
  input: { documentKey: string; route: ResolutionRoute; parentTaskId: string | null },
): Promise<CitizenTask> {
  const definition = documentDefinition(input.documentKey);

  // If the citizen simply says "I already have my birth certificate" while an
  // application is waiting for exactly that, attach it to the application
  // rather than leaving the two unaware of each other.
  const parentTaskId = input.parentTaskId ?? (await findWaitingParent(ctx.userId, input.documentKey));
  const parent = parentTaskId ? await getDatabase().getTask(parentTaskId) : null;

  const child = await startTask({
    userId: ctx.userId,
    workflowId: 'document_task',
    serviceType: 'DOCUMENT',
    conversationId: ctx.conversationId,
    title: `${definition.label}`,
    parentTaskId,
    requiredFor: parent ? parent.title.toLowerCase() : null,
    data: {
      documentKey: input.documentKey,
      route: input.route,
      steps: childSteps(input.route),
    },
  });

  if (parentTaskId) {
    await updateRequirement(parentTaskId, input.documentKey, {
      state: 'ACTION_REQUIRED',
      childTaskId: child.id,
      note: null,
    });
  }
  return child;
}

/** An unfinished application that is waiting for this exact document. */
async function findWaitingParent(userId: string, documentKey: string): Promise<string | null> {
  const tasks = await getDatabase().listTasks(userId);
  const waiting = tasks.find(
    (task) =>
      task.serviceType !== 'DOCUMENT' &&
      !['COMPLETED', 'CANCELLED'].includes(task.status) &&
      readRequirements(task).some(
        (requirement) =>
          requirement.key === documentKey &&
          ['MISSING', 'ACTION_REQUIRED', 'LOST', 'NEEDS_UPDATE'].includes(requirement.state),
      ),
  );
  return waiting?.id ?? null;
}

/** The next screen after the citizen says which situation they are in. */
export async function routeDraft(
  ctx: HandlerContext,
  child: CitizenTask,
): Promise<AssistantDraft> {
  const route = String(child.data.route) as ResolutionRoute;
  const documentKey = String(child.data.documentKey);
  const definition = documentDefinition(documentKey);
  const db = getDatabase();

  switch (route) {
    case 'have_it': {
      const documents = await db.listDocuments(ctx.userId);
      const candidates = documents.filter(
        (document) =>
          document.purposes.includes(definition.purpose) ||
          document.name.toLowerCase().includes(definition.label.toLowerCase()),
      );
      const locker = (await services.digilocker.listDocuments(ctx.userId)).filter(
        (document) => document.purposes.includes(definition.purpose) && !document.imported,
      );
      await advanceTask({ taskId: child.id, currentStep: 'choose', status: 'WAITING_FOR_USER' });
      return {
        content: `Good. Where is your ${definition.label}?`,
        blocks: [
          {
            type: 'document_picker',
            childTaskId: child.id,
            label: definition.label,
            candidates,
            locker,
          },
        ],
        inputState: 'WAITING_FOR_DOCUMENT',
      };
    }

    case 'already_applied': {
      const profile = await db.getProfile(ctx.userId);
      const stored = storedIdentifier(profile, documentKey);
      await advanceTask({
        taskId: child.id,
        currentStep: 'reference',
        status: 'WAITING_FOR_USER',
        data: { awaiting: 'reference' },
      });
      return {
        content: stored
          ? `Your ${definition.label} number is already saved on your account: ${stored.value}. If you also have the application or enrolment number from when you applied, type it and I will check the status — otherwise tap the button below.`
          : `Do you have the application number they gave you for your ${definition.label}?`,
        blocks: [
          ...(stored
            ? [
                noticeBlock(
                  'I kept this from the ID proof you verified when you created your account.',
                  'success',
                  `Your ${stored.label} number`,
                ),
              ]
            : []),
          {
            type: 'text_input',
            childTaskId: child.id,
            action: 'DOC_REFERENCE',
            field: 'reference',
            label: 'Application number',
            placeholder: 'For example AAD-2026-00088',
            help: 'It is on the slip the office gave you. If you do not have it, tap the button below.',
          },
        ],
        actions: [
          serverAction(
            'I do not have the number',
            'DOC_NO_REFERENCE',
            { childTaskId: child.id },
            'secondary',
          ),
        ],
        inputState: 'WAITING_FOR_USER',
      };
    }

    case 'update': {
      await advanceTask({
        taskId: child.id,
        currentStep: 'details',
        status: 'WAITING_FOR_USER',
      });
      return {
        content: `What needs changing on your ${definition.label}?`,
        actions: [
          serverAction('My mobile number', 'DOC_FIELD', { childTaskId: child.id, field: 'mobile' }, 'secondary'),
          serverAction('My name', 'DOC_FIELD', { childTaskId: child.id, field: 'name' }, 'secondary'),
          serverAction('My address', 'DOC_FIELD', { childTaskId: child.id, field: 'address' }, 'secondary'),
          serverAction('My date of birth', 'DOC_FIELD', { childTaskId: child.id, field: 'dateOfBirth' }, 'secondary'),
        ],
        inputState: 'WAITING_FOR_USER',
      };
    }

    case 'problem': {
      await advanceTask({
        taskId: child.id,
        currentStep: 'details',
        status: 'WAITING_FOR_USER',
        data: { awaiting: 'problem_detail' },
      });
      return {
        content: `I can write a complaint about your ${definition.label}. What went wrong?`,
        blocks: [
          {
            type: 'text_input',
            childTaskId: child.id,
            action: 'DOC_PROBLEM_DETAIL',
            field: 'detail',
            label: 'What happened',
            placeholder: 'For example: the office says my record is not found',
            help: 'A sentence is enough. I will write the rest for you.',
          },
        ],
        inputState: 'WAITING_FOR_USER',
      };
    }

    // never_applied and lost both build an application from the saved profile.
    default:
      return profileConfirmDraft(ctx, child);
  }
}

/** Shows what is already on file so the citizen does not retype it. */
export async function profileConfirmDraft(
  ctx: HandlerContext,
  child: CitizenTask,
): Promise<AssistantDraft> {
  const route = String(child.data.route) as ResolutionRoute;
  const definition = documentDefinition(String(child.data.documentKey));
  const profile = await getDatabase().getProfile(ctx.userId);

  await advanceTask({
    taskId: child.id,
    currentStep: 'details',
    status: 'WAITING_FOR_USER',
    complete: [],
  });

  return {
    content:
      route === 'lost'
        ? `I can ask ${definition.issuedBy} for another copy. I already have your details — please check they are right.`
        : `I can apply for your ${definition.label} here. I already have your details — please check they are right.`,
    blocks: [
      {
        type: 'profile_confirm',
        childTaskId: child.id,
        rows: profileRows(profile),
      },
      noticeBlock(
        'You will see everything once more before anything is sent.',
        'info',
      ),
    ],
    inputState: 'WAITING_FOR_CONFIRMATION',
  };
}

export function profileRows(profile: {
  name: string;
  dateOfBirth: string;
  gender: string;
  city: string;
  state: string;
  mobile: string;
  email: string;
  photo: { available: boolean; label: string };
}) {
  return [
    { key: 'name', label: 'Name', value: profile.name },
    { key: 'dateOfBirth', label: 'Date of birth', value: formatDate(profile.dateOfBirth) },
    { key: 'gender', label: 'Gender', value: profile.gender },
    { key: 'address', label: 'Address', value: `${profile.city}, ${profile.state}` },
    { key: 'mobile', label: 'Mobile', value: profile.mobile },
    { key: 'email', label: 'Email', value: profile.email },
    { key: 'photo', label: 'Photo', value: profile.photo.available ? 'On file' : 'Not on file' },
  ];
}

/** The last screen before anything leaves: everything shown, nothing assumed. */
export async function reviewDraft(ctx: HandlerContext, child: CitizenTask): Promise<AssistantDraft> {
  const route = String(child.data.route) as ResolutionRoute;
  const definition = documentDefinition(String(child.data.documentKey));
  const profile = await getDatabase().getProfile(ctx.userId);

  const rows =
    route === 'update'
      ? [
          { label: 'Document', value: definition.label },
          { label: 'Changing', value: String(child.data.fieldLabel ?? 'a detail') },
          { label: 'From', value: String(child.data.currentValue ?? '') },
          { label: 'To', value: String(child.data.newValue ?? '') },
        ]
      : [
          { label: 'Document', value: definition.label },
          { label: 'Name', value: profile.name },
          { label: 'Date of birth', value: formatDate(profile.dateOfBirth) },
          { label: 'Address', value: `${profile.city}, ${profile.state}` },
          { label: 'Mobile', value: profile.mobile },
          { label: 'Photo', value: profile.photo.available ? 'On file' : 'Not on file' },
        ];

  await advanceTask({
    taskId: child.id,
    currentStep: 'review',
    status: 'WAITING_FOR_CONFIRMATION',
    complete: ['details', 'verify'],
  });

  return {
    content: 'Here is everything before it goes. Nothing is sent until you tap the button.',
    blocks: [
      {
        type: 'review',
        title: route === 'update' ? `Change your ${definition.label}` : `Your ${definition.label} request`,
        rows,
        warning: 'This is a practice app. Nothing is sent to a real government office.',
        confirm: serverAction('Send it', 'DOC_SUBMIT', { childTaskId: child.id }, 'primary'),
        cancel: serverAction('Stop this', 'DOC_CANCEL', { childTaskId: child.id }, 'ghost'),
      },
    ],
    actions: [
      serverAction('Change something', 'DOC_EDIT', { childTaskId: child.id }, 'secondary'),
    ],
    inputState: 'WAITING_FOR_CONFIRMATION',
  };
}

/** Sends the request off and puts the child into background processing. */
export async function submitChild(ctx: HandlerContext, child: CitizenTask): Promise<AssistantDraft> {
  const route = String(child.data.route) as ResolutionRoute;
  const documentKey = String(child.data.documentKey);
  const definition = documentDefinition(documentKey);
  const seconds = processingSeconds(documentKey, route);
  const reference = demoReference(definition.referencePrefix, 124);
  const profile = await getDatabase().getProfile(ctx.userId);

  const updated = await advanceTask({
    taskId: child.id,
    complete: ['details', 'verify', 'review', 'submit'],
    currentStep: 'processing',
    status: 'PROCESSING',
    applicationId: reference,
    completeAt: dueIn(seconds),
    data: { reference },
    timeline: { label: 'Sent to the office', tone: 'success' },
    nextActionLabel: null,
    nextActionPrompt: null,
  });

  if (child.parentTaskId) {
    await updateRequirement(child.parentTaskId, documentKey, {
      state: route === 'problem' ? 'PROCESSING' : 'APPLICATION_SUBMITTED',
      reference,
      note: 'The office is looking at it.',
    });
  }

  await recordAudit({
    eventType: 'APPLICATION_SUBMITTED_DEMO',
    userId: ctx.userId,
    taskId: child.id,
    metadata: { document: documentKey, route },
  });

  if (route === 'problem') {
    const department = String(
      child.data.complaintDepartment ?? `The office that issues your ${definition.label}`,
    );
    const departmentEmail = String(child.data.complaintEmail ?? 'cpgrams@grievance.demo.gov.in');
    const complaint = await getDatabase().createComplaint({
      id: newId('cmp'),
      userId: ctx.userId,
      taskId: child.id,
      category: String(child.data.complaintCategory ?? `${definition.label} problem`),
      department,
      subject: String(child.data.complaintSubject ?? `Problem with my ${definition.label}`),
      description: String(child.data.complaintBody ?? ''),
      status: 'submitted_demo',
      reference,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      officialSourceName: String(child.data.complaintPortalName ?? services.grievance.officialSource.name),
      officialSourceUrl: String(child.data.complaintPortalUrl ?? services.grievance.officialSource.url),
      departmentEmail,
      authority: String(child.data.complaintAuthority ?? department),
      citizenStatement: String(child.data.complaintStatement ?? ''),
    });
    // The complaint is emailed to the department (demo mailbox), and the citizen
    // is told a copy is in their Updates.
    await sendDemoEmail({
      userId: ctx.userId,
      to: departmentEmail,
      subject: `[${reference}] ${complaint.subject}`,
      body: `${complaint.description}\n\n— — —\nComplaint reference: ${reference}\nFiled via NammaSahaay (practice app). Simulated grievance email; no real office received it.`,
      taskId: child.id,
    });
  } else {
    await sendDemoEmail({
      userId: ctx.userId,
      to: profile.email,
      subject: `${definition.label} request sent`,
      body: `Your ${definition.label} request has been sent to ${definition.issuedBy}.\n\nNumber to keep: ${reference}\n\nWe will tell you as soon as it is ready. You do not have to wait here.`,
      taskId: child.id,
    });
  }

  await notify({
    userId: ctx.userId,
    title: `${definition.label} request sent`,
    body: `Number ${reference}. The office is looking at it. We will tell you when it is ready.`,
    tone: 'info',
    taskId: child.id,
  });

  const parentLine = child.parentTaskId
    ? ' You can carry on with anything else in the meantime — I will keep watching this one.'
    : ' You do not have to wait here — I will tell you when it is ready.';

  return {
    content: `Sent. Your ${definition.label} is with ${definition.issuedBy} now.${parentLine}`,
    processing: submissionPlan(definition.label),
    blocks: [
      noticeBlock(`Keep this number safe: ${reference}`, 'success', 'Sent'),
      ...(updated ? [{ type: 'task_progress' as const, task: updated, steps: [] }] : []),
    ],
    inputState: 'BACKGROUND_PROCESSING',
  };
}

/** The staged messages shown while input is locked, for any service call. */
export function submissionPlan(what: string): ProcessingPlan {
  return {
    title: `Sending your ${what.toLowerCase()} request`,
    steps: [
      { label: 'Checking your details', ms: 900 },
      { label: 'Preparing your request', ms: 1000 },
      { label: 'Sending it to the office', ms: 1100 },
    ],
    reassurance: 'Please wait while we finish this step.',
  };
}

export function checkingPlan(what: string): ProcessingPlan {
  return {
    title: what,
    steps: [
      { label: 'Checking your details', ms: 800 },
      { label: 'Looking through your papers', ms: 1000 },
      { label: 'Checking the connected service', ms: 900 },
    ],
    reassurance: "Don't worry. We check everything step by step.",
  };
}

/** Attaches a document the citizen already holds and moves the parent on. */
export async function attachDocument(
  ctx: HandlerContext,
  child: CitizenTask,
  document: CitizenDocument,
): Promise<AssistantDraft> {
  const definition = documentDefinition(String(child.data.documentKey));
  const db = getDatabase();

  // Make sure the paper is filed under the purpose that was asked for, so the
  // next service that needs it finds it too.
  if (!document.purposes.includes(definition.purpose)) {
    await db.addDocument({ ...document, purposes: [...document.purposes, definition.purpose] });
  }

  await advanceTask({
    taskId: child.id,
    complete: ['choose', 'check', 'done'],
    currentStep: 'done',
    status: 'COMPLETED',
    documents: [document.id],
    data: { documentId: document.id },
    timeline: { label: `${definition.label} added`, tone: 'success' },
    nextActionLabel: null,
    nextActionPrompt: null,
  });

  await recordAudit({
    eventType: 'DOCUMENT_REUSED',
    userId: ctx.userId,
    taskId: child.id,
    metadata: { document: String(child.data.documentKey) },
  });

  if (!child.parentTaskId) {
    return {
      content: `Saved. Your ${definition.label} is with your papers.`,
      inputState: 'IDLE',
      suggestions: ['Show my papers'],
    };
  }

  const parent = await updateRequirement(child.parentTaskId, String(child.data.documentKey), {
    state: 'AVAILABLE',
    documentId: document.id,
    note: null,
  });
  if (!parent) return { content: `Saved. Your ${definition.label} is with your papers.` };

  const progress = requirementProgress(parent);
  return {
    content: progress.allReady
      ? `Got it. That was the last paper — your ${parent.title.toLowerCase()} is ready to check.`
      : `Got it. ${progress.ready} of ${progress.total} papers are ready for your ${parent.title.toLowerCase()}.`,
    blocks: [{ type: 'requirements', taskId: parent.id, title: parent.title }],
    actions: progress.allReady
      ? [serverAction('Check my application', 'PARENT_REVIEW', { taskId: parent.id }, 'primary')]
      : outstandingActions(parent),
    inputState: progress.allReady ? 'WAITING_FOR_CONFIRMATION' : 'WAITING_FOR_DOCUMENT',
  };
}

/** Buttons for whatever the parent is still waiting on. */
export function outstandingActions(parent: CitizenTask) {
  const requirements = readRequirements(parent);
  return requirements
    .filter((requirement) => requirement.state === 'MISSING' || requirement.state === 'ACTION_REQUIRED')
    .slice(0, 3)
    .map((requirement) =>
      serverAction(
        `Sort out ${requirement.label}`,
        'RESOLVE_REQUIREMENT',
        { taskId: parent.id, key: requirement.key },
        'primary',
      ),
    );
}

export { documentDefinition, promptAction, linkAction };
