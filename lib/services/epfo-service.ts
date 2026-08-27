import type { GovernmentService, ServiceConnection } from './types';
import { ServiceUnavailableError, demoReference, isForcedOffline } from './types';
import { demoKyc, demoPassbook, demoPassbookEntries, EPFO_SOURCE, WITHDRAWAL_DEMO_LIMIT } from '@/data/demo/epfo';
import type { PassbookSummary } from '@/types/chat';
import { nowIso } from '@/lib/utils';

export interface PassbookResult {
  passbook: PassbookSummary;
  entries: typeof demoPassbookEntries;
}

export interface WithdrawalCheck {
  eligible: boolean;
  reasons: { label: string; ok: boolean }[];
  maxAmount: number;
  bankMasked: string;
}

export interface WithdrawalSubmission {
  applicationId: string;
  status: 'submitted_demo';
  submittedAt: string;
}

export interface EPFOService extends GovernmentService {
  getPassbook(userId: string): Promise<PassbookResult>;
  checkWithdrawalEligibility(userId: string, amount: number): Promise<WithdrawalCheck>;
  submitWithdrawal(userId: string, amount: number): Promise<WithdrawalSubmission>;
}

/**
 * Simulated EPFO adapter.
 *
 * Nothing here talks to EPFO. The numbers are synthetic and every response is
 * labelled as demo data by the callers that render it.
 */
export class MockEPFOService implements EPFOService {
  readonly id = 'epfo';
  readonly name = 'EPFO';
  readonly mode = 'demo' as const;
  readonly officialSource = {
    name: EPFO_SOURCE.name,
    url: EPFO_SOURCE.url,
    lastVerified: EPFO_SOURCE.lastVerified,
  };

  async checkConnection(): Promise<ServiceConnection> {
    if (isForcedOffline(this.id)) {
      return {
        serviceId: this.id,
        status: 'unavailable',
        mode: 'demo',
        checkedAt: nowIso(),
        message: 'The provident fund service is switched off for this session.',
      };
    }
    return {
      serviceId: this.id,
      status: 'connected',
      mode: 'demo',
      checkedAt: nowIso(),
      message: 'Your provident fund account is connected.',
    };
  }

  private async ensureOnline() {
    const connection = await this.checkConnection();
    if (connection.status !== 'connected') {
      throw new ServiceUnavailableError(this.id);
    }
  }

  async getPassbook(_userId: string): Promise<PassbookResult> {
    await this.ensureOnline();
    return { passbook: { ...demoPassbook }, entries: demoPassbookEntries.map((e) => ({ ...e })) };
  }

  async checkWithdrawalEligibility(_userId: string, amount: number): Promise<WithdrawalCheck> {
    await this.ensureOnline();
    const withinBalance = amount > 0 && amount <= demoPassbook.balance;
    const withinLimit = amount <= WITHDRAWAL_DEMO_LIMIT;
    const reasons = [
      { label: 'Your account was found', ok: true },
      { label: 'Your identity and bank details are linked', ok: demoKyc.aadhaarSeeded && demoKyc.bankSeeded },
      { label: 'You have enough money in the account', ok: withinBalance },
      { label: 'The amount is within the limit for one request', ok: withinLimit },
    ];
    return {
      eligible: reasons.every((reason) => reason.ok),
      reasons,
      maxAmount: Math.min(demoPassbook.balance, WITHDRAWAL_DEMO_LIMIT),
      bankMasked: demoKyc.bankMasked,
    };
  }

  async submitWithdrawal(_userId: string, _amount: number): Promise<WithdrawalSubmission> {
    await this.ensureOnline();
    return {
      applicationId: demoReference('PF', 123),
      status: 'submitted_demo',
      submittedAt: nowIso(),
    };
  }
}
