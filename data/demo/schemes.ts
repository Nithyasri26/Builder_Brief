import type { Scheme } from '@/types/scheme';

/**
 * Two kinds of entries live here.
 *
 * 1. dataType: 'verified_public_information'
 *    Real, publicly listed government programmes. We store ONLY the name, a
 *    neutral description and the official source URL, and deliberately encode
 *    NO eligibility rules — official eligibility is defined by the government,
 *    and this prototype must never fabricate it. These resolve to "more
 *    information required" and point the citizen at the official portal.
 *
 * 2. dataType: 'demo_dataset'
 *    Sample programmes written for this prototype. They exercise the
 *    eligibility engine end to end. The About page says plainly that these are
 *    sample data, so the cards themselves can stay readable.
 */

const VERIFIED = 'verified_public_information' as const;
const DEMO = 'demo_dataset' as const;
const LAST_VERIFIED = '2026-08-25';

export const demoSchemes: Scheme[] = [
  {
    id: 'demo-family-support',
    name: 'Family Support Assistance',
    category: 'social_security',
    state: 'Karnataka',
    description:
      'Monthly support for a household that has lost an earning member and has a child to look after.',
    benefitSummary: '₹2,000 a month for the household.',
    officialSource: 'Sample programme data',
    sourceUrl: '',
    eligibilityRules: [
      {
        id: 'r-state',
        field: 'state',
        operator: 'equals',
        value: 'Karnataka',
        label: 'Karnataka resident',
        explanation: 'This programme is run by the Karnataka government.',
      },
      {
        id: 'r-marital',
        field: 'maritalStatus',
        operator: 'equals',
        value: 'widowed',
        label: 'Widowed applicant',
        explanation: 'This programme is for households that lost an earning member.',
      },
      {
        id: 'r-child',
        field: 'dependentChildren',
        operator: 'gte',
        value: 1,
        label: 'At least one dependent child',
        explanation: 'The payment is worked out per household with a child to support.',
      },
      {
        id: 'r-income',
        field: 'annualHouseholdIncome',
        operator: 'lte',
        value: 200000,
        label: 'Household income up to ₹2,00,000 a year',
        explanation: 'There is an income limit for this programme.',
      },
    ],
    requiredDocuments: [
      {
        key: 'identity',
        label: 'Identity proof',
        purpose: 'identity_proof',
        why: 'Used to confirm that the applicant is the person named in the application.',
      },
      {
        key: 'income',
        label: 'Income certificate',
        purpose: 'income_proof',
        why: 'Used to check whether the household falls within the income criteria for this programme.',
      },
      {
        key: 'child',
        label: 'Child birth certificate',
        purpose: 'child_birth_proof',
        why: 'Used to confirm the dependent child recorded in the application.',
      },
      {
        key: 'bank',
        label: 'Bank proof',
        purpose: 'bank_proof',
        why: 'Used so that any assistance can be credited to the correct account.',
      },
    ],
    applicationMethod: 'Online, through NammaSahaay',
    processingTime: 'About 15 working days',
    status: 'open',
    lastVerified: LAST_VERIFIED,
    dataType: DEMO,
    isDemoScheme: true,
  },
  {
    id: 'demo-girl-child-education',
    name: 'Girl Child Education Support',
    category: 'education',
    state: 'Karnataka',
    description:
      'Yearly help with school costs for a child under 18.',
    benefitSummary: '₹6,000 a year for each child in school.',
    officialSource: 'Sample programme data',
    sourceUrl: '',
    eligibilityRules: [
      {
        id: 'r-state',
        field: 'state',
        operator: 'equals',
        value: 'Karnataka',
        label: 'Karnataka resident',
        explanation: 'This programme is run by the Karnataka government.',
      },
      {
        id: 'r-child-age',
        field: 'youngestChildAge',
        operator: 'lte',
        value: 18,
        label: 'Child below 18 years',
        explanation: 'The support is for children who are still at school.',
      },
      {
        id: 'r-income',
        field: 'annualHouseholdIncome',
        operator: 'lte',
        value: 300000,
        label: 'Household income up to ₹3,00,000 a year',
        explanation: 'There is an income limit for this programme.',
      },
    ],
    requiredDocuments: [
      {
        key: 'child',
        label: 'Child birth certificate',
        purpose: 'child_birth_proof',
        why: 'Used to confirm the age of the child named in the application.',
      },
      {
        key: 'identity',
        label: 'Identity proof of parent',
        purpose: 'identity_proof',
        why: 'Used to confirm who is applying on behalf of the child.',
      },
      {
        key: 'income',
        label: 'Income certificate',
        purpose: 'income_proof',
        why: 'Used to check the household income against the demo threshold.',
      },
    ],
    applicationMethod: 'Online, through NammaSahaay',
    processingTime: 'About 21 working days',
    status: 'open',
    lastVerified: LAST_VERIFIED,
    dataType: DEMO,
    isDemoScheme: true,
  },
  {
    id: 'demo-skill-training',
    name: 'Skill Training Allowance',
    category: 'employment',
    state: 'Karnataka',
    description:
      'A monthly allowance while you take a skills training course.',
    benefitSummary: '₹1,500 a month while you are training.',
    officialSource: 'Sample programme data',
    sourceUrl: '',
    eligibilityRules: [
      {
        id: 'r-employment',
        field: 'employmentStatus',
        operator: 'equals',
        value: 'unemployed',
        label: 'Currently not employed',
        explanation: 'The allowance is for people who are looking for work.',
      },
      {
        id: 'r-age',
        field: 'age',
        operator: 'lte',
        value: 45,
        label: 'Age 45 or below',
        explanation: 'There is an age limit for this programme.',
      },
      {
        id: 'r-state',
        field: 'state',
        operator: 'equals',
        value: 'Karnataka',
        label: 'Karnataka resident',
        explanation: 'This programme is run by the Karnataka government.',
      },
    ],
    requiredDocuments: [
      {
        key: 'identity',
        label: 'Identity proof',
        purpose: 'identity_proof',
        why: 'Used to confirm the applicant identity before enrolment.',
      },
      {
        key: 'education',
        label: 'Education certificate',
        purpose: 'education_proof',
        why: 'Used to place the applicant in a suitable training batch.',
      },
      {
        key: 'bank',
        label: 'Bank proof',
        purpose: 'bank_proof',
        why: 'Used so that the demo stipend can be credited correctly.',
      },
    ],
    applicationMethod: 'Online, through NammaSahaay',
    processingTime: 'About 10 working days',
    status: 'open',
    lastVerified: LAST_VERIFIED,
    dataType: DEMO,
    isDemoScheme: true,
  },
  {
    id: 'demo-housing-assistance',
    name: 'Housing Assistance',
    category: 'housing',
    state: 'Karnataka',
    description:
      'A one-time payment towards housing costs for low-income households.',
    benefitSummary: 'A one-time payment towards housing.',
    officialSource: 'Sample programme data',
    sourceUrl: '',
    eligibilityRules: [
      {
        id: 'r-state',
        field: 'state',
        operator: 'equals',
        value: 'Karnataka',
        label: 'Karnataka resident',
        explanation: 'This programme is run by the Karnataka government.',
      },
      {
        id: 'r-disability',
        field: 'hasDisability',
        operator: 'exists',
        label: 'Disability status recorded',
        explanation:
          'This programme asks about disability, and we do not have that information yet.',
      },
      {
        id: 'r-income',
        field: 'annualHouseholdIncome',
        operator: 'lte',
        value: 250000,
        label: 'Household income up to ₹2,50,000 a year',
        explanation: 'There is an income limit for this programme.',
      },
    ],
    requiredDocuments: [
      {
        key: 'identity',
        label: 'Identity proof',
        purpose: 'identity_proof',
        why: 'Used to confirm the applicant identity.',
      },
      {
        key: 'address',
        label: 'Address proof',
        purpose: 'address_proof',
        why: 'Used to confirm where the applicant currently lives.',
      },
      {
        key: 'income',
        label: 'Income certificate',
        purpose: 'income_proof',
        why: 'Used to check the household income against the demo threshold.',
      },
    ],
    applicationMethod: 'Online, through NammaSahaay',
    processingTime: 'About 45 working days',
    status: 'open',
    lastVerified: LAST_VERIFIED,
    dataType: DEMO,
    isDemoScheme: true,
  },
  {
    id: 'demo-senior-care',
    name: 'Senior Citizen Care Assistance',
    category: 'health',
    state: 'Karnataka',
    description:
      'Care support for people aged 60 and above.',
    benefitSummary: 'Care support for people aged 60 and above.',
    officialSource: 'Sample programme data',
    sourceUrl: '',
    eligibilityRules: [
      {
        id: 'r-age',
        field: 'age',
        operator: 'gte',
        value: 60,
        label: 'Age 60 or above',
        explanation: 'This programme is for senior citizens.',
      },
      {
        id: 'r-state',
        field: 'state',
        operator: 'equals',
        value: 'Karnataka',
        label: 'Karnataka resident',
        explanation: 'This programme is run by the Karnataka government.',
      },
    ],
    requiredDocuments: [
      {
        key: 'identity',
        label: 'Identity proof',
        purpose: 'identity_proof',
        why: 'Used to confirm the applicant age and identity.',
      },
    ],
    applicationMethod: 'Online, through NammaSahaay',
    processingTime: 'About 30 working days',
    status: 'open',
    lastVerified: LAST_VERIFIED,
    dataType: DEMO,
    isDemoScheme: true,
  },

  // --- Real, publicly listed programmes --------------------------------
  // Information-only cards. No eligibility rules are encoded, because
  // official eligibility is defined by the government, not by this prototype.
  {
    id: 'info-nsap-widow-pension',
    name: 'Indira Gandhi National Widow Pension Scheme (NSAP)',
    category: 'social_security',
    state: 'All India',
    description:
      'A government pension for widows. The rules, amounts and how to apply are published by the government on the official portal.',
    benefitSummary: 'Refer to the official NSAP portal for current benefit details.',
    officialSource: 'National Social Assistance Programme (NSAP), Ministry of Rural Development',
    sourceUrl: 'https://nsap.nic.in',
    eligibilityRules: [],
    requiredDocuments: [],
    applicationMethod: 'Through the official channel published on the NSAP portal.',
    processingTime: 'As published by the concerned authority.',
    status: 'unknown',
    lastVerified: LAST_VERIFIED,
    dataType: VERIFIED,
    isDemoScheme: false,
  },
  {
    id: 'info-myscheme',
    name: 'myScheme - National Scheme Discovery Portal',
    category: 'social_security',
    state: 'All India',
    description:
      'The Government of India official scheme discovery platform. It lets citizens find central and state schemes and read the criteria published by each department.',
    benefitSummary: 'Search official central and state schemes in one place.',
    officialSource: 'myScheme, Government of India',
    sourceUrl: 'https://www.myscheme.gov.in',
    eligibilityRules: [],
    requiredDocuments: [],
    applicationMethod: 'Through the official portal.',
    processingTime: 'Varies by scheme.',
    status: 'unknown',
    lastVerified: LAST_VERIFIED,
    dataType: VERIFIED,
    isDemoScheme: false,
  },
  {
    id: 'info-seva-sindhu',
    name: 'Seva Sindhu - Karnataka Government Services',
    category: 'social_security',
    state: 'Karnataka',
    description:
      'The Karnataka state services portal, where state departments publish their services and the documents each one requires.',
    benefitSummary: 'State service applications and status tracking.',
    officialSource: 'Seva Sindhu, Government of Karnataka',
    sourceUrl: 'https://sevasindhu.karnataka.gov.in',
    eligibilityRules: [],
    requiredDocuments: [],
    applicationMethod: 'Through the official state portal.',
    processingTime: 'Varies by service.',
    status: 'unknown',
    lastVerified: LAST_VERIFIED,
    dataType: VERIFIED,
    isDemoScheme: false,
  },
];
