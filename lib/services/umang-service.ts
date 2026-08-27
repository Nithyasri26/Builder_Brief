import type { GovernmentService, ServiceConnection } from './types';
import { nowIso } from '@/lib/utils';

export interface ServiceDirectoryEntry {
  id: string;
  label: string;
  description: string;
  examplePrompt: string;
  officialSourceName: string;
  officialSourceUrl: string;
}

export interface UMANGService extends GovernmentService {
  listServices(): Promise<ServiceDirectoryEntry[]>;
}

/**
 * Directory adapter.
 *
 * India already publishes a large catalogue of digital services through
 * platforms such as UMANG. This adapter stands in for that catalogue so the
 * assistant can tell a citizen what it is able to help with, and always name
 * the official destination for each service.
 */
export class MockUMANGService implements UMANGService {
  readonly id = 'umang';
  readonly name = 'Service Directory';
  readonly mode = 'demo' as const;
  readonly officialSource = {
    name: 'UMANG (Unified Mobile Application for New-age Governance)',
    url: 'https://web.umang.gov.in',
    lastVerified: '2026-08-25',
  };

  async checkConnection(): Promise<ServiceConnection> {
    return {
      serviceId: this.id,
      status: 'connected',
      mode: 'demo',
      checkedAt: nowIso(),
      message: 'The service list is available.',
    };
  }

  async listServices(): Promise<ServiceDirectoryEntry[]> {
    return [
      {
        id: 'epfo',
        label: 'Provident fund',
        description: 'See your PF money, or ask to take some out.',
        examplePrompt: 'Show my PF money',
        officialSourceName: 'EPFO',
        officialSourceUrl: 'https://www.epfindia.gov.in',
      },
      {
        id: 'schemes',
        label: 'Government help',
        description: 'Find support you may be able to get.',
        examplePrompt: 'Is there any government help for me?',
        officialSourceName: 'myScheme',
        officialSourceUrl: 'https://www.myscheme.gov.in',
      },
      {
        id: 'documents',
        label: 'Your papers',
        description: 'See what you already have. I reuse them so you are not asked twice.',
        examplePrompt: 'Show my papers',
        officialSourceName: 'DigiLocker',
        officialSourceUrl: 'https://www.digilocker.gov.in',
      },
      {
        id: 'passport',
        label: 'Passport',
        description: 'Apply using the papers you already have.',
        examplePrompt: 'I want a passport',
        officialSourceName: 'Passport Seva',
        officialSourceUrl: 'https://www.passportindia.gov.in',
      },
      {
        id: 'grievance',
        label: 'Complaints',
        description: 'I write the complaint for you and keep track of it.',
        examplePrompt: 'My pension has not come',
        officialSourceName: 'CPGRAMS',
        officialSourceUrl: 'https://pgportal.gov.in',
      },
      {
        id: 'rail',
        label: 'Trains',
        description: 'Look up a journey.',
        examplePrompt: 'I want to go from Bengaluru to Chennai tomorrow',
        officialSourceName: 'IRCTC',
        officialSourceUrl: 'https://www.irctc.co.in',
      },
    ];
  }
}
