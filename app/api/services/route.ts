import { guard, ok } from '@/lib/api';
import { allServices } from '@/lib/services/registry';

export const dynamic = 'force-dynamic';

/** Live connection state of every government adapter. All simulated today. */
export async function GET() {
  return guard(async () => {
    const connections = await Promise.all(
      allServices().map(async (service) => ({
        id: service.id,
        name: service.name,
        mode: service.mode,
        officialSource: service.officialSource,
        connection: await service.checkConnection(),
      })),
    );
    return ok({ connections });
  });
}
