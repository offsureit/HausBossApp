import type { GpsPoint, MediaItem, MediaTag } from '@/types';

/**
 * Pure media helpers shared by the web app (`services/mediaService.ts`, `PhotoViewer.tsx`) and the
 * mobile app: file naming, storage paths, Pre-Job / Post-Job grouping and GPS links (§8.5).
 */

export const TEMP_JOB_FOLDER = 'temp';

/** Strip everything except `[A-Za-z0-9._-]`, collapse repeats and cap the length. */
export function sanitizeFileName(name: string): string {
  const trimmed = (name ?? '').trim();
  const cleaned = trimmed.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_{2,}/g, '_').replace(/^[._-]+/, '');
  const capped = cleaned.slice(0, 120);
  return capped || 'file';
}

/** `${userId}/${jobId|temp}/${now}_${name}` — the public URL persisted in `jobs.media_urls`. */
export function buildMediaPath(userId: string, jobId: string | null | undefined, name: string, now: number = Date.now()): string {
  const folder = jobId && jobId.trim() ? jobId.trim() : TEMP_JOB_FOLDER;
  return `${userId}/${folder}/${now}_${sanitizeFileName(name)}`;
}

export function tagMedia<T extends MediaItem>(item: T, tag: MediaTag): T {
  return { ...item, tag };
}

export function isPreJob(item: MediaItem): boolean {
  return item.tag === 'pre';
}

export function isPostJob(item: MediaItem): boolean {
  return item.tag === 'post';
}

export interface GroupedMedia {
  pre: MediaItem[];
  post: MediaItem[];
  other: MediaItem[];
}

export function groupMedia(items: readonly MediaItem[]): GroupedMedia {
  const grouped: GroupedMedia = { pre: [], post: [], other: [] };
  for (const item of items) {
    if (item.tag === 'pre') grouped.pre.push(item);
    else if (item.tag === 'post') grouped.post.push(item);
    else grouped.other.push(item);
  }
  return grouped;
}

/** Google Maps link for a GPS-stamped capture. */
export function gpsMapLink(gps: GpsPoint | null | undefined): string | null {
  if (!gps || !Number.isFinite(gps.latitude) || !Number.isFinite(gps.longitude)) return null;
  return `https://www.google.com/maps?q=${gps.latitude},${gps.longitude}`;
}

export function isVideo(item: Pick<MediaItem, 'type' | 'name'>): boolean {
  return item.type.startsWith('video') || /\.(mp4|webm|mov|m4v)$/i.test(item.name);
}
