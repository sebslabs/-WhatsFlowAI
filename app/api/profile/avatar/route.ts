import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { supabaseAdmin } from '@/lib/supabase/admin';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MIME_TO_EXTENSION: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png':  ['png'],
  'image/webp': ['webp'],
  'image/gif':  ['gif'],
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB cap for avatars

export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request);
  if (error) return error;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `File type not allowed. Accepted types: jpeg, png, webp, gif` },
        { status: 415 }
      );
    }

    // Enforce file size limit
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File size exceeds the 5 MB limit` },
        { status: 413 }
      );
    }

    // Validate file extension against MIME type
    const rawExt = (file.name.split('.').pop() || '').toLowerCase();
    const allowedExts = MIME_TO_EXTENSION[file.type] ?? [];
    if (!allowedExts.includes(rawExt)) {
      return NextResponse.json(
        { error: `File extension '.${rawExt}' does not match declared content type '${file.type}'` },
        { status: 415 }
      );
    }

    const bucketName = 'avatars';

    // Verify bucket exists and is public using admin client
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      if (!buckets?.some(b => b.id === bucketName)) {
        await supabaseAdmin.storage.createBucket(bucketName, {
          public: true, // Profile images must be public for simple embedding
          fileSizeLimit: MAX_FILE_SIZE_BYTES,
          allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
        });
      }
    } catch (err: any) {
      logger.error({ err }, 'Failed ensuring avatars bucket exists via admin');
    }

    // Enforce user isolation in path: `user_id/avatar-timestamp.ext`
    const fileName = `${user.id}/avatar-${Date.now()}.${rawExt}`;

    // Upload using admin client to bypass any missing local migration policies
    const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadErr) {
      logger.error({ err: uploadErr }, 'Upload to avatars bucket failed');
      throw uploadErr;
    }

    // Get the public URL for the uploaded avatar image
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    if (!publicUrlData || !publicUrlData.publicUrl) {
      throw new Error('Failed to generate public URL for avatar');
    }

    const publicUrl = publicUrlData.publicUrl;

    // Update profiles table with the new avatar URL
    const { error: profileUpdateErr } = await (supabaseAdmin.from('profiles') as any)
      .update({ avatar_url: publicUrl })
      .eq('id', user.id) as { error: any };

    if (profileUpdateErr) {
      logger.error({ err: profileUpdateErr }, 'Failed to update avatar_url in profiles table');
      throw profileUpdateErr;
    }

    logger.info({ userId: user.id, avatarUrl: publicUrl }, 'Avatar uploaded and saved successfully');

    return NextResponse.json({
      success: true,
      avatar_url: publicUrl,
    });

  } catch (err: any) {
    logger.error('Profile avatar upload failed', err);
    return NextResponse.json({ error: 'Avatar upload failed', details: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { user, error } = await requireAuthApi(request);
  if (error) return error;

  try {
    const bucketName = 'avatars';

    // 1. Fetch current profile to get the avatar_url and delete the physical file
    const { data: profile, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .maybeSingle() as { data: { avatar_url: string | null } | null; error: any };

    if (fetchErr) {
      logger.error({ err: fetchErr }, 'Failed to fetch user profile during avatar deletion');
      throw fetchErr;
    }

    if (profile?.avatar_url) {
      // Parse the file path inside the bucket from the public URL
      // URL format: .../storage/v1/object/public/avatars/{user_id}/avatar-timestamp.ext
      const urlParts = profile.avatar_url.split(`/storage/v1/object/public/${bucketName}/`);
      if (urlParts.length === 2) {
        const filePath = urlParts[1];
        const { error: deleteFileErr } = await supabaseAdmin.storage
          .from(bucketName)
          .remove([filePath]);
        if (deleteFileErr) {
          logger.warn({ err: deleteFileErr, filePath }, 'Failed to delete avatar file from storage bucket');
        }
      }
    }

    // 2. Set the avatar_url in the profiles table to NULL
    const { error: profileUpdateErr } = await (supabaseAdmin.from('profiles') as any)
      .update({ avatar_url: null })
      .eq('id', user.id) as { error: any };

    if (profileUpdateErr) {
      logger.error({ err: profileUpdateErr }, 'Failed to reset avatar_url in profiles table');
      throw profileUpdateErr;
    }

    logger.info({ userId: user.id }, 'Avatar removed successfully');

    return NextResponse.json({
      success: true,
      avatar_url: null,
    });

  } catch (err: any) {
    logger.error('Profile avatar removal failed', err);
    return NextResponse.json({ error: 'Avatar removal failed', details: err.message }, { status: 500 });
  }
}
