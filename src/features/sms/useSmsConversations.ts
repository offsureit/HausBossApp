import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { smsService } from '~/services/sms';
import type { SmsConversation, SmsListFilter, SmsMessage, SmsRealtimeChange } from '@/types';

export interface UseSmsConversationsResult {
  conversations: SmsConversation[];
  loading: boolean;
  error: string | null;
  filter: SmsListFilter;
  setFilter: (f: SmsListFilter) => void;
  refresh: () => Promise<void>;
  /** Sum of `unread_count` over open threads in the loaded list. */
  unreadTotal: number;
  upsertLocal: (conversation: SmsConversation) => void;
  /** The thread currently displayed; message INSERT/UPDATEs for it are pushed to `onMessage`. */
  setActiveThread: (conversationId: string | null) => void;
  onMessage: (handler: ((message: SmsMessage) => void) | null) => void;
}

const REFRESH_DEBOUNCE_MS = 400;

/**
 * Company SMS inbox: list + realtime (`sms:company:<id>`), the web `useSmsConversations` hook.
 * Conversation changes re-fetch the list (the API row carries joined names the payload lacks).
 */
export function useSmsConversations(companyId: string | null | undefined, enabled = true, initialFilter: SmsListFilter = 'open'): UseSmsConversationsResult {
  const [conversations, setConversations] = useState<SmsConversation[]>([]);
  const [loading, setLoading] = useState<boolean>(!!companyId && enabled);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SmsListFilter>(initialFilter);
  const activeThread = useRef<string | null>(null);
  const messageHandler = useRef<((message: SmsMessage) => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId || !enabled) { setConversations([]); setLoading(false); return; }
    const { data, error: err } = await smsService.list(filter);
    setError(err?.message ?? null);
    if (data) setConversations(data);
    setLoading(false);
  }, [companyId, enabled, filter]);

  useEffect(() => { setLoading(true); void refresh(); }, [refresh]);

  const scheduleRefresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void refresh(); }, REFRESH_DEBOUNCE_MS);
  }, [refresh]);

  useEffect(() => {
    if (!companyId || !enabled) return;
    const off = smsService.subscribe(companyId, (change: SmsRealtimeChange) => {
      if (change.table === 'sms_conversations') {
        if (change.eventType === 'DELETE') {
          const id = change.old?.id;
          if (id) setConversations((prev) => prev.filter((c) => c.id !== id));
          return;
        }
        const row = change.new;
        if (row?.id) setConversations((prev) => prev.map((c) => (c.id === row.id ? ({ ...c, ...row } as SmsConversation) : c)));
        scheduleRefresh();
      } else if (change.table === 'sms_messages') {
        const msg = change.new;
        if (msg && msg.conversation_id === activeThread.current) messageHandler.current?.(msg);
      }
    });
    return () => { off(); if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  }, [companyId, enabled, scheduleRefresh]);

  const upsertLocal = useCallback((conversation: SmsConversation) => {
    setConversations((prev) => (prev.some((c) => c.id === conversation.id) ? prev.map((c) => (c.id === conversation.id ? conversation : c)) : [conversation, ...prev]));
  }, []);
  const setActiveThread = useCallback((id: string | null) => { activeThread.current = id; }, []);
  const onMessage = useCallback((handler: ((message: SmsMessage) => void) | null) => { messageHandler.current = handler; }, []);
  const unreadTotal = useMemo(() => conversations.reduce((n, c) => n + (c.status === 'open' ? c.unread_count : 0), 0), [conversations]);

  return { conversations, loading, error, filter, setFilter, refresh, unreadTotal, upsertLocal, setActiveThread, onMessage };
}
