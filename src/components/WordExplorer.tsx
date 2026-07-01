import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DirectionalNav, NavDirection, VocabularyGraph, VocabularyWord } from '../types/vocabulary';
import {
  DIRECTION_ARROWS,
  buildDirectionalNav,
  directionFromSwipe,
  getNeighborInDirection,
} from '../lib/wordNavigator';
import { HSK_COLORS } from '../lib/graphEngine';
import { truncateGloss } from '../lib/database';
import { colors } from '../constants/theme';

interface Props {
  visible: boolean;
  word: VocabularyWord | null;
  pool: VocabularyWord[];
  graph: VocabularyGraph | null;
  onClose: () => void;
  onWordChange: (word: VocabularyWord) => void;
}

const AnimatedView = Animated.createAnimatedComponent(View);

function NavPreview({
  slot,
  direction,
  onPress,
  compact = false,
}: {
  slot: DirectionalNav[NavDirection];
  direction: NavDirection;
  onPress: () => void;
  compact?: boolean;
}) {
  const arrow = DIRECTION_ARROWS[direction];
  const hskColor = slot ? HSK_COLORS[slot.word.hskLevel] ?? colors.border : colors.border;

  return (
    <Pressable
      onPress={slot ? onPress : undefined}
      style={[
        styles.previewSlot,
        compact && styles.previewSlotCompact,
        direction === 'left' || direction === 'right' ? styles.previewSide : styles.previewVertical,
        !slot && styles.previewEmpty,
      ]}
    >
      <Text style={styles.previewArrow}>{arrow}</Text>
      {slot ? (
        <>
          <Text style={[styles.previewChar, compact && styles.previewCharCompact]} numberOfLines={1}>
            {slot.word.simplified}
          </Text>
          <Text style={styles.previewGloss} numberOfLines={compact ? 1 : 2}>
            {truncateGloss(slot.word.english, compact ? 16 : 24)}
          </Text>
          <Text style={[styles.previewShared, { color: hskColor }]}>
            共 {slot.sharedChar}
          </Text>
        </>
      ) : (
        <Text style={styles.previewEmptyText}>—</Text>
      )}
    </Pressable>
  );
}

function WordCenter({ word }: { word: VocabularyWord }) {
  const hskColor = HSK_COLORS[word.hskLevel] ?? '#64748b';

  return (
    <View style={styles.centerCard}>
      <View style={styles.centerHeader}>
        <Text style={styles.centerHanzi}>{word.simplified}</Text>
        <View style={[styles.hskBadge, { backgroundColor: hskColor }]}>
          <Text style={styles.hskBadgeText}>HSK {word.hskLevel}</Text>
        </View>
      </View>
      <Text style={styles.centerTraditional}>{word.traditional}</Text>
      <Text style={styles.centerPinyin}>{word.pinyin}</Text>

      <View style={styles.centerRow}>
        <Text style={styles.centerLabel}>English</Text>
        <Text style={styles.centerValue}>{word.english}</Text>
      </View>
      <View style={styles.centerRow}>
        <Text style={styles.centerLabel}>Thai</Text>
        <Text style={styles.centerValue}>{word.thai || '—'}</Text>
      </View>
    </View>
  );
}

export function WordExplorer({ visible, word, pool, graph, onClose, onWordChange }: Props) {
  const slideX = useSharedValue(0);
  const slideY = useSharedValue(0);
  const [displayWord, setDisplayWord] = useState<VocabularyWord | null>(word);

  useEffect(() => {
    if (word) setDisplayWord(word);
  }, [word]);

  const nav = useMemo(
    () => (displayWord ? buildDirectionalNav(displayWord, pool, graph) : null),
    [displayWord, pool, graph],
  );

  const navigate = useCallback(
    (dir: NavDirection) => {
      if (!displayWord) return;
      const currentNav = buildDirectionalNav(displayWord, pool, graph);
      const next = getNeighborInDirection(currentNav, dir);
      if (!next) return;

      setDisplayWord(next.word);
      onWordChange(next.word);
      slideX.value = 0;
      slideY.value = 0;
    },
    [displayWord, pool, graph, onWordChange, slideX, slideY],
  );

  const panStart = useRef({ x: 0, y: 0 });
  const panGesture = Gesture.Pan()
    .onBegin(() => {
      panStart.current = { x: slideX.value, y: slideY.value };
    })
    .onUpdate((event) => {
      slideX.value = panStart.current.x + event.translationX * 0.35;
      slideY.value = panStart.current.y + event.translationY * 0.35;
    })
    .onEnd((event) => {
      const dir = directionFromSwipe(event.translationX, event.translationY);
      if (dir && nav?.[dir]) {
        runOnJS(navigate)(dir);
        return;
      }
      slideX.value = withSpring(0);
      slideY.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }, { translateY: slideY.value }],
  }));

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;

    const onKey = (event: KeyboardEvent) => {
      const keyMap: Record<string, NavDirection> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      };
      const dir = keyMap[event.key];
      if (dir) {
        event.preventDefault();
        navigate(dir);
      }
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, navigate, onClose]);

  if (!displayWord || !nav) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕ Close</Text>
          </Pressable>
          <Text style={styles.topHint}>Swipe or tap arrows · arrow keys on web</Text>
        </View>

        <GestureDetector gesture={panGesture}>
          <AnimatedView style={[styles.grid, animatedStyle]}>
            <View style={styles.rowTop}>
              <NavPreview
                slot={nav.up}
                direction="up"
                onPress={() => navigate('up')}
              />
            </View>

            <View style={styles.rowMiddle}>
              <NavPreview
                slot={nav.left}
                direction="left"
                onPress={() => navigate('left')}
                compact
              />
              <WordCenter word={displayWord} />
              <NavPreview
                slot={nav.right}
                direction="right"
                onPress={() => navigate('right')}
                compact
              />
            </View>

            <View style={styles.rowBottom}>
              <NavPreview
                slot={nav.down}
                direction="down"
                onPress={() => navigate('down')}
              />
            </View>
          </AnimatedView>
        </GestureDetector>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
  },
  closeBtnText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  topHint: {
    color: colors.textMuted,
    fontSize: 11,
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  grid: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
    gap: 8,
  },
  rowTop: {
    alignItems: 'center',
    minHeight: 88,
  },
  rowMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flex: 1,
  },
  rowBottom: {
    alignItems: 'center',
    minHeight: 88,
  },
  previewSlot: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 140,
    maxWidth: 220,
  },
  previewSlotCompact: {
    minWidth: 96,
    maxWidth: 110,
    paddingHorizontal: 8,
  },
  previewVertical: {
    width: '72%',
    maxWidth: 280,
  },
  previewSide: {
    flex: 1,
    maxWidth: 118,
  },
  previewEmpty: {
    opacity: 0.35,
  },
  previewArrow: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  previewChar: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  previewCharCompact: {
    fontSize: 22,
  },
  previewGloss: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  previewShared: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  previewEmptyText: {
    color: colors.textMuted,
    fontSize: 20,
  },
  centerCard: {
    flex: 2,
    maxWidth: 360,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.accent,
    padding: 20,
    gap: 10,
    shadowColor: colors.accent,
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  centerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
  },
  centerHanzi: {
    fontSize: 56,
    fontWeight: '800',
    color: colors.text,
  },
  hskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  hskBadgeText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 12,
  },
  centerTraditional: {
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '600',
  },
  centerPinyin: {
    fontSize: 20,
    color: colors.accent,
    textAlign: 'center',
  },
  centerRow: {
    gap: 4,
    marginTop: 4,
  },
  centerLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  centerValue: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
  },
});
