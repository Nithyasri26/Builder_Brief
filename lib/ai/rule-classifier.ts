import type { Intent, IntentEntities, IntentResult } from '@/types/ai';
import type { CitizenSituation } from '@/types/user';
import { lookupTerm } from '@/data/demo/glossary';

/**
 * Deterministic first pass.
 *
 * Most citizen requests are short and unambiguous ("show my documents",
 * "I need my PF passbook"). Sending those to a large language model costs
 * money and adds latency for no benefit, so they are resolved here in plain
 * TypeScript. Only genuinely open-ended language falls through to a model.
 */

interface Pattern {
  intent: Intent;
  confidence: number;
  /** All of these must appear for the pattern to fire. */
  all?: RegExp[];
  /** Any one of these fires the pattern. */
  any?: RegExp[];
  /** None of these may appear. */
  none?: RegExp[];
}

const PATTERNS: Pattern[] = [
  {
    // "how much will i get", "when will the money come" — asked about whatever
    // the citizen has already started, so it routes to their applications.
    intent: 'VIEW_APPLICATIONS',
    confidence: 0.91,
    any: [
      /\b(how much|how many days|how long|when)\b.*\b(get|come|arrive|receive|money|paid|approved|ready)\b/,
      /\bwhat happened to\b/,
      /\bany (update|news)\b/,
      /\bis it (done|approved|sent|ready)\b/,
      /\bhow many (papers|documents|more)\b/,
      /\bwhat.{0,20}\b(still|else)\b.{0,12}\bneed\b/,
      /\bwhat is (left|pending|remaining)\b/,
    ],
    // "how much PF money do I have" is a balance question, not a status one.
    none: [/\b(pf|epf|provident|passbook|balance)\b/],
  },
  {
    intent: 'PAUSE_TASK',
    confidence: 0.93,
    any: [
      /\b(i(')?ll|i will)\s+(do|finish|complete|continue)\s+(it|this|that)?\s*(later|tomorrow|afterwards)\b/,
      /\b(do|finish)\s+it\s+later\b/,
      /\b(pause|hold|stop)\s+(this|it|the|my)?\s*(application|withdrawal|task|process)?\b/,
      /\b(not now|later please|save (this|it) for later)\b/,
    ],
  },
  {
    intent: 'CONTINUE_TASK',
    confidence: 0.93,
    any: [
      /\b(continue|resume|carry on with|go back to|finish)\b.*\b(withdrawal|application|passport|scheme|complaint|task|booking)\b/,
      /\bcontinue where i (left off|stopped)\b/,
      /\bwhere did i stop\b/,
    ],
  },
  {
    intent: 'START_PF_WITHDRAWAL',
    confidence: 0.95,
    any: [
      /\b(withdraw|withdrawal|claim|take out|takeout)\b/,
      /\bi (want|need)\b.*\b(my )?(pf|provident|epf)\b.*\b(money|amount|cash)\b/,
      /\b(get|send)\b.*\b(pf|provident|epf)\b.*\b(money|to my bank|to my account)\b/,
    ],
    // "show my PF money" means show the balance, not start a withdrawal.
    none: [/\b(show|see|check|view|display|how much|balance|passbook)\b/],
  },
  {
    intent: 'GET_PF_PASSBOOK',
    confidence: 0.95,
    any: [
      /\b(pf|epf|provident fund)\b/,
      /\b(passbook|pass book)\b/,
      /\bhow much.*\b(pf|provident)\b/,
    ],
    none: [/\bwithdraw|\btake out\b|\bclaim\b|\bneed the money\b/],
  },
  {
    intent: 'START_PASSPORT_APPLICATION',
    confidence: 0.95,
    any: [/\bpassport\b/],
    // "check my passport status" is a tracking question, not a new application.
    none: [
      /\bstatus\b/,
      /\bwhere is my\b/,
      /\bhow (long|much longer)\b/,
      /\btrack\b/,
      /\bupdate on\b/,
    ],
  },
  {
    intent: 'CREATE_COMPLAINT',
    confidence: 0.92,
    any: [
      /\b(complain|complaint|complaints|grievance|grievances)\b/,
      // Civic problems, in the words people actually use.
      /\b(no|without)\s+(water|electricity|power|current|supply|light)\b/,
      /\b(water|power|electricity|current|street ?light)\b[^.]{0,25}\b(cut|gone|off|not (coming|working|available)|problem|issue|failure|outage|fluctuat\w*)\b/,
      /\b(pothole|potholes|manhole|open drain|broken (footpath|road|street ?light))\b/,
      /\b(garbage|waste|rubbish|sewage|drain|drainage|road|footpath|toilet|ration|pds|fair price shop)\b[^.]{0,40}\b(not|problem|issue|broken|blocked|overflow\w*|dirty|clogged|clear|collect\w*|repair\w*|damaged|full of|giving|closed|refus\w*|deny|denied)\b/,
      // "my pension/PF/refund has not come" is how people actually say it.
      /\b(pension|payment|salary|amount|money|refund|pf|provident|scholarship)\b[^.]{0,30}\b(not (been )?(come|received|arrived|credited|paid|refunded|processed|disbursed)|hasn'?t (arrived|come|been received)|did not come|stopped|delayed|missing|pending)\b/,
      /\bnot (received|got|come)\b[^.]{0,30}\b(pension|payment|money|salary|refund)\b/,
      /\b(pension|salary|ration|road|water|electricity)\b.*\b(problem|issue|not working)\b/,
      // Institutions that people complain about being unhelpful or unfair.
      /\b(police|fir|hospital|doctor|nurse|ambulance|school|teacher|principal|bank|atm|passport office)\b[^.]{0,40}\b(not|problem|issue|refus\w*|deny|denied|harass\w*|closed|broken|delay\w*|rude|bribe|corrupt\w*)\b/,
    ],
    // "how much is my electricity bill" is a question, not a complaint.
    none: [/\b(bill amount|how much is|balance|status of my|track my)\b/],
  },
  {
    intent: 'SEARCH_TRAINS',
    confidence: 0.92,
    any: [
      /\btrain\b/,
      /\b(i want to (go|travel)|travel|going)\b.*\bfrom\b.*\bto\b/,
      /\bticket\b.*\b(train|rail)\b/,
      /\birctc\b/,
      // "from Delhi to Jaipur" — a journey reply after we asked for the cities.
      /\bfrom\b\s+[a-z ]{3,}\s+\bto\b\s+[a-z ]{3,}/,
      // A whole message that is just "Delhi to Jaipur (tomorrow)".
      /^[a-z]{3,15}(\s[a-z]{3,15})?\s+to\s+[a-z]{3,15}(\s[a-z]{3,15})?(\s+(today|tomorrow|day after tomorrow))?[.!?]*$/,
    ],
  },
  {
    intent: 'CHECK_GOVERNMENT_SCHEMES',
    confidence: 0.9,
    any: [
      /\b(scheme|schemes|yojana|welfare|benefit|benefits|subsidy|assistance|financial help|government (support|help|aid))\b/,
      /\b(husband|wife|spouse)\b.*\b(passed away|died|expired|no more)\b/,
      /\b(widow|widowed)\b/,
      /\bany (help|support)\b/,
      /\bi (don'?t|do not) have (a )?job\b/,
      /\b(lost|left)\b.*\bjob\b/,
      /\b(unemployed|no income|no earning|jobless)\b/,
      // People in difficulty rarely use the word "scheme".
      /\b(i )?need money\b/,
      /\bno money\b/,
      /\b(struggling|difficulty|poor|helpless)\b/,
      /\bcan i get\b.*\b(help|money|support)\b/,
      /\b(school fees|school fee|hostel fee|education cost)\b/,
      /\bwhat (help|support)\b.*\b(get|available|there)\b/,
      /\bam i eligible\b/,
    ],
  },
  {
    // "I lost my Aadhaar", "my Aadhaar mobile number changed", "I never
    // applied for a birth certificate" — one intent, many situations.
    intent: 'RESOLVE_DOCUMENT',
    confidence: 0.93,
    all: [/\b(aadhaa?r|birth certificate|income certificate|voter card|pan card)\b/],
    any: [
      /\b(lost|misplaced|cannot find|can'?t find)\b/,
      /\bnever (applied|got|had)\b/,
      /\b(applied|enrolled)\b/,
      /\b(wrong|incorrect|mistake|spelling)\b/,
      /\b(changed|change|update|not linked|old number)\b/,
      /\b(problem|issue|not working|cannot download|can'?t download)\b/,
      /\b(i need|i want|apply for|help me with|get my)\b/,
      /\bi already have\b/,
      /\bwhere is my\b/,
      /\bhow do i get\b/,
    ],
    // "do I have my marksheet?" asks about the wallet, not about a situation.
    none: [/\bdo i have\b/],
  },
  {
    intent: 'IMPORT_DIGILOCKER_DOCUMENT',
    confidence: 0.9,
    any: [
      /\bdigilocker\b/,
      /\b(import|get|fetch|pull)\b.*\b(certificate|marksheet|document|licence|license)\b/,
      /\b(lost|misplaced)\b.*\b(certificate|marksheet|document)\b/,
    ],
  },
  {
    intent: 'GET_DOCUMENT',
    confidence: 0.88,
    any: [
      /\bdo i have\b.*\b(marksheet|certificate|document|proof|aadhaar|pan|licence|license)\b/,
      /\b(marksheet|birth certificate|income certificate|driving licence|driving license)\b/,
      /\bfind my\b.*\b(document|certificate|marksheet)\b/,
    ],
  },
  {
    intent: 'VIEW_APPLICATIONS',
    confidence: 0.94,
    any: [
      /\b(my|show|open|view|list)\b.*\bapplications?\b/,
      /\bwhere is my (application|passport|money|pension|request)\b/,
      /\b(application|passport|scheme|withdrawal)\b.*\b(status|progress)\b/,
      /\bstatus of my\b/,
      /\btrack\b.*\b(application|request)\b/,
    ],
  },
  {
    intent: 'VIEW_DOCUMENTS',
    confidence: 0.94,
    any: [
      /\b(show|view|open|list|see|check)\b.*\b(my )?(documents?|papers?|files?|wallet|certificates?)\b/,
      /\bwhat (documents?|papers?) do i have\b/,
      /\bmy (documents?|papers?)\b/,
    ],
  },
  {
    intent: 'VIEW_DOWNLOADS',
    confidence: 0.94,
    any: [/\b(show|view|open|list|my)\b.*\b(downloads?|saved files?)\b/],
  },
  {
    intent: 'VIEW_NOTIFICATIONS',
    confidence: 0.94,
    any: [
      /\b(show|view|open|list|my|any)\b.*\b(notifications?|updates?)\b/,
      /\bwhat'?s new\b/,
    ],
  },
  {
    intent: 'EXPLAIN_TERM',
    confidence: 0.9,
    any: [
      /\bwhat (does|do)\b.*\bmean\b/,
      /\bwhat is (a |an )?(kyc|uan|annexure|grievance|income certificate|address proof|beneficiary|police verification|self attestation|digilocker)\b/,
      /\bexplain\b/,
      /\bi (don'?t|do not) understand\b/,
    ],
  },
  {
    intent: 'HELP',
    confidence: 0.92,
    any: [
      /\bwhat can you (do|help)\b/,
      /\bhow (do|does) (this|it) work\b/,
      /^\s*(help|help me|hi|hii+|hello|hey|namaste|namaskara|namaskar|vanakkam|start)\s*[!.?]*\s*$/,
      /\bwhat services\b/,
      /\bwhat (all )?(can|do) (you|i) do\b/,
      /\bi (don'?t|do not) know what to (do|ask)\b/,
    ],
    // "help me with my pension" is a real request, not a request for the menu.
    none: [/\b(pension|pf|passport|scheme|complaint|train|document|paper)\b/],
  },
];

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  a: 1,
  an: 1,
};

/** Common misspellings, so a typo does not read as "not understood". */
const SPELLING: [RegExp, string][] = [
  [/\bpas?s?port?s?\b|\bpasport\b|\bpassprot\b|\bpassporte\b/g, 'passport'],
  [/\bpenshion\b|\bpention\b|\bpencion\b/g, 'pension'],
  [/\bcomplaint?s\b|\bcompliant\b|\bcomplain\b/g, 'complaint'],
  [/\bdocumnet\b|\bdocumet\b|\bdocuemnt\b/g, 'document'],
  [/\bcertificat\b|\bcertifikate\b|\bcertficate\b/g, 'certificate'],
  [/\bschme\b|\bshceme\b|\bschem\b/g, 'scheme'],
  [/\bmarksheat\b|\bmarkshet\b/g, 'marksheet'],
  [/\btraine?s?\b(?= (ticket|to|from))/g, 'train'],
  [/\bwithdral\b|\bwithdrawl\b|\bwithdrw\b/g, 'withdraw'],
];

function normalise(input: string): string {
  let text = input.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const [pattern, correct] of SPELLING) text = text.replace(pattern, correct);
  return text;
}

/** "₹50,000" / "50000" / "50k" / "fifty thousand" -> 50000 */
export function extractAmount(text: string): number | undefined {
  const t = normalise(text);
  const kMatch = t.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*k\b/);
  if (kMatch) return Math.round(Number(kMatch[1]) * 1000);
  const lakhMatch = t.match(/(\d+(?:\.\d+)?)\s*(lakh|lac)\b/);
  if (lakhMatch) return Math.round(Number(lakhMatch[1]) * 100000);
  const plain = t.match(/(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+|\d{4,7})\b/);
  if (plain) {
    const value = Number(plain[1].replace(/,/g, ''));
    if (!Number.isNaN(value) && value >= 500) return value;
  }
  const words = t.match(/\b(fifty|forty|thirty|twenty|ten|five)\s+thousand\b/);
  if (words) {
    const map: Record<string, number> = {
      fifty: 50000,
      forty: 40000,
      thirty: 30000,
      twenty: 20000,
      ten: 10000,
      five: 5000,
    };
    return map[words[1]];
  }
  return undefined;
}

const CITY_ALIASES: Record<string, string> = {
  bangalore: 'Bengaluru',
  bengaluru: 'Bengaluru',
  blr: 'Bengaluru',
  chennai: 'Chennai',
  madras: 'Chennai',
  mysore: 'Mysuru',
  mysuru: 'Mysuru',
  hyderabad: 'Hyderabad',
  delhi: 'Delhi',
  mumbai: 'Mumbai',
  pune: 'Pune',
  kochi: 'Kochi',
  coimbatore: 'Coimbatore',
  hubballi: 'Hubballi',
  mangaluru: 'Mangaluru',
  mangalore: 'Mangaluru',
};

function toCity(value: string): string {
  const key = normalise(value).replace(/[^a-z ]/g, '').trim();
  return CITY_ALIASES[key] ?? key.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function extractJourney(text: string): { from?: string; to?: string; date?: string } {
  const t = normalise(text);
  const route = t.match(/from\s+([a-z ]{3,20}?)\s+to\s+([a-z ]{3,20}?)(?:\s|$|,|\.)/);
  const result: { from?: string; to?: string; date?: string } = {};
  if (route) {
    result.from = toCity(route[1]);
    result.to = toCity(route[2]);
  } else {
    // Accept any two city-like words, not only the aliased ones, so journeys
    // like "Pune to Nagpur" or "Delhi to Jaipur" work. A small stop-list keeps
    // everyday verbs ("I want to go") from being read as city names.
    const short = t.match(/\b([a-z]{3,15})\s+to\s+([a-z]{3,15})\b/);
    const NON_CITY = /^(want|need|like|love|go|going|goes|get|got|have|had|has|able|back|here|there|this|that|the|book|travel|reach|come|coming|next|day|now|then|please|how|when|where|what|which|for|and|but|talk|speak|reply|you|me|us|him|her)$/;
    if (short && !NON_CITY.test(short[1]) && !NON_CITY.test(short[2])) {
      result.from = toCity(short[1]);
      result.to = toCity(short[2]);
    }
  }
  if (/\btomorrow\b/.test(t)) result.date = 'tomorrow';
  else if (/\btoday\b/.test(t)) result.date = 'today';
  else if (/\bday after tomorrow\b/.test(t)) result.date = 'day after tomorrow';
  else {
    const explicit = t.match(/\b(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)\b/);
    if (explicit) result.date = explicit[1];
  }
  const passengers = t.match(/\b(\d|one|two|three|four|five|six)\s+(passengers?|people|persons?|tickets?)\b/);
  if (passengers) {
    const raw = passengers[1];
    const count = Number.isNaN(Number(raw)) ? NUMBER_WORDS[raw] : Number(raw);
    if (count) (result as { passengers?: number }).passengers = count;
  }
  return result;
}

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

export function extractMonth(text: string): string | undefined {
  const t = normalise(text);
  const found = MONTHS.find((month) => t.includes(month) || t.includes(month.slice(0, 3)));
  if (!found) return undefined;
  return found.charAt(0).toUpperCase() + found.slice(1);
}

/**
 * Pulls a structured life situation out of everyday language. The result goes
 * to the eligibility engine — the classifier never decides eligibility itself.
 */
export function extractSituation(text: string): CitizenSituation | undefined {
  const t = normalise(text);
  const situation: CitizenSituation = {};

  if (/\b(husband|wife|spouse)\b.*\b(passed away|died|expired|no more|death)\b/.test(t) || /\bwidow(ed)?\b/.test(t)) {
    situation.maritalStatus = 'widowed';
  }
  if (/\b(divorced|separated)\b/.test(t)) situation.maritalStatus = 'divorced';

  const childMatch = t.match(
    /\b(one|two|three|four|1|2|3|4)\s+(daughter|son|girl child|boy child|child|children|kids?)\b/,
  );
  if (childMatch) {
    const raw = childMatch[1];
    const count = Number.isNaN(Number(raw)) ? NUMBER_WORDS[raw] : Number(raw);
    if (count) situation.dependentChildren = count;
  } else if (/\b(a|my)\s+(daughter|son|girl child|child)\b/.test(t)) {
    situation.dependentChildren = 1;
  }

  const childAge = t.match(/\b(\d{1,2})\s*(?:years?|yrs?)\s*old\b/);
  if (childAge && situation.dependentChildren) {
    situation.youngestChildAge = Number(childAge[1]);
  }

  if (
    /\b(i (don'?t|do not) have (a )?job|unemployed|no job|not working|jobless|no income|no earning)\b/.test(t) ||
    /\b(lost|left)\b[^.]{0,12}\bjob\b/.test(t)
  ) {
    situation.employmentStatus = 'unemployed';
  }
  if (/\b(i am working|i have a job|employed)\b/.test(t)) situation.employmentStatus = 'employed';

  if (/\b(not educated|no education|didn'?t study|uneducated|studied (only )?(till|up to))\b/.test(t)) {
    situation.educationLevel = 'limited formal education';
  }

  if (/\b(disabled|disability|differently abled)\b/.test(t)) situation.hasDisability = true;

  const income = t.match(/\bincome\b[^\d]{0,20}(₹|rs\.?|inr)?\s*([\d,]{4,10})/);
  if (income) {
    const value = Number(income[2].replace(/,/g, ''));
    if (!Number.isNaN(value)) situation.annualHouseholdIncome = value;
  }

  return Object.keys(situation).length > 0 ? situation : undefined;
}

function extractEntities(intent: Intent, text: string): IntentEntities {
  const entities: IntentEntities = {};
  const t = normalise(text);

  if (intent === 'START_PF_WITHDRAWAL') {
    const amount = extractAmount(text);
    if (amount) entities.amount = amount;
    entities.service = 'EPFO';
  }
  if (intent === 'GET_PF_PASSBOOK') entities.service = 'EPFO';

  if (intent === 'SEARCH_TRAINS' || intent === 'START_TRAIN_BOOKING') {
    const journey = extractJourney(text);
    if (journey.from) entities.from = journey.from;
    if (journey.to) entities.to = journey.to;
    if (journey.date) entities.date = journey.date;
    const passengers = (journey as { passengers?: number }).passengers;
    if (passengers) entities.passengers = passengers;
    if (/\bsleeper\b/.test(t)) entities.travelClass = 'Sleeper';
    else if (/\b(3a|third ac|ac 3)\b/.test(t)) entities.travelClass = '3A';
    else if (/\b(chair car|cc)\b/.test(t)) entities.travelClass = 'Chair Car';
  }

  if (intent === 'CREATE_COMPLAINT') {
    if (/\bpension\b/.test(t)) entities.complaintTopic = 'pension';
    else if (/\b(pf|provident)\b/.test(t)) entities.complaintTopic = 'provident fund';
    else if (/\bpassport\b/.test(t)) entities.complaintTopic = 'passport';
    else if (/\bscheme\b/.test(t)) entities.complaintTopic = 'scheme payment';
    const month = extractMonth(text);
    if (month) entities.lastReceived = month;
  }

  if (intent === 'EXPLAIN_TERM') {
    const quoted = text.match(/"([^"]{2,40})"/);
    const phrase = quoted ? quoted[1] : text;
    const entry = lookupTerm(phrase);
    if (entry) entities.term = entry.term;
  }

  if (intent === 'GET_DOCUMENT' || intent === 'IMPORT_DIGILOCKER_DOCUMENT') {
    const names = [
      '10th marksheet',
      'marksheet',
      'birth certificate',
      'income certificate',
      'driving licence',
      'driving license',
      'aadhaar',
      'pan',
      'voter id',
      'bank proof',
    ];
    const found = names.find((name) => t.includes(name));
    if (found) entities.documentName = found;
  }

  if (intent === 'CONTINUE_TASK') {
    if (/\bwithdraw/.test(t)) entities.service = 'EPFO';
    else if (/\bpassport\b/.test(t)) entities.service = 'PASSPORT';
    else if (/\bscheme\b/.test(t)) entities.service = 'SCHEME';
    else if (/\bcomplaint\b/.test(t)) entities.service = 'COMPLAINT';
    else if (/\b(train|booking)\b/.test(t)) entities.service = 'RAIL';
  }

  return entities;
}

function matches(pattern: Pattern, text: string): boolean {
  if (pattern.none?.some((rx) => rx.test(text))) return false;
  if (pattern.all && !pattern.all.every((rx) => rx.test(text))) return false;
  if (pattern.any && !pattern.any.some((rx) => rx.test(text))) return false;
  return Boolean(pattern.all ?? pattern.any);
}

/**
 * Returns null when the text is too open-ended for a rule to claim it.
 * The caller then decides whether to spend a model call.
 */
export function classifyByRules(input: string): IntentResult | null {
  const text = normalise(input);
  if (!text) return null;

  for (const pattern of PATTERNS) {
    if (!matches(pattern, text)) continue;
    const situation = extractSituation(text);
    // A life-situation message deserves a real reply, not a lookup, so we let
    // the model handle the wording even though the intent is already known.
    const isLongSituation = text.split(' ').length > 14 && Boolean(situation);
    return {
      intent: pattern.intent,
      confidence: isLongSituation ? Math.min(pattern.confidence, 0.85) : pattern.confidence,
      entities: extractEntities(pattern.intent, text),
      source: 'rules',
      situation,
    };
  }

  return null;
}
