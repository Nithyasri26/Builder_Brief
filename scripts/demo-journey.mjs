/**
 * End-to-end demo journey check.
 *
 * Walks the exact journey a judge is asked to run, against a server already
 * started with `npm run dev`, and reports PASS/FAIL per step. It resets the
 * demo at the start and at the end, so it is safe to run repeatedly.
 *
 *   npm run dev          # in one terminal
 *   npm run demo:check   # in another
 */
const BASE = process.env.DEMO_BASE_URL ?? 'http://localhost:3000';
let conversationId = null;
const fails = [];

async function chat(message) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, conversationId: conversationId ?? undefined }),
  });
  if (!res.ok) throw new Error(`chat ${res.status}: ${message}`);
  const data = await res.json();
  conversationId = data.conversation.id;
  return data.assistantMessage;
}

async function act(action, payload = {}) {
  const res = await fetch(`${BASE}/api/chat/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, conversationId, payload }),
  });
  if (!res.ok) throw new Error(`action ${res.status}: ${action}`);
  return (await res.json()).assistantMessage;
}

function check(step, condition, detail = '') {
  const mark = condition ? 'PASS' : 'FAIL';
  if (!condition) fails.push(step);
  console.log(`${mark}  ${step}${detail ? ` — ${detail}` : ''}`);
}

function blocks(message) {
  return (message.blocks ?? []).map((b) => b.type);
}

function find(message, type) {
  return (message.blocks ?? []).find((b) => b.type === type);
}

await fetch(`${BASE}/api/demo/reset`, { method: 'POST' });
console.log('--- demo reset ---');

// 2-5 schemes, eligibility, documents
const m1 = await chat(
  "My husband passed away. I have one daughter and I don't have a job. I am not educated. Is there any government support?",
);
const schemes = find(m1, 'schemes');
check('2. Ask about support after loss', /sorry for your loss/i.test(m1.content));
check('3. Find schemes', Boolean(schemes), `${schemes?.matches.length ?? 0} results`);
check(
  '4. Potential eligibility levels',
  schemes.matches.some((m) => m.level === 'potential_match') &&
    schemes.matches.some((m) => m.level === 'more_information_required') &&
    schemes.matches.some((m) => m.level === 'not_matching'),
);
check(
  '5. Required documents listed',
  schemes.matches[0].documents.length > 0 && schemes.matches[0].documents.every((d) => d.why),
);

// 6-7 reuse + start
const m2 = await act('START_SCHEME_APPLICATION', { schemeId: 'demo-family-support' });
const reusable = find(m2, 'documents');
check('6. Reuse existing documents offered', (reusable?.documents.length ?? 0) === 4);
check('7. Application started', blocks(m2).includes('checklist'));

// 8-9 pause + resume
const m3 = await chat("I'll do it later");
check('8. Pause application', find(m3, 'task_progress')?.task.status === 'WAITING_FOR_USER');
const m4 = await chat('Continue my demo family support assistance application');
check('9. Resume application', blocks(m4).includes('documents'));

const m5 = await act('USE_EXISTING_DOCUMENTS', { taskId: find(m3, 'task_progress').task.id });
check('9b. Review before submission', Boolean(find(m5, 'review')));
const m6 = await act('SUBMIT_SCHEME_APPLICATION', { taskId: find(m5, 'task_progress').task.id });
check('9c. Application sent', /SCHEME-\d{4}-/.test(JSON.stringify(m6.blocks)));

// 10-11 passbook + download
const m7 = await chat('I also want my PF passbook');
check('10. PF passbook', find(m7, 'pf_passbook')?.passbook.balance === 184250);
const downloads = await (await fetch(`${BASE}/api/downloads`)).json();
const passbookFile = downloads.files.find((f) => f.kind === 'pf_passbook');
const pdf = await fetch(`${BASE}/api/downloads/${passbookFile.id}/file`);
const bytes = new Uint8Array(await pdf.arrayBuffer());
check(
  '11. Download PF passbook',
  pdf.ok && new TextDecoder().decode(bytes.slice(0, 8)) === '%PDF-1.4',
  `${bytes.length} bytes`,
);

// 12-13 withdrawal + pause
const m8 = await chat('I want to withdraw ₹50,000');
const review = find(m8, 'review');
check('12. Withdrawal review', review?.rows.some((r) => r.value === '₹50,000'));
check('12b. Requires confirmation', review?.confirm.action === 'CONFIRM_PF_WITHDRAWAL');
const m9 = await chat("I'll do it later");
check('13. Pause withdrawal', find(m9, 'task_progress')?.task.status === 'WAITING_FOR_USER');

// 14-15 passport: five papers, tracked one by one
const m10 = await chat('I want to apply for a passport');
const passportRequirements = find(m10, 'requirements');
check('14. Passport workflow', Boolean(passportRequirements));
const passportState = await (
  await fetch(`${BASE}/api/tasks/${passportRequirements.taskId}`)
).json();
check(
  '15. Papers checked against what the citizen holds',
  passportState.requirements.total === 5 && passportState.requirements.ready === 3,
  `${passportState.requirements.ready} of ${passportState.requirements.total} ready`,
);

// 16-18 complaint
const m11 = await chat('I have a complaint because my pension has not arrived');
check('16. Complaint asks one question', /when did you last get the payment/i.test(m11.content));
const m12 = await chat('June');
const draft = find(m12, 'complaint_draft');
check('16b. Complaint draft', /June/.test(draft?.complaint.subject ?? ''));
const m13 = await act('UPDATE_COMPLAINT', {
  complaintId: draft.complaint.id,
  subject: draft.complaint.subject,
  description: `${draft.complaint.description}\n\nEdited by the citizen.`,
});
check('17. Edit complaint', /Edited by the citizen/.test(find(m13, 'complaint_draft').complaint.description));
const m14 = await act('SEND_COMPLAINT', { taskId: draft.complaint.taskId });
check('18. Confirm complaint', /GRV-\d{4}-/.test(JSON.stringify(m14.blocks)));

// train booking
const m15 = await chat('I want to go from Bengaluru to Chennai tomorrow');
const trains = find(m15, 'trains');
check('18b. Train search', (trains?.options.length ?? 0) === 3);
const m16 = await act('SELECT_TRAIN', { taskId: trains.taskId, trainId: trains.options[0].id });
check('18c. Journey review', Boolean(find(m16, 'review')));
const m17 = await act('CONFIRM_TRAIN', { taskId: trains.taskId });
check('18d. Journey saved', /RAIL-\d{4}-/.test(JSON.stringify(m17.blocks)));

// 19-22 surfaces
const apps = await (await fetch(`${BASE}/api/applications`)).json();
check('19. My Applications', apps.applications.length === 5, `${apps.applications.length} applications`);
const docs = await (await fetch(`${BASE}/api/documents`)).json();
check('20. My Documents', docs.documents.length === 7, `${docs.documents.length} papers`);
const dls = await (await fetch(`${BASE}/api/downloads`)).json();
// Four files: scheme application, passbook, complaint, ticket. The passport and
// withdrawal tasks are deliberately left unsubmitted at this point in the journey.
check('21. Downloads', dls.files.length === 4, dls.files.map((f) => f.fileName).join(', '));
const notes = await (await fetch(`${BASE}/api/notifications`)).json();
check('22. Notifications', notes.notifications.length >= 6, `${notes.unread} unread`);

// 23 history
const convs = await (await fetch(`${BASE}/api/conversations`)).json();
const detail = await (await fetch(`${BASE}/api/conversations/${conversationId}`)).json();
check('23. Chat history restored', detail.messages.length > 20, `${detail.messages.length} messages`);
check('23b. Automatic titles', convs.conversations.every((c) => c.title && c.title !== 'New conversation'),
  convs.conversations.map((c) => c.title).join(' | '));

// every PDF opens
for (const file of dls.files) {
  const res = await fetch(`${BASE}/api/downloads/${file.id}/file`);
  const buf = new Uint8Array(await res.arrayBuffer());
  check(`PDF ${file.fileName}`, res.ok && new TextDecoder().decode(buf.slice(0, 8)) === '%PDF-1.4');
}

// 24 reset
await fetch(`${BASE}/api/demo/reset`, { method: 'POST' });
const after = await (await fetch(`${BASE}/api/applications`)).json();
const afterDocs = await (await fetch(`${BASE}/api/documents`)).json();
check('24. Reset demo', after.applications.length === 0 && afterDocs.documents.length === 7);

console.log(fails.length === 0 ? '\nALL STEPS PASSED' : `\nFAILED: ${fails.join(', ')}`);
process.exit(fails.length === 0 ? 0 : 1);
