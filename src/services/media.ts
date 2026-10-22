import { File } from 'expo-file-system';
import { api, uploadFile } from '~/api/client';
import { resolveMediaUrl } from '~/lib/env';
import { fail, fromApi, ok, toServiceError, type ServiceResult } from '@/services/types';
import { TEMP_JOB_FOLDER, sanitizeFileName } from '@/utils/media';
import type { GpsPoint, MediaItem, MediaTag } from '@/types';

/**
 * Media storage (`POST /media/upload`, `DELETE /media`; §8.5). Same path convention and
 * `jobs.media_urls` read-modify-write as the web `mediaService`; the file comes from a local
 * `file://` URI (camera / library) instead of a Blob.
 */

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 60;

export interface MediaUploadItem {
  /** Local file URI from expo-image-picker. */
  uri: string;
  name: string;
  type: string;
  size?: number | null;
  gps?: GpsPoint | null;
  tag?: MediaTag;
  timestamp?: string;
}

export interface MediaUploadResult {
  uploaded: MediaItem[];
  failed: { name: string; message: string }[];
}

export function validateMediaItem(item: Pick<MediaUploadItem, 'name' | 'type' | 'size'>): string | null {
  if (!item.type.startsWith('image/') && !item.type.startsWith('video/')) return `${item.name}: only images and videos are allowed`;
  if (item.size && item.size > MAX_FILE_BYTES) return `${item.name}: larger than ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB`;
  return null;
}

interface UploadResponse { path: string; url: string; size?: number; mimeType?: string | null }

/**
 * Expo's WinterCG `fetch` (installed globally in SDK 58) rejects React Native's legacy `{ uri }`
 * form parts ("Unsupported FormDataPart implementation"); it wants a Blob-like part exposing
 * `bytes()`, `name` and `type`. Read the picked file lazily through expo-file-system.
 */
function fileParam(item: MediaUploadItem): Blob {
  const file = new File(item.uri);
  const part = { name: sanitizeFileName(item.name), type: item.type || 'application/octet-stream', size: item.size ?? file.size ?? 0, bytes: () => file.bytes() };
  return part as unknown as Blob;
}

export async function uploadMedia(items: readonly MediaUploadItem[], userId: string, jobId?: string | null, onProgress?: (name: string, state: 'uploading' | 'done' | 'error') => void): Promise<ServiceResult<MediaUploadResult>> {
  if (!userId) return fail('You must be signed in to upload media');
  const result: MediaUploadResult = { uploaded: [], failed: [] };
  const folder = jobId && jobId.trim() ? jobId.trim() : TEMP_JOB_FOLDER;
  for (const item of items) {
    onProgress?.(item.name, 'uploading');
    try {
      const form = new FormData();
      form.append('file', fileParam(item));
      form.append('folder', folder);
      if (folder !== TEMP_JOB_FOLDER && folder !== 'avatar') form.append('jobId', folder);
      const res = await uploadFile<UploadResponse>('/media/upload', form);
      result.uploaded.push({
        url: resolveMediaUrl({ url: res.url, path: res.path }),
        path: res.path,
        type: res.mimeType ?? item.type,
        name: item.name,
        timestamp: item.timestamp ?? new Date().toISOString(),
        gps: item.gps ?? null,
        tag: item.tag,
        uploadedBy: userId,
      });
      onProgress?.(item.name, 'done');
    } catch (err) {
      result.failed.push({ name: item.name, message: toServiceError(err).message });
      onProgress?.(item.name, 'error');
    }
  }
  return ok(result);
}

export async function removeMedia(path: string): Promise<ServiceResult<{ removed: string }>> {
  const res = await fromApi(() => api.delete<unknown>('/media', { query: { path } }), 'Could not delete the file');
  return res.error ? { data: null, error: res.error } : ok({ removed: path });
}

async function readJobMedia(jobId: string): Promise<ServiceResult<MediaItem[]>> {
  const res = await fromApi(() => api.get<{ media_urls: unknown }>(`/jobs/${encodeURIComponent(jobId)}`), 'Job not found');
  if (res.error) return { data: null, error: res.error };
  return ok(Array.isArray(res.data?.media_urls) ? (res.data.media_urls as MediaItem[]) : []);
}

/** Append items to `jobs.media_urls` (read-modify-write; the realtime echo refreshes the job). */
export async function appendJobMedia(jobId: string, items: readonly MediaItem[]): Promise<ServiceResult<MediaItem[]>> {
  if (items.length === 0) return ok([]);
  const existing = await readJobMedia(jobId);
  if (existing.error) return { data: null, error: existing.error };
  const merged = [...(existing.data ?? []), ...items];
  const saved = await fromApi(() => api.patch<unknown>(`/jobs/${encodeURIComponent(jobId)}`, { media_urls: merged }), 'Could not attach media to the job');
  return saved.error ? { data: null, error: saved.error } : ok(merged);
}

export async function removeJobMedia(jobId: string, path: string, options: { deleteFromStorage?: boolean } = {}): Promise<ServiceResult<MediaItem[]>> {
  const existing = await readJobMedia(jobId);
  if (existing.error) return { data: null, error: existing.error };
  const remaining = (existing.data ?? []).filter((m) => m.path !== path);
  const saved = await fromApi(() => api.patch<unknown>(`/jobs/${encodeURIComponent(jobId)}`, { media_urls: remaining }), 'Could not update the job media');
  if (saved.error) return { data: null, error: saved.error };
  if (options.deleteFromStorage) await removeMedia(path);
  return ok(remaining);
}

export const mediaService = { uploadMedia, removeMedia, appendJobMedia, removeJobMedia, validateMediaItem, MAX_FILE_BYTES, MAX_VIDEO_SECONDS };
