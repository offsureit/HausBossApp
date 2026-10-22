import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ban, Briefcase, CheckCircle2, MessageCircle, RotateCcw, UserCheck } from 'lucide-react-native';
import { getContractorColor } from '@/utils/contractorColors';
import type { SmsConversation, SmsMessage } from '@/types';
import { SmsBubble } from '~/components/sms/SmsBubble';
import { SmsComposer } from '~/components/sms/SmsComposer';
import { Button, EmptyState, Select, Skeleton, StatusBadge, Text } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { useCompany } from '~/features/company/CompanyProvider';
import { useSmsInbox } from '~/features/sms/SmsInboxProvider';
import { useTeamQuery } from '~/features/team/useTeam';
import { toast } from '~/features/toast/store';
import { haptics } from '~/lib/haptics';
import { smsService } from '~/services/sms';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing, withAlpha } from '~/theme/tokens';

const UNASSIGNED = 'none';

/** One SMS thread: header (customer, phone, job, assignment, resolve), bubbles, composer (web `SmsThread`). */
export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { isStaff } = useAuth();
  const { companyId } = useCompany();
  const inbox = useSmsInbox();
  const team = useTeamQuery(companyId);
  const [thread, setThread] = useState<{ conversation: SmsConversation; messages: SmsMessage[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const { setActiveThread, onMessage, upsertLocal } = inbox;

  useEffect(() => {
    setActiveThread(id);
    let cancelled = false;
    setLoading(true);
    void smsService.get(id).then(({ data, error: err }) => {
      if (cancelled) return;
      setLoading(false);
      if (err || !data) { setError(err?.message ?? 'Conversation not found'); return; }
      setThread(data);
      if (data.conversation.unread_count > 0) void smsService.markRead(id).then((r) => { if (!r.error) upsertLocal({ ...data.conversation, unread_count: 0 }); });
    });
    onMessage((m) => {
      setThread((t) => {
        if (!t || t.conversation.id !== m.conversation_id) return t;
        const exists = t.messages.some((x) => x.id === m.id);
        return { ...t, messages: exists ? t.messages.map((x) => (x.id === m.id ? { ...x, ...m } : x)) : [...t.messages, m] };
      });
      if (m.direction === 'inbound') { haptics.soft(); void smsService.markRead(m.conversation_id); }
    });
    return () => { cancelled = true; setActiveThread(null); onMessage(null); };
  }, [id, setActiveThread, onMessage, upsertLocal]);

  useEffect(() => { const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50); return () => clearTimeout(t); }, [thread?.messages.length]);

  const listRow = inbox.conversations.find((c) => c.id === id) ?? null;
  const conversation = useMemo(() => (thread && listRow ? { ...thread.conversation, ...listRow } : thread?.conversation ?? null), [thread, listRow]);
  const employees = useMemo(() => (team.data ?? []).filter((e) => e.isActive), [team.data]);

  const send = useCallback(async (body: string) => {
    const { data, error: err } = await smsService.send(id, body);
    if (err || !data) { toast.error(err?.message ?? 'Failed to send'); haptics.error(); return false; }
    setThread((t) => (t && !t.messages.some((m) => m.id === data.id) ? { ...t, messages: [...t.messages, data] } : t));
    if (data.status === 'failed' || data.status === 'undelivered') toast.error('Message was not delivered', { description: data.error ?? undefined });
    else haptics.light();
    return true;
  }, [id]);

  const applyRow = (r: { data: SmsConversation | null; error: { message: string } | null }, okMsg: string) => {
    if (r.error || !r.data) { toast.error(r.error?.message ?? 'Request failed'); return; }
    upsertLocal(r.data);
    setThread((t) => (t ? { ...t, conversation: { ...t.conversation, ...r.data } } : t));
    toast.success(okMsg);
  };

  const title = conversation ? smsService.conversationTitle(conversation) : 'Conversation';
  const disabledReason = !inbox.configured ? 'No SMS number configured for your company.' : conversation?.sms_opted_out ? 'This customer has opted out of text messages.' : null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { backgroundColor: colors.background }]} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <Stack.Screen options={{ title, headerBackTitle: 'Back' }} />
      {loading && !thread ? <View style={styles.pad}><Skeleton height={60} width="70%" /><Skeleton height={60} width="60%" style={styles.right} /><Skeleton height={60} width="50%" /></View>
        : !conversation ? <View style={styles.pad}><EmptyState icon={MessageCircle} title="Conversation not found" message={error ?? undefined} action={<Button label="Back" variant="outline" onPress={() => router.back()} />} /></View>
        : (
          <>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <View style={styles.headRow}>
                <View style={styles.grow}>
                  <Text variant="small" color="mutedForeground">{conversation.customer_name ? smsService.formatPhone(conversation.customer_phone) : 'Unknown customer'}</Text>
                </View>
                {conversation.sms_opted_out ? <View style={[styles.chip, { backgroundColor: withAlpha(colors.destructive, 0.12) }]}><Ban size={12} color={colors.destructive} /><Text variant="caption" color="destructive">Opted out</Text></View> : null}
                {conversation.active_job_id ? (
                  <Button label="Active job" variant="outline" size="sm" icon={<Briefcase size={14} color={colors.foreground} />} onPress={() => router.push({ pathname: '/job/[id]', params: { id: conversation.active_job_id as string } })} />
                ) : null}
                {conversation.job_status ? <StatusBadge status={conversation.job_status} size="sm" /> : null}
              </View>
              {isStaff ? (
                <View style={styles.manage}>
                  <View style={styles.grow}>
                    <Select
                      label="Assigned to"
                      value={conversation.assigned_user_id ?? UNASSIGNED}
                      onChange={(v) => void smsService.assign(conversation.id, v === UNASSIGNED ? null : v).then((r) => applyRow(r, v === UNASSIGNED ? 'Assignment cleared' : 'Conversation assigned'))}
                      options={[{ value: UNASSIGNED, label: 'Unassigned', leading: <UserCheck size={14} color={colors.mutedForeground} /> }, ...employees.map((e) => ({ value: e.id, label: e.name, leading: <View style={[styles.dot, { backgroundColor: getContractorColor(e.name, e.color) }]} /> }))]}
                    />
                  </View>
                  {conversation.status === 'open'
                    ? <Button label="Resolve" variant="outline" size="sm" icon={<CheckCircle2 size={14} color={colors.foreground} />} onPress={() => void smsService.resolve(conversation.id).then((r) => applyRow(r, 'Conversation resolved'))} />
                    : <Button label="Reopen" variant="outline" size="sm" icon={<RotateCcw size={14} color={colors.foreground} />} onPress={() => void smsService.reopen(conversation.id).then((r) => applyRow(r, 'Conversation reopened'))} />}
                </View>
              ) : null}
            </View>
            <ScrollView ref={scroll} contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled" accessibilityLabel="Messages">
              {thread?.messages.length === 0 ? <Text variant="small" color="mutedForeground" align="center">No messages yet. Say hello 👋</Text> : null}
              {thread?.messages.map((m) => <SmsBubble key={m.id} message={m} />)}
            </ScrollView>
            <SmsComposer onSend={send} disabledReason={disabledReason} />
          </>
        )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pad: { padding: spacing[4], gap: spacing[3] },
  right: { alignSelf: 'flex-end' },
  header: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], gap: spacing[2], borderBottomWidth: StyleSheet.hairlineWidth },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  manage: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] },
  grow: { flex: 1, minWidth: 0 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing[1] },
  messages: { padding: spacing[4], gap: spacing[2], flexGrow: 1, justifyContent: 'flex-end' },
});
