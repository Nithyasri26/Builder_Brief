import type { PassbookSummary } from '@/types/chat';

/** Sample account data for the prototype — not a real EPFO member account. */
export const demoPassbook: PassbookSummary = {
  uan: '100123456789',
  memberId: 'KA/BNG/1234567/000001',
  employer: 'ABC Technologies Pvt Ltd',
  employeeContribution: 92000,
  employerContribution: 78500,
  interest: 13750,
  balance: 184250,
  lastUpdated: '31 July 2026',
};

export const demoPassbookEntries = [
  { period: 'Apr 2026 – Jun 2026', employee: 12000, employer: 10200, interest: 3100 },
  { period: 'Jan 2026 – Mar 2026', employee: 12000, employer: 10200, interest: 3050 },
  { period: 'Oct 2025 – Dec 2025', employee: 11500, employer: 9800, interest: 2900 },
  { period: 'Jul 2025 – Sep 2025', employee: 11500, employer: 9800, interest: 2850 },
];

export const EPFO_SOURCE = {
  name: 'Employees’ Provident Fund Organisation (official portal)',
  url: 'https://www.epfindia.gov.in',
  lastVerified: '2026-08-25',
} as const;

/** Account verification state used by the withdrawal workflow. */
export const demoKyc = {
  aadhaarSeeded: true,
  panSeeded: true,
  bankSeeded: true,
  bankMasked: 'XXXX 4821',
  bankName: 'State Bank of Karnataka',
  serviceYears: 6,
};

export const WITHDRAWAL_DEMO_LIMIT = 150000;
