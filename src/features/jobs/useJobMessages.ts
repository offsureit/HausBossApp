import { useCallback, useEffect, useState } from 'react';
import { isOnline } from '~/api/client';
import { messagesService, type SendMessageInput } from '~/services/messages';
import { offlineQueue, useOfflineQueueStore } from '~/services/offlineQueue';
import type { JobMessage, MediaItem } from '@/types';

export interface UseJobMessages {
  messages: JobMessage[];
  loading: boolean;
  error: string | null;
  sending: boolean;
  refresh: () => Promise<void>;
  send: (input: { content: string; attachments?: MediaItem[]; isFromNote?: boolean }, sender: { id: string; name: string }) => Promise<boolean>;
}

export const QUEUED_MESSAGE_PREFIX = 'queued:';
export const isQueuedMessage = (m: Pick<JobMessage, 'id'>) => m.id.startsWith(QUEUED_MESSAGE_PREFIX);

/** Messages waiting in the offline queue for this job, shaped like rows so the thread can show them. */
function queuedMessages(jobId: string): JobMessage[] {
  return offlineQueue.pendingFor(jobId).flatMap((op) => (op.kind === 'chat_message' ? [{
    id: `${QUEUED_MESSAGE_PREFIX}${op.id}`, job_id: jobId, sender_id: op.message.senderId, sender_name: op.message.senderName, content: op.message.content,
    is_from_note: op.message.isFromNote ?? false, attachments: (op.message.attachments ?? []) as unknown as JobMessage['attachments'], created_at: op.queuedAt,
  }] : []));
}

/** Job chat history + realtime inserts (`job-messages-<jobId>`); offline sends are queued and shown as pending. */
export function useJobMessages(jobId: string | null): UseJobMessages {
  const [messages, setMessages] = useState<JobMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queued = useOfflineQueueStore((s) => s.queued);

  const refresh = useCallback(async () => {
    if (!jobId) { setMessages([]); return; }
    setLoading(true);
    const { data, error: err } = await messagesService.listByJob(jobId);
    setError(err?.message ?? null);
    if (data) setMessages([...data, ...queuedMessages(jobId)]);
    setLoading(false);
  }, [jobId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Queue changes (a replay sent our pending messages): drop the placeholders; the realtime insert brings the real rows.
  useEffect(() => {
    if (!jobId) return;
    setMessages((prev) => [...prev.filter((m) => !isQueuedMessage(m)), ...queuedMessages(jobId)]);
  }, [jobId, queued]);

  useEffect(() => {
    if (!jobId) return;
    return messagesService.subscribe(jobId, (change) => {
      const row = change.new;
      if (!row) return;
      setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev.filter((m) => !isQueuedMessage(m)), row, ...prev.filter(isQueuedMessage)]));
    });
  }, [jobId]);

  const send = useCallback(async (input: { content: string; attachments?: MediaItem[]; isFromNote?: boolean }, sender: { id: string; name: string }) => {
    if (!jobId) return false;
    const content = input.content.trim();
    if (!content && !input.attachments?.length) return false;
    const message: SendMessageInput = { senderId: sender.id, senderName: sender.name, content: content || '(attachment)', isFromNote: input.isFromNote, attachments: input.attachments };
    if (!isOnline()) {
      const op = offlineQueue.enqueue({ kind: 'chat_message', jobId, message });
      if (!op) { setError('You are offline and the message could not be saved on this device'); return false; }
      return true; // the queue effect appends the placeholder
    }
    setSending(true);
    const { data, error: err } = await messagesService.send(jobId, message);
    setSending(false);
    if (err) { setError(err.message); return false; }
    if (data) setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    return true;
  }, [jobId]);

  return { messages, loading, error, sending, refresh, send };
}
