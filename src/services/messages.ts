import { api } from '~/api/client';
import { subscribe as subscribeChannel } from '~/api/realtime';
import { fail, fromApi, fromApiMap, type ServiceResult } from '@/services/types';
import type { JobMessage, MediaItem, RealtimeChange, Unsubscribe } from '@/types';

/** Per-job chat (`/jobs/:id/messages`). The server stamps the sender; `notify_chat_message()` fans out. */

export interface SendMessageInput {
  senderId: string;
  senderName: string;
  content: string;
  /** Mirror of a job note into the thread. */
  isFromNote?: boolean;
  attachments?: MediaItem[];
}

export async function listByJob(jobId: string): Promise<ServiceResult<JobMessage[]>> {
  return fromApiMap(() => api.get<JobMessage[]>(`/jobs/${encodeURIComponent(jobId)}/messages`), (rows) => rows ?? [], 'Failed to load messages');
}

export async function send(jobId: string, input: SendMessageInput): Promise<ServiceResult<JobMessage>> {
  const content = (input.content ?? '').trim();
  const hasAttachments = (input.attachments?.length ?? 0) > 0;
  if (!content && !hasAttachments) return fail('Message cannot be empty', 'validation');
  if (!input.senderId) return fail('You must be signed in to send messages', 'auth');
  return fromApi(
    () => api.post<JobMessage>(`/jobs/${encodeURIComponent(jobId)}/messages`, {
      content: content || '(attachment)',
      is_from_note: input.isFromNote ?? false,
      attachments: input.attachments ?? [],
      sender_name: input.senderName || undefined,
    }),
    'Failed to send message',
  );
}

/** Channel `job-messages-<jobId>`: INSERT only (threads are append-only). */
export function subscribe(jobId: string, onInsert: (change: RealtimeChange<JobMessage>) => void): Unsubscribe {
  return subscribeChannel<JobMessage>(`job-messages-${jobId}`, (change) => {
    if (change.eventType === 'INSERT' && change.new) onInsert({ eventType: 'INSERT', new: change.new, old: null });
  });
}

export function parseAttachments(raw: unknown): MediaItem[] {
  return Array.isArray(raw) ? (raw as MediaItem[]).filter((a) => a && typeof a.url === 'string') : [];
}

export const messagesService = { listByJob, send, subscribe, parseAttachments };
