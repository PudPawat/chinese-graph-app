import { useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import type { GraphNode, VocabularyGraph as GraphData } from '../types/vocabulary';
import { DEFAULT_GRAPH_ZOOM, getGraphBounds, HSK_COLORS } from '../lib/graphEngine';
import { truncateGloss } from '../lib/database';
import { graphStyles as styles, colors } from '../constants/theme';

interface Props {
  graph: GraphData | null;
  selectedId: string | null;
  onSelect: (node: GraphNode) => void;
}

const AnimatedView = Animated.createAnimatedComponent(View);

export function VocabularyGraph({ graph, selectedId, onSelect }: Props) {
  const [viewport, setViewport] = useState({ width: 320, height: 360 });
  const scale = useSharedValue(DEFAULT_GRAPH_ZOOM);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startScale = useSharedValue(DEFAULT_GRAPH_ZOOM);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const bounds = useMemo(() => getGraphBounds(graph?.nodes ?? []), [graph]);
  const fitTransform = useMemo(() => {
    if (!graph || bounds.width === 0 || bounds.height === 0) {
      return { scale: 1, offsetX: 24, offsetY: 24 };
    }

    const padding = 48;
    const scaleX = (viewport.width - padding * 2) / bounds.width;
    const scaleY = (viewport.height - padding * 2) / bounds.height;
    const fitScale = Math.min(scaleX, scaleY, 1.35);

    return {
      scale: fitScale,
      offsetX: (viewport.width - bounds.width * fitScale) / 2 - bounds.minX * fitScale,
      offsetY: (viewport.height - bounds.height * fitScale) / 2 - bounds.minY * fitScale,
    };
  }, [graph, bounds, viewport]);

  const zoomRef = useRef(DEFAULT_GRAPH_ZOOM);
  zoomRef.current = scale.value;

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    });

  const pinchBase = useRef(DEFAULT_GRAPH_ZOOM);
  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      pinchBase.current = zoomRef.current;
    })
    .onUpdate((event) => {
      scale.value = Math.min(3, Math.max(1.2, pinchBase.current * event.scale));
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport({ width, height });
  };

  if (!graph || graph.nodes.length === 0) {
    return (
      <View style={styles.graphArea}>
        <Text style={styles.emptyText}>No related words in this HSK range.</Text>
      </View>
    );
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  return (
    <View style={styles.graphArea} onLayout={onLayout}>
      <GestureDetector gesture={composed}>
        <AnimatedView style={[{ flex: 1 }, animatedStyle]}>
          <Svg width={viewport.width} height={viewport.height}>
            <G x={fitTransform.offsetX} y={fitTransform.offsetY} scale={fitTransform.scale}>
              {graph.edges.map((edge) => {
                const source = nodeById.get(edge.source);
                const target = nodeById.get(edge.target);
                if (!source || !target) return null;

                return (
                  <G key={edge.id}>
                    <Line
                      x1={source.x + source.width / 2}
                      y1={source.y + source.height / 2}
                      x2={target.x + target.width / 2}
                      y2={target.y + target.height / 2}
                      stroke={colors.border}
                      strokeWidth={1.5}
                    />
                    <SvgText
                      x={(source.x + target.x + source.width) / 2}
                      y={(source.y + target.y + source.height) / 2 - 4}
                      fill={colors.textMuted}
                      fontSize={10}
                      textAnchor="middle"
                    >
                      {edge.sharedChar}
                    </SvgText>
                  </G>
                );
              })}

              {graph.nodes.map((node) => {
                const isRoot = node.id === graph.rootId;
                const isSelected = node.id === selectedId;
                const hskColor = HSK_COLORS[node.word.hskLevel] ?? colors.border;
                const gloss = truncateGloss(node.word.english, 14);

                return (
                  <G key={node.id}>
                    <Rect
                      x={node.x}
                      y={node.y}
                      width={node.width}
                      height={node.height}
                      rx={12}
                      fill={isSelected ? colors.accentSoft : colors.surface}
                      stroke={isSelected ? colors.accent : isRoot ? hskColor : colors.border}
                      strokeWidth={isSelected || isRoot ? 2.5 : 1.5}
                      onPress={() => onSelect(node)}
                    />
                    <SvgText
                      x={node.x + node.width / 2}
                      y={node.y + 26}
                      fill={colors.text}
                      fontSize={18}
                      fontWeight="700"
                      textAnchor="middle"
                      pointerEvents="none"
                    >
                      {node.word.simplified}
                    </SvgText>
                    <SvgText
                      x={node.x + node.width / 2}
                      y={node.y + 44}
                      fill={colors.accent}
                      fontSize={9}
                      textAnchor="middle"
                      pointerEvents="none"
                    >
                      {gloss}
                    </SvgText>
                    <SvgText
                      x={node.x + node.width / 2}
                      y={node.y + 58}
                      fill={hskColor}
                      fontSize={9}
                      fontWeight="600"
                      textAnchor="middle"
                      pointerEvents="none"
                    >
                      HSK {node.word.hskLevel}
                    </SvgText>
                  </G>
                );
              })}
            </G>
          </Svg>
        </AnimatedView>
      </GestureDetector>
    </View>
  );
}
