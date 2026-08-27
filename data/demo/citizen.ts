import type { CitizenProfile, ConnectedService } from '@/types/user';

export const DEMO_USER_ID = 'demo-citizen-001';

/**
 * SYNTHETIC DEMO DATA.
 * This person does not exist. No real citizen record is used anywhere
 * in this prototype.
 */
export const demoCitizen: CitizenProfile = {
  id: DEMO_USER_ID,
  name: 'Lakshmi Devi',
  age: 34,
  dateOfBirth: '1992-05-14',
  photo: { available: true, label: 'Passport-size photo' },
  gender: 'female',
  state: 'Karnataka',
  city: 'Bengaluru',
  maritalStatus: 'widowed',
  dependents: [{ relation: 'daughter', age: 10 }],
  employmentStatus: 'unemployed',
  education: '8th standard',
  annualHouseholdIncome: 120000,
  mobile: '+91 98765 43210',
  email: 'lakshmi@example.com',
  isSyntheticDemoData: true,
  bankAccountMasked: 'XXXX 4821',
  identifiers: [
    {
      key: 'uan',
      label: 'UAN',
      value: '100123456789',
      note: 'Sample number for this prototype.',
    },
    {
      key: 'pan',
      label: 'PAN',
      value: 'ABCDE1234F',
      note: 'Sample number for this prototype.',
    },
    {
      key: 'aadhaar',
      label: 'Aadhaar',
      value: 'XXXX-XXXX-4821',
      note: 'Sample number, partly hidden. No real Aadhaar is used.',
    },
    {
      key: 'voter_id',
      label: 'Voter ID',
      value: 'DEMO1234567',
      note: 'Sample number for this prototype.',
    },
  ],
};

export const demoConnectedServices: ConnectedService[] = [
  {
    id: 'epfo',
    name: 'EPFO',
    description: 'Provident fund passbook and withdrawal requests.',
    status: 'connected',
    mode: 'demo',
    lastCheckedAt: 'Today, 10:30 AM',
    officialSourceName: 'Employees’ Provident Fund Organisation',
    officialSourceUrl: 'https://www.epfindia.gov.in',
  },
  {
    id: 'digilocker',
    name: 'DigiLocker',
    description: 'Your issued documents, available to reuse across services.',
    status: 'connected',
    mode: 'demo',
    lastCheckedAt: 'Today, 10:30 AM',
    officialSourceName: 'DigiLocker',
    officialSourceUrl: 'https://www.digilocker.gov.in',
  },
  {
    id: 'schemes',
    name: 'Government Schemes',
    description: 'Discovery of welfare programmes you may be able to apply for.',
    status: 'available',
    mode: 'demo',
    lastCheckedAt: 'Today, 10:30 AM',
    officialSourceName: 'myScheme (National Scheme Discovery Portal)',
    officialSourceUrl: 'https://www.myscheme.gov.in',
  },
  {
    id: 'passport',
    name: 'Passport Services',
    description: 'Passport application preparation and tracking.',
    status: 'available',
    mode: 'demo',
    lastCheckedAt: 'Today, 10:28 AM',
    officialSourceName: 'Passport Seva',
    officialSourceUrl: 'https://www.passportindia.gov.in',
  },
  {
    id: 'grievance',
    name: 'Public Grievance',
    description: 'Preparing and tracking a grievance.',
    status: 'available',
    mode: 'demo',
    lastCheckedAt: 'Today, 10:28 AM',
    officialSourceName: 'Centralised Public Grievance Redress and Monitoring System',
    officialSourceUrl: 'https://pgportal.gov.in',
  },
  {
    id: 'rail',
    name: 'Railway Enquiry',
    description: 'Train search and journey preparation.',
    status: 'available',
    mode: 'demo',
    lastCheckedAt: 'Today, 10:26 AM',
    officialSourceName: 'IRCTC',
    officialSourceUrl: 'https://www.irctc.co.in',
  },
];
