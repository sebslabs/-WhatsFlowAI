import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { logger } from '@/lib/logger';

// SECURITY FIX (CRITICAL #4): Allowlist of permitted MIME types.
// Only allow safe, common file types to prevent malicious file uploads.
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

// SECURITY FIX (CRITICAL #4): Extension to MIME mapping to prevent MIME/extension mismatch attacks.
// e.g. a .png file that claims MIME type image/jpeg must be rejected.
const MIME_TO_EXTENSION: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png':  ['png'],
  'image/webp': ['webp'],
  'application/pdf': ['pdf'],
};

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB cap

export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request);
  if (error) return error;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // SECURITY FIX (CRITICAL #4): Enforce MIME type allowlist
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `File type not allowed. Accepted types: ${[...ALLOWED_MIME_TYPES].join(', ')}` },
        { status: 415 }
      );
    }

    // SECURITY FIX (CRITICAL #4): Enforce file size cap explicitly at the app layer
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File size exceeds maximum allowed limit of 20 MB` },
        { status: 413 }
      );
    }

    // SECURITY FIX (CRITICAL #4): Validate that the file extension matches the declared MIME type
    const rawExt = (file.name.split('.').pop() || '').toLowerCase();
    const allowedExts = MIME_TO_EXTENSION[file.type] ?? [];
    if (!allowedExts.includes(rawExt)) {
      return NextResponse.json(
        { error: `File extension '.${rawExt}' does not match declared content type '${file.type}'` },
        { status: 415 }
      );
    }

    const bucketName = 'chat-attachments';

    // SECURITY FIX (CRITICAL #4): Ensure bucket is private (public: false).
    // Files are accessed via signed URLs, not public URLs.
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      if (!buckets?.some(b => b.id === bucketName)) {
        await supabase.storage.createBucket(bucketName, {
          public: false,          // FIXED: was true — bucket must be private
          fileSizeLimit: MAX_FILE_SIZE_BYTES,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.warn('Failed ensuring bucket exists:', errorMessage);
    }

    // Namespace by tenant to enforce tenant isolation in storage
    const fileName = `${user.tenant_id}/${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${rawExt}`;

    const { data, error: uploadErr } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadErr) {
      logger.warn({ err: uploadErr }, 'Upload to chat-attachments failed');
      throw uploadErr;
    }

    // SECURITY FIX (CRITICAL #4): Generate a signed URL instead of a public URL.
    // Signed URLs expire and prevent unauthorized access to private files.
    const { data: signedUrlData, error: signedUrlErr } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(fileName, 3600); // 1-hour expiry

    if (signedUrlErr || !signedUrlData?.signedUrl) {
      logger.error('Failed to generate signed URL for uploaded file', signedUrlErr?.message ?? 'Unknown error');
      throw signedUrlErr ?? new Error('Signed URL generation failed');
    }

    return NextResponse.json({
      url: signedUrlData.signedUrl,
      name: file.name,
      type: file.type,
    });

  } catch (err: any) {
    logger.error('File upload API failed', err);
    return NextResponse.json({ error: 'File upload failed', details: err.message }, { status: 500 });
  }
}
