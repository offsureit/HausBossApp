import { create } from 'zustand';
import { Directory, File, Paths } from 'expo-file-system';
import { isOnline } from '~/api/client';
import { kv } from '~/lib/storage';
import type { ServiceError } from '@/services/types';
import type { JobStatus, JobUpdateInput, MediaItem } from '@/types';
import { jobsService } from './jobs';
import { mediaService, type MediaUploadItem } from './media';
import { messagesService, type SendMessageInput } from './messages';
import type { LocationFix } from './locations';

/**
 * Offline write queue — the mobile port of the web `src/services/offlineQueue.ts`, in MMKV.
 * Queues job updates, status changes (with the GPS fix captured at the time), chat messages and
 * photo uploads (the files are copied into the app's documents folder first) while offline, and
 * replays them in FIFO order when the connection returns.
 *
 * Guarantees: FIFO, single-flight replay, ops enqueued during a replay survive (merge-on-write).
 * A transient failure (offline / timeout / 5xx) stops the replay so order is preserved and the
 * op retries next time; a permanent answer (4xx: the server refused the transition, the job is
 * gone…) marks the op `stuck` so the user can retry or discard it from the banner — it is never
 * silently overwritten or dropped.
 */

export const OFFLINE_QUEUE_KEY = 'hb.offline.queue';
export const OFFLINE_QUEUE_MAX = 500;
export const MAX_ATTEMPTS = 5;
const MEDIA_DIR = 'offline-media';

interface Base { id: string; queuedAt: string; attempts: number; lastError?: string; stuck?: boolean }
export type QueuedOperation =
  | (Base & { kind: 'job_update'; jobId: string; patch: JobUpdateInput })
  | (Base & { kind: 'job_status'; jobId: string; status: JobStatus; previousStatus?: JobStatus; location?: LocationFix; actorIsContractor?: boolean; isStaff?: boolean })
  | (Base & { kind: 'chat_message'; jobId: string; message: SendMessageInput })
  | (Base & { kind: 'media_upload'; jobId: string | null; userId: string; items: MediaUploadItem[] });

export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type QueueInput = DistributiveOmit<QueuedOperation, 'id' | 'queuedAt' | 'attempts' | 'lastError' | 'stuck'>;

export interface ReplayReport {
  replayed: number;
  failed: { op: QueuedOperation; error: ServiceError }[];
  remaining: number;
  /** Replay stopped early because the network dropped again. */
  interrupted: boolean;
}

export interface OfflineQueueState {
  queued: number;
  stuck: number;
  replaying: boolean;
  lastReport: ReplayReport | null;
}

/** Live counts for the banner / badges (updated by every write and replay). */
export const useOfflineQueueStore = create<OfflineQueueState>(() => ({ queued: 0, stuck: 0, replaying: false, lastReport: null }));

export function readQueue(): QueuedOperation[] {
  const parsed = kv.getJSON<unknown>(OFFLINE_QUEUE_KEY);
  return Array.isArray(parsed) ? (parsed as QueuedOperation[]) : [];
}

function publish(ops: readonly QueuedOperation[], extra: Partial<OfflineQueueState> = {}): void {
  useOfflineQueueStore.setState({ queued: ops.length, stuck: ops.filter((o) => o.stuck).length, ...extra });
}

export function writeQueue(ops: readonly QueuedOperation[]): boolean {
  try {
    const next = ops.slice(-OFFLINE_QUEUE_MAX);
    kv.setJSON(OFFLINE_QUEUE_KEY, next);
    publish(next);
    return true;
  } catch {
    return false;
  }
}

export function clearQueue(): void {
  for (const op of readQueue()) if (op.kind === 'media_upload') removeLocalCopies(op.items);
  kv.remove(OFFLINE_QUEUE_KEY);
  publish([]);
}

export function queueLength(): number {
  return readQueue().length;
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Appends an operation. Returns null when it could not be persisted. */
export function enqueue(op: QueueInput): QueuedOperation | null {
  const full = { ...op, id: newId(), queuedAt: new Date().toISOString(), attempts: 0 } as QueuedOperation;
  return writeQueue([...readQueue(), full]) ? full : null;
}

export function discard(id: string): void {
  const ops = readQueue();
  const op = ops.find((o) => o.id === id);
  if (op?.kind === 'media_upload') removeLocalCopies(op.items);
  writeQueue(ops.filter((o) => o.id !== id));
}

/** Puts stuck operations back in the retry pool. */
export function retryStuck(): void {
  writeQueue(readQueue().map((o) => (o.stuck ? { ...o, stuck: false, attempts: 0, lastError: undefined } : o)));
}

export function pendingFor(jobId: string, ops: readonly QueuedOperation[] = readQueue()): QueuedOperation[] {
  return ops.filter((o) => o.jobId === jobId);
}

// ---------------------------------------------------------------------------
// Local copies of photos picked while offline (the picker's cache can be purged)
// ---------------------------------------------------------------------------

function mediaDir(): Directory {
  const dir = new Directory(Paths.document, MEDIA_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Copies the picked file into app storage; returns the item pointing at the copy. */
export async function stashForOffline(item: MediaUploadItem): Promise<MediaUploadItem> {
  const safe = item.name.replace(/[^A-Za-z0-9._-]/g, '_');
  const dest = new File(mediaDir(), `${newId()}-${safe}`);
  await new File(item.uri).copy(dest);
  return { ...item, uri: dest.uri, size: dest.size ?? item.size ?? null };
}

export function removeLocalCopies(items: readonly MediaUploadItem[]): void {
  for (const item of items) {
    try { const f = new File(item.uri); if (f.exists && item.uri.includes(`/${MEDIA_DIR}/`)) f.delete(); } catch { /* ignore */ }
  }
}

/** Placeholder `MediaItem` for a queued photo so grids and strips can show the local file. */
export function queuedMediaItem(item: MediaUploadItem, opId: string, userId: string): MediaItem {
  return { url: item.uri, path: `queued/${opId}/${item.name}`, type: item.type, name: item.name, timestamp: item.timestamp ?? new Date().toISOString(), gps: item.gps ?? null, tag: item.tag, uploadedBy: userId };
}

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

/** Transient: offline, timeout, 5xx, 401/408/429 → retry later. Everything else is a permanent answer. */
export function isTransient(error: ServiceError): boolean {
  const code = error.code ?? '';
  if (['network', 'offline', 'timeout', 'aborted'].includes(code)) return true;
  const status = (error.cause as { status?: number } | undefined)?.status;
  if (typeof status !== 'number') return !['workflow', 'validation', 'auth', 'profile_missing'].includes(code);
  return status === 0 || status >= 500 || status === 401 || status === 408 || status === 429;
}

let inFlight: Promise<ReplayReport> | null = null;

/** Replay in FIFO order (single-flight; concurrent callers share the run). */
export function replay(options: { maxAttempts?: number } = {}): Promise<ReplayReport> {
  if (inFlight) return inFlight;
  inFlight = doReplay(options).finally(() => { inFlight = null; });
  return inFlight;
}

async function doReplay(options: { maxAttempts?: number }): Promise<ReplayReport> {
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
  const ops = readQueue();
  const report: ReplayReport = { replayed: 0, failed: [], remaining: 0, interrupted: false };
  const keep: QueuedOperation[] = [];
  const processed = new Set<string>();
  useOfflineQueueStore.setState({ replaying: true });

  for (let i = 0; i < ops.length; i += 1) {
    const op = ops[i];
    if (op.stuck || !isOnline()) { keep.push(op); if (!isOnline()) report.interrupted = true; continue; }
    processed.add(op.id);
    const outcome = await replayOne(op);
    if (!outcome.error) { report.replayed += 1; continue; }
    report.failed.push({ op, error: outcome.error });
    const next: QueuedOperation = { ...(outcome.op ?? op), attempts: op.attempts + 1, lastError: outcome.error.message };
    if (isTransient(outcome.error)) {
      // Keep the order: this op and everything after it wait for the next window.
      keep.push(next.attempts >= maxAttempts ? { ...next, stuck: true } : next, ...ops.slice(i + 1));
      report.interrupted = true;
      break;
    }
    keep.push({ ...next, stuck: true });
  }

  const late = readQueue().filter((op) => !processed.has(op.id) && !keep.some((k) => k.id === op.id));
  const next = [...keep, ...late];
  writeQueue(next);
  report.remaining = next.length;
  useOfflineQueueStore.setState({ replaying: false, lastReport: report });
  return report;
}

async function replayOne(op: QueuedOperation): Promise<{ error: ServiceError | null; op?: QueuedOperation }> {
  switch (op.kind) {
    case 'job_update': return { error: (await jobsService.updateJob(op.jobId, op.patch)).error };
    case 'job_status': return { error: (await jobsService.updateJobStatus(op.jobId, op.status, { previousStatus: op.previousStatus, actorIsContractor: op.actorIsContractor, isStaff: op.isStaff, location: op.location, skipLocation: !op.location })).error };
    case 'chat_message': return { error: (await messagesService.send(op.jobId, op.message)).error };
    case 'media_upload': {
      const { data, error } = await mediaService.uploadMedia(op.items, op.userId, op.jobId);
      if (error || !data) return { error: error ?? { message: 'Upload failed' } };
      if (data.uploaded.length && op.jobId) {
        const appended = await mediaService.appendJobMedia(op.jobId, data.uploaded);
        if (appended.error) return { error: appended.error };
      }
      removeLocalCopies(op.items.filter((i) => data.uploaded.some((u) => u.name === i.name)));
      if (data.failed.length) {
        const remaining = op.items.filter((i) => data.failed.some((f) => f.name === i.name));
        return { error: { message: data.failed[0]?.message ?? 'Upload failed', code: 'upload' }, op: { ...op, items: remaining } };
      }
      return { error: null };
    }
    default: return { error: { message: 'Unknown queued operation' } };
  }
}

/** Boot: reflect what is on disk in the store. */
export function hydrateOfflineQueue(): void {
  publish(readQueue());
}

export const offlineQueue = {
  enqueue, discard, retryStuck, replay, readQueue, writeQueue, clearQueue, queueLength, pendingFor, stashForOffline, queuedMediaItem, isTransient, hydrateOfflineQueue,
  OFFLINE_QUEUE_KEY, MAX_ATTEMPTS,
};
