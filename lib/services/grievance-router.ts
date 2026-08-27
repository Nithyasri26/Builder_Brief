/**
 * Content-driven grievance routing.
 *
 * The department is decided from WHAT THE CITIZEN ACTUALLY WROTE, not from a
 * preset topic. Each entry lists the words people really use for that kind of
 * problem; the first matching entry wins, and a general public-grievance cell
 * catches anything unmatched. The email addresses are demo addresses — nothing
 * is sent to a real office — but they are shaped like a real routing target so
 * the citizen sees where a complaint of this kind would go.
 */

export interface GrievanceRoute {
  id: string;
  department: string;
  category: string;
  authority: string;
  email: string;
  portalName: string;
  portalUrl: string;
}

interface RouteRule extends GrievanceRoute {
  match: RegExp;
}

const DEMO_DOMAIN = 'grievance.demo.gov.in';

const RULES: RouteRule[] = [
  {
    id: 'electricity',
    match: /\b(electric\w*|current|power ?cut|power ?supply|power ?outage|bijli|voltage|transformer|electric(ity)? meter|discom|bescom|mseb|tangedco|no power|street ?light)\b/i,
    department: 'State Electricity Board (Distribution)',
    category: 'Electricity supply',
    authority: 'Electricity Distribution Company (DISCOM)',
    email: `electricity@${DEMO_DOMAIN}`,
    portalName: 'National Power Portal',
    portalUrl: 'https://npp.gov.in',
  },
  {
    id: 'water',
    match: /\b(water ?(supply|connection|leak\w*|shortage|problem)|no water|drinking water|sewage|sewer\w*|drainage|drain(age)?|pipeline|tap water|nala)\b/i,
    department: 'Water Supply & Sewerage Board',
    category: 'Water supply / sewerage',
    authority: 'Municipal Water Supply & Sewerage Board',
    email: `water@${DEMO_DOMAIN}`,
    portalName: 'CPGRAMS',
    portalUrl: 'https://pgportal.gov.in',
  },
  {
    id: 'sanitation',
    match: /\b(garbage|waste|trash|rubbish|refuse|sanitation|dust ?bin|drain (block|choke|overflow)|toilet|cleanliness|mosquito|open drain)\b/i,
    department: 'Municipal Corporation — Sanitation',
    category: 'Sanitation / waste',
    authority: 'Urban Local Body (Municipal Corporation)',
    email: `sanitation@${DEMO_DOMAIN}`,
    portalName: 'CPGRAMS',
    portalUrl: 'https://pgportal.gov.in',
  },
  {
    id: 'roads',
    match: /\b(road|pothole|footpath|pavement|speed ?breaker|manhole|traffic ?signal|flyover|bridge)\b/i,
    department: 'Public Works Department (PWD)',
    category: 'Roads & public works',
    authority: 'Public Works Department',
    email: `pwd@${DEMO_DOMAIN}`,
    portalName: 'CPGRAMS',
    portalUrl: 'https://pgportal.gov.in',
  },
  {
    id: 'pension',
    match: /\b(pension|old ?age (allowance|pension)|widow pension|vridha)\b/i,
    department: 'Pension & Social Welfare Department',
    category: 'Pension payment',
    authority: 'Directorate of Social Welfare',
    email: `pension@${DEMO_DOMAIN}`,
    portalName: 'CPGRAMS',
    portalUrl: 'https://pgportal.gov.in',
  },
  {
    id: 'epfo',
    match: /\b(pf|epf|epfo|provident ?fund|uan|pf ?claim|pf ?withdrawal)\b/i,
    department: "Employees' Provident Fund Organisation (EPFO)",
    category: 'Provident fund',
    authority: 'EPFO Regional Office',
    email: `epfo@${DEMO_DOMAIN}`,
    portalName: 'EPFiGMS',
    portalUrl: 'https://epfigms.gov.in',
  },
  {
    id: 'passport',
    match: /\b(passport|psk|passport seva|police verification)\b/i,
    department: 'Regional Passport Office (Passport Seva)',
    category: 'Passport service',
    authority: 'Ministry of External Affairs',
    email: `passport@${DEMO_DOMAIN}`,
    portalName: 'Passport Seva',
    portalUrl: 'https://www.passportindia.gov.in',
  },
  {
    id: 'aadhaar',
    match: /\b(aadhaa?r|uidai|enrol?ment (id|number)|biometric\w*)\b/i,
    department: 'Unique Identification Authority of India (UIDAI)',
    category: 'Aadhaar',
    authority: 'UIDAI',
    email: `uidai@${DEMO_DOMAIN}`,
    portalName: 'UIDAI',
    portalUrl: 'https://uidai.gov.in',
  },
  {
    id: 'pan',
    match: /\b(pan card|pan number|\bpan\b|tan)\b/i,
    department: 'Income Tax Department (PAN Services)',
    category: 'PAN',
    authority: 'Income Tax Department',
    email: `pan@${DEMO_DOMAIN}`,
    portalName: 'Income Tax e-Filing',
    portalUrl: 'https://www.incometax.gov.in',
  },
  {
    id: 'ration',
    match: /\b(ration|pds|fair ?price ?shop|food ?grain|kerosene|ration ?card|public distribution)\b/i,
    department: 'Food, Civil Supplies & Consumer Affairs',
    category: 'Ration / PDS',
    authority: 'Department of Food & Civil Supplies',
    email: `civilsupplies@${DEMO_DOMAIN}`,
    portalName: 'CPGRAMS',
    portalUrl: 'https://pgportal.gov.in',
  },
  {
    id: 'railway',
    match: /\b(train|railway|irctc|coach|platform|reservation|tatkal|pnr|ticket refund|tte|waitlist)\b/i,
    department: 'Indian Railways (RailMadad)',
    category: 'Railway service',
    authority: 'Ministry of Railways',
    email: `railmadad@${DEMO_DOMAIN}`,
    portalName: 'RailMadad',
    portalUrl: 'https://railmadad.indianrailways.gov.in',
  },
  {
    id: 'police',
    match: /\b(police|theft|stolen|harass\w*|fir|crime|fraud|cheat\w*|threat|missing|assault)\b/i,
    department: 'Police Department',
    category: 'Police / safety',
    authority: 'State Police',
    email: `police@${DEMO_DOMAIN}`,
    portalName: 'CPGRAMS',
    portalUrl: 'https://pgportal.gov.in',
  },
  {
    id: 'health',
    match: /\b(hospital|health ?(centre|center)|phc|chc|doctor|nurse|medicine|ambulance|clinic|dispensary)\b/i,
    department: 'Health & Family Welfare Department',
    category: 'Health services',
    authority: 'Directorate of Health Services',
    email: `health@${DEMO_DOMAIN}`,
    portalName: 'CPGRAMS',
    portalUrl: 'https://pgportal.gov.in',
  },
  {
    id: 'education',
    match: /\b(school|college|teacher|principal|admission|scholarship|exam|mid ?day meal|education)\b/i,
    department: 'Department of Education',
    category: 'Education',
    authority: 'Directorate of Public Instruction',
    email: `education@${DEMO_DOMAIN}`,
    portalName: 'CPGRAMS',
    portalUrl: 'https://pgportal.gov.in',
  },
  {
    id: 'lpg',
    match: /\b(gas ?(cylinder|connection|leak|booking)|lpg|cooking gas|indane|hp ?gas|bharat ?gas)\b/i,
    department: 'Oil Marketing Company (LPG)',
    category: 'LPG / cooking gas',
    authority: 'Ministry of Petroleum & Natural Gas',
    email: `lpg@${DEMO_DOMAIN}`,
    portalName: 'CPGRAMS',
    portalUrl: 'https://pgportal.gov.in',
  },
  {
    id: 'banking',
    match: /\b(bank|atm|loan|upi|neft|imps|account (block|freeze|debit)|debited|transaction failed|cheque|passbook entry)\b/i,
    department: 'Banking Ombudsman (RBI)',
    category: 'Banking',
    authority: 'Reserve Bank of India',
    email: `bankingombudsman@${DEMO_DOMAIN}`,
    portalName: 'RBI CMS',
    portalUrl: 'https://cms.rbi.org.in',
  },
  {
    id: 'telecom',
    match: /\b(mobile ?network|sim ?card|recharge|broadband|internet|telecom|call ?drop|signal|network problem)\b/i,
    department: 'Department of Telecommunications / TRAI',
    category: 'Telecom',
    authority: 'Telecom Regulatory Authority of India',
    email: `telecom@${DEMO_DOMAIN}`,
    portalName: 'PG Portal (DoT)',
    portalUrl: 'https://pgportal.gov.in',
  },
  {
    id: 'revenue',
    match: /\b(land|property|khata|mutation|survey number|revenue|patta|encroach\w*|boundary|tehsil)\b/i,
    department: 'Revenue Department',
    category: 'Land & revenue',
    authority: 'District Revenue Office',
    email: `revenue@${DEMO_DOMAIN}`,
    portalName: 'CPGRAMS',
    portalUrl: 'https://pgportal.gov.in',
  },
  {
    id: 'municipal',
    match: /\b(municipal\w*|corporation|panchayat|ward office|birth certificate|death certificate|property tax|trade licen[cs]e)\b/i,
    department: 'Municipal Corporation / Gram Panchayat',
    category: 'Local civic body',
    authority: 'Urban Local Body',
    email: `municipal@${DEMO_DOMAIN}`,
    portalName: 'CPGRAMS',
    portalUrl: 'https://pgportal.gov.in',
  },
];

const DEFAULT_ROUTE: GrievanceRoute = {
  id: 'general',
  department: 'Public Grievance Cell (CPGRAMS)',
  category: 'General grievance',
  authority: 'Department of Administrative Reforms & Public Grievances',
  email: `cpgrams@${DEMO_DOMAIN}`,
  portalName: 'CPGRAMS',
  portalUrl: 'https://pgportal.gov.in',
};

/** Chooses the department a complaint should go to, from its wording. */
export function routeGrievance(text: string): GrievanceRoute {
  const rule = RULES.find((entry) => entry.match.test(text));
  if (!rule) return { ...DEFAULT_ROUTE };
  const { match: _match, ...route } = rule;
  return route;
}
