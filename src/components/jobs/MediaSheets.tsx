import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Camera, ImageIcon, Loader2 } from 'lucide-react-native';
import { resolveMediaUrl } from '~/lib/env';
import { pickMedia, useMediaUpload } from '~/features/media/useMediaUpload';
import { Button, Sheet, Text } from '~/components/ui';
import { useTheme } from '~/theme/ThemeProvider';
import { fontFamily, radius, spacing, touchTarget } from '~/theme/tokens';
import type { MediaItem, MediaTag } from '@/types';

export interface PhotoPromptSheetProps {
  open: boolean;
  phase: 'pre' | 'post';
  jobId: string;
  /** Fired after capture/upload OR skip — the clock continues either way (§14). */
  onDone: (uploaded: MediaItem[]) => void;
  onCancel: () => void;
}

/** Forced Pre-Job / Post-Job photo prompt: Take photo / Choose / Skip. Uploads immediately with the tag. */
export function PhotoPromptSheet({ open, phase, jobId, onDone, onCancel }: PhotoPromptSheetProps) {
  const { colors } = useTheme();
  const { upload, uploading } = useMediaUpload();
  const [captured, setCaptured] = useState<MediaItem[]>([]);
  useEffect(() => { if (!open) setCaptured([]); }, [open]);
  const tag: MediaTag = phase;

  const add = async (source: 'camera' | 'library') => {
    const items = await pickMedia(source, { tag, multiple: source === 'library' });
    if (!items.length) return;
    const uploaded = await upload(items, jobId);
    setCaptured((c) => [...c, ...uploaded]);
  };

  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={phase === 'pre' ? 'Pre-Job photo' : 'Post-Job photo'}
      description={phase === 'pre' ? 'Document the site before you start. You can skip if a photo is not possible.' : 'Document the finished work before clocking out. You can skip if a photo is not possible.'}
      footer={
        <>
          <Button label={captured.length ? 'Continue' : 'Skip'} variant={captured.length ? 'primary' : 'secondary'} size="lg" fullWidth onPress={() => onDone(captured)} disabled={uploading} />
          <Button label="Cancel" variant="ghost" fullWidth onPress={onCancel} disabled={uploading} />
        </>
      }
    >
      <View style={styles.actions}>
        <Button label="Take photo" icon={<Camera size={18} color={colors.accentForeground} />} size="lg" onPress={() => void add('camera')} loading={uploading} style={styles.grow} />
        <Button label="Choose" variant="outline" icon={<ImageIcon size={18} color={colors.foreground} />} size="lg" onPress={() => void add('library')} disabled={uploading} style={styles.grow} />
      </View>
      {uploading ? <View style={styles.uploading}><Loader2 size={16} color={colors.mutedForeground} /><Text variant="small" color="mutedForeground">Uploading…</Text></View> : null}
      {captured.length > 0 ? (
        <View style={styles.strip}>
          {captured.map((m) => <Image key={m.path} source={{ uri: resolveMediaUrl(m) }} style={[styles.thumb, { backgroundColor: colors.muted }]} contentFit="cover" accessibilityLabel={m.name} />)}
          <Text variant="caption" color="success">{captured.length} photo{captured.length > 1 ? 's' : ''} attached.</Text>
        </View>
      ) : null}
    </Sheet>
  );
}

export interface NotesSheetProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => void | Promise<void>;
  title?: string;
  description?: string;
  confirmLabel?: string;
  busy?: boolean;
}

/** Clock-out / completion notes (dictation: use the keyboard microphone). */
export function NotesSheet({ open, onClose, onConfirm, title = 'Clock-out notes', description = 'Summarise the work done. Tap the microphone on your keyboard to dictate.', confirmLabel = 'Clock out', busy = false }: NotesSheetProps) {
  const { colors } = useTheme();
  const [notes, setNotes] = useState('');
  useEffect(() => { if (!open) setNotes(''); }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title={title} description={description} footer={<Button label={confirmLabel} size="lg" fullWidth loading={busy} onPress={() => void onConfirm(notes.trim())} />}>
      <TextInput
        testID="notes-input"
        accessibilityLabel="Notes"
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="Replaced the run capacitor, tested cooling…"
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]}
        textAlignVertical="top"
        autoFocus
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing[2] },
  grow: { flex: 1 },
  uploading: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  strip: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[2] },
  thumb: { width: 64, height: 64, borderRadius: radius.md },
  input: { minHeight: touchTarget * 3, borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: radius.md, padding: spacing[3], fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 22 },
});
