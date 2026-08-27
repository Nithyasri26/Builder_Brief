import type { GovernmentService, ServiceConnection } from './types';
import { ServiceUnavailableError, demoReference, isForcedOffline } from './types';
import type { Scheme, SchemeMatch, SchemeRequiredDocument } from '@/types/scheme';
import type { CitizenSituation } from '@/types/user';
import type { CitizenDocument } from '@/types/document';
import { demoSchemes } from '@/data/demo/schemes';
import { checkPotentialEligibility, rankMatches } from '@/lib/eligibility/engine';
import { nowIso } from '@/lib/utils';

export interface SchemeService extends GovernmentService {
  searchSchemes(situation: CitizenSituation): Promise<Scheme[]>;
  checkPotentialEligibility(
    situation: CitizenSituation,
    documents: CitizenDocument[],
  ): Promise<SchemeMatch[]>;
  getScheme(schemeId: string): Promise<Scheme | null>;
  getRequiredDocuments(schemeId: string): Promise<SchemeRequiredDocument[]>;
  startSchemeApplication(userId: string, schemeId: string): Promise<{ applicationId: string }>;
}

/**
 * Simulated scheme discovery.
 *
 * Demo schemes exercise the eligibility engine. Official programmes are
 * carried as information-only entries pointing at the government source —
 * this prototype never asserts official eligibility.
 */
export class MockSchemeService implements SchemeService {
  readonly id = 'schemes';
  readonly name = 'Government Schemes';
  readonly mode = 'demo' as const;
  readonly officialSource = {
    name: 'myScheme (National Scheme Discovery Portal)',
    url: 'https://www.myscheme.gov.in',
    lastVerified: '2026-08-25',
  };

  async checkConnection(): Promise<ServiceConnection> {
    if (isForcedOffline(this.id)) {
      return {
        serviceId: this.id,
        status: 'unavailable',
        mode: 'demo',
        checkedAt: nowIso(),
        message: 'The programme list is switched off for this session.',
      };
    }
    return {
      serviceId: this.id,
      status: 'connected',
      mode: 'demo',
      checkedAt: nowIso(),
      message: 'Support programmes are available to search.',
    };
  }

  private async ensureOnline() {
    const connection = await this.checkConnection();
    if (connection.status !== 'connected') throw new ServiceUnavailableError(this.id);
  }

  async searchSchemes(situation: CitizenSituation): Promise<Scheme[]> {
    await this.ensureOnline();
    const state = situation.state?.toLowerCase();
    return demoSchemes.filter((scheme) => {
      if (!state) return true;
      const schemeState = scheme.state.toLowerCase();
      return schemeState === state || schemeState === 'all india';
    });
  }

  async checkPotentialEligibility(
    situation: CitizenSituation,
    documents: CitizenDocument[],
  ): Promise<SchemeMatch[]> {
    const schemes = await this.searchSchemes(situation);
    const matches = schemes.map((scheme) =>
      checkPotentialEligibility(scheme, situation, documents),
    );
    return rankMatches(matches);
  }

  async getScheme(schemeId: string): Promise<Scheme | null> {
    return demoSchemes.find((scheme) => scheme.id === schemeId) ?? null;
  }

  async getRequiredDocuments(schemeId: string): Promise<SchemeRequiredDocument[]> {
    const scheme = await this.getScheme(schemeId);
    return scheme?.requiredDocuments ?? [];
  }

  async startSchemeApplication(_userId: string, schemeId: string): Promise<{ applicationId: string }> {
    await this.ensureOnline();
    const scheme = await this.getScheme(schemeId);
    if (!scheme) throw new ServiceUnavailableError(this.id, 'I cannot find that programme.');
    if (!scheme.isDemoScheme) {
      throw new ServiceUnavailableError(
        this.id,
        'This programme is applied for on the government website, not here.',
      );
    }
    return { applicationId: demoReference('SCHEME', 401) };
  }
}
