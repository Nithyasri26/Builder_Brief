/**
 * The passport journey, end to end.
 *
 * Runs the exact scenario the product is built around: a passport needing five
 * papers, two of them missing, resolved in parallel by different routes, with
 * the application picking itself back up when the last one lands.
 *
 *   npm run dev              # in one terminal
 *   npm run passport:check   # in another
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

const get = async (path) => (await fetch(`${BASE}${path}`, { cache: 'no-store' })).json();
const block = (message, type) => (message.blocks ?? []).find((b) => b.type === type);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(step, condition, detail = '') {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${step}${detail ? ` — ${detail}` : ''}`);
  if (!condition) fails.push(step);
}

async function requirements(taskId) {
  return (await get(`/api/tasks/${taskId}`)).requirements;
}

await fetch(`${BASE}/api/demo/reset`, { method: 'POST' });
console.log('--- reset ---');

// 1-5 the passport is started and the papers are checked
const start = await chat('I want to apply for a passport');
const req = block(start, 'requirements');
check('1. Passport application started', Boolean(req));
const parentId = req.taskId;
let state = await requirements(parentId);
check('2. Five papers required', state.total === 5, `${state.total} required`);
check('3. Three already available', state.ready === 3, `${state.ready} ready`);
check(
  '4. Aadhaar is missing',
  state.requirements.find((r) => r.key === 'aadhaar')?.state === 'MISSING',
);
check(
  '5. Birth certificate is missing',
  state.requirements.find((r) => r.key === 'birth_certificate')?.state === 'MISSING',
);
check('5b. Input is not locked open-endedly', start.inputState === 'WAITING_FOR_DOCUMENT');

// 6 the citizen chooses to sort out both
const both = await act('RESOLVE_ALL', { taskId: parentId });
const optionBlocks = (both.blocks ?? []).filter((b) => b.type === 'document_options');
check('6. Both papers offered together', optionBlocks.length === 2);
check(
  '6b. Every situation is offered',
  optionBlocks[0].options.length >= 6,
  optionBlocks[0].options.map((o) => o.route).join(', '),
);

// 7-9 Aadhaar: never applied -> application -> processing
const aadhaarStart = await act('DOC_ROUTE', {
  documentKey: 'aadhaar',
  route: 'never_applied',
  parentTaskId: parentId,
});
check('7. Aadhaar uses details already on file', Boolean(block(aadhaarStart, 'profile_confirm')));
const aadhaarChildId = block(aadhaarStart, 'profile_confirm').childTaskId;

const aadhaarReview = await act('DOC_CONFIRM_PROFILE', { childTaskId: aadhaarChildId });
check('8. Aadhaar shows a review before sending', Boolean(block(aadhaarReview, 'review')));

const aadhaarSent = await act('DOC_SUBMIT', { childTaskId: aadhaarChildId });
check('9. Aadhaar sent', /AAD-\d{4}-/.test(JSON.stringify(aadhaarSent.blocks)));
check('9b. Citizen is free to carry on', aadhaarSent.inputState === 'BACKGROUND_PROCESSING');

state = await requirements(parentId);
check(
  '9c. Aadhaar now shows as with the office',
  ['APPLICATION_SUBMITTED', 'PROCESSING'].includes(
    state.requirements.find((r) => r.key === 'aadhaar').state,
  ),
);

// 10 birth certificate runs independently, by a different route
const birthStart = await act('DOC_ROUTE', {
  documentKey: 'birth_certificate',
  route: 'have_it',
  parentTaskId: parentId,
});
const picker = block(birthStart, 'document_picker');
check('10. Birth certificate started while Aadhaar is still going', Boolean(picker));
check(
  '10b. It was found in the online locker',
  (picker.locker ?? []).some((d) => d.name === 'Birth Certificate'),
);

const picked = await act('DOC_PICK_LOCKER', {
  childTaskId: picker.childTaskId,
  digiLockerId: picker.locker.find((d) => d.name === 'Birth Certificate').id,
});
check('11. Birth certificate attached', /4 of 5|last paper/i.test(picked.content), picked.content.slice(0, 70));

state = await requirements(parentId);
check('12. Progress moved to 4 of 5', state.ready === 4, `${state.ready} of ${state.total}`);
check('12b. Passport was never lost', state.taskId === parentId);

// 13 the citizen uses another service while Aadhaar is still being sorted out
const pf = await chat('Show my PF money');
check('13. Other services still usable', Boolean(block(pf, 'pf_passbook')));

// 14 Aadhaar comes back on its own
console.log('    waiting for the Aadhaar office to finish…');
let settled = false;
for (let attempt = 0; attempt < 20; attempt += 1) {
  await sleep(3000);
  state = await requirements(parentId);
  if (state.allReady) {
    settled = true;
    break;
  }
}
check('14. Aadhaar completed on its own', settled, `${state.ready} of ${state.total}`);
check('15. Progress reached 5 of 5', state.ready === 5);

// 16 the citizen was told, in the app and by email
const notes = await get('/api/notifications');
check(
  '16. Notification for each completion',
  notes.notifications.some((n) => /Aadhaar is ready/i.test(n.title)),
);
check(
  '16b. Told that everything is now ready',
  notes.notifications.some((n) => /all 5 papers/i.test(n.body)),
  notes.notifications[0]?.body.slice(0, 60),
);
const emails = await get('/api/emails');
check(
  '17. Emails sent along the way',
  emails.emails.length >= 2,
  emails.emails.map((e) => e.subject).join(' | '),
);

// 18 the passport picks itself back up
const review = await act('PARENT_REVIEW', { taskId: parentId });
check('18. Ready for final review', Boolean(block(review, 'review')));
check('18b. Nothing sent without confirmation', review.inputState === 'WAITING_FOR_CONFIRMATION');

const submitted = await act('PARENT_SUBMIT', { taskId: parentId });
check('19. Passport sent', /PASS-\d{4}-/.test(JSON.stringify(submitted.blocks)));

const apps = await get('/api/applications');
const passport = apps.applications.find((a) => a.title === 'Passport Application');
check('19b. Shows as being processed', passport?.statusLabel === 'Being processed', passport?.statusLabel);
check(
  '19c. Papers and children all tracked',
  apps.applications.length >= 3,
  `${apps.applications.length} items in My Applications`,
);

const after = await chat('Show my papers');
check('20. Services still work afterwards', Boolean(block(after, 'documents')));

console.log(fails.length === 0 ? '\nALL STEPS PASSED' : `\nFAILED: ${fails.join(', ')}`);
process.exit(fails.length === 0 ? 0 : 1);
