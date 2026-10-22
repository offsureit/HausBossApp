import { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useMotion } from '~/motion';
import { useTheme } from '~/theme/ThemeProvider';

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

interface Piece { x: number; drift: number; rotate: number; delay: number; size: number; color: string; round: boolean }

/** Small seeded PRNG (mulberry32) so a burst's layout is a pure function of its key. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function layout(seed: number, pieces: number, width: number): Piece[] {
  const rnd = seeded(seed);
  return Array.from({ length: pieces }, (_, i) => ({
    x: (i / pieces) * width + (rnd() - 0.5) * 40,
    drift: (rnd() - 0.5) * 120,
    rotate: rnd() * 720 - 360,
    delay: rnd() * 180,
    size: 6 + rnd() * 6,
    color: COLORS[i % COLORS.length],
    round: rnd() > 0.5,
  }));
}

export function Confetti({ burst, pieces = 28, height = 220 }: { burst: number | null; pieces?: number; height?: number }) {
  const { reduced, duration } = useMotion();
  const { scheme } = useTheme();
  const { width } = useWindowDimensions();
  const items = useMemo<Piece[]>(() => layout(burst ?? 1, pieces, width), [pieces, width, burst]);
  if (!burst || reduced) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height, opacity: scheme === 'dark' ? 0.9 : 1 }]}>
      {items.map((p, i) => <PieceView key={`${burst}-${i}`} piece={p} height={height} total={duration.hero * 2} />)}
    </View>
  );
}

function PieceView({ piece, height, total }: { piece: Piece; height: number; total: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(0);
    t.set(withDelay(piece.delay, withTiming(1, { duration: total, easing: Easing.out(Easing.quad) })));
  }, [piece, total, t]);
  const style = useAnimatedStyle(() => {
    const v = t.get();
    return {
      opacity: v < 0.15 ? v / 0.15 : v > 0.75 ? (1 - v) / 0.25 : 1,
      transform: [
        { translateX: piece.x + piece.drift * v },
        { translateY: -20 + height * v * v },
        { rotate: `${piece.rotate * v}deg` },
      ],
    };
  });
  return <Animated.View style={[styles.piece, { width: piece.size, height: piece.round ? piece.size : piece.size * 0.6, backgroundColor: piece.color, borderRadius: piece.round ? piece.size / 2 : 1 }, style]} />;
}

const styles = StyleSheet.create({ piece: { position: 'absolute', top: 0, left: 0 } });
