import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Paperclip, Send, StickyNote, X } from 'lucide-react-native';
import { getContractorColor, getContrastText } from '@/utils/contractorColors';
import { fullName } from '@/utils/names';
import { isVideo } from '@/utils/media';
import type { MediaItem } from '@/types';
import { resolveMediaUrl } from '~/lib/env';
import { EmptyState, IconButton, Skeleton, Text } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { useJobMessages } from '~/features/jobs/useJobMessages';
import { pickMedia, useMediaUpload } from '~/features/media/useMediaUpload';
import { toast } from '~/features/toast/store';
import { links } from '~/lib/links';
import { timeAgo } from '~/lib/time';
import { messagesService } from '~/services/messages';
import type { MediaUploadItem } from '~/services/media';
import { useTheme } from '~/theme/ThemeProvider';
import { fontFamily, radius, spacing, withAlpha } from '~/theme/tokens';

/** Realtime per-job thread with attachments and per-user colours (§2, §11). */
export function JobChat({ jobId }: { jobId: string }) {
  const { colors } = useTheme();
  const { user, profile } = useAuth();
  const { messages, loading, error, sending, send } = useJobMessages(jobId);
  const { upload, uploading } = useMediaUpload();
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<MediaUploadItem[]>([]);
  const senderName = useMemo(() => fullName({ firstName: profile?.first_name, lastName: profile?.last_name }) || user?.email || 'Me', [profile, user]);

  const submit = async () => {
    if (!user) return;
    const content = draft.trim();
    if (!content && pending.length === 0) return;
    let attachments: MediaItem[] | undefined;
    if (pending.length) {
      const uploaded = await upload(pending, jobId, { append: false });
      if (!uploaded.length) return;
      attachments = uploaded;
    }
    const ok = await send({ content, attachments }, { id: user.id, name: senderName });
    if (ok) { setDraft(''); setPending([]); }
    else if (error) toast.error(error);
  };

  const attach = async () => {
    const items = await pickMedia('library', { multiple: true });
    if (items.length) setPending((p) => [...p, ...items]);
  };

  return (
    <View style={styles.wrap}>
      {loading && messages.length === 0 ? (
        <View style={styles.list}><Skeleton width="60%" height={40} /><Skeleton width="70%" height={40} style={styles.right} /><Skeleton width="50%" height={40} /></View>
      ) : messages.length === 0 ? (
        <View style={styles.list}><EmptyState icon={StickyNote} title="No messages yet" message={error ?? 'Start the conversation with the team.'} /></View>
      ) : (
        <View style={styles.list} accessibilityRole="list">
          {messages.map((m) => {
            const mine = m.sender_id === user?.id;
            const color = getContractorColor(m.sender_name);
            const attachments = messagesService.parseAttachments(m.attachments);
            if (m.is_from_note) {
              return (
                <View key={m.id} style={[styles.note, { backgroundColor: withAlpha(colors.warning, 0.12), borderColor: withAlpha(colors.warning, 0.4) }]}>
                  <View style={styles.noteHead}><StickyNote size={12} color={colors.warningForeground} /><Text variant="caption" color="mutedForeground">Note from {m.sender_name} · {timeAgo(m.created_at)}</Text></View>
                  <Text variant="small">{m.content}</Text>
                </View>
              );
            }
            return (
              <View key={m.id} style={[styles.row, mine && styles.rowMine]}>
                {!mine ? <View style={[styles.avatar, { backgroundColor: color }]}><Text variant="caption" color={getContrastText(color)}>{m.sender_name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}</Text></View> : null}
                <View style={[styles.bubble, mine ? { backgroundColor: colors.accent, borderBottomRightRadius: 4 } : { backgroundColor: colors.muted, borderBottomLeftRadius: 4 }]}>
                  {!mine ? <Text variant="caption" color={color} style={styles.sender}>{m.sender_name}</Text> : null}
                  <Text variant="body" color={mine ? 'accentForeground' : 'foreground'}>{m.content}</Text>
                  {attachments.length > 0 ? (
                    <View style={styles.attachments}>
                      {attachments.map((a) => (
                        <Pressable key={a.path || a.url} accessibilityRole="imagebutton" accessibilityLabel={a.name} onPress={() => void links.url(resolveMediaUrl(a))} style={[styles.attachment, { backgroundColor: colors.card }]}>
                          {isVideo(a) ? <Text variant="caption" color="accent">{a.name}</Text> : <Image source={{ uri: resolveMediaUrl(a) }} style={styles.attachmentImage} contentFit="cover" />}
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  <Text variant="caption" color={mine ? withAlpha(colors.accentForeground, 0.75) : 'mutedForeground'} style={styles.time}>{timeAgo(m.created_at)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
      {pending.length > 0 ? (
        <View style={styles.pending}>
          {pending.map((p, i) => (
            <View key={`${p.name}-${i}`} style={[styles.chip, { backgroundColor: colors.muted }]}>
              <Paperclip size={12} color={colors.mutedForeground} />
              <Text variant="caption" numberOfLines={1} style={styles.chipText}>{p.name}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`} onPress={() => setPending((prev) => prev.filter((_, j) => j !== i))} hitSlop={8}><X size={12} color={colors.mutedForeground} /></Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <View style={[styles.composer, { borderTopColor: colors.border }]}>
        <IconButton icon={Paperclip} label="Attach files" onPress={() => void attach()} disabled={uploading || sending} />
        <TextInput
          accessibilityLabel="Message"
          value={draft}
          onChangeText={setDraft}
          placeholder="Message…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted }]}
        />
        <IconButton icon={Send} label="Send message" tone="accent" variant="filled" onPress={() => void submit()} disabled={sending || uploading || (!draft.trim() && pending.length === 0)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 320 },
  list: { paddingVertical: spacing[2], gap: spacing[2], flexGrow: 1 },
  right: { alignSelf: 'flex-end' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] },
  rowMine: { flexDirection: 'row-reverse' },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  sender: { marginBottom: 2, fontFamily: fontFamily.medium },
  attachments: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], marginTop: spacing[1] },
  attachment: { borderRadius: radius.sm, overflow: 'hidden', padding: 2 },
  attachmentImage: { width: 80, height: 80, borderRadius: radius.sm },
  time: { marginTop: 2 },
  note: { alignSelf: 'center', maxWidth: '90%', borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing[3], gap: 2 },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pending: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], paddingVertical: spacing[1] },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 4, maxWidth: 200 },
  chipText: { flexShrink: 1 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[1], borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing[2] },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: radius.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontFamily: fontFamily.regular, fontSize: 16 },
});
