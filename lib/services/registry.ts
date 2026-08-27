import { MockEPFOService, type EPFOService } from './epfo-service';
import { MockDigiLockerService, type DigiLockerService } from './digilocker-service';
import { MockSchemeService, type SchemeService } from './scheme-service';
import { MockPassportService, type PassportService } from './passport-service';
import { MockComplaintService, type ComplaintService } from './complaint-service';
import { MockRailService, type RailService } from './rail-service';
import { MockUMANGService, type UMANGService } from './umang-service';
import type { GovernmentService } from './types';

/**
 * The single place where an adapter is chosen.
 *
 * Today every entry resolves to a Mock* implementation. Connecting a real,
 * authorised integration later means swapping the right-hand side here — the
 * chat orchestrator, the workflow engine and every screen stay untouched.
 *
 *   epfo       -> MockEPFOService        -> future authorised EPFO integration
 *   digilocker -> MockDigiLockerService  -> future authorised DigiLocker integration
 *   schemes    -> MockSchemeService      -> future verified scheme data source
 *   passport   -> MockPassportService    -> future authorised Passport Seva integration
 *   grievance  -> MockComplaintService   -> future authorised grievance integration
 *   rail       -> MockRailService        -> future authorised railway integration
 */
export const services = {
  epfo: new MockEPFOService() as EPFOService,
  digilocker: new MockDigiLockerService() as DigiLockerService,
  schemes: new MockSchemeService() as SchemeService,
  passport: new MockPassportService() as PassportService,
  grievance: new MockComplaintService() as ComplaintService,
  rail: new MockRailService() as RailService,
  directory: new MockUMANGService() as UMANGService,
};

export function allServices(): GovernmentService[] {
  return Object.values(services);
}

export type { GovernmentService } from './types';
export { ServiceUnavailableError } from './types';
