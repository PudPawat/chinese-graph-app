import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, G, Line } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { HskRange, SphereRotation } from '../types/vocabulary';
import {
  DEFAULT_SPHERE_ZOOM,
  INITIAL_CHAR_BATCH,
  LOAD_MORE_BATCH,
  buildCharacterLinks,
  clampZoom,
  dbCharactersToOverviewSphere,
  getCharacterColor,
  getSortedCharactersForRange,
  ORBIT_DRAG_SENSITIVITY,
  ORBIT_WHEEL_SENSITIVITY,
  projectCharacters,
  SPHERE_GLOBE_RADIUS,
  CARD_BASE_WIDTH,
  CARD_BASE_HEIGHT,
  CARD_CHAR_FONT,
  CARD_GLOSS_FONT,
  CARD_THAI_FONT,
  CARD_HSK_FONT,
  truncateGloss,
} from '../lib/sphereEngine';
import { getAllCharacters, getAllWords } from '../lib/database';
import { extractChineseChars, filterByHskRange } from '../lib/graphEngine';
import { colors, graphStyles as styles } from '../constants/theme';

interface Props {
  range: HskRange;
  onSelectCharacter: (char: string) => void;
  onStatsChange?: (stats: { loaded: number; total: number }) => void;
}

function latitudeLines(segments = 8): Array<{ y: number; r: number }> {
  return Array.from({ length: segments }, (_, i) => {
    const t = (i + 1) / (segments + 1);
    const y = (t - 0.5) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    return { y, r };
  });
}

export function CharacterSphere({ range, onSelectCharacter, onStatsChange }: Props) {
  const [viewport, setViewport] = useState({ width: 320, height: 420 });
  const [rotation, setRotation] = useState<SphereRotation>({ yaw: 0.35, pitch: -0.12 });
  const [zoom, setZoom] = useState(DEFAULT_SPHERE_ZOOM);
  const [loadedCount, setLoadedCount] = useState(INITIAL_CHAR_BATCH);
  const [loadingMore, setLoadingMore] = useState(false);

  const wordCountInRange = useMemo(() => {
    const filtered = filterByHskRange(getAllWords(), range);
    const counts = new Map<string, number>();
    for (const word of filtered) {
      const first = extractChineseChars(word.simplified)[0];
      if (!first) continue;
      counts.set(first, (counts.get(first) ?? 0) + 1);
    }
    return counts;
  }, [range]);

  const sortedAll = useMemo(
    () => getSortedCharactersForRange(getAllCharacters(), range, wordCountInRange),
    [range, wordCountInRange],
  );

  const totalAvailable = sortedAll.length;
  const effectiveLoaded = Math.min(loadedCount, totalAvailable);

  useEffect(() => {
    setLoadedCount(INITIAL_CHAR_BATCH);
    setRotation({ yaw: 0.35, pitch: -0.12 });
    setZoom(DEFAULT_SPHERE_ZOOM);
  }, [range]);

  useEffect(() => {
    onStatsChange?.({ loaded: effectiveLoaded, total: totalAvailable });
  }, [effectiveLoaded, totalAvailable, onStatsChange]);

  const characters = useMemo(
    () => dbCharactersToOverviewSphere(sortedAll, wordCountInRange, effectiveLoaded),
    [sortedAll, wordCountInRange, effectiveLoaded],
  );

  const links = useMemo(() => buildCharacterLinks(characters), [characters]);

  const projected = useMemo(
    () => projectCharacters(characters, rotation, viewport, zoom),
    [characters, rotation, viewport, zoom],
  );

  const projectedByChar = useMemo(
    () => new Map(projected.map((item) => [item.char, item])),
    [projected],
  );

  const loadMore = useCallback(() => {
    if (loadingMore || effectiveLoaded >= totalAvailable) return;
    setLoadingMore(true);
    requestAnimationFrame(() => {
      setLoadedCount((prev) => Math.min(prev + LOAD_MORE_BATCH, totalAvailable));
      setLoadingMore(false);
    });
  }, [loadingMore, effectiveLoaded, totalAvailable]);

  const orbitAreaRef = useRef<View>(null);
  const zoomRef = useRef(DEFAULT_SPHERE_ZOOM);
  const rotationRef = useRef<SphereRotation>(rotation);
  zoomRef.current = zoom;
  rotationRef.current = rotation;

  const panStart = useRef<SphereRotation>(rotation);
  const panGesture = Gesture.Pan()
    .onBegin(() => {
      panStart.current = rotationRef.current;
    })
    .onUpdate((event) => {
      setRotation({
        yaw: panStart.current.yaw + event.translationX * ORBIT_DRAG_SENSITIVITY,
        pitch: panStart.current.pitch - event.translationY * ORBIT_DRAG_SENSITIVITY,
      });
    });

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const node = orbitAreaRef.current as unknown as HTMLElement | null;
    if (!node) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setRotation((prev) => ({
        yaw: prev.yaw + event.deltaX * ORBIT_WHEEL_SENSITIVITY,
        pitch: prev.pitch - event.deltaY * ORBIT_WHEEL_SENSITIVITY,
      }));
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  const pinchBase = useRef(DEFAULT_SPHERE_ZOOM);
  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      pinchBase.current = zoomRef.current;
    })
    .onUpdate((event) => {
      setZoom(clampZoom(pinchBase.current * event.scale));
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport({ width, height });
  };

  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  const globeRadius = SPHERE_GLOBE_RADIUS * zoom;

  if (totalAvailable === 0) {
    return (
      <View style={styles.graphArea}>
        <Text style={styles.emptyText}>No characters in HSK {range.min}–{range.max}.</Text>
      </View>
    );
  }

  return (
    <View style={styles.graphArea} onLayout={onLayout}>
      <GestureDetector gesture={composed}>
        <View ref={orbitAreaRef} style={{ flex: 1 }}>
          <Svg width={viewport.width} height={viewport.height} style={{ position: 'absolute' }}>
            <Circle
              cx={cx}
              cy={cy}
              r={globeRadius}
              fill="none"
              stroke={colors.border}
              strokeWidth={1}
              opacity={0.35}
            />

            {latitudeLines().map(({ y, r }, index) => (
              <Circle
                key={`lat-${index}`}
                cx={cx}
                cy={cy + y * globeRadius}
                r={r * globeRadius}
                fill="none"
                stroke={colors.border}
                strokeWidth={0.6}
                opacity={0.16}
              />
            ))}

            {[0, 1, 2, 3].map((index) => {
              const angle = (index / 4) * Math.PI;
              return (
                <Line
                  key={`mer-${index}`}
                  x1={cx + Math.cos(angle) * globeRadius}
                  y1={cy + Math.sin(angle) * globeRadius * 0.15}
                  x2={cx - Math.cos(angle) * globeRadius}
                  y2={cy - Math.sin(angle) * globeRadius * 0.15}
                  stroke={colors.border}
                  strokeWidth={0.6}
                  opacity={0.16}
                />
              );
            })}

            <G>
              {links.map(([a, b]) => {
                const pa = projectedByChar.get(a);
                const pb = projectedByChar.get(b);
                if (!pa || !pb || !pa.visible || !pb.visible) return null;

                return (
                  <Line
                    key={`${a}-${b}`}
                    x1={pa.screenX}
                    y1={pa.screenY}
                    x2={pb.screenX}
                    y2={pb.screenY}
                    stroke={colors.accent}
                    strokeWidth={0.7}
                    opacity={0.06 + ((pa.depth + pb.depth) / 4) * 0.08}
                  />
                );
              })}
            </G>
          </Svg>

          {projected.map((item) => {
            if (!item.visible) return null;

            const cardWidth = CARD_BASE_WIDTH;
            const cardHeight = CARD_BASE_HEIGHT;
            const hskColor = getCharacterColor(item.minHsk);
            const opacity = 0.48 + ((item.depth + 1) / 2) * 0.52;
            const english = truncateGloss(item.english, 18);
            const thai = item.thai ? truncateGloss(item.thai, 14) : '—';

            return (
              <Pressable
                key={item.char}
                onPress={() => onSelectCharacter(item.char)}
                style={{
                  position: 'absolute',
                  left: item.screenX - cardWidth / 2,
                  top: item.screenY - cardHeight / 2,
                  width: cardWidth,
                  minHeight: cardHeight,
                  borderRadius: 12,
                  backgroundColor: '#1e293bee',
                  borderWidth: 2,
                  borderColor: hskColor,
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  opacity,
                  zIndex: Math.round((item.depth + 1) * 100),
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: CARD_CHAR_FONT,
                    fontWeight: '800',
                    textAlign: 'center',
                  }}
                >
                  {item.char}
                </Text>
                <Text
                  style={{
                    color: colors.accent,
                    fontSize: CARD_GLOSS_FONT,
                    textAlign: 'center',
                    marginTop: 2,
                  }}
                  numberOfLines={2}
                >
                  {english}
                </Text>
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: CARD_THAI_FONT,
                    textAlign: 'center',
                    marginTop: 1,
                  }}
                  numberOfLines={1}
                >
                  {thai}
                </Text>
                <Text
                  style={{
                    color: hskColor,
                    fontSize: CARD_HSK_FONT,
                    textAlign: 'center',
                    marginTop: 2,
                    fontWeight: '700',
                  }}
                >
                  HSK {item.minHsk}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GestureDetector>

      <View style={local.footer}>
        {loadingMore ? (
          <ActivityIndicator color={colors.accent} size="small" />
        ) : (
          <>
            <Text style={local.footerText}>
              Drag or scroll to orbit · Pinch to zoom · {effectiveLoaded} characters on sphere
            </Text>
            {effectiveLoaded < totalAvailable ? (
              <Pressable onPress={loadMore} style={local.loadMoreBtn}>
                <Text style={local.loadMoreText}>
                  Load more (+{Math.min(LOAD_MORE_BATCH, totalAvailable - effectiveLoaded)})
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  footer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: '#1e293bcc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    alignItems: 'center',
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
  loadMoreBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
  },
  loadMoreText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
});
