import type { GovernmentService, ServiceConnection } from './types';
import { ServiceUnavailableError, demoReference, isForcedOffline } from './types';
import type { TrainOption } from '@/types/train';
import { RAIL_SOURCE, buildGenericRoute, demoTrainRoutes } from '@/data/demo/trains';
import { nowIso } from '@/lib/utils';

export interface RailBooking {
  reference: string;
  status: 'demo_booking';
  bookedAt: string;
}

export interface RailService extends GovernmentService {
  searchTrains(input: { from: string; to: string; date: string; travelClass?: string }): Promise<TrainOption[]>;
  getTrain(trainId: string, from: string, to: string): Promise<TrainOption | null>;
  createDemoBooking(userId: string, trainId: string): Promise<RailBooking>;
}

/**
 * Simulated railway adapter.
 *
 * Journey options come from a small demo dataset. Nothing here is live
 * availability, no payment is taken and no ticket is ever booked.
 */
export class MockRailService implements RailService {
  readonly id = 'rail';
  readonly name = 'Railway Enquiry';
  readonly mode = 'demo' as const;
  readonly officialSource = {
    name: RAIL_SOURCE.name,
    url: RAIL_SOURCE.url,
    lastVerified: RAIL_SOURCE.lastVerified,
  };

  async checkConnection(): Promise<ServiceConnection> {
    if (isForcedOffline(this.id)) {
      return {
        serviceId: this.id,
        status: 'unavailable',
        mode: 'demo',
        checkedAt: nowIso(),
        message: 'The railway service is switched off for this session.',
      };
    }
    return {
      serviceId: this.id,
      status: 'connected',
      mode: 'demo',
      checkedAt: nowIso(),
      message: 'Train information is available.',
    };
  }

  private routeKey(from: string, to: string): string {
    return `${from.toLowerCase().trim()}->${to.toLowerCase().trim()}`;
  }

  async searchTrains(input: {
    from: string;
    to: string;
    date: string;
    travelClass?: string;
  }): Promise<TrainOption[]> {
    const connection = await this.checkConnection();
    if (connection.status !== 'connected') throw new ServiceUnavailableError(this.id);

    const known = demoTrainRoutes[this.routeKey(input.from, input.to)];
    const options = known ? known.map((train) => ({ ...train })) : buildGenericRoute(input.from, input.to);
    if (input.travelClass) {
      const filtered = options.filter(
        (train) => train.travelClass.toLowerCase() === input.travelClass?.toLowerCase(),
      );
      if (filtered.length > 0) return filtered;
    }
    return options;
  }

  async getTrain(trainId: string, from: string, to: string): Promise<TrainOption | null> {
    const options = await this.searchTrains({ from, to, date: 'demo' });
    return options.find((train) => train.id === trainId) ?? null;
  }

  async createDemoBooking(_userId: string, _trainId: string): Promise<RailBooking> {
    const connection = await this.checkConnection();
    if (connection.status !== 'connected') throw new ServiceUnavailableError(this.id);
    return {
      reference: demoReference('RAIL', 501),
      status: 'demo_booking',
      bookedAt: nowIso(),
    };
  }
}
