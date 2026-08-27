const BASE = 'http://localhost:3000';
let conversationId = null;
const fails = [];

async function chat(message) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, conversationId: conversationId ?? undefined }),
  });
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
  return (await res.json()).assistantMessage;
}
const block = (m, t) => (m.blocks ?? []).find((b) => b.type === t);
function check(step, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails.push(step);
}

await fetch(`${BASE}/api/demo/reset`, { method: 'POST' });

// ---- "I lost my Aadhaar" understood straight from the sentence ----
const lost = await chat('I lost my Aadhaar');
check('lost: understood', lost.meta.intent === 'RESOLVE_DOCUMENT', lost.meta.intent);
check(
  'lost: does not start a new application blindly',
  Boolean(block(lost, 'profile_confirm')),
  lost.content.slice(0, 80),
);
const lostChild = block(lost, 'profile_confirm')?.childTaskId;
const lostReview = await act('DOC_CONFIRM_PROFILE', { childTaskId: lostChild });
check('lost: review before sending', Boolean(block(lostReview, 'review')));
const lostSent = await act('DOC_SUBMIT', { childTaskId: lostChild });
check('lost: request sent', /AAD-\d{4}-/.test(JSON.stringify(lostSent.blocks)));

// ---- "my Aadhaar mobile number changed" -> correction + OTP ----
await fetch(`${BASE}/api/demo/reset`, { method: 'POST' });
conversationId = null;
const update = await chat('My Aadhaar mobile number has changed');
check('update: understood', update.meta.intent === 'RESOLVE_DOCUMENT', update.meta.intent);
const fieldButtons = (update.actions ?? []).map((a) => a.label);
check('update: asks what is wrong', fieldButtons.includes('My mobile number'), fieldButtons.join(', '));
const childId = update.actions.find((a) => a.label === 'My mobile number').payload.childTaskId;

const askNew = await act('DOC_FIELD', { childTaskId: childId, field: 'mobile' });
check('update: shows the current value first', /98765 43210/.test(askNew.content), askNew.content.slice(0, 60));

const otpStep = await act('DOC_NEW_VALUE', { childTaskId: childId, value: '+91 90000 11111' });
check('update: asks to verify the new number', Boolean(block(otpStep, 'otp')));

const wrongOtp = await act('DOC_OTP', { childTaskId: childId, value: '000000' });
check('update: wrong code refused', /did not match/i.test(wrongOtp.content));

const goodOtp = await act('DOC_OTP', { childTaskId: childId, value: '123456' });
const updateReview = block(goodOtp, 'review');
check('update: correct code accepted', Boolean(updateReview));
check(
  'update: review shows old and new',
  JSON.stringify(updateReview?.rows).includes('90000 11111'),
  JSON.stringify(updateReview?.rows ?? []).slice(0, 120),
);
const updateSent = await act('DOC_SUBMIT', { childTaskId: childId });
check('update: correction sent', /AAD-\d{4}-/.test(JSON.stringify(updateSent.blocks)));

// ---- "I applied but have not got it" ----
await fetch(`${BASE}/api/demo/reset`, { method: 'POST' });
conversationId = null;
const applied = await chat('I applied for my birth certificate but have not received it');
check('applied: understood', applied.meta.intent === 'RESOLVE_DOCUMENT', applied.meta.intent);
const refBlock = block(applied, 'text_input');
check('applied: asks for the application number', Boolean(refBlock), applied.content.slice(0, 70));
const withRef = await act('DOC_REFERENCE', {
  childTaskId: refBlock.childTaskId,
  value: 'BIR-2026-00088',
});
check('applied: does not make them apply again', /still being checked/i.test(JSON.stringify(withRef.blocks)));

// ---- "I have a problem" -> complaint ----
await fetch(`${BASE}/api/demo/reset`, { method: 'POST' });
conversationId = null;
const problem = await chat('I have a problem with my Aadhaar, I cannot download it');
const problemInput = block(problem, 'text_input');
check('problem: asks what went wrong', Boolean(problemInput), problem.content.slice(0, 70));
const draft = await act('DOC_PROBLEM_DETAIL', {
  childTaskId: problemInput.childTaskId,
  value: 'The website says my record is not found',
});
check('problem: writes a complaint the citizen can change', Boolean(block(draft, 'review')));
check(
  'problem: uses the citizen own words',
  /record is not found/.test(JSON.stringify(draft.blocks)),
);
const complaintSent = await act('DOC_SUBMIT', { childTaskId: problemInput.childTaskId });
check('problem: complaint sent', /AAD-\d{4}-/.test(JSON.stringify(complaintSent.blocks)));
const complaints = await (await fetch(`${BASE}/api/complaints`)).json();
check('problem: recorded as a complaint', complaints.complaints.length === 1);

console.log(fails.length === 0 ? '\nALL ROUTES PASSED' : `\nFAILED: ${fails.join(', ')}`);
process.exit(fails.length === 0 ? 0 : 1);
