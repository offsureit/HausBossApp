import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Camera, ImageIcon, MapPin, Trash2, Video, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gpsMapLink, groupMedia, isVideo } from '@/utils/media';
import type { Job, MediaItem } from '@/types';
import { resolveMediaUrl } from '~/lib/env';
import { Button, Dialog, IconButton, Text } from '~/components/ui';
import { useAuth } from '~/features/auth/AuthProvider';
import { pickMedia, useMediaUpload } from '~/features/media/useMediaUpload';
import { toast } from '~/features/toast/store';
import { links } from '~/lib/links';
import { mediaService } from '~/services/media';
import { useTheme } from '~/theme/ThemeProvider';
import { radius, spacing } from '~/theme/tokens';

/** Job media: capture / pick, Pre-Job / Post-Job / Other grids, full-screen viewer with delete. */
export function MediaSection({ job, onChanged }: { job: Job; onChanged?: () => void }) {
  const { colors } = useTheme();
  const { user, isStaff } = useAuth();
  const { upload, uploading } = useMediaUpload();
  const { width } = useWindowDimensions();
  const [viewer, setViewer] = useState<{ items: MediaItem[]; index: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const media = useMemo(() => groupMedia(job.mediaUrls ?? []), [job.mediaUrls]);
  const tile = (width - spacing[4] * 2 - spacing[2] * 2) / 3;

  const add = async (source: 'camera' | 'library') => {
    const items = await pickMedia(source, { multiple: true });
    if (!items.length) return;
    const uploaded = await upload(items, job.id);
    const sent = uploaded.filter((m) => !m.path.startsWith('queued/')); // queued offline → the banner / queue toast already said so
    if (sent.length) { toast.success(`${sent.length} file${sent.length > 1 ? 's' : ''} attached to the job`); onChanged?.(); }
  };

  const canDelete = (item: MediaItem) => isStaff || (!!user && (item.uploadedBy === user.id || item.path.startsWith(`${user.id}/`)));
  const remove = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const { error } = await mediaService.removeJobMedia(job.id, confirmDelete.path, { deleteFromStorage: true });
    setDeleting(false);
    setConfirmDelete(null);
    if (error) toast.error(error.message);
    else { toast.success('Media removed'); setViewer(null); onChanged?.(); }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.actions}>
        <Button label="Take photo" icon={<Camera size={18} color={colors.accentForeground} />} onPress={() => void add('camera')} loading={uploading} style={styles.grow} />
        <Button label="Choose" variant="outline" icon={<ImageIcon size={18} color={colors.foreground} />} onPress={() => void add('library')} disabled={uploading} style={styles.grow} />
      </View>
      {([['Pre-Job', media.pre], ['Post-Job', media.post], ['Other', media.other]] as const).map(([title, items]) => (
        <View key={title} style={styles.group}>
          <Text variant="label">{title} <Text variant="caption" color="mutedForeground">({items.length})</Text></Text>
          {items.length === 0 ? <Text variant="caption" color="mutedForeground">Nothing yet.</Text> : (
            <View style={styles.grid}>
              {items.map((m, i) => (
                <Pressable key={m.path || m.url} accessibilityRole="imagebutton" accessibilityLabel={`Open ${m.name}`} onPress={() => setViewer({ items: [...items], index: i })} style={[styles.tile, { width: tile, height: tile, backgroundColor: colors.muted }]}>
                  {isVideo(m) ? <View style={styles.videoTile}><Video size={28} color={colors.mutedForeground} /></View> : <Image source={{ uri: resolveMediaUrl(m) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />}
                  {m.gps ? <View style={[styles.gpsBadge, { backgroundColor: colors.card }]}><MapPin size={10} color={colors.accent} /></View> : null}
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ))}

      {viewer ? <PhotoViewer items={viewer.items} index={viewer.index} onClose={() => setViewer(null)} onDelete={canDelete(viewer.items[viewer.index]) ? (item) => setConfirmDelete(item) : undefined} /> : null}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete this file?" description="It is removed from the job and from storage." confirmLabel="Delete" confirmVariant="destructive" onConfirm={remove} busy={deleting} />
    </View>
  );
}

function PhotoViewer({ items, index, onClose, onDelete }: { items: MediaItem[]; index: number; onClose: () => void; onDelete?: (item: MediaItem) => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(index);
  const item = items[current];
  const map = item ? gpsMapLink(item.gps) : null;
  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.viewer}>
        <FlatList
          data={items}
          horizontal
          pagingEnabled
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(m) => m.path || m.url}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item: m }) => (
            <View style={{ width, height }}>
              {isVideo(m) ? (
                <Pressable style={styles.videoFull} onPress={() => void links.url(resolveMediaUrl(m))} accessibilityRole="link" accessibilityLabel={`Open video ${m.name}`}>
                  <Video size={48} color="#ffffff" />
                  <Text variant="small" color="#ffffff">Open video</Text>
                </Pressable>
              ) : <Image source={{ uri: resolveMediaUrl(m) }} style={{ width, height }} contentFit="contain" accessibilityLabel={m.name} />}
            </View>
          )}
        />
        <View style={[styles.viewerTop, { top: insets.top + spacing[2] }]}>
          <IconButton icon={X} label="Close" variant="filled" tone="default" onPress={onClose} style={styles.onDark} />
        </View>
        {item ? (
          <View style={[styles.viewerBottom, { bottom: insets.bottom + spacing[3] }]}>
            <View style={styles.viewerMeta}>
              <Text variant="label" color="#ffffff" numberOfLines={1}>{item.name}</Text>
              <Text variant="caption" color="#c7d2e8">{item.tag === 'pre' ? 'Pre-job · ' : item.tag === 'post' ? 'Post-job · ' : ''}{item.timestamp ? new Date(item.timestamp).toLocaleString() : ''} · {current + 1}/{items.length}</Text>
            </View>
            {map ? <IconButton icon={MapPin} label="Show capture location" onPress={() => item.gps && void links.showPoint(item.gps.latitude, item.gps.longitude)} style={styles.onDark} /> : null}
            {onDelete ? <IconButton icon={Trash2} label="Delete media" tone="destructive" onPress={() => onDelete(item)} style={styles.onDark} /> : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[4] },
  actions: { flexDirection: 'row', gap: spacing[2] },
  grow: { flex: 1 },
  group: { gap: spacing[2] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tile: { borderRadius: radius.md, overflow: 'hidden' },
  videoTile: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gpsBadge: { position: 'absolute', right: 4, bottom: 4, borderRadius: radius.full, padding: 3 },
  viewer: { flex: 1, backgroundColor: '#000' },
  viewerTop: { position: 'absolute', right: spacing[3] },
  viewerBottom: { position: 'absolute', left: spacing[3], right: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  viewerMeta: { flex: 1, minWidth: 0 },
  videoFull: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  onDark: { backgroundColor: 'rgba(255,255,255,0.15)' },
});
