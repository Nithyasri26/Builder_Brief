import type { CitizenTask } from '@/types/task';
import type { ResolutionRoute } from '@/types/document';
import { getDatabase } from '@/lib/database';
import { services, ServiceUnavailableError } from '@/lib/services/registry';
import { advanceTask, cancelTask } from '@/lib/workflows/engine';
import { readRequirements, requirementProgress, updateRequirement } from '@/lib/workflows/requirements';
import { documentDefinition } from '@/data/demo/document-catalogue';
import { demoReference } from '@/lib/services/types';
import { notify } from '@/lib/notifications';
import { sendDemoEmail } from '@/lib/email/demo-mailbox';
import { recordAudit } from '@/lib/security/audit';
import { registerDownload } from '@/lib/documents/document-service';
import { dueIn } from '@/lib/workflows/background';
import { routeGrievance } from '@/lib/services/grievance-router';
import { formatDate } from '@/lib/utils';
import {
  DEMO_OTP,
  askHowToResolve,
  attachDocument,
  checkingPlan,
  demoIdNumber,
  outstandingActions,
  profileConfirmDraft,
  reviewDraft,
  routeDraft,
  startChildTask,
  storedIdentifier,
  submissionPlan,
  submitChild,
} from './resolution';
import {
  downloadAction,
  linkAction,
  noticeBlock,
  promptAction,
  serverAction,
  type AssistantDraft,
} from './presenters';
import type { HandlerContext } from './handlers';

/**
 * Every button in the document-resolution flow lands here.
 *
 * Returning null means "not one of mine" — the older action handler then takes
 * it, so none of the existing service workflows had to change.
 */
export async function handleDocumentAction(
  ctx: HandlerContext,
  action: string,
  payload: Record<string, unknown>,
): Promise<AssistantDraft | null> {
  const db = getDatabase();
  const childId = String(payload.childTaskId ?? '');
  const value = String(payload.value ?? '').trim();

  const child = childId ? await db.getTask(childId) : null;
  if (childId && (!child || child.userId !== ctx.userId)) return notFound();

  switch (action) {
    // ---------- picking a requirement to work on ----------
    case 'RESOLVE_REQUIREMENT': {
      const parent = await db.getTask(String(payload.taskId ?? ''));
      if (!parent || parent.userId !== ctx.userId) return notFound();
      const key = String(payload.key ?? '');
      const requirement = readRequirements(parent).find((item) => item.key === key);
      if (!requirement) return notFound();

      // Already being worked on: go back to where that one had got to.
      if (requirement.childTaskId) {
        const existing = await db.getTask(requirement.childTaskId);
        if (existing && !['COMPLETED', 'CANCELLED'].includes(existing.status)) {
          return routeDraft(ctx, existing);
        }
      }

      const definition = documentDefinition(key);
      return {
        content: `Let us sort out your ${definition.label}. Which of these is closest to your situation?`,
        blocks: [await askHowToResolve(ctx.userId, key, parent.id)],
        inputState: 'WAITING_FOR_USER',
      };
    }

    case 'RESOLVE_ALL': {
      const parent = await db.getTask(String(payload.taskId ?? ''));
      if (!parent || parent.userId !== ctx.userId) return notFound();
      const outstanding = readRequirements(parent).filter(
        (requirement) => requirement.state === 'MISSING' || requirement.state === 'ACTION_REQUIRED',
      );
      return {
        content: `Both papers can be sorted out at the same time — you do not have to finish one before starting the other. Tell me about each one and I will run them side by side.`,
        blocks: outstanding.map((requirement) => ({
          type: 'document_options' as const,
          parentTaskId: parent.id,
          documentKey: requirement.key,
          label: requirement.label,
          why: requirement.why,
          options: documentDefinition(requirement.key).routes.map((route) => ({
            route,
            label: routeLabel(route, requirement.label),
            hint: routeHint(route),
          })),
        })),
        inputState: 'WAITING_FOR_USER',
      };
    }

    // ---------- the citizen states their situation ----------
    case 'DOC_ROUTE': {
      const documentKey = String(payload.documentKey ?? '');
      const route = String(payload.route ?? '') as ResolutionRoute;
      const parentTaskId = payload.parentTaskId ? String(payload.parentTaskId) : null;
      const created = await startChildTask(ctx, { documentKey, route, parentTaskId });
      const draft = await routeDraft(ctx, created);
      return {
        ...draft,
        processing: checkingPlan(`Checking your ${documentDefinition(documentKey).label.toLowerCase()}`),
      };
    }

    // ---------- "I already have it" ----------
    case 'DOC_PICK': {
      if (!child) return notFound();
      const document = await db.getDocument(String(payload.documentId ?? ''));
      if (!document || document.userId !== ctx.userId) return notFound();
      return attachDocument(ctx, child, document);
    }

    case 'DOC_PICK_LOCKER': {
      if (!child) return notFound();
      try {
        const imported = await services.digilocker.importDocument(
          ctx.userId,
          String(payload.digiLockerId ?? ''),
        );
        return attachDocument(ctx, child, imported);
      } catch (error) {
        if (error instanceof ServiceUnavailableError) {
          return {
            content: 'Your online locker is not answering just now. Nothing was lost.',
            actions: [
              serverAction('Try again', 'DOC_PICK_LOCKER', payload, 'primary'),
            ],
            inputState: 'WAITING_FOR_USER',
          };
        }
        throw error;
      }
    }

    // ---------- "I applied but have not got it" ----------
    case 'DOC_REFERENCE': {
      if (!child) return notFound();
      const definition = documentDefinition(String(child.data.documentKey));
      if (!value) {
        return {
          content: 'Please type the number, or tell me you do not have it.',
          inputState: 'WAITING_FOR_USER',
        };
      }
      await advanceTask({
        taskId: child.id,
        complete: ['reference', 'check'],
        currentStep: 'done',
        status: 'PROCESSING',
        applicationId: value,
        completeAt: new Date(Date.now() + 14000).toISOString(),
        data: { awaiting: null, reference: value },
        timeline: { label: 'Checking with the office', tone: 'info' },
      });
      if (child.parentTaskId) {
        await updateRequirement(child.parentTaskId, String(child.data.documentKey), {
          state: 'VERIFICATION_PENDING',
          reference: value,
          note: 'The office is still checking your earlier application.',
        });
      }
      return {
        content: `I checked with ${definition.issuedBy}.`,
        processing: checkingPlan('Checking your application'),
        blocks: [
          noticeBlock(
            `Application number: ${value}\nStatus: still being checked`,
            'info',
            `Your ${definition.label} application`,
          ),
          noticeBlock(
            'You do not need to apply again. I will tell you the moment it is ready.',
            'success',
          ),
        ],
        inputState: 'BACKGROUND_PROCESSING',
      };
    }

    case 'DOC_NO_REFERENCE': {
      if (!child) return notFound();
      const documentKey = String(child.data.documentKey);
      const definition = documentDefinition(documentKey);
      const profile = await db.getProfile(ctx.userId);
      const stored = storedIdentifier(profile, documentKey);

      // The account already holds this number (from the ID verified at sign-up):
      // show it, never make the citizen hunt for something we already have.
      if (stored) {
        await advanceTask({
          taskId: child.id,
          currentStep: 'reference',
          status: 'WAITING_FOR_USER',
          data: { awaiting: null },
        });
        return {
          content: `Good news — your ${definition.label} number is already saved on your account from the ID you signed up with:\n\n${stored.value}\n\nYou do not need to search for it.`,
          blocks: [
            noticeBlock(
              'I kept this from the ID proof you verified when you created your account. Please keep it private.',
              'success',
              `Your ${stored.label} number`,
            ),
          ],
          actions: [
            serverAction(
              `Check the status of my ${definition.label}`,
              'DOC_RETRIEVE_NUMBER',
              { childTaskId: child.id, mode: 'status' },
              'primary',
            ),
            serverAction('That is all I needed', 'DOC_CANCEL', { childTaskId: child.id, confirmed: true }, 'ghost'),
          ],
          inputState: 'WAITING_FOR_USER',
        };
      }

      // Not on the account: show every place the number could be, then offer to
      // register a request that retrieves it and shares it back.
      await advanceTask({
        taskId: child.id,
        currentStep: 'reference',
        status: 'WAITING_FOR_USER',
        data: { awaiting: null },
      });
      return {
        content: `No problem — let us find your ${definition.label} number. It is usually in one of these places:`,
        blocks: [
          noticeBlock(
            [
              '• On the ID proof you uploaded when you registered',
              `• In an SMS or email from ${definition.issuedBy}`,
              '• In your DigiLocker, if the document is saved there',
              '• On the physical card or the acknowledgement slip',
            ].join('\n'),
            'info',
            `Where to find your ${definition.label} number`,
          ),
          noticeBlock(
            `If you still cannot find it, I can register a request with ${definition.issuedBy} to retrieve your number, and share it with you here as soon as they reply.`,
            'info',
          ),
        ],
        actions: [
          serverAction(
            'Register a request to get my number',
            'DOC_RETRIEVE_NUMBER',
            { childTaskId: child.id, mode: 'retrieve' },
            'primary',
          ),
          linkAction('Check my DigiLocker', '/documents', 'secondary'),
        ],
        inputState: 'WAITING_FOR_USER',
      };
    }

    case 'DOC_RETRIEVE_NUMBER': {
      if (!child) return notFound();
      const documentKey = String(child.data.documentKey);
      const definition = documentDefinition(documentKey);
      const profile = await db.getProfile(ctx.userId);
      const stored = storedIdentifier(profile, documentKey);
      const reference = demoReference(definition.referencePrefix, 124);
      const numberToShare = stored?.value ?? demoIdNumber(documentKey);
      const shareLabel = stored?.label ?? `${definition.label} number`;

      await advanceTask({
        taskId: child.id,
        complete: ['reference', 'check', 'details', 'verify', 'review', 'submit'],
        currentStep: 'processing',
        status: 'PROCESSING',
        applicationId: reference,
        completeAt: dueIn(12),
        data: { awaiting: null, reference, mode: 'retrieve_number', shareNumber: numberToShare, shareLabel },
        timeline: { label: `Request sent to ${definition.issuedBy}`, tone: 'success' },
        nextActionLabel: null,
        nextActionPrompt: null,
      });

      await recordAudit({
        eventType: 'APPLICATION_SUBMITTED_DEMO',
        userId: ctx.userId,
        taskId: child.id,
        metadata: { document: documentKey, route: 'retrieve_number' },
      });

      await sendDemoEmail({
        userId: ctx.userId,
        to: profile.email,
        subject: `Request to retrieve your ${definition.label} number`,
        body: `Your request to retrieve your ${definition.label} number has been sent to ${definition.issuedBy}.\n\nRequest number: ${reference}\n\nWe will share your number with you here as soon as they reply. You do not have to wait.`,
        taskId: child.id,
      });

      return {
        content: `Done. I have registered a request with ${definition.issuedBy} to retrieve your ${definition.label} number. Request number ${reference}.\n\nI will share the number with you here as soon as they reply — you do not have to wait.`,
        processing: submissionPlan(`${definition.label} number retrieval`),
        blocks: [noticeBlock(`Request number: ${reference}`, 'success', 'Request sent')],
        inputState: 'BACKGROUND_PROCESSING',
      };
    }

    // ---------- "something on it is wrong" ----------
    case 'DOC_FIELD': {
      if (!child) return notFound();
      const field = String(payload.field ?? 'name');
      const profile = await db.getProfile(ctx.userId);
      const labels: Record<string, string> = {
        mobile: 'Mobile number',
        name: 'Name',
        address: 'Address',
        dateOfBirth: 'Date of birth',
      };
      const current: Record<string, string> = {
        mobile: profile.mobile,
        name: profile.name,
        address: `${profile.city}, ${profile.state}`,
        dateOfBirth: formatDate(profile.dateOfBirth),
      };
      await advanceTask({
        taskId: child.id,
        currentStep: 'details',
        status: 'WAITING_FOR_USER',
        data: { field, fieldLabel: labels[field], currentValue: current[field] },
      });
      return {
        content: `Right now it says:\n\n${current[field]}\n\nWhat should it say instead?`,
        blocks: [
          {
            type: 'text_input',
            childTaskId: child.id,
            action: 'DOC_NEW_VALUE',
            field,
            label: `New ${labels[field].toLowerCase()}`,
            placeholder: field === 'mobile' ? '+91 90000 00000' : undefined,
            current: current[field],
            help: 'I will show you everything again before anything is sent.',
          },
        ],
        inputState: 'WAITING_FOR_USER',
      };
    }

    case 'DOC_NEW_VALUE': {
      if (!child) return notFound();
      if (!value) {
        return { content: 'Please type the new value.', inputState: 'WAITING_FOR_USER' };
      }
      const field = String(child.data.field ?? 'name');
      await advanceTask({ taskId: child.id, data: { newValue: value } });

      // A new mobile number has to be checked before it can be used.
      if (field === 'mobile') {
        await advanceTask({
          taskId: child.id,
          currentStep: 'verify',
          complete: ['details'],
          status: 'WAITING_FOR_USER',
        });
        return {
          content: `To keep your account safe, we need to check that ${value} is yours.`,
          blocks: [{ type: 'otp', childTaskId: child.id, mobile: value }],
          inputState: 'WAITING_FOR_USER',
        };
      }
      return reviewDraft(ctx, child);
    }

    case 'DOC_OTP': {
      if (!child) return notFound();
      if (value !== DEMO_OTP) {
        return {
          content: 'That code did not match. Please type it again.',
          blocks: [
            {
              type: 'otp',
              childTaskId: child.id,
              mobile: String(child.data.newValue ?? ''),
              alreadySent: true,
            },
          ],
          inputState: 'WAITING_FOR_USER',
        };
      }

      // A number checked from the citizen's own details is saved straight away.
      // A correction to a document is a different thing: that record only
      // changes when the office processes it, so it waits for the background
      // step rather than being written here.
      const newMobile = String(child.data.newValue ?? '');
      if (child.data.profileEdit && newMobile) {
        await db.updateProfile(ctx.userId, { mobile: newMobile });
      }

      await advanceTask({
        taskId: child.id,
        complete: ['verify'],
        data: { mobileVerified: true },
        timeline: { label: 'Mobile number checked', tone: 'success' },
      });
      const refreshed = (await db.getTask(child.id)) ?? child;
      const draft = await reviewDraft(ctx, refreshed);
      return { ...draft, content: `Checked. ${draft.content}` };
    }

    // ---------- "I am having a problem" ----------
    case 'DOC_PROBLEM_DETAIL': {
      if (!child) return notFound();
      const documentKey = String(child.data.documentKey);
      const definition = documentDefinition(documentKey);
      const profile = await db.getProfile(ctx.userId);

      // Never file a blank, generic complaint — the citizen's own words are the
      // whole point. If they gave nothing, ask again instead of inventing one.
      if (!value || value.replace(/[^a-z0-9]/gi, '').length < 6) {
        await advanceTask({
          taskId: child.id,
          currentStep: 'details',
          status: 'WAITING_FOR_USER',
          data: { awaiting: 'problem_detail' },
        });
        return {
          content: `Tell me what went wrong with your ${definition.label}, in your own words — for example what the office told you, or what you are unable to do.`,
          blocks: [
            {
              type: 'text_input',
              childTaskId: child.id,
              action: 'DOC_PROBLEM_DETAIL',
              field: 'detail',
              label: 'What happened',
              placeholder: 'For example: the office says my record is not found',
              help: 'A sentence or two is enough. I will write it up properly for you.',
            },
          ],
          inputState: 'WAITING_FOR_USER',
        };
      }

      const stored = storedIdentifier(profile, documentKey);
      const route = routeGrievance(`${value} (regarding my ${definition.label})`);
      const subject = (value.split(/[.\n]/)[0]?.trim() || `Problem with my ${definition.label}`).slice(0, 90);
      const addressParts = [profile.city, profile.state, profile.pincode].filter(Boolean).join(', ');
      const body = [
        `To,\nThe Grievance Officer,\n${route.department}.`,
        `Subject: ${subject}`,
        'Respected Sir/Madam,',
        `I, ${profile.name}${addressParts ? `, resident of ${addressParts}` : ''}, wish to report a problem with my ${definition.label}${stored ? ` (${stored.label}: ${stored.value})` : ''}:`,
        `"${value}"`,
        'I request you to look into this matter and resolve it at the earliest, and to keep me informed of the action taken.',
        `Regards,\n${profile.name}${profile.mobile ? `\nMobile: ${profile.mobile}` : ''}`,
      ].join('\n\n');

      await advanceTask({
        taskId: child.id,
        complete: ['details'],
        currentStep: 'review',
        status: 'WAITING_FOR_CONFIRMATION',
        data: {
          awaiting: null,
          complaintSubject: subject,
          complaintBody: body,
          complaintDepartment: route.department,
          complaintEmail: route.email,
          complaintCategory: route.category,
          complaintAuthority: route.authority,
          complaintPortalName: route.portalName,
          complaintPortalUrl: route.portalUrl,
          complaintStatement: value,
        },
      });

      return {
        content: `Based on what you told me, this will go to **${route.department}**. I have written it up formally using your own words. Change anything you want, then send it.`,
        blocks: [
          {
            type: 'review',
            title: 'Your complaint',
            rows: [
              { label: 'About', value: definition.label },
              { label: 'Goes to', value: route.department },
              { label: 'Subject', value: subject },
            ],
            warning: 'This is a practice app. Nothing is sent to a real government office.',
            confirm: serverAction('Send it', 'DOC_SUBMIT', { childTaskId: child.id }, 'primary'),
            cancel: serverAction('Stop this', 'DOC_CANCEL', { childTaskId: child.id }, 'ghost'),
          },
          noticeBlock(body, 'info', 'What it says'),
        ],
        actions: [
          {
            kind: 'action',
            label: 'Change the wording',
            action: 'DOC_PROBLEM_EDIT',
            payload: { childTaskId: child.id },
            variant: 'secondary',
          },
        ],
        inputState: 'WAITING_FOR_CONFIRMATION',
      };
    }

    case 'DOC_PROBLEM_EDIT': {
      if (!child) return notFound();
      return {
        content: 'Tell me what it should say instead, in your own words.',
        blocks: [
          {
            type: 'text_input',
            childTaskId: child.id,
            action: 'DOC_PROBLEM_DETAIL',
            field: 'detail',
            label: 'What happened',
            current: '',
            help: 'I will write it up properly for you.',
          },
        ],
        inputState: 'WAITING_FOR_USER',
      };
    }

    // ---------- profile confirmation on an application ----------
    case 'DOC_CONFIRM_PROFILE': {
      if (!child) return notFound();
      return reviewDraft(ctx, child);
    }

    case 'DOC_EDIT_PROFILE': {
      if (!child) return notFound();
      const patch = (payload.patch ?? {}) as Record<string, string>;
      const profile = await db.getProfile(ctx.userId);
      const next: Record<string, unknown> = {};
      if (patch.name) next.name = patch.name;
      if (patch.dateOfBirth) next.dateOfBirth = patch.dateOfBirth;
      if (patch.gender) next.gender = patch.gender;
      if (patch.city) next.city = patch.city;
      if (patch.email) next.email = patch.email;

      // A changed mobile number is checked separately, never saved silently.
      const wantsMobile = patch.mobile && patch.mobile !== profile.mobile;
      if (Object.keys(next).length > 0) await db.updateProfile(ctx.userId, next);

      if (wantsMobile) {
        await advanceTask({
          taskId: child.id,
          data: {
            field: 'mobile',
            fieldLabel: 'Mobile number',
            currentValue: profile.mobile,
            newValue: patch.mobile,
            profileEdit: true,
          },
        });
        return {
          content: `To keep your account safe, we need to check that ${patch.mobile} is yours.`,
          blocks: [{ type: 'otp', childTaskId: child.id, mobile: String(patch.mobile) }],
          inputState: 'WAITING_FOR_USER',
        };
      }

      const updated = (await db.getTask(child.id)) ?? child;
      const draft = await profileConfirmDraft(ctx, updated);
      return { ...draft, content: `Saved. ${draft.content}` };
    }

    // ---------- send / stop ----------
    case 'DOC_SUBMIT': {
      if (!child) return notFound();
      if (child.status === 'PROCESSING' || child.status === 'COMPLETED') {
        return {
          content: 'That was already sent. I will tell you as soon as there is news.',
          inputState: 'BACKGROUND_PROCESSING',
        };
      }
      return submitChild(ctx, child);
    }

    case 'DOC_EDIT': {
      if (!child) return notFound();
      return profileConfirmDraft(ctx, child);
    }

    case 'DOC_CANCEL': {
      if (!child) return notFound();
      if (!payload.confirmed) {
        const definition = documentDefinition(String(child.data.documentKey));
        return {
          content: `Do you want to stop sorting out your ${definition.label}?`,
          actions: [
            serverAction('Yes, stop it', 'DOC_CANCEL', { childTaskId: child.id, confirmed: true }, 'danger'),
            serverAction('No, keep going', 'DOC_EDIT', { childTaskId: child.id }, 'primary'),
          ],
          inputState: 'WAITING_FOR_USER',
        };
      }
      await cancelTask(child.id);
      if (child.parentTaskId) {
        await updateRequirement(child.parentTaskId, String(child.data.documentKey), {
          state: 'MISSING',
          childTaskId: null,
          note: 'You stopped this one. You can start it again whenever you want.',
        });
        const parent = await db.getTask(child.parentTaskId);
        return {
          content: 'Stopped. Nothing was sent. Your application is still saved.',
          blocks: parent ? [{ type: 'requirements', taskId: parent.id, title: parent.title }] : [],
          actions: parent ? outstandingActions(parent) : [],
          inputState: 'WAITING_FOR_DOCUMENT',
        };
      }
      return { content: 'Stopped. Nothing was sent.', inputState: 'IDLE' };
    }

    // ---------- the parent application ----------
    case 'PARENT_REVIEW': {
      const parent = await db.getTask(String(payload.taskId ?? ''));
      if (!parent || parent.userId !== ctx.userId) return notFound();
      const progress = requirementProgress(parent);
      if (!progress.allReady) {
        return {
          content: `Your ${parent.title.toLowerCase()} still needs ${progress.total - progress.ready} paper${
            progress.total - progress.ready === 1 ? '' : 's'
          }.`,
          blocks: [{ type: 'requirements', taskId: parent.id, title: parent.title }],
          actions: outstandingActions(parent),
          inputState: 'WAITING_FOR_DOCUMENT',
        };
      }
      const profile = await db.getProfile(ctx.userId);
      const requirements = readRequirements(parent);
      return {
        content: 'Everything is ready. Here is your application — have a look before it goes.',
        blocks: [
          {
            type: 'review',
            title: `${parent.title} — your check`,
            rows: [
              { label: 'Name', value: profile.name },
              { label: 'Date of birth', value: formatDate(profile.dateOfBirth) },
              { label: 'Address', value: `${profile.city}, ${profile.state}` },
              { label: 'Mobile', value: profile.mobile },
              { label: 'Papers', value: `All ${requirements.length} ready` },
            ],
            warning: 'This is a practice app. Nothing is sent to the passport office.',
            confirm: serverAction('Send my application', 'PARENT_SUBMIT', { taskId: parent.id }, 'primary'),
            cancel: serverAction('Stop this', 'CANCEL_TASK', { taskId: parent.id }, 'ghost'),
          },
          { type: 'requirements', taskId: parent.id, title: parent.title },
        ],
        inputState: 'WAITING_FOR_CONFIRMATION',
      };
    }

    case 'PARENT_SUBMIT': {
      const parent = await db.getTask(String(payload.taskId ?? ''));
      if (!parent || parent.userId !== ctx.userId) return notFound();
      if (parent.applicationId) {
        return {
          content: `That was already sent, number ${parent.applicationId}.`,
          actions: [linkAction('See my applications', '/applications', 'secondary')],
          inputState: 'IDLE',
        };
      }
      const reference = demoReference('PASS', 124);
      const profile = await db.getProfile(ctx.userId);
      const updated = await advanceTask({
        taskId: parent.id,
        complete: ['preparation', 'review', 'submission'],
        currentStep: 'verification',
        status: 'PROCESSING',
        applicationId: reference,
        timeline: { label: 'Application sent', tone: 'success' },
        nextActionLabel: null,
        nextActionPrompt: null,
      });
      await recordAudit({
        eventType: 'USER_CONFIRMED_PASSPORT_APPLICATION',
        userId: ctx.userId,
        taskId: parent.id,
        metadata: { service: 'PASSPORT' },
      });
      await notify({
        userId: ctx.userId,
        title: 'Your passport application was sent',
        body: `Number ${reference}. The department is looking at it now.`,
        tone: 'success',
        taskId: parent.id,
        actionPrompt: 'Show my applications',
        actionLabel: 'See it',
      });
      await sendDemoEmail({
        userId: ctx.userId,
        to: profile.email,
        subject: 'Passport application sent',
        body: `Your passport application has been sent.\n\nNumber to keep: ${reference}\n\nYou can keep using NammaSahaay while it is being looked at.`,
        taskId: parent.id,
      });
      const download = await registerDownload({
        userId: ctx.userId,
        fileName: 'Passport_Application.pdf',
        title: 'Passport application',
        kind: 'application',
        taskId: parent.id,
      });
      return {
        content: 'Done. Your passport application has been sent.',
        processing: submissionPlan('passport application'),
        blocks: [
          noticeBlock(`Keep this number safe: ${reference}`, 'success', 'Sent'),
          ...(updated ? [{ type: 'task_progress' as const, task: updated, steps: [] }] : []),
        ],
        actions: [
          downloadAction('Save a copy', download.id),
          linkAction('See it in my applications', '/applications', 'secondary'),
        ],
        suggestions: ['Show my PF money', 'Show my applications'],
        inputState: 'BACKGROUND_PROCESSING',
      };
    }

    default:
      return null;
  }
}

function routeLabel(route: ResolutionRoute, name: string): string {
  switch (route) {
    case 'have_it':
      return `I already have my ${name}`;
    case 'already_applied':
      return 'I applied but have not got it';
    case 'never_applied':
      return `I never applied for ${name}`;
    case 'lost':
      return `I lost my ${name}`;
    case 'update':
      return 'Something on it is wrong';
    default:
      return 'I am having a problem';
  }
}

function routeHint(route: ResolutionRoute): string {
  switch (route) {
    case 'have_it':
      return 'Pick it from your papers or add a photo or PDF.';
    case 'already_applied':
      return 'I will check what is happening with your application.';
    case 'never_applied':
      return 'I will help you apply for it here.';
    case 'lost':
      return 'I will help you get another copy.';
    case 'update':
      return 'Name, address, date of birth or mobile number.';
    default:
      return 'I will write a complaint for you.';
  }
}

function notFound(): AssistantDraft {
  return {
    content: 'I cannot find that any more. Tell me what you need and I will start again.',
    actions: [promptAction('Start again', 'I want to apply for a passport', 'secondary')],
    inputState: 'IDLE',
  };
}

/** Used by the orchestrator to keep a document child's profile data fresh. */
export async function refreshChild(taskId: string): Promise<CitizenTask | null> {
  return getDatabase().getTask(taskId);
}
