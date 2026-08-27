import type { IntentResult } from '@/types/ai';
import type { CitizenProfile } from '@/types/user';
import type { CitizenTask } from '@/types/task';
import type { ContentBlock } from '@/types/chat';
import { getDatabase } from '@/lib/database';
import { services, ServiceUnavailableError } from '@/lib/services/registry';
import { ELIGIBILITY_DISCLAIMER } from '@/lib/eligibility/engine';
import {
  advanceTask,
  findOpenTask,
  findResumableTask,
  pauseTask,
  progressOf,
  resumeTask,
  startTask,
} from '@/lib/workflows/engine';
import { registerDownload } from '@/lib/documents/document-service';
import { recordAudit } from '@/lib/security/audit';
import { notify } from '@/lib/notifications';
import { lookupTerm, glossary } from '@/data/demo/glossary';
import { passportRequirements, PASSPORT_SOURCE } from '@/data/demo/passport';
import { EPFO_SOURCE, demoKyc } from '@/data/demo/epfo';
import { DIGILOCKER_SOURCE } from '@/data/demo/documents';
import { RAIL_SOURCE } from '@/data/demo/trains';
import { buildRequirements, readRequirements, requirementProgress } from '@/lib/workflows/requirements';
import { askHowToResolve, checkingPlan, outstandingActions } from './resolution';
import { documentDefinition, matchDocumentKey, matchRoute } from '@/data/demo/document-catalogue';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  DEFAULT_SUGGESTIONS,
  UNAVAILABLE_DRAFT,
  demoSource,
  documentsBlock,
  downloadAction,
  linkAction,
  mergeSituation,
  noticeBlock,
  promptAction,
  serverAction,
  situationFromProfile,
  steps,
  taskProgressBlock,
  type AssistantDraft,
} from './presenters';

export interface HandlerContext {
  userId: string;
  conversationId: string;
  profile: CitizenProfile;
  message: string;
  intent: IntentResult;
}

const PF_FILE = 'PF_Passbook.pdf';

/** A task that asked the citizen a question and is waiting for the answer. */
export async function getAwaitingTask(
  userId: string,
  conversationId: string,
): Promise<CitizenTask | null> {
  const tasks = await getDatabase().listTasks(userId);
  return (
    tasks.find(
      (task) =>
        task.conversationId === conversationId &&
        task.status === 'WAITING_FOR_USER' &&
        typeof task.data.awaiting === 'string',
    ) ?? null
  );
}

// =====================================================================
// Schemes
// =====================================================================

async function handleSchemes(ctx: HandlerContext): Promise<AssistantDraft> {
  const db = getDatabase();
  const documents = await db.listDocuments(ctx.userId);
  const situation = mergeSituation(situationFromProfile(ctx.profile), ctx.intent.situation);

  let matches;
  try {
    matches = await services.schemes.checkPotentialEligibility(situation, documents);
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      return UNAVAILABLE_DRAFT('scheme dataset', 'Are there any government schemes I can get?');
    }
    throw error;
  }

  await recordAudit({
    eventType: 'ELIGIBILITY_CHECKED',
    userId: ctx.userId,
    metadata: { schemesChecked: matches.length, state: situation.state ?? 'unknown' },
  });

  // Offer condolences ONLY when the citizen actually mentions the loss in this
  // conversation — never just because their saved profile says "widowed".
  const mentionedLoss =
    ctx.intent.situation?.maritalStatus === 'widowed' ||
    /\b(passed away|expired|no more|died|death)\b|\bwidow/i.test(ctx.message);
  const opening = mentionedLoss
    ? "I'm sorry for your loss. Let me look for support you may be able to get."
    : 'Let me look for support you may be able to get.';

  const checklist: ContentBlock = {
    type: 'checklist',
    title: 'What I already know about you',
    items: [
      {
        label: `You live in ${situation.state ?? 'a place we do not know yet'}`,
        state: situation.state ? 'done' : 'missing',
      },
      {
        label: `${situation.dependentChildren ?? 0} child to look after`,
        state: situation.dependentChildren !== undefined ? 'done' : 'missing',
      },
      {
        label:
          situation.employmentStatus === 'unemployed'
            ? 'You are not working right now'
            : `Work: ${(situation.employmentStatus ?? 'not known').replace('_', ' ')}`,
        state: situation.employmentStatus ? 'done' : 'missing',
      },
      {
        label:
          situation.annualHouseholdIncome !== undefined
            ? `Household income ${formatCurrency(situation.annualHouseholdIncome)} a year`
            : 'Household income not known',
        state: situation.annualHouseholdIncome !== undefined ? 'done' : 'missing',
      },
    ],
  };

  const potential = matches.filter((match) => match.level === 'potential_match').length;

  const headline =
    potential === 0
      ? 'From what I know so far, nothing looks like a good match.'
      : potential === 1
        ? 'I found 1 programme you may be able to get.'
        : `I found ${potential} programmes you may be able to get.`;

  return {
    content: `${opening}\n\n${headline} I used what I already know about you, so you do not have to answer the same questions again.`,
    steps: steps(['Checking what I know about you', 'Looking for support programmes']),
    blocks: [checklist, { type: 'schemes', matches }, noticeBlock(ELIGIBILITY_DISCLAIMER, 'info')],
    suggestions: [
      potential > 0 ? 'What papers do I need?' : 'What else can you help with?',
      'I also want my PF passbook',
      'Show my documents',
    ],
    title: 'Government Support',
  };
}

// =====================================================================
// Provident fund
// =====================================================================

async function handlePassbook(ctx: HandlerContext): Promise<AssistantDraft> {
  try {
    const { passbook } = await services.epfo.getPassbook(ctx.userId);
    const download = await registerDownload({
      userId: ctx.userId,
      fileName: PF_FILE,
      title: 'Provident fund passbook',
      kind: 'pf_passbook',
    });
    await getDatabase().touchConnectedService(ctx.userId, 'epfo');

    return {
      content: 'Here is your provident fund passbook.',
      steps: steps(['Finding your account', 'Opening your passbook']),
      blocks: [
        {
          type: 'pf_passbook',
          passbook,
          source: demoSource(EPFO_SOURCE.name, EPFO_SOURCE.url, EPFO_SOURCE.lastVerified),
        },
      ],
      actions: [
        linkAction('Open it', `/api/downloads/${download.id}/file?inline=1`, 'secondary'),
        downloadAction('Save a copy', download.id, 'primary'),
        serverAction('Email it to me', 'EMAIL_DOWNLOAD', { downloadId: download.id }, 'secondary'),
      ],
      suggestions: ['I want to take out ₹50,000', 'What does UAN mean?', 'Show my applications'],
      title: 'PF Passbook',
    };
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      return UNAVAILABLE_DRAFT('EPFO', 'I need my PF passbook');
    }
    throw error;
  }
}

async function handleWithdrawal(ctx: HandlerContext): Promise<AssistantDraft> {
  const amount = ctx.intent.entities.amount;
  const openTask = await findOpenTask(ctx.userId, 'pf_withdrawal');

  if (amount && openTask) {
    return startWithdrawalWithAmount(ctx, amount, openTask);
  }
  if (!amount && openTask) {
    return renderTaskStep(ctx, openTask);
  }

  if (!amount) {
    const task = await startTask({
      userId: ctx.userId,
      workflowId: 'pf_withdrawal',
      conversationId: ctx.conversationId,
      data: { awaiting: 'amount' },
    });
    await advanceTask({
      taskId: task.id,
      complete: ['account'],
      status: 'WAITING_FOR_USER',
      nextActionLabel: 'Enter amount',
      nextActionPrompt: 'Continue my PF withdrawal',
    });
    const { passbook } = await services.epfo.getPassbook(ctx.userId);
    return {
      content: `You have ${formatCurrency(passbook.balance)} in your account. How much would you like to take out?`,
      suggestions: ['₹50,000', '₹25,000', 'Show my PF passbook'],
      title: 'PF Withdrawal',
    };
  }

  return startWithdrawalWithAmount(ctx, amount);
}

export async function startWithdrawalWithAmount(
  ctx: HandlerContext,
  amount: number,
  existingTask?: CitizenTask,
): Promise<AssistantDraft> {
  try {
    const check = await services.epfo.checkWithdrawalEligibility(ctx.userId, amount);
    const task =
      existingTask ??
      (await startTask({
        userId: ctx.userId,
        workflowId: 'pf_withdrawal',
        conversationId: ctx.conversationId,
      }));

    if (!check.eligible) {
      const failed = check.reasons.find((reason) => !reason.ok);
      await advanceTask({
        taskId: task.id,
        data: { amount, awaiting: 'amount' },
        status: 'WAITING_FOR_USER',
        timeline: { label: 'That amount could not be used', detail: failed?.label, tone: 'warning' },
      });
      return {
        content: `I cannot ask for that amount. ${failed?.label ?? ''} You can ask for up to ${formatCurrency(check.maxAmount)}. Tell me another amount and I will get it ready.`,
        suggestions: [`I want to take out ${formatCurrency(check.maxAmount)}`],
        title: 'PF Withdrawal',
      };
    }

    const updated = await advanceTask({
      taskId: task.id,
      complete: ['account', 'kyc', 'bank', 'eligibility'],
      currentStep: 'review',
      status: 'WAITING_FOR_CONFIRMATION',
      data: { amount, awaiting: null, bankMasked: check.bankMasked },
      timeline: { label: 'Ready for you to check', tone: 'info' },
      nextActionLabel: 'Confirm withdrawal',
      nextActionPrompt: 'Continue my PF withdrawal',
    });

    return {
      content: `Your request for ${formatCurrency(amount)} is ready. Nothing is sent until you tap Confirm.`,
      steps: steps(['Found your account', 'Checked your details', 'Checked your bank account']),
      blocks: [
        taskProgressBlock(updated ?? task),
        {
          type: 'review',
          title: 'Review PF Withdrawal',
          rows: [
            { label: 'Amount', value: formatCurrency(amount) },
            { label: 'Goes to', value: `${demoKyc.bankName} ${check.bankMasked}` },
          ],
          warning: 'This is a practice app. No money will actually move.',
          confirm: serverAction('Yes, send it', 'CONFIRM_PF_WITHDRAWAL', { taskId: task.id }, 'primary'),
          cancel: serverAction('Stop this', 'CANCEL_TASK', { taskId: task.id }, 'ghost'),
        },
      ],
      suggestions: ["I'll do it later", 'What does KYC mean?'],
      title: 'PF Withdrawal',
    };
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      return UNAVAILABLE_DRAFT('provident fund', `I want to take out ${formatCurrency(amount)}`);
    }
    throw error;
  }
}

// =====================================================================
// Passport
// =====================================================================

async function handlePassport(ctx: HandlerContext): Promise<AssistantDraft> {
  const openTask = await findOpenTask(ctx.userId, 'passport_application');
  if (openTask) {
    const resumed = await renderTaskStep(ctx, openTask);
    return {
      ...resumed,
      content: `You already have a passport application in progress. ${resumed.content}`,
    };
  }
  try {
    const catalogue = await services.passport.getRequirements();
    const requirements = await buildRequirements(ctx.userId, catalogue);
    const ready = requirements.filter((requirement) => requirement.state === 'AVAILABLE');
    const missing = requirements.filter((requirement) => requirement.state !== 'AVAILABLE');

    const task = await startTask({
      userId: ctx.userId,
      workflowId: 'passport_application',
      conversationId: ctx.conversationId,
      data: {
        requirements,
        documentsReady: ready.length,
        documentsTotal: requirements.length,
      },
      documents: ready
        .map((requirement) => requirement.documentId)
        .filter((value): value is string => Boolean(value)),
    });

    await advanceTask({
      taskId: task.id,
      complete: ['personal'],
      currentStep: 'documents',
      status: missing.length > 0 ? 'WAITING_FOR_DOCUMENT' : 'WAITING_FOR_CONFIRMATION',
      nextActionLabel: missing.length > 0 ? 'Sort out your papers' : 'Review and send',
      nextActionPrompt: 'Continue my passport application',
    });

    const blocks: ContentBlock[] = [
      { type: 'requirements', taskId: task.id, title: 'Passport Application' },
      noticeBlock(
        'This is a practice app. Your application is not sent to the passport office.',
        'info',
        undefined,
        demoSource(PASSPORT_SOURCE.name, PASSPORT_SOURCE.url, PASSPORT_SOURCE.lastVerified),
      ),
    ];

    if (missing.length === 0) {
      return {
        content: 'Good news — you already have all five papers. Shall I get your application ready?',
        processing: checkingPlan('Checking your papers'),
        blocks,
        actions: [serverAction('Check my application', 'PARENT_REVIEW', { taskId: task.id }, 'primary')],
        inputState: 'WAITING_FOR_CONFIRMATION',
        title: 'Passport Application',
      };
    }

    const names = missing.map((requirement) => requirement.label).join(' and ');
    return {
      content: `A passport needs five papers. You already have ${ready.length}.\n\n${
        missing.length === 1 ? 'One paper needs attention' : `${missing.length} papers need attention`
      }: ${names}. We can sort them out one at a time, or both together — you do not have to finish one before starting the other.`,
      processing: checkingPlan('Checking your papers'),
      blocks,
      // The progress card above already offers a button per paper, so the only
      // extra action worth showing is the one it cannot: doing both at once.
      actions:
        missing.length > 1
          ? [serverAction('Sort out both together', 'RESOLVE_ALL', { taskId: task.id }, 'primary')]
          : [],
      suggestions: ["I'll do it later", 'Why do you need my Aadhaar?'],
      inputState: 'WAITING_FOR_DOCUMENT',
      title: 'Passport Application',
    };
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      return UNAVAILABLE_DRAFT('passport service', 'I want to apply for a passport');
    }
    throw error;
  }
}

// =====================================================================
// Complaint
// =====================================================================

/**
 * Pulls the citizen's own complaint out of their message. Returns '' when the
 * message is only a request to start ("I want to make a complaint"), so the
 * flow knows to ask them to describe the problem in their own words.
 */
export function complaintStatementFrom(message: string): string {
  const trimmed = message.replace(/\s+/g, ' ').trim();
  // Strip a leading "I want to file a complaint about/that/:" wrapper.
  const stripped = trimmed
    .replace(/^\s*(hi|hello|hey|namaste)[,\s]+/i, '')
    .replace(
      /^\s*(i\s+(want|need|would like|wish|have)\s+to\s+)?(make|file|register|raise|lodge|submit|create|do|have)?\s*(a\s+)?(complaint|grievance)\s*(about|regarding|against|that|:|-|for|on)?\s*/i,
      '',
    )
    .trim();
  // If stripping the wrapper leaves nothing, it was only a request to start.
  const core = stripped;
  if (core.replace(/[^a-z0-9]/gi, '').length < 8) return '';
  if (/^(complaint|grievance|complain)[.!?]*$/i.test(core)) return '';
  return core;
}

async function handleComplaint(ctx: HandlerContext): Promise<AssistantDraft> {
  const openTask = await findOpenTask(ctx.userId, 'complaint');
  const statement = complaintStatementFrom(ctx.message);

  // Resuming a complaint that is still waiting for its description.
  if (openTask && !statement) {
    const resumed = await renderTaskStep(ctx, openTask);
    return { ...resumed, content: `You already have a complaint in progress. ${resumed.content}` };
  }

  const task =
    openTask ??
    (await startTask({
      userId: ctx.userId,
      workflowId: 'complaint',
      conversationId: ctx.conversationId,
      title: 'Complaint',
      data: {},
    }));

  if (!statement) {
    await advanceTask({
      taskId: task.id,
      status: 'WAITING_FOR_USER',
      data: { awaiting: 'complaint_detail' },
      nextActionLabel: 'Describe the problem',
      nextActionPrompt: 'Continue my complaint',
    });
    return {
      content:
        'I can raise a complaint for you. Tell me, in your own words, what the problem is — what happened, which service or office it concerns, and any dates or details you want included.',
      blocks: [
        noticeBlock(
          'You decide what the complaint says. I only put your words into a proper letter and send it to the right department.',
          'info',
        ),
      ],
      suggestions: [
        'No electricity in my area for the last 3 days',
        'Garbage has not been collected on my street for a week',
        'My pension has not come since June',
      ],
      title: 'New Complaint',
    };
  }

  return draftComplaint(ctx, task, statement);
}

/** Routes the citizen's statement to a department and writes the letter. */
export async function draftComplaint(
  ctx: HandlerContext,
  task: CitizenTask,
  statement: string,
): Promise<AssistantDraft> {
  const db = getDatabase();
  try {
    const draft = await services.grievance.draft({ statement, profile: ctx.profile });

    const complaint = await db.createComplaint({
      id: `cmp_${Math.random().toString(36).slice(2, 10)}`,
      userId: ctx.userId,
      taskId: task.id,
      category: draft.category,
      department: draft.department,
      subject: draft.subject,
      description: draft.description,
      status: 'draft',
      reference: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      officialSourceName: draft.route.portalName,
      officialSourceUrl: draft.route.portalUrl,
      departmentEmail: draft.departmentEmail,
      authority: draft.authority,
      citizenStatement: draft.citizenStatement,
    });

    await db.updateTask(task.id, { title: `${draft.category} Complaint` });

    const updated = await advanceTask({
      taskId: task.id,
      complete: ['details', 'draft'],
      currentStep: 'review',
      status: 'WAITING_FOR_CONFIRMATION',
      data: {
        awaiting: null,
        complaintId: complaint.id,
        department: draft.department,
        departmentEmail: draft.departmentEmail,
      },
      timeline: { label: `Routed to ${draft.department}`, tone: 'info' },
      nextActionLabel: 'Review and send',
      nextActionPrompt: 'Continue my complaint',
    });

    await notify({
      userId: ctx.userId,
      title: 'Your complaint is ready to read',
      body: `A complaint for ${draft.department} is written and waiting. Nothing is sent until you say so.`,
      tone: 'action_required',
      taskId: task.id,
      actionPrompt: 'Continue my complaint',
      actionLabel: 'Review draft',
    });

    return {
      content: `Based on what you told me, this should go to **${draft.department}**. I have written it up formally using your own words. Read it, change anything you like, and send it only when you are happy.`,
      steps: steps(['Understood your problem', 'Chose the right department', 'Wrote your complaint']),
      blocks: [{ type: 'complaint_draft', complaint }, taskProgressBlock(updated ?? task)],
      suggestions: ['Send the complaint', 'Let me change something', "I'll do it later"],
      title: `${draft.category} Complaint`,
    };
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      return UNAVAILABLE_DRAFT('grievance service', 'I want to raise a complaint');
    }
    throw error;
  }
}

// =====================================================================
// Trains
// =====================================================================

function resolveDate(value?: string): string {
  const date = new Date();
  if (!value || value === 'today') return formatDate(date);
  if (value === 'tomorrow') {
    date.setDate(date.getDate() + 1);
    return formatDate(date);
  }
  if (value === 'day after tomorrow') {
    date.setDate(date.getDate() + 2);
    return formatDate(date);
  }
  return value;
}

async function handleTrains(ctx: HandlerContext): Promise<AssistantDraft> {
  const { from, to, date, passengers, travelClass } = ctx.intent.entities;

  if (!from || !to) {
    return {
      content: 'Which city are you travelling from, and which city are you going to?',
      suggestions: ['I want to go from Bengaluru to Chennai tomorrow'],
      title: 'Train Booking',
    };
  }

  try {
    const travelDate = resolveDate(date);
    const options = await services.rail.searchTrains({ from, to, date: travelDate, travelClass });

    const existing = await findOpenTask(ctx.userId, 'train_booking');
    const task = existing
      ? ((await advanceTask({
          taskId: existing.id,
          data: {
            from,
            to,
            date: travelDate,
            passengers: passengers ?? 1,
            travelClass: travelClass ?? 'Sleeper',
          },
        })) ?? existing)
      : await startTask({
          userId: ctx.userId,
          workflowId: 'train_booking',
          conversationId: ctx.conversationId,
          title: `Train Booking — ${from} to ${to}`,
          data: {
            from,
            to,
            date: travelDate,
            passengers: passengers ?? 1,
            travelClass: travelClass ?? 'Sleeper',
          },
        });

    await getDatabase().saveTrainSearch({
      id: `search_${Math.random().toString(36).slice(2, 10)}`,
      userId: ctx.userId,
      from,
      to,
      date: travelDate,
      passengers: passengers ?? 1,
      travelClass: travelClass ?? 'Sleeper',
      createdAt: new Date().toISOString(),
      results: options,
    });

    return {
      content: `Here are trains from ${from} to ${to} on ${travelDate}, for ${passengers ?? 1} person${(passengers ?? 1) > 1 ? 's' : ''}.`,
      steps: steps(['Looking for trains']),
      blocks: [
        {
          type: 'trains',
          options,
          taskId: task.id,
          summary: `${from} → ${to} · ${travelDate}`,
        },
        noticeBlock(
          'This is a practice app. Book real tickets on the official IRCTC website or app.',
          'info',
          undefined,
          demoSource(RAIL_SOURCE.name, RAIL_SOURCE.url, RAIL_SOURCE.lastVerified),
        ),
      ],
      suggestions: ['Show my applications', "I'll do it later"],
      title: 'Train Booking',
    };
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      return UNAVAILABLE_DRAFT('railway service', `I want to go from ${from} to ${to}`);
    }
    throw error;
  }
}

// =====================================================================
// Documents
// =====================================================================

async function handleViewDocuments(ctx: HandlerContext): Promise<AssistantDraft> {
  const documents = await getDatabase().listDocuments(ctx.userId);
  return {
    content: `You have ${documents.length} papers saved. I will use them whenever a service asks, so you do not have to find them again.`,
    blocks: [documentsBlock(documents, 'Your papers', true)],
    actions: [linkAction('Open my papers', '/documents', 'secondary')],
    suggestions: ['Do I have my 10th marksheet?', 'I want to apply for a passport'],
    title: 'My Documents',
  };
}

async function handleGetDocument(ctx: HandlerContext): Promise<AssistantDraft> {
  const db = getDatabase();
  const query = ctx.intent.entities.documentName ?? ctx.message;
  const documents = await db.listDocuments(ctx.userId);
  const normalised = query.toLowerCase();

  const found = documents.filter((document) => {
    const name = document.name.toLowerCase();
    return (
      normalised.includes(name.replace(' (demo)', '')) ||
      name.replace(' (demo)', '').split(' ').some((word) => word.length > 4 && normalised.includes(word))
    );
  });

  if (found.length > 0) {
    return {
      content: `Yes — you have your ${found[0].name}. You will not need to find it again.`,
      steps: steps(['Looking through your papers', 'Found it']),
      blocks: [documentsBlock(found.slice(0, 3))],
      suggestions: ['Show my documents', 'I want to apply for a passport'],
      title: found[0].name.replace(' (Demo)', ''),
    };
  }

  return handleDigiLocker(ctx);
}

async function handleDigiLocker(ctx: HandlerContext): Promise<AssistantDraft> {
  try {
    const query = ctx.intent.entities.documentName ?? ctx.message;
    const match = await services.digilocker.findDocument(ctx.userId, query);
    await getDatabase().touchConnectedService(ctx.userId, 'digilocker');

    if (match && !match.imported) {
      return {
        content: `Your ${match.name} is in your online locker. I can save a copy here so you can use it.`,
        steps: steps(['Opening your online locker', 'Found your document']),
        blocks: [
          { type: 'digilocker', documents: [match] },
          noticeBlock(
            'This is a practice app, so the locker is not your real DigiLocker account.',
            'info',
            undefined,
            demoSource(DIGILOCKER_SOURCE.name, DIGILOCKER_SOURCE.url, DIGILOCKER_SOURCE.lastVerified),
          ),
        ],
        suggestions: ['Show my documents', 'What is DigiLocker?'],
        title: match.name,
      };
    }

    const all = await services.digilocker.listDocuments(ctx.userId);
    const importable = all.filter((document) => !document.imported);

    if (importable.length === 0) {
      return {
        content: "I couldn't find that document. Everything in your connected wallet has already been imported.",
        blocks: [noticeBlock('You can upload a document yourself, or check what you already have.', 'info')],
        actions: [
          linkAction('Upload a document', '/documents', 'primary'),
          promptAction('Show my documents', 'Show my documents'),
        ],
        suggestions: DEFAULT_SUGGESTIONS.slice(0, 3),
      };
    }

    return {
      content: "I couldn't find that exact document. These are available in your connected wallet.",
      steps: steps(['Connecting to DigiLocker', 'Connection established']),
      blocks: [
        { type: 'digilocker', documents: importable },
        noticeBlock('This is a DEMO CONNECTION. No real DigiLocker account is accessed.', 'warning'),
      ],
      actions: [linkAction('Upload a document instead', '/documents', 'secondary')],
      suggestions: ['Show my documents'],
    };
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      return UNAVAILABLE_DRAFT('document wallet', 'Do I have my 10th marksheet?');
    }
    throw error;
  }
}

// =====================================================================
// Tracking surfaces
// =====================================================================

async function handleApplications(ctx: HandlerContext): Promise<AssistantDraft> {
  const { toApplicationView } = await import('@/lib/workflows/engine');
  const tasks = await getDatabase().listTasks(ctx.userId);
  const applications = tasks.map(toApplicationView);

  if (applications.length === 0) {
    return {
      content: 'You have not started anything yet. When you do, it will all be here in one place.',
      suggestions: DEFAULT_SUGGESTIONS.slice(0, 3),
      title: 'My Applications',
    };
  }

  return {
    content: `Here is everything you have started.`,
    blocks: [{ type: 'applications', applications }],
    actions: [linkAction('Open my applications', '/applications', 'secondary')],
    suggestions: ['Continue my PF withdrawal', 'Show my documents'],
    title: 'My Applications',
  };
}

async function handleDownloads(ctx: HandlerContext): Promise<AssistantDraft> {
  const files = await getDatabase().listDownloads(ctx.userId);
  if (files.length === 0) {
    return {
      content: 'You have no files yet. Anything I make for you will be saved here.',
      suggestions: ['I need my PF passbook'],
      title: 'Downloads',
    };
  }
  return {
    content: 'Here are the files I have made for you.',
    blocks: [{ type: 'downloads', files }],
    actions: [linkAction('Open my files', '/downloads', 'secondary')],
    title: 'Downloads',
  };
}

async function handleNotifications(ctx: HandlerContext): Promise<AssistantDraft> {
  const items = await getDatabase().listNotifications(ctx.userId);
  return {
    content: items.length > 0 ? 'Here is what has happened recently.' : 'Nothing new right now.',
    blocks: items.length > 0 ? [{ type: 'notifications', items }] : undefined,
    actions: [linkAction('Open updates', '/notifications', 'secondary')],
    title: 'Notifications',
  };
}

// =====================================================================
// Task control
// =====================================================================

async function handlePause(ctx: HandlerContext): Promise<AssistantDraft> {
  const task = await findResumableTask(ctx.userId);
  if (!task) {
    return {
      content: 'There is nothing in progress right now, so nothing to save.',
      suggestions: DEFAULT_SUGGESTIONS.slice(0, 3),
    };
  }
  const paused = await pauseTask(task.id);
  await notify({
    userId: ctx.userId,
    title: `${task.title} saved`,
    body: 'You can continue from the same place whenever you are ready.',
    tone: 'info',
    taskId: task.id,
    actionPrompt: `Continue my ${task.title.toLowerCase()}`,
    actionLabel: 'Continue',
  });
  return {
    content: `No problem. I have saved your ${task.title.toLowerCase()} exactly where it is. Nothing was sent.`,
    blocks: [taskProgressBlock(paused ?? task)],
    actions: [promptAction('Carry on now', `Continue my ${task.title.toLowerCase()}`, 'secondary')],
    suggestions: ['Show my applications', 'I want to apply for a passport'],
  };
}

/** Rebuilds the screen for whatever step a task is sitting on. */
export async function renderTaskStep(
  ctx: HandlerContext,
  task: CitizenTask,
): Promise<AssistantDraft> {
  const progress = progressOf(task);
  const doneLabels = progress.filter((step) => step.state === 'done').map((step) => step.label);
  const current = progress.find((step) => step.state === 'current');

  if (task.workflowId === 'pf_withdrawal') {
    const amount = Number(task.data.amount ?? 0);
    if (!amount || task.data.awaiting === 'amount') {
      return {
        content: 'Let us carry on. How much would you like to take out?',
        blocks: [taskProgressBlock(task)],
        suggestions: ['₹50,000', '₹25,000'],
      };
    }
    return {
      content: `Here is your request for ${formatCurrency(amount)} again. Nothing has been sent yet.`,
      steps: steps(doneLabels, current?.label),
      blocks: [
        taskProgressBlock(task),
        {
          type: 'review',
          title: 'Review PF Withdrawal',
          rows: [
            { label: 'Amount', value: formatCurrency(amount) },
            { label: 'Goes to', value: String(task.data.bankMasked ?? demoKyc.bankMasked) },
          ],
          warning: 'This is a practice app. No money will actually move.',
          confirm: serverAction('Yes, send it', 'CONFIRM_PF_WITHDRAWAL', { taskId: task.id }, 'primary'),
          cancel: serverAction('Stop this', 'CANCEL_TASK', { taskId: task.id }, 'ghost'),
        },
      ],
      suggestions: ["I'll do it later"],
    };
  }

  if (task.workflowId === 'complaint') {
    const complaintId = String(task.data.complaintId ?? '');
    const complaint = complaintId ? await getDatabase().getComplaint(complaintId) : null;
    if (complaint) {
      return {
        content: 'Here is your complaint again. It has not been sent.',
        blocks: [{ type: 'complaint_draft', complaint }, taskProgressBlock(task)],
        suggestions: ['Send the complaint'],
      };
    }
    return {
      content: 'Let us carry on with your complaint. Tell me, in your own words, what the problem is.',
      blocks: [taskProgressBlock(task)],
      suggestions: ['No electricity in my area for 3 days', 'Garbage not collected for a week'],
    };
  }

  if (task.workflowId === 'passport_application' && readRequirements(task).length > 0) {
    const progress = requirementProgress(task);
    if (progress.allReady) {
      return {
        content: 'All five papers are ready. Shall we check your application and send it?',
        blocks: [{ type: 'requirements', taskId: task.id, title: task.title }],
        actions: [serverAction('Check my application', 'PARENT_REVIEW', { taskId: task.id }, 'primary')],
        inputState: 'WAITING_FOR_CONFIRMATION',
      };
    }
    return {
      content: `Here is where your ${task.title.toLowerCase()} has got to.`,
      blocks: [{ type: 'requirements', taskId: task.id, title: task.title }],
      actions: outstandingActions(task),
      inputState: 'WAITING_FOR_DOCUMENT',
    };
  }

  if (task.workflowId === 'scheme_application') {
    const documentIds = (task.data.candidateDocuments as string[] | undefined) ?? task.documents;
    const db = getDatabase();
    const documents = (
      await Promise.all(documentIds.map((documentId) => db.getDocument(documentId)))
    ).filter(Boolean) as NonNullable<Awaited<ReturnType<typeof db.getDocument>>>[];

    if (task.status === 'WAITING_FOR_CONFIRMATION') {
      return buildApplicationReview(task, documents.map((document) => document.name));
    }

    return {
      content: `Let us carry on with your ${task.title.toLowerCase()}. I will use these papers.`,
      steps: steps(doneLabels, current?.label),
      blocks: [taskProgressBlock(task), documentsBlock(documents, 'I will use these', true)],
      actions: [
        serverAction('Yes, use these papers', 'USE_EXISTING_DOCUMENTS', { taskId: task.id }, 'primary'),
        linkAction('Add a different paper', '/documents', 'secondary'),
      ],
      suggestions: ["I'll do it later"],
    };
  }

  if (task.serviceType === 'DOCUMENT') {
    const definition = documentDefinition(String(task.data.documentKey ?? ''));
    if (task.status === 'PROCESSING') {
      return {
        content: `Your ${definition.label} is still with ${definition.issuedBy}. I will tell you the moment it is ready — you do not have to wait here.`,
        blocks: [taskProgressBlock(task)],
        inputState: 'BACKGROUND_PROCESSING',
      };
    }
    const { routeDraft } = await import('./resolution');
    return routeDraft(ctx, task);
  }

  return {
    content: `Carrying on with your ${task.title.toLowerCase()}.`,
    steps: steps(doneLabels, current?.label),
    blocks: [taskProgressBlock(task)],
  };
}

export function buildApplicationReview(task: CitizenTask, documentNames: string[]): AssistantDraft {
  const isPassport = task.workflowId === 'passport_application';
  const rows = [
    { label: 'For', value: isPassport ? 'A passport' : String(task.data.schemeName ?? 'A support programme') },
    { label: 'Papers', value: documentNames.join(', ') || 'None attached' },
  ];
  return {
    content: 'Everything is ready. Have a look, then send it when you are happy.',
    blocks: [
      taskProgressBlock(task),
      {
        type: 'review',
        title: `Review ${task.title}`,
        rows,
        warning: isPassport
          ? 'This is a practice app. Nothing is sent to the passport office.'
          : 'This is a practice app. Nothing is sent to a government office.',
        confirm: serverAction(
          'Send it',
          isPassport ? 'SUBMIT_PASSPORT_APPLICATION' : 'SUBMIT_SCHEME_APPLICATION',
          { taskId: task.id },
          'primary',
        ),
        cancel: serverAction('Stop this', 'CANCEL_TASK', { taskId: task.id }, 'ghost'),
      },
    ],
    suggestions: ["I'll do it later"],
  };
}

async function handleContinue(ctx: HandlerContext): Promise<AssistantDraft> {
  const task = await findResumableTask(ctx.userId, ctx.intent.entities.service);
  if (!task) {
    return {
      content: 'There is nothing waiting to be continued right now.',
      suggestions: DEFAULT_SUGGESTIONS.slice(0, 3),
    };
  }
  const resumed = (await resumeTask(task.id)) ?? task;
  return renderTaskStep(ctx, resumed);
}

// =====================================================================
// Explanations and fallback
// =====================================================================

function handleExplain(ctx: HandlerContext): AssistantDraft {
  const entry = lookupTerm(ctx.intent.entities.term ?? ctx.message);
  if (!entry) {
    return {
      content: 'Tell me which word you would like explained and I will put it in simple language.',
      suggestions: glossary.slice(0, 4).map((item) => `What does ${item.term} mean?`),
    };
  }
  return {
    content: `Here is what ${entry.term} means.`,
    blocks: [{ type: 'explain', term: entry.term, meaning: entry.meaning, example: entry.example }],
    suggestions: DEFAULT_SUGGESTIONS.slice(0, 3),
  };
}

async function handleHelp(): Promise<AssistantDraft> {
  const directory = await services.directory.listServices();
  return {
    content: 'Just tell me what you need in your own words. Here is what I can help with.',
    suggestions: directory.map((entry) => entry.examplePrompt),
    title: 'Getting started',
  };
}

/**
 * The fallback. Every option here is a real button — nothing that looks
 * tappable may be plain text, because a citizen who taps and gets nothing
 * assumes the whole app is broken.
 */
function handleUnknown(message: string): AssistantDraft {
  const unsupported = detectUnsupportedTopic(message);
  if (unsupported) {
    return {
      content: `I don't currently have ${unsupported} connected. I can help with the services available in NammaSahaay.`,
      suggestions: DEFAULT_SUGGESTIONS,
      inputState: 'IDLE',
    };
  }
  return {
    content:
      "I don't currently have verified information for that request. I can help you with the services available here.",
    suggestions: DEFAULT_SUGGESTIONS,
    inputState: 'IDLE',
  };
}

/** Names the thing we cannot do, instead of a blank "I did not understand". */
function detectUnsupportedTopic(message: string): string | null {
  const text = message.toLowerCase();
  const topics: [RegExp, string][] = [
    [/\bration\b|\bpds\b/, 'ration cards'],
    [/\bdriving licen[cs]e\b|\brto\b|\blearner'?s licen[cs]e\b/, 'driving licences'],
    [/\bvoter\b.*\b(card|id|list)\b|\bepic\b/, 'voter cards'],
    [/\belectricity\b|\bwater bill\b|\bgas connection\b/, 'utility bills'],
    [/\bproperty tax\b|\bkhata\b/, 'property records'],
    [/\bscholarship\b/, 'scholarships'],
    [/\bcaste certificate\b|\bincome certificate\b.*\bapply\b/, 'applying for certificates'],
    [/\bloan\b|\bcredit\b/, 'loans'],
    [/\bjob\b.*\b(apply|vacancy|opening)\b|\bemployment exchange\b/, 'job applications'],
  ];
  for (const [pattern, label] of topics) {
    if (pattern.test(text)) return label;
  }
  return null;
}

// =====================================================================
// Entry point
// =====================================================================

/**
 * A request about one document on its own: "I lost my Aadhaar", "my Aadhaar
 * mobile number changed", "I never applied for a birth certificate". The same
 * resolution flow serves these, with no parent application behind them.
 */
async function handleDocumentRequest(ctx: HandlerContext): Promise<AssistantDraft> {
  const documentKey = matchDocumentKey(ctx.message) ?? ctx.intent.entities.documentName ?? '';
  if (!documentKey || !documentDefinition(documentKey)) {
    return handleUnknown(ctx.message);
  }
  const definition = documentDefinition(documentKey);
  const route = matchRoute(ctx.message);

  // If the citizen has already told us the situation, skip straight to it.
  if (route && definition.routes.includes(route)) {
    const { startChildTask, routeDraft } = await import('./resolution');
    const child = await startChildTask(ctx, { documentKey, route, parentTaskId: null });
    const draft = await routeDraft(ctx, child);
    return {
      ...draft,
      processing: checkingPlan(`Checking your ${definition.label.toLowerCase()}`),
      title: definition.label,
    };
  }

  return {
    content: `I can help with your ${definition.label}. Which of these is closest to your situation?`,
    blocks: [await askHowToResolve(ctx.userId, documentKey, null)],
    inputState: 'WAITING_FOR_USER',
    title: definition.label,
  };
}

export async function handleIntent(ctx: HandlerContext): Promise<AssistantDraft> {
  switch (ctx.intent.intent) {
    case 'CHECK_GOVERNMENT_SCHEMES':
    case 'CHECK_SCHEME_ELIGIBILITY':
      return handleSchemes(ctx);
    case 'START_SCHEME_APPLICATION':
      return handleSchemes(ctx);
    case 'GET_PF_PASSBOOK':
      return handlePassbook(ctx);
    case 'START_PF_WITHDRAWAL':
      return handleWithdrawal(ctx);
    case 'START_PASSPORT_APPLICATION':
      return handlePassport(ctx);
    case 'CREATE_COMPLAINT':
      return handleComplaint(ctx);
    case 'SEARCH_TRAINS':
    case 'START_TRAIN_BOOKING':
      return handleTrains(ctx);
    case 'VIEW_DOCUMENTS':
      return handleViewDocuments(ctx);
    case 'GET_DOCUMENT':
      return handleGetDocument(ctx);
    case 'RESOLVE_DOCUMENT':
      return handleDocumentRequest(ctx);
    case 'IMPORT_DIGILOCKER_DOCUMENT':
      return handleDigiLocker(ctx);
    case 'VIEW_APPLICATIONS':
      return handleApplications(ctx);
    case 'VIEW_DOWNLOADS':
      return handleDownloads(ctx);
    case 'VIEW_NOTIFICATIONS':
      return handleNotifications(ctx);
    case 'PAUSE_TASK':
      return handlePause(ctx);
    case 'CONTINUE_TASK':
      return handleContinue(ctx);
    case 'EXPLAIN_TERM':
      return handleExplain(ctx);
    case 'HELP':
      return handleHelp();
    default:
      return handleUnknown(ctx.message);
  }
}

/** Handles a reply to a question a workflow asked earlier. */
export async function handleAwaitingAnswer(
  ctx: HandlerContext,
  task: CitizenTask,
): Promise<AssistantDraft | null> {
  const awaiting = String(task.data.awaiting ?? '');

  if (awaiting === 'amount') {
    const { extractAmount } = await import('@/lib/ai/rule-classifier');
    const amount = extractAmount(ctx.message);
    if (!amount) return null;
    return startWithdrawalWithAmount(ctx, amount, task);
  }

  if (awaiting === 'complaint_detail') {
    // Whatever the citizen typed here IS the complaint — they were asked for it.
    const statement = complaintStatementFrom(ctx.message) || ctx.message.trim();
    if (statement.replace(/[^a-z0-9]/gi, '').length < 5) return null;
    return draftComplaint(ctx, task, statement);
  }

  return null;
}

export { passportRequirements };
