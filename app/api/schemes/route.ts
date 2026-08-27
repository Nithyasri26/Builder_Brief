import { guard, ok } from '@/lib/api';
import { demoSchemes } from '@/data/demo/schemes';

export const dynamic = 'force-dynamic';

export async function GET() {
  return guard(async () => ok({ schemes: demoSchemes }));
}
