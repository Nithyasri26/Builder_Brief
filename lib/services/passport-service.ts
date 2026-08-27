import type { GovernmentService, ServiceConnection } from './types';
import { ServiceUnavailableError, demoReference, isForcedOffline } from './types';
import { PASSPORT_SOURCE, demoAppointmentCentre, passportRequirements, type PassportRequirement } from '@/data/demo/passport';
import { nowIso } from '@/lib/utils';

export interface PassportSubmission {
  applicationId: string;
  status: 'submitted_demo';
  appointmentCentre: string;
  submittedAt: string;
}

export interface PassportService extends GovernmentService {
  getRequirements(): Promise<PassportRequirement[]>;
  submitApplication(userId: string): Promise<PassportSubmission>;
}

/**
 * Simulated Passport Seva adapter. No application is ever filed with
 * Passport Seva from this prototype.
 */
export class MockPassportService implements PassportService {
  readonly id = 'passport';
  readonly name = 'Passport Services';
  readonly mode = 'demo' as const;
  readonly officialSource = {
    name: PASSPORT_SOURCE.name,
    url: PASSPORT_SOURCE.url,
    lastVerified: PASSPORT_SOURCE.lastVerified,
  };

  async checkConnection(): Promise<ServiceConnection> {
    if (isForcedOffline(this.id)) {
      return {
        serviceId: this.id,
        status: 'unavailable',
        mode: 'demo',
        checkedAt: nowIso(),
        message: 'The passport service is switched off for this session.',
      };
    }
    return {
      serviceId: this.id,
      status: 'connected',
      mode: 'demo',
      checkedAt: nowIso(),
      message: 'The passport service is connected.',
    };
  }

  async getRequirements(): Promise<PassportRequirement[]> {
    const connection = await this.checkConnection();
    if (connection.status !== 'connected') throw new ServiceUnavailableError(this.id);
    return passportRequirements.map((requirement) => ({ ...requirement }));
  }

  async submitApplication(_userId: string): Promise<PassportSubmission> {
    const connection = await this.checkConnection();
    if (connection.status !== 'connected') throw new ServiceUnavailableError(this.id);
    return {
      applicationId: demoReference('PSP', 210),
      status: 'submitted_demo',
      appointmentCentre: demoAppointmentCentre,
      submittedAt: nowIso(),
    };
  }
}
