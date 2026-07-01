import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
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

const SPRING = { damping: 22, stiffness: 240 };
const SLIDE_MS = 220;

function swipeThreshold(width: number, height: number): number {
  return Math.min(width, height) * 0.18;
}

function NavPreview({
  slot,
  direction,
  onPress,
  compact,
}: {
  slot: DirectionalNav[NavDirection];
  direction: NavDirection;
  onPress: () => void;
  compact: boolean;
}) {
  const arrow = DIRECTION_ARROWS[direction];
  const hskColor = slot ? HSK_COLORS[slot.word.hskLevel] ?? colors.border : colors.border;
  const isSide = direction === 'left' || direction === 'right';

  return (
    <Pressable
      onPress={slot ? onPress : undefined}
      style={[
        styles.previewSlot,
        compact && styles.previewSlotCompact,
        isSide ? styles.previewSide : styles.previewVertical,
        !slot && styles.previewEmpty,
      ]}
    >
      <Text style={[styles.previewArrow, compact && styles.previewArrowCompact]}>{arrow}</Text>
      {slot ? (
        <>
          <Text
            style={[styles.previewChar, compact && styles.previewCharCompact]}
            numberOfLines={1}
          >
            {slot.word.simplified}
          </Text>
          {!compact ? (
            <Text style={styles.previewGloss} numberOfLines={2}>
              {truncateGloss(slot.word.english, 22)}
            </Text>
          ) : null}
          <Text style={[styles.previewShared, { color: hskColor }]}>
            {compact ? slot.sharedChar : `共 ${slot.sharedChar}`}
          </Text>
        </>
      ) : (
        <Text style={styles.previewEmptyText}>—</Text>
      )}
    </Pressable>
  );
}

function WordCenter({ word, compact }: { word: VocabularyWord; compact: boolean }) {
  const hskColor = HSK_COLORS[word.hskLevel] ?? '#64748b';

  return (
    <View style={[styles.centerCard, compact && styles.centerCardCompact]}>
      <View style={styles.centerHeader}>
        <Text style={[styles.centerHanzi, compact && styles.centerHanziCompact]}>
          {word.simplified}
        </Text>
        <View style={[styles.hskBadge, { backgroundColor: hskColor }]}>
          <Text style={styles.hskBadgeText}>HSK {word.hskLevel}</Text>
        </View>
      </View>
      <Text style={[styles.centerTraditional, compact && styles.centerTraditionalCompact]}>
        {word.traditional}
      </Text>
      <Text style={[styles.centerPinyin, compact && styles.centerPinyinCompact]}>{word.pinyin}</Text>

      <ScrollView
        style={styles.centerScroll}
        contentContainerStyle={styles.centerScrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.centerRow}>
          <Text style={styles.centerLabel}>English</Text>
          <Text style={[styles.centerValue, compact && styles.centerValueCompact]}>
            {word.english}
          </Text>
        </View>
        <View style={styles.centerRow}>
          <Text style={styles.centerLabel}>Thai</Text>
          <Text style={[styles.centerValue, compact && styles.centerValueCompact]}>
            {word.thai || '—'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

export function WordExplorer({ visible, word, pool, graph, onClose, onWordChange }: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const compact = screenW < 420 || screenH < 740;

  const [displayWord, setDisplayWord] = useState<VocabularyWord | null>(word);
  const [areaSize, setAreaSize] = useState({ width: screenW, height: screenH * 0.72 });
  const [incomingWord, setIncomingWord] = useState<VocabularyWord | null>(null);

  const slideX = useSharedValue(0);
  const slideY = useSharedValue(0);
  const incomingX = useSharedValue(0);
  const incomingY = useSharedValue(0);
  const isAnimating = useSharedValue(false);

  useEffect(() => {
    if (word) setDisplayWord(word);
  }, [word]);

  const nav = useMemo(
    () => (displayWord ? buildDirectionalNav(displayWord, pool, graph) : null),
    [displayWord, pool, graph],
  );

  const resetSlides = useCallback(() => {
    slideX.value = 0;
    slideY.value = 0;
    incomingX.value = 0;
    incomingY.value = 0;
    setIncomingWord(null);
  }, [slideX, slideY, incomingX, incomingY]);

  const finishNavigation = useCallback(
    (nextWord: VocabularyWord) => {
      setDisplayWord(nextWord);
      onWordChange(nextWord);
      resetSlides();
      isAnimating.value = false;
    },
    [onWordChange, resetSlides, isAnimating],
  );

  const animateToNeighbor = useCallback(
    (dir: NavDirection) => {
      if (!displayWord || !nav || isAnimating.value) return;
      const slot = getNeighborInDirection(nav, dir);
      if (!slot) {
        slideX.value = withSpring(0, SPRING);
        slideY.value = withSpring(0, SPRING);
        return;
      }

      isAnimating.value = true;
      setIncomingWord(slot.word);

      const { width, height } = areaSize;
      const originX = slideX.value;
      const originY = slideY.value;
      const deltaX = dir === 'left' ? -width : dir === 'right' ? width : 0;
      const deltaY = dir === 'up' ? -height : dir === 'down' ? height : 0;

      incomingX.value = originX - deltaX;
      incomingY.value = originY - deltaY;

      slideX.value = withTiming(originX + deltaX, { duration: SLIDE_MS });
      slideY.value = withTiming(originY + deltaY, { duration: SLIDE_MS });
      incomingX.value = withTiming(0, { duration: SLIDE_MS });
      incomingY.value = withTiming(0, { duration: SLIDE_MS }, (finished) => {
        if (finished) {
          runOnJS(finishNavigation)(slot.word);
        }
      });
    },
    [
      displayWord,
      nav,
      areaSize,
      slideX,
      slideY,
      incomingX,
      incomingY,
      isAnimating,
      finishNavigation,
    ],
  );

  const navigate = useCallback(
    (dir: NavDirection) => {
      animateToNeighbor(dir);
    },
    [animateToNeighbor],
  );

  const navRef = useRef(nav);
  navRef.current = nav;
  const areaSizeRef = useRef(areaSize);
  areaSizeRef.current = areaSize;

  const handlePanEnd = useCallback(
    (translationX: number, translationY: number) => {
      if (isAnimating.value) return;

      const { width, height } = areaSizeRef.current;
      const dir = directionFromSwipe(
        translationX,
        translationY,
        swipeThreshold(width, height),
      );

      if (dir && navRef.current?.[dir]) {
        animateToNeighbor(dir);
        return;
      }

      setIncomingWord(null);
      slideX.value = withSpring(0, SPRING);
      slideY.value = withSpring(0, SPRING);
      incomingX.value = withSpring(0, SPRING);
      incomingY.value = withSpring(0, SPRING);
    },
    [animateToNeighbor, isAnimating, slideX, slideY, incomingX, incomingY],
  );

  const panStart = useRef({ x: 0, y: 0 });
  const panGesture = Gesture.Pan()
    .onBegin(() => {
      if (isAnimating.value) return;
      panStart.current = { x: slideX.value, y: slideY.value };
    })
    .onUpdate((event) => {
      if (isAnimating.value) return;
      slideX.value = panStart.current.x + event.translationX;
      slideY.value = panStart.current.y + event.translationY;
    })
    .onEnd((event) => {
      runOnJS(handlePanEnd)(event.translationX, event.translationY);
    });

  const currentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }, { translateY: slideY.value }],
  }));

  const incomingStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: incomingX.value }, { translateY: incomingY.value }],
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

  useEffect(() => {
    if (!visible) resetSlides();
  }, [visible, resetSlides]);

  if (!displayWord || !nav) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
          <Text style={styles.topHint} numberOfLines={1}>
            {compact ? 'Swipe ↑↓←→' : 'Swipe or tap arrows · keys on web'}
          </Text>
        </View>

        <GestureDetector gesture={panGesture}>
          <View
            style={styles.slideArea}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setAreaSize({ width, height });
            }}
          >
            <View style={styles.rowTop}>
              <NavPreview slot={nav.up} direction="up" onPress={() => navigate('up')} compact={compact} />
            </View>

            <View style={styles.rowMiddle}>
              <NavPreview
                slot={nav.left}
                direction="left"
                onPress={() => navigate('left')}
                compact={compact}
              />

              <View style={styles.centerStage}>
                {incomingWord ? (
                  <AnimatedView style={[styles.centerLayer, incomingStyle]} pointerEvents="none">
                    <WordCenter word={incomingWord} compact={compact} />
                  </AnimatedView>
                ) : null}
                <AnimatedView style={[styles.centerLayer, currentStyle]}>
                  <WordCenter word={displayWord} compact={compact} />
                </AnimatedView>
              </View>

              <NavPreview
                slot={nav.right}
                direction="right"
                onPress={() => navigate('right')}
                compact={compact}
              />
            </View>

            <View style={styles.rowBottom}>
              <NavPreview slot={nav.down} direction="down" onPress={() => navigate('down')} compact={compact} />
            </View>
          </View>
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    gap: 10,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  topHint: {
    color: colors.textMuted,
    fontSize: 11,
    flex: 1,
  },
  slideArea: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  rowTop: {
    alignItems: 'center',
    flexShrink: 0,
  },
  rowMiddle: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
    minHeight: 0,
  },
  rowBottom: {
    alignItems: 'center',
    flexShrink: 0,
  },
  centerStage: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    borderRadius: 18,
  },
  centerLayer: {
    ...StyleSheet.absoluteFill,
  },
  previewSlot: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewSlotCompact: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 10,
  },
  previewVertical: {
    width: '100%',
    maxWidth: 320,
    minHeight: 56,
  },
  previewSide: {
    width: 58,
    maxWidth: 58,
    minWidth: 58,
    alignSelf: 'stretch',
  },
  previewEmpty: {
    opacity: 0.3,
  },
  previewArrow: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  previewArrowCompact: {
    fontSize: 12,
    marginBottom: 0,
  },
  previewChar: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  previewCharCompact: {
    fontSize: 18,
  },
  previewGloss: {
    color: colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
  previewShared: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  previewEmptyText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  centerCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.accent,
    padding: 16,
    gap: 6,
    minHeight: 0,
  },
  centerCardCompact: {
    padding: 12,
    gap: 4,
    borderRadius: 16,
  },
  centerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    flexShrink: 0,
  },
  centerHanzi: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.text,
  },
  centerHanziCompact: {
    fontSize: 38,
  },
  hskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  hskBadgeText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 11,
  },
  centerTraditional: {
    fontSize: 24,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '600',
    flexShrink: 0,
  },
  centerTraditionalCompact: {
    fontSize: 20,
  },
  centerPinyin: {
    fontSize: 17,
    color: colors.accent,
    textAlign: 'center',
    flexShrink: 0,
  },
  centerPinyinCompact: {
    fontSize: 15,
  },
  centerScroll: {
    flex: 1,
    minHeight: 0,
  },
  centerScrollContent: {
    gap: 8,
    paddingBottom: 4,
  },
  centerRow: {
    gap: 3,
  },
  centerLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  centerValue: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  centerValueCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
});
