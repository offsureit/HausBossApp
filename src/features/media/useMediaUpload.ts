import { useCallback, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { isOnline } from '~/api/client';
import { useAuth } from '~/features/auth/AuthProvider';
import { toast } from '~/features/toast/store';
import { locationsService } from '~/services/locations';
import { mediaService, type MediaUploadItem } from '~/services/media';
import { offlineQueue } from '~/services/offlineQueue';
import type { MediaItem, MediaTag } from '@/types';

export type UploadStatus = 'uploading' | 'done' | 'error' | 'queued';

/** Longest edge after compression; job photos do not need more and uploads are 4–6× smaller. */
export const MAX_IMAGE_EDGE = 1600;
export const JPEG_QUALITY = 0.8;

/** Downscale + re-encode an image for upload (videos and small images pass through). */
export async function compressImage(uri: string, width?: number | null, height?: number | null): Promise<{ uri: string; size?: number | null; type: string } | null> {
  try {
    const longest = Math.max(width ?? 0, height ?? 0);
    const ctx = ImageManipulator.manipulate(uri);
    if (longest > MAX_IMAGE_EDGE) ctx.resize((width ?? 0) >= (height ?? 0) ? { width: MAX_IMAGE_EDGE } : { height: MAX_IMAGE_EDGE });
    const ref = await ctx.renderAsync();
    const out = await ref.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
    return { uri: out.uri, size: null, type: 'image/jpeg' };
  } catch {
    return null;
  }
}

/** Camera or library → `MediaUploadItem`s (validated, images compressed). Returns [] when cancelled or denied. */
export async function pickMedia(source: 'camera' | 'library', options: { tag?: MediaTag; multiple?: boolean; video?: boolean } = {}): Promise<MediaUploadItem[]> {
  const mediaTypes: ImagePicker.MediaType[] = options.video === false ? ['images'] : ['images', 'videos'];
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { toast.error('Camera permission is needed', { description: 'Allow camera access in Settings to take job photos.' }); return []; }
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { toast.error('Photo library permission is needed', { description: 'Allow photo access in Settings to attach files.' }); return []; }
  }
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync({ mediaTypes, quality: 0.9, videoMaxDuration: mediaService.MAX_VIDEO_SECONDS })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes, quality: 0.9, allowsMultipleSelection: options.multiple ?? true, selectionLimit: 10 });
  if (result.canceled) return [];
  const gps = await locationsService.captureGps(4_000);
  const items: MediaUploadItem[] = [];
  for (const a of result.assets) {
    const isVideo = a.type === 'video';
    const baseName = a.fileName ?? `${isVideo ? 'video' : 'photo'}-${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`;
    let uri = a.uri;
    let type = a.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg');
    let size: number | null | undefined = a.fileSize ?? null;
    let name = baseName;
    if (!isVideo) {
      const compressed = await compressImage(a.uri, a.width, a.height);
      if (compressed) { uri = compressed.uri; type = compressed.type; size = compressed.size; name = baseName.replace(/\.[a-z0-9]+$/i, '') + '.jpg'; }
    }
    const item: MediaUploadItem = { uri, name, type, size, gps, tag: options.tag, timestamp: new Date().toISOString() };
    const problem = mediaService.validateMediaItem(item);
    if (problem) { toast.error(problem); continue; }
    items.push(item);
  }
  return items;
}

/**
 * Sequential upload with per-item progress; appends to `jobs.media_urls` when a job id is given.
 * Offline, the files are copied into app storage and queued (the returned items point at the local
 * copies, `path` starts with `queued/`). A failed upload offers Retry.
 */
export function useMediaUpload() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<Record<string, UploadStatus>>({});
  const active = useRef(0);

  const upload = useCallback(async function run(items: readonly MediaUploadItem[], jobId: string | null, options: { append?: boolean } = {}): Promise<MediaItem[]> {
    if (!user) { toast.error('You must be signed in to upload'); return []; }
    if (items.length === 0) return [];

    if (!isOnline() && options.append !== false) {
      const stashed: MediaUploadItem[] = [];
      for (const item of items) {
        try { stashed.push(await offlineQueue.stashForOffline(item)); } catch { toast.error(`${item.name}: could not be saved for later`); }
      }
      if (!stashed.length) return [];
      const op = offlineQueue.enqueue({ kind: 'media_upload', jobId, userId: user.id, items: stashed });
      if (!op) { toast.error('You are offline and the photos could not be saved on this device'); return []; }
      setProgress((p) => ({ ...p, ...Object.fromEntries(stashed.map((i) => [i.name, 'queued' as UploadStatus])) }));
      toast.info(`You are offline — ${stashed.length} photo${stashed.length > 1 ? 's' : ''} queued`);
      return stashed.map((i) => offlineQueue.queuedMediaItem(i, op.id, user.id));
    }

    active.current += 1;
    setUploading(true);
    const { data } = await mediaService.uploadMedia(items, user.id, jobId, (name, state) => setProgress((p) => ({ ...p, [name]: state })));
    const uploaded = data?.uploaded ?? [];
    if (jobId && uploaded.length && options.append !== false) {
      const appended = await mediaService.appendJobMedia(jobId, uploaded);
      if (appended.error) toast.error(appended.error.message);
    }
    if (data?.failed.length) {
      const failedItems = items.filter((i) => data.failed.some((f) => f.name === i.name));
      toast.error(`Upload failed for ${data.failed.length} file${data.failed.length > 1 ? 's' : ''}`, { description: data.failed[0]?.message, action: { label: 'Retry', onPress: () => void run(failedItems, jobId, options) } });
    }
    active.current -= 1;
    if (active.current <= 0) setUploading(false);
    return uploaded;
  }, [user]);

  return { uploading, progress, upload };
}
