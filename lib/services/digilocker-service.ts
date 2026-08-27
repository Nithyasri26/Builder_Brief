import type { GovernmentService, ServiceConnection } from './types';
import { ServiceUnavailableError, isForcedOffline } from './types';
import { DIGILOCKER_SOURCE } from '@/data/demo/documents';
import type { CitizenDocument, DigiLockerDocument } from '@/types/document';
import { getDatabase } from '@/lib/database';
import { nowIso } from '@/lib/utils';

export interface DigiLockerService extends GovernmentService {
  listDocuments(userId: string): Promise<DigiLockerDocument[]>;
  findDocument(userId: string, query: string): Promise<DigiLockerDocument | null>;
  importDocument(userId: string, digiLockerId: string): Promise<CitizenDocument>;
}

/**
 * Simulated DigiLocker adapter.
 *
 * There is NO real DigiLocker connection. Documents come from a sample wallet.
 * The About page states this plainly, so individual screens do not have to
 * repeat it on every row.
 */
export class MockDigiLockerService implements DigiLockerService {
  readonly id = 'digilocker';
  readonly name = 'DigiLocker';
  readonly mode = 'demo' as const;
  readonly officialSource = {
    name: DIGILOCKER_SOURCE.name,
    url: DIGILOCKER_SOURCE.url,
    lastVerified: DIGILOCKER_SOURCE.lastVerified,
  };

  async checkConnection(): Promise<ServiceConnection> {
    if (isForcedOffline(this.id)) {
      return {
        serviceId: this.id,
        status: 'unavailable',
        mode: 'demo',
        checkedAt: nowIso(),
        message: 'The document locker is switched off for this session.',
      };
    }
    return {
      serviceId: this.id,
      status: 'connected',
      mode: 'demo',
      checkedAt: nowIso(),
      message: 'Your document locker is connected.',
    };
  }

  private async ensureOnline() {
    const connection = await this.checkConnection();
    if (connection.status !== 'connected') throw new ServiceUnavailableError(this.id);
  }

  async listDocuments(userId: string): Promise<DigiLockerDocument[]> {
    await this.ensureOnline();
    return getDatabase().listDigiLockerDocuments(userId);
  }

  async findDocument(userId: string, query: string): Promise<DigiLockerDocument | null> {
    const documents = await this.listDocuments(userId);
    const q = query.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!q) return null;
    return (
      documents.find((doc) => doc.name.toLowerCase() === q) ??
      documents.find((doc) => q.includes(doc.name.toLowerCase())) ??
      documents.find((doc) => doc.name.toLowerCase().includes(q)) ??
      null
    );
  }

  async importDocument(userId: string, digiLockerId: string): Promise<CitizenDocument> {
    await this.ensureOnline();
    const db = getDatabase();
    const documents = await db.listDigiLockerDocuments(userId);
    const source = documents.find((doc) => doc.id === digiLockerId);
    if (!source) throw new ServiceUnavailableError(this.id, 'That document is not in your locker.');

    // If the citizen already holds this document, the wallet row must still be
    // marked as imported — otherwise the button sits there looking untouched
    // and they tap it again and again.
    const existing = await db.listDocuments(userId);
    const already = existing.find((doc) => doc.name === source.name);
    if (already) {
      await db.markDigiLockerImported(userId, digiLockerId);
      return already;
    }

    const imported: CitizenDocument = {
      id: `doc_${source.id}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      name: source.name,
      fileName: `${source.name.replace(/\s+/g, '_')}.pdf`,
      category: source.category,
      purposes: source.purposes,
      source: 'digilocker_demo',
      sourceLabel: 'From your online locker',
      issuedOn: source.issuedOn,
      addedAt: nowIso(),
      verification: 'demo_imported',
      mimeType: 'application/pdf',
      sizeLabel: '120 KB',
      isDemoDocument: true,
      summary: `Saved from your online locker. Issued by ${source.issuer}.`,
    };

    await db.addDocument(imported);
    await db.markDigiLockerImported(userId, digiLockerId);
    return imported;
  }
}
