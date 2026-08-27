import type { GovernmentService, ServiceConnection } from './types';
import { ServiceUnavailableError, demoReference, isForcedOffline } from './types';
import type { CitizenProfile } from '@/types/user';
import { nowIso } from '@/lib/utils';
import { routeGrievance, type GrievanceRoute } from './grievance-router';

export interface ComplaintDraft {
  department: string;
  category: string;
  subject: string;
  description: string;
  departmentEmail: string;
  authority: string;
  citizenStatement: string;
  route: GrievanceRoute;
}

export interface ComplaintSubmission {
  reference: string;
  status: 'submitted_demo';
  submittedAt: string;
}

export interface ComplaintService extends GovernmentService {
  draft(input: { statement: string; profile: CitizenProfile }): Promise<ComplaintDraft>;
  submit(userId: string, complaintId: string): Promise<ComplaintSubmission>;
}

/** A concise subject line built from the citizen's own first sentence. */
function subjectFrom(statement: string, category: string): string {
  const firstSentence = statement.split(/[.\n]/)[0]?.trim() ?? statement.trim();
  const short = firstSentence.length > 90 ? `${firstSentence.slice(0, 88).trim()}…` : firstSentence;
  const cleaned = short.charAt(0).toUpperCase() + short.slice(1);
  return cleaned.length >= 6 ? cleaned : `${category} grievance`;
}

/**
 * Simulated grievance adapter.
 *
 * The draft is composed from a template rather than a model, so the wording
 * is predictable, neutral and never invents facts the citizen did not state.
 * Nothing is filed with any real grievance system.
 */
export class MockComplaintService implements ComplaintService {
  readonly id = 'grievance';
  readonly name = 'Public Grievance';
  readonly mode = 'demo' as const;
  readonly officialSource = {
    name: 'Centralised Public Grievance Redress and Monitoring System',
    url: 'https://pgportal.gov.in',
    lastVerified: '2026-08-25',
  };

  async checkConnection(): Promise<ServiceConnection> {
    if (isForcedOffline(this.id)) {
      return {
        serviceId: this.id,
        status: 'unavailable',
        mode: 'demo',
        checkedAt: nowIso(),
        message: 'The complaints service is switched off for this session.',
      };
    }
    return {
      serviceId: this.id,
      status: 'connected',
      mode: 'demo',
      checkedAt: nowIso(),
      message: 'The complaints service is connected.',
    };
  }

  /**
   * Composes a formal complaint FROM THE CITIZEN'S OWN WORDS. The department is
   * derived from what they wrote, and their exact statement is kept verbatim at
   * the centre of the letter — the service never invents facts or a category the
   * citizen did not describe.
   */
  async draft(input: { statement: string; profile: CitizenProfile }): Promise<ComplaintDraft> {
    const connection = await this.checkConnection();
    if (connection.status !== 'connected') throw new ServiceUnavailableError(this.id);

    const statement = input.statement.trim();
    const route = routeGrievance(statement);
    const subject = subjectFrom(statement, route.category);
    const profile = input.profile;

    const addressParts = [profile.city, profile.state, profile.pincode]
      .filter(Boolean)
      .join(', ');

    const description = [
      `To,\nThe Grievance Officer,\n${route.department}.`,
      `Subject: ${subject}`,
      'Respected Sir/Madam,',
      `I, ${profile.name}${addressParts ? `, resident of ${addressParts}` : ''}, wish to register the following grievance:`,
      `"${statement}"`,
      'I request you to kindly look into this matter and take the necessary action at the earliest. Please acknowledge this complaint and keep me informed of the action taken.',
      `Regards,\n${profile.name}${profile.mobile ? `\nMobile: ${profile.mobile}` : ''}`,
    ].join('\n\n');

    return {
      department: route.department,
      category: route.category,
      subject,
      description,
      departmentEmail: route.email,
      authority: route.authority,
      citizenStatement: statement,
      route,
    };
  }

  async submit(_userId: string, _complaintId: string): Promise<ComplaintSubmission> {
    const connection = await this.checkConnection();
    if (connection.status !== 'connected') throw new ServiceUnavailableError(this.id);
    return {
      reference: demoReference('GRV', 142),
      status: 'submitted_demo',
      submittedAt: nowIso(),
    };
  }
}
