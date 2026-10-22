import { api } from '~/api/client';
import { subscribe as subscribeChannel } from '~/api/realtime';
import { fail, fromApi, fromApiMap, type ServiceResult } from '@/services/types';
import { formatPhone } from '@/utils/phone';
import type { Customer, SmsConversation, SmsListFilter, SmsMessage, SmsRealtimeChange, Unsubscribe } from '@/types';

/**
 * Customer SMS over the company's Telnyx number (`/conversations*`, `/customers/:id/{messages,consent,opt-out}`).
 * Same contract as the web `smsService`; the FROM number is always resolved server-side.
 */

export const SMS_MAX_LENGTH = 1600;
const enc = encodeURIComponent;

export async function list(filter: SmsListFilter = 'open'): Promise<ServiceResult<SmsConversation[]>> {
  return fromApiMap(() => api.get<SmsConversation[]>('/conversations', { query: { status: filter } }), (rows) => rows ?? [], 'Failed to load conversations');
}

export async function get(conversationId: string): Promise<ServiceResult<{ conversation: SmsConversation; messages: SmsMessage[] }>> {
  return fromApiMap(
    () => api.get<{ conversation: SmsConversation; messages: SmsMessage[] }>(`/conversations/${enc(conversationId)}`),
    (res) => ({ conversation: res.conversation, messages: res.messages ?? [] }),
    'Failed to load conversation',
  );
}

/** Staff: start (or reopen the existing) thread with a customer ("Text customer"). */
export async function start(customerId: string): Promise<ServiceResult<SmsConversation>> {
  if (!customerId) return fail('Customer is required', 'validation');
  return fromApi(() => api.post<SmsConversation>('/conversations', { customer_id: customerId }), 'Could not start the conversation');
}

/** Sends from the company number. A Telnyx rejection still resolves with `status: 'failed'` and `error`. */
export async function send(conversationId: string, body: string): Promise<ServiceResult<SmsMessage>> {
  const text = (body ?? '').trim();
  if (!text) return fail('Message cannot be empty', 'validation');
  if (text.length > SMS_MAX_LENGTH) return fail(`Message is too long (max ${SMS_MAX_LENGTH} characters)`, 'validation');
  return fromApi(() => api.post<SmsMessage>(`/conversations/${enc(conversationId)}/messages`, { body: text }), 'Failed to send message');
}

export async function assign(conversationId: string, userId: string | null): Promise<ServiceResult<SmsConversation>> {
  return fromApi(() => api.post<SmsConversation>(`/conversations/${enc(conversationId)}/assign`, { user_id: userId }), 'Could not assign the conversation');
}

export async function resolve(conversationId: string): Promise<ServiceResult<SmsConversation>> {
  return fromApi(() => api.post<SmsConversation>(`/conversations/${enc(conversationId)}/resolve`), 'Could not resolve the conversation');
}

export async function reopen(conversationId: string): Promise<ServiceResult<SmsConversation>> {
  return fromApi(() => api.post<SmsConversation>(`/conversations/${enc(conversationId)}/reopen`), 'Could not reopen the conversation');
}

export async function markRead(conversationId: string): Promise<ServiceResult<{ ok: true }>> {
  return fromApi(() => api.post<{ ok: true }>(`/conversations/${enc(conversationId)}/read`), 'Could not mark as read');
}

export async function customerMessages(customerId: string): Promise<ServiceResult<SmsMessage[]>> {
  return fromApiMap(() => api.get<SmsMessage[]>(`/customers/${enc(customerId)}/messages`), (rows) => rows ?? [], 'Failed to load messages');
}

/** Staff: `optedOut = true` blocks every outbound text until consent is restored. */
export async function setConsent(customerId: string, optedOut: boolean): Promise<ServiceResult<Customer>> {
  const path = `/customers/${enc(customerId)}/${optedOut ? 'opt-out' : 'consent'}`;
  return fromApi(() => api.post<Customer>(path), optedOut ? 'Could not opt the customer out' : 'Could not restore consent');
}

/** Channel `sms:company:<companyId>`: conversation + message changes the caller may see. */
export function subscribe(companyId: string, handler: (change: SmsRealtimeChange) => void): Unsubscribe {
  return subscribeChannel<Record<string, unknown>>(`sms:company:${companyId}`, (change) => {
    const table = change.table;
    if (table === 'sms_conversations') handler({ table, eventType: change.eventType, new: (change.new as Partial<SmsConversation> | null) ?? null, old: (change.old as Partial<SmsConversation> | null) ?? null });
    else if (table === 'sms_messages') handler({ table, eventType: change.eventType, new: (change.new as SmsMessage | null) ?? null, old: (change.old as Partial<SmsMessage> | null) ?? null });
  });
}

export function conversationTitle(c: Pick<SmsConversation, 'customer_name' | 'customer_phone'>): string {
  return (c.customer_name ?? '').trim() || formatPhone(c.customer_phone);
}

/** Search by name, job, digits of the phone or the last message. */
export function matchesConversation(c: SmsConversation, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, '');
  return (c.customer_name ?? '').toLowerCase().includes(q)
    || (c.job_client_name ?? '').toLowerCase().includes(q)
    || (digits.length >= 3 && c.customer_phone.replace(/\D/g, '').includes(digits))
    || (c.last_message_preview ?? '').toLowerCase().includes(q);
}

export const smsService = { list, get, start, send, assign, resolve, reopen, markRead, customerMessages, setConsent, subscribe, formatPhone, conversationTitle, matchesConversation, SMS_MAX_LENGTH };
