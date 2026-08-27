import { ApiError, guard, limit, ok } from '@/lib/api';
import { documentUploadSchema } from '@/lib/validation/schemas';
import { getCurrentUserId } from '@/lib/security/session';
import { getDatabase } from '@/lib/database';
import { storeUpload } from '@/lib/documents/document-service';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

export async function GET() {
  return guard(async () => {
    const userId = await getCurrentUserId();
    const documents = await getDatabase().listDocuments(userId);
    return ok({ documents });
  });
}

/** Uploads a document into the citizen's wallet so it can be reused later. */
export async function POST(request: Request) {
  return guard(async () => {
    const userId = await getCurrentUserId();
    await limit('write', userId);

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new ApiError('Choose a file to upload.', 400);
    if (file.size > MAX_BYTES) throw new ApiError('That file is larger than the 4 MB prototype limit.', 413);
    if (!ALLOWED.includes(file.type)) {
      throw new ApiError('Upload a PDF or an image (PNG, JPEG or WebP).', 415);
    }

    const parsed = documentUploadSchema.parse({
      name: form.get('name')?.toString() || undefined,
      category: form.get('category')?.toString() || undefined,
      purposes: form.getAll('purposes').map((value) => value.toString()),
    });

    const document = await storeUpload({
      userId,
      fileName: file.name,
      mimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
      category: parsed.category,
      purposes: parsed.purposes,
      name: parsed.name,
    });

    return ok({ document }, { status: 201 });
  });
}
