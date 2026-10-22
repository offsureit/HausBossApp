import { useCallback, useEffect, useMemo, useRef } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { addDays, differenceInCalendarDays, format, startOfDay } from 'date-fns';
import type { Job } from '@/types';
import { DayTimeline } from './DayTimeline';
import { haptics } from '~/lib/haptics';

/** Days rendered on each side of the anchor; swiping stays within this window. */
const SPAN = 180;

export interface DayPagerProps {
  anchor: Date;
  onAnchorChange: (day: Date) => void;
  jobsByDay: Map<string, Job[]>;
  colorFor: (job: Job) => string;
}

/** Horizontal paging between days (native swipe), one timeline per page. */
export function DayPager({ anchor, onAnchorChange, jobsByDay, colorFor }: DayPagerProps) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Date>>(null);
  const base = useMemo(() => addDays(startOfDay(new Date()), -SPAN), []);
  const days = useMemo(() => Array.from({ length: SPAN * 2 + 1 }, (_, i) => addDays(base, i)), [base]);
  const index = Math.min(days.length - 1, Math.max(0, differenceInCalendarDays(startOfDay(anchor), base)));
  const lastIndex = useRef(index);

  // Programmatic anchor changes (Today / arrows / date picker) scroll the pager.
  useEffect(() => {
    if (lastIndex.current === index) return;
    lastIndex.current = index;
    listRef.current?.scrollToIndex({ index, animated: Math.abs(index - lastIndex.current) <= 7 });
  }, [index]);

  const onEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== lastIndex.current && days[next]) {
      lastIndex.current = next;
      haptics.selection();
      onAnchorChange(days[next]);
    }
  }, [width, days, onAnchorChange]);

  return (
    <FlatList
      ref={listRef}
      data={days}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={index}
      getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
      keyExtractor={(d) => format(d, 'yyyy-MM-dd')}
      windowSize={3}
      initialNumToRender={1}
      maxToRenderPerBatch={2}
      removeClippedSubviews
      onMomentumScrollEnd={onEnd}
      renderItem={({ item: day, index: i }) => (
        <View style={{ width }}>
          <DayTimeline day={day} jobs={jobsByDay.get(format(day, 'yyyy-MM-dd')) ?? []} colorFor={colorFor} active={i === index} />
        </View>
      )}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({ list: { flex: 1 } });
