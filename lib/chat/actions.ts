import type { ContentBlock } from '@/types/chat';
import type { CitizenDocument } from '@/types/document';
import { getDatabase } from '@/lib/database';
import { services, ServiceUnavailableError } from '@/lib/services/registry';
import { advanceTask, cancelTask, pauseTask, resumeTask, startTask } from '@/lib/workflows/engine';
import { registerDownload, documentsForPurposes, renderDownload } from '@/lib/documents/document-service';
import { recordAudit } from '@/lib/security/audit';
import { notify } from '@/lib/notifications';
import { getEmailProvider } from '@/lib/email';
import { sendDemoEmail } from '@/lib/email/demo-mailbox';
import { lookupTerm } from '@/data/demo/glossary';
import { demoAppointmentCentre } from '@/data/demo/passport';
import { formatCurrency } from '@/lib/utils';
import { checkPotentialEligibility } from '@/lib/eligibility/engine';
import {
  DEFAULT_SUGGESTIONS,
  UNAVAILABLE_DRAFT,
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
import { buildApplicationReview, renderTaskStep, type HandlerContext } from './handlers';
import { handleDocumentAction } from './document-actions';

/**
 * Actions are the buttons inside assistant messages.
 *
 * Every consequential action arrives here as an explicit citizen decision —
 * the model can never trigger one on its own.
 */
export async function handleChatAction(
  ctx: HandlerContext,
  action: string,
  payload: Record<string, unknown>,
): Promise<AssistantDraft> {
  const db = getDatabase();

  // The document-resolution flow owns its own buttons. Anything it does not
  // recognise falls through to the service workflows below, unchanged.
  const documentDraft = await handleDocumentAction(ctx, action, payload);
  if (documentDraft) return documentDraft;

  switch (action) {
    // --- Provident fund ------------------------------------------------
    case 'CONFIRM_PF_WITHDRAWAL': {
      const task = await db.getTask(String(payload.taskId ?? ''));
      if (!task || task.userId !== ctx.userId) return notFound();
      if (task.status === 'SUBMITTED') return alreadyDone(task.applicationId);

      const amount = Number(task.data.amount ?? 0);
      try {
        const submission = await services.epfo.submitWithdrawal(ctx.userId, amount);
        const updated = await advanceTask({
          taskId: task.id,
          complete: ['review', 'confirmation', 'submission'],
          currentStep: 'submission',
          status: 'SUBMITTED',
          applicationId: submission.applicationId,
          timeline: { label: 'Sent', tone: 'success' },
          nextActionLabel: null,
          nextActionPrompt: null,
        });

        await recordAudit({
          eventType: 'USER_CONFIRMED_PF_WITHDRAWAL',
          userId: ctx.userId,
          taskId: task.id,
          metadata: { amount, confirmed: true },
        });
        await recordAudit({
          eventType: 'APPLICATION_SUBMITTED_DEMO',
          userId: ctx.userId,
          taskId: task.id,
          metadata: { service: 'EPFO' },
        });
        await notify({
          userId: ctx.userId,
          title: 'Your PF request was sent',
          body: `Request number ${submission.applicationId}. This is a practice app, so no money actually moves.`,
          tone: 'success',
          taskId: task.id,
          actionPrompt: 'Show my applications',
          actionLabel: 'View application',
        });
        const download = await registerDownload({
          userId: ctx.userId,
          fileName: 'PF_Withdrawal_Request.pdf',
          title: 'PF withdrawal request',
          kind: 'application',
          taskId: task.id,
        });

        return {
          content: `Done. Your request for ${formatCurrency(amount)} has been sent.`,
          steps: steps(['Checked', 'Confirmed by you', 'Sent']),
          blocks: [
            noticeBlock(
              `Keep this number safe: ${submission.applicationId}`,
              'success',
              'Your request was sent',
            ),
            taskProgressBlock(updated ?? task),
          ],
          actions: [
            downloadAction('Save a copy', download.id),
            linkAction('See it in my applications', '/applications', 'secondary'),
          ],
          suggestions: ['I want to apply for a passport', 'Show my applications'],
        };
      } catch (error) {
        if (error instanceof ServiceUnavailableError) {
          return UNAVAILABLE_DRAFT('EPFO', 'Continue my PF withdrawal');
        }
        throw error;
      }
    }

    // --- Task control --------------------------------------------------
    case 'CANCEL_TASK': {
      const task = await db.getTask(String(payload.taskId ?? ''));
      if (!task || task.userId !== ctx.userId) return notFound();
      // Cancelling is destructive, so it is confirmed rather than done on one tap.
      if (!payload.confirmed) {
        return {
          content: `Do you want to stop your ${task.title.toLowerCase()}? Everything you have done so far will be lost.`,
          actions: [
            serverAction('Yes, stop it', 'CANCEL_TASK', { taskId: task.id, confirmed: true }, 'danger'),
            serverAction('No, keep going', 'CONTINUE_TASK', { taskId: task.id }, 'primary'),
          ],
        };
      }
      const cancelled = await cancelTask(task.id);
      const restartPrompt = restartPromptFor(task);
      return {
        content: `I have stopped your ${task.title.toLowerCase()}. Nothing was sent.`,
        blocks: [taskProgressBlock(cancelled ?? task)],
        actions: restartPrompt ? [promptAction('Start it again', restartPrompt, 'primary')] : [],
        suggestions: DEFAULT_SUGGESTIONS.slice(0, 3),
      };
    }

    case 'PAUSE_TASK': {
      const task = await db.getTask(String(payload.taskId ?? ''));
      if (!task || task.userId !== ctx.userId) return notFound();
      const paused = await pauseTask(task.id);
      return {
        content: `Saved. Your ${task.title.toLowerCase()} is exactly where you left it.`,
        blocks: [taskProgressBlock(paused ?? task)],
        actions: [promptAction('Carry on now', `Continue my ${task.title.toLowerCase()}`)],
      };
    }

    case 'CONTINUE_TASK': {
      const task = await db.getTask(String(payload.taskId ?? ''));
      if (!task || task.userId !== ctx.userId) return notFound();
      const resumed = (await resumeTask(task.id)) ?? task;
      return renderTaskStep(ctx, resumed);
    }

    // --- Documents -----------------------------------------------------
    case 'USE_EXISTING_DOCUMENTS': {
      const task = await db.getTask(String(payload.taskId ?? ''));
      if (!task || task.userId !== ctx.userId) return notFound();
      const documentIds = (task.data.candidateDocuments as string[] | undefined) ?? [];
      const documents = (
        await Promise.all(documentIds.map((documentId) => db.getDocument(documentId)))
      ).filter(Boolean) as CitizenDocument[];

      const updated = await advanceTask({
        taskId: task.id,
        complete: task.workflowId === 'passport_application' ? ['documents', 'preparation'] : ['documents'],
        currentStep: 'review',
        status: 'WAITING_FOR_CONFIRMATION',
        documents: documentIds,
        timeline: { label: 'Used papers you already had', tone: 'success' },
        nextActionLabel: 'Review and confirm',
        nextActionPrompt: `Continue my ${task.title.toLowerCase()}`,
      });

      await recordAudit({
        eventType: 'DOCUMENT_REUSED',
        userId: ctx.userId,
        taskId: task.id,
        metadata: { count: documents.length },
      });

      return buildApplicationReview(updated ?? task, documents.map((document) => document.name));
    }

    case 'IMPORT_DIGILOCKER': {
      try {
        const imported = await services.digilocker.importDocument(
          ctx.userId,
          String(payload.digiLockerId ?? ''),
        );
        await recordAudit({
          eventType: 'DOCUMENT_IMPORTED',
          userId: ctx.userId,
          metadata: { category: imported.category },
        });
        await notify({
          userId: ctx.userId,
          title: 'Document imported',
          body: `${imported.name} was imported from the demo DigiLocker connection.`,
          tone: 'success',
          actionPrompt: 'Show my documents',
          actionLabel: 'View documents',
        });
        return {
          content: `Saved. Your ${imported.name} is with your other papers now, and I will use it whenever a service asks for it.`,
          steps: steps(['Opened your locker', 'Saved a copy']),
          blocks: [documentsBlock([imported], undefined, true)],
          actions: [linkAction('See all my papers', '/documents', 'secondary')],
          suggestions: ['I want to apply for a passport', 'Show my documents'],
        };
      } catch (error) {
        if (error instanceof ServiceUnavailableError) {
          return UNAVAILABLE_DRAFT('document locker', 'Do I have my 10th marksheet?');
        }
        throw error;
      }
    }

    // --- Schemes -------------------------------------------------------
    case 'VIEW_SCHEME': {
      const scheme = await services.schemes.getScheme(String(payload.schemeId ?? ''));
      if (!scheme) return notFound();
      const documents = await db.listDocuments(ctx.userId);
      const situation = mergeSituation(situationFromProfile(ctx.profile), undefined);
      const match = checkPotentialEligibility(scheme, situation, documents);
      return {
        content: `Here are the details for ${scheme.name}.`,
        blocks: [{ type: 'scheme_detail', match }],
        actions: scheme.isDemoScheme
          ? [serverAction('Start application', 'START_SCHEME_APPLICATION', { schemeId: scheme.id })]
          : scheme.sourceUrl
            ? [linkAction('Open official portal', scheme.sourceUrl, 'secondary')]
            : [],
        suggestions: ['What documents do I need?', 'Show my documents'],
      };
    }

    case 'START_SCHEME_APPLICATION': {
      const schemeId = String(payload.schemeId ?? '');
      const scheme = await services.schemes.getScheme(schemeId);
      if (!scheme) return notFound();

      if (!scheme.isDemoScheme) {
        return {
          content: `${scheme.name} is an official programme. Applications for it are made on the government portal, not inside this prototype.`,
          blocks: [
            noticeBlock(
              'NammaSahaay does not submit applications for official programmes. Check the current criteria and apply on the official service.',
              'warning',
            ),
          ],
          actions: scheme.sourceUrl ? [linkAction('Open official portal', scheme.sourceUrl, 'primary')] : [],
          suggestions: ['Are there any government schemes I can get?'],
        };
      }

      const documents = await db.listDocuments(ctx.userId);
      const situation = mergeSituation(situationFromProfile(ctx.profile), undefined);
      const match = checkPotentialEligibility(scheme, situation, documents);
      const available = await documentsForPurposes(
        ctx.userId,
        scheme.requiredDocuments.map((requirement) => requirement.purpose),
      );
      const matched = scheme.requiredDocuments
        .map((requirement) => available[requirement.purpose])
        .filter((document): document is CitizenDocument => Boolean(document));
      const unique = matched.filter(
        (document, index) => matched.findIndex((other) => other.id === document.id) === index,
      );
      const missing = match.documents.filter((document) => !document.available);

      const task = await startTask({
        userId: ctx.userId,
        workflowId: 'scheme_application',
        conversationId: ctx.conversationId,
        title: `${scheme.name} Application`,
        data: {
          schemeId: scheme.id,
          schemeName: scheme.name,
          candidateDocuments: unique.map((document) => document.id),
        },
      });

      await advanceTask({
        taskId: task.id,
        complete: ['eligibility'],
        currentStep: 'documents',
        status: missing.length > 0 ? 'WAITING_FOR_DOCUMENT' : 'WAITING_FOR_USER',
        nextActionLabel: 'Continue',
        nextActionPrompt: `Continue my ${scheme.name.toLowerCase()} application`,
      });

      const blocks: ContentBlock[] = [
        {
          type: 'checklist',
          title: 'Papers this application asks for',
          items: match.documents.map((document) => ({
            label: document.available
              ? `${document.label} — you have this`
              : `${document.label} — you do not have this yet`,
            state: document.available ? 'done' : 'missing',
          })),
        },
        documentsBlock(unique, 'I will use these', true),
      ];

      return {
        content:
          missing.length > 0
            ? `I have started your application for ${scheme.name}. You still need ${missing.length} more paper${missing.length > 1 ? 's' : ''}.`
            : `Good news — you already have every paper this asks for. Shall I use them?`,
        steps: steps(['Checked what you may get', 'Checked your papers']),
        blocks,
        actions: [
          serverAction('Yes, use these papers', 'USE_EXISTING_DOCUMENTS', { taskId: task.id }, 'primary'),
          linkAction('Add a different paper', '/documents', 'secondary'),
        ],
        suggestions: ["I'll do it later", 'Why do you need an income certificate?'],
      };
    }

    case 'SUBMIT_SCHEME_APPLICATION': {
      const task = await db.getTask(String(payload.taskId ?? ''));
      if (!task || task.userId !== ctx.userId) return notFound();
      if (task.status === 'SUBMITTED') return alreadyDone(task.applicationId);
      try {
        const { applicationId } = await services.schemes.startSchemeApplication(
          ctx.userId,
          String(task.data.schemeId ?? ''),
        );
        const updated = await advanceTask({
          taskId: task.id,
          complete: ['review', 'submission'],
          currentStep: 'processing',
          status: 'SUBMITTED',
          applicationId,
          timeline: { label: 'Sent', tone: 'success' },
          nextActionLabel: null,
          nextActionPrompt: null,
        });
        await recordAudit({
          eventType: 'USER_CONFIRMED_SCHEME_APPLICATION',
          userId: ctx.userId,
          taskId: task.id,
          metadata: { scheme: String(task.data.schemeName ?? '') },
        });
        await notify({
          userId: ctx.userId,
          title: 'Your application was sent',
          body: `${task.data.schemeName} — request number ${applicationId}.`,
          tone: 'success',
          taskId: task.id,
          actionPrompt: 'Show my applications',
          actionLabel: 'View application',
        });
        const download = await registerDownload({
          userId: ctx.userId,
          fileName: 'Support_Application.pdf',
          title: `${task.data.schemeName} application`,
          kind: 'application',
          taskId: task.id,
        });
        return {
          content:
            'Done, your application has been sent. The government office decides the final answer, not me.',
          blocks: [
            noticeBlock(`Keep this number safe: ${applicationId}`, 'success', 'Your application was sent'),
            taskProgressBlock(updated ?? task),
          ],
          actions: [
            downloadAction('Save a copy', download.id),
            linkAction('See it in my applications', '/applications', 'secondary'),
          ],
          suggestions: ['I also want my PF passbook', 'Show my applications'],
        };
      } catch (error) {
        if (error instanceof ServiceUnavailableError) {
          return UNAVAILABLE_DRAFT('scheme service', 'Continue my scheme application');
        }
        throw error;
      }
    }

    // --- Passport ------------------------------------------------------
    case 'SUBMIT_PASSPORT_APPLICATION': {
      const task = await db.getTask(String(payload.taskId ?? ''));
      if (!task || task.userId !== ctx.userId) return notFound();
      if (task.status === 'SUBMITTED' || task.status === 'PROCESSING') {
        return alreadyDone(task.applicationId);
      }
      try {
        const submission = await services.passport.submitApplication(ctx.userId);
        const updated = await advanceTask({
          taskId: task.id,
          complete: ['review', 'submission'],
          currentStep: 'verification',
          status: 'PROCESSING',
          applicationId: submission.applicationId,
          timeline: {
            label: 'Sent',
            detail: `Appointment centre (demo): ${submission.appointmentCentre}`,
            tone: 'success',
          },
          nextActionLabel: null,
          nextActionPrompt: null,
        });
        await recordAudit({
          eventType: 'USER_CONFIRMED_PASSPORT_APPLICATION',
          userId: ctx.userId,
          taskId: task.id,
          metadata: { service: 'PASSPORT' },
        });
        await notify({
          userId: ctx.userId,
          title: 'Your passport application is being processed',
          body: `Request number ${submission.applicationId}. This is a practice app, so nothing went to the passport office.`,
          tone: 'info',
          taskId: task.id,
          actionPrompt: 'Show my applications',
          actionLabel: 'View application',
        });
        const download = await registerDownload({
          userId: ctx.userId,
          fileName: 'Passport_Application.pdf',
          title: 'Passport application',
          kind: 'application',
          taskId: task.id,
        });
        return {
          content: 'Done. Your passport application has been sent and is being processed.',
          blocks: [
            noticeBlock(
              `Keep this number safe: ${submission.applicationId}\nYour appointment office: ${demoAppointmentCentre}`,
              'success',
              'Your application was sent',
            ),
            taskProgressBlock(updated ?? task),
          ],
          actions: [
            downloadAction('Save a copy', download.id),
            linkAction('See it in my applications', '/applications', 'secondary'),
          ],
          suggestions: ['My pension has not come', 'Show my applications'],
        };
      } catch (error) {
        if (error instanceof ServiceUnavailableError) {
          return UNAVAILABLE_DRAFT('passport service', 'Continue my passport application');
        }
        throw error;
      }
    }

    // --- Complaint -----------------------------------------------------
    case 'UPDATE_COMPLAINT': {
      const complaint = await db.getComplaint(String(payload.complaintId ?? ''));
      if (!complaint || complaint.userId !== ctx.userId) return notFound();
      const updated = await db.updateComplaint(complaint.id, {
        subject: String(payload.subject ?? complaint.subject),
        description: String(payload.description ?? complaint.description),
      });
      return {
        content: 'I have changed it. Read it once more and send it when you are ready.',
        blocks: [{ type: 'complaint_draft', complaint: updated ?? complaint }],
        suggestions: ['Send the complaint'],
      };
    }

    case 'SEND_COMPLAINT': {
      const task = await db.getTask(String(payload.taskId ?? ''));
      if (!task || task.userId !== ctx.userId) return notFound();
      const complaint = await db.getComplaint(String(task.data.complaintId ?? ''));
      if (!complaint) return notFound();
      if (complaint.status !== 'draft') return alreadyDone(complaint.reference);

      try {
        const submission = await services.grievance.submit(ctx.userId, complaint.id);
        const updatedComplaint = await db.updateComplaint(complaint.id, {
          status: 'submitted_demo',
          reference: submission.reference,
        });

        // Raise the grievance email to the routed department, and keep a copy
        // the citizen can read in the Emails view. Demo mailbox — no real office
        // receives it.
        const departmentEmail = complaint.departmentEmail ?? 'cpgrams@grievance.demo.gov.in';
        await sendDemoEmail({
          userId: ctx.userId,
          to: departmentEmail,
          subject: `[${submission.reference}] ${complaint.subject}`,
          body: `${complaint.description}\n\n— — —\nComplaint reference: ${submission.reference}\nAuthority: ${complaint.authority ?? complaint.department}\nFiled via NammaSahaay (practice app). This is a simulated grievance email; no real office received it.`,
          taskId: task.id,
        });

        const updatedTask = await advanceTask({
          taskId: task.id,
          complete: ['review', 'submission'],
          currentStep: 'tracking',
          status: 'SUBMITTED',
          applicationId: submission.reference,
          timeline: { label: `Emailed to ${complaint.department}`, tone: 'success' },
          nextActionLabel: null,
          nextActionPrompt: null,
        });
        await recordAudit({
          eventType: 'USER_CONFIRMED_COMPLAINT',
          userId: ctx.userId,
          taskId: task.id,
          metadata: { category: complaint.category },
        });
        await notify({
          userId: ctx.userId,
          title: 'Your complaint was sent',
          body: `Complaint number ${submission.reference}. This is a practice app, so it did not go to a real office.`,
          tone: 'success',
          taskId: task.id,
          actionPrompt: 'Show my applications',
          actionLabel: 'View complaint',
        });
        const download = await registerDownload({
          userId: ctx.userId,
          fileName: 'Complaint.pdf',
          title: 'Your complaint',
          kind: 'complaint',
          taskId: task.id,
        });
        return {
          content: `Your complaint has been emailed to ${complaint.department}. You can see a copy in your Updates.`,
          blocks: [
            noticeBlock(
              `Keep this number safe: ${submission.reference}\nSent to: ${complaint.departmentEmail ?? 'the grievance cell'}`,
              'success',
              'Your complaint was sent',
            ),
            { type: 'complaint_draft', complaint: updatedComplaint ?? complaint },
            taskProgressBlock(updatedTask ?? task),
          ],
          actions: [
            downloadAction('Save a copy', download.id),
            linkAction('See it in my applications', '/applications', 'secondary'),
          ],
          suggestions: ['Show my applications', 'Show my documents'],
        };
      } catch (error) {
        if (error instanceof ServiceUnavailableError) {
          return UNAVAILABLE_DRAFT('grievance service', 'Continue my complaint');
        }
        throw error;
      }
    }

    // --- Trains --------------------------------------------------------
    case 'SELECT_TRAIN': {
      const task = await db.getTask(String(payload.taskId ?? ''));
      if (!task || task.userId !== ctx.userId) return notFound();
      const train = await services.rail.getTrain(
        String(payload.trainId ?? ''),
        String(task.data.from ?? ''),
        String(task.data.to ?? ''),
      );
      if (!train) return notFound();

      const passengers = Number(task.data.passengers ?? 1);
      const updated = await advanceTask({
        taskId: task.id,
        complete: ['journey', 'passengers'],
        currentStep: 'review',
        status: 'WAITING_FOR_CONFIRMATION',
        data: { train },
        timeline: { label: `Journey selected: ${train.number} ${train.name}`, tone: 'info' },
        nextActionLabel: 'Confirm journey',
        nextActionPrompt: 'Continue my train booking',
      });

      return {
        content: `You picked the ${train.name}. Nothing is booked until you tap Confirm, and no money is taken.`,
        blocks: [
          taskProgressBlock(updated ?? task),
          {
            type: 'review',
            title: 'Review journey',
            rows: [
              { label: 'Train', value: `${train.number} ${train.name}` },
              { label: 'From', value: `${train.from}, ${train.departure}` },
              { label: 'To', value: `${train.to}, ${train.arrival}` },
              { label: 'Date', value: String(task.data.date ?? '') },
              { label: 'People', value: String(passengers) },
              { label: 'Cost', value: formatCurrency(train.fare * passengers) },
            ],
            warning: 'This is a practice app. No money is taken and no seat is really booked.',
            confirm: serverAction('Book it', 'CONFIRM_TRAIN', { taskId: task.id }, 'primary'),
            cancel: serverAction('Stop this', 'CANCEL_TASK', { taskId: task.id }, 'ghost'),
          },
        ],
        suggestions: ["I'll do it later"],
      };
    }

    case 'CONFIRM_TRAIN': {
      const task = await db.getTask(String(payload.taskId ?? ''));
      if (!task || task.userId !== ctx.userId) return notFound();
      if (task.status === 'COMPLETED') return alreadyDone(task.applicationId);
      try {
        const booking = await services.rail.createDemoBooking(ctx.userId, String(payload.taskId));
        const updated = await advanceTask({
          taskId: task.id,
          complete: ['review', 'payment', 'booking'],
          currentStep: 'booking',
          status: 'COMPLETED',
          applicationId: booking.reference,
          timeline: { label: 'Journey saved', tone: 'success' },
          nextActionLabel: null,
          nextActionPrompt: null,
        });
        await recordAudit({
          eventType: 'USER_CONFIRMED_TRAIN_BOOKING',
          userId: ctx.userId,
          taskId: task.id,
          metadata: { service: 'RAIL' },
        });
        const download = await registerDownload({
          userId: ctx.userId,
          fileName: 'Train_Journey.pdf',
          title: 'Your train journey',
          kind: 'ticket',
          taskId: task.id,
        });
        await notify({
          userId: ctx.userId,
          title: 'Your journey details are ready',
          body: `Reference ${booking.reference}. This is a practice app, so it cannot be used to travel.`,
          tone: 'info',
          taskId: task.id,
        });
        return {
          content:
            'Your journey details are saved. Remember, this is a practice app — it is not a real ticket.',
          blocks: [
            noticeBlock(`Reference: ${booking.reference}`, 'success', 'Journey saved'),
            taskProgressBlock(updated ?? task),
          ],
          actions: [downloadAction('Save a copy', download.id)],
          suggestions: ['Show my applications'],
        };
      } catch (error) {
        if (error instanceof ServiceUnavailableError) {
          return UNAVAILABLE_DRAFT('railway service', 'Continue my train booking');
        }
        throw error;
      }
    }

    // --- Files and explanations ----------------------------------------
    case 'EMAIL_DOWNLOAD': {
      const downloadId = String(payload.downloadId ?? '');
      const file = await db.getDownload(downloadId);
      if (!file || file.userId !== ctx.userId) return notFound();
      const rendered = await renderDownload(ctx.userId, downloadId);
      const receipt = await getEmailProvider().send({
        to: ctx.profile.email,
        subject: `Your ${file.title} is ready`,
        body: `Attached is your ${file.title}. This came from a practice app and is not an official record.`,
        attachmentName: file.fileName,
        attachment: rendered?.bytes,
      });
      await recordAudit({
        eventType: 'DOCUMENT_EMAILED',
        userId: ctx.userId,
        metadata: { kind: file.kind },
      });
      return {
        content: 'I have sent it to your email.',
        blocks: [{ type: 'email_sent', receipt }],
        suggestions: DEFAULT_SUGGESTIONS.slice(0, 3),
      };
    }

    case 'WHY_NEEDED': {
      const label = String(payload.label ?? 'this document');
      const why = String(payload.why ?? '');
      return {
        content: why || `${label} is used to check the details of your application.`,
        blocks: [
          {
            type: 'why',
            title: `Why ${label.toLowerCase()} is asked for`,
            reasons: [why || `${label} is used to check the details of your application.`],
          },
        ],
      };
    }

    case 'EXPLAIN_TERM': {
      const entry = lookupTerm(String(payload.term ?? ''));
      if (!entry) {
        return { content: 'I do not have a simple explanation for that word yet.' };
      }
      return {
        content: entry.meaning,
        blocks: [{ type: 'explain', term: entry.term, meaning: entry.meaning, example: entry.example }],
      };
    }

    default:
      return {
        content: 'That option is no longer available. Tell me what you would like to do next.',
        suggestions: DEFAULT_SUGGESTIONS.slice(0, 3),
      };
  }
}

function notFound(): AssistantDraft {
  return {
    content: 'I cannot find that any more. Tell me what you need and I will start again.',
    suggestions: DEFAULT_SUGGESTIONS.slice(0, 3),
  };
}

function alreadyDone(reference: string | null): AssistantDraft {
  return {
    content: `That was already sent${reference ? `, number ${reference}` : ''}. You can see it in your applications.`,
    actions: [linkAction('See my applications', '/applications', 'secondary')],
  };
}

/** What to say to start the same thing over after it was stopped. */
function restartPromptFor(task: { workflowId: string; data: Record<string, unknown> }): string | null {
  switch (task.workflowId) {
    case 'pf_withdrawal':
      return 'I want to take out money from my PF';
    case 'passport_application':
      return 'I want to apply for a passport';
    case 'complaint':
      return 'I want to make a complaint';
    case 'train_booking':
      return 'I want to book a train';
    case 'scheme_application':
      return task.data.schemeName ? `Apply for ${String(task.data.schemeName)}` : 'Is there any government help for me?';
    default:
      return null;
  }
}
