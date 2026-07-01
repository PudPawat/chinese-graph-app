import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import vocabularyData from '../../src/data/db/words.json';
import { HskRangePicker, LayoutDirectionPicker } from '../../src/components/HskRangePicker';
import { VocabularyGraph } from '../../src/components/VocabularyGraph';
import { WordDetailPanel } from '../../src/components/WordDetailPanel';
import { WordExplorer } from '../../src/components/WordExplorer';
import {
  INITIAL_WORD_BATCH,
  LOAD_MORE_WORD_BATCH,
  WORDS_PER_GRAPH_PAGE,
  buildVocabularyGraphPage,
  extractChineseChars,
  filterByHskRange,
  rankWordsForRoot,
  totalWordPages,
} from '../../src/lib/graphEngine';
import { searchDatabase } from '../../src/lib/database';
import { useSafeBack } from '../../src/lib/navigation';
import { graphStyles as styles, colors } from '../../src/constants/theme';
import type { GraphNode, HskRange, VocabularyWord } from '../../src/types/vocabulary';

const vocabulary = vocabularyData as VocabularyWord[];

function parseRange(min?: string, max?: string): HskRange {
  const parsedMin = Math.min(8, Math.max(1, Number(min) || 1));
  const parsedMax = Math.min(8, Math.max(parsedMin, Number(max) || 6));
  return { min: parsedMin, max: parsedMax };
}

export default function CharacterGraphScreen() {
  const goToOverview = useSafeBack('/');
  const params = useLocalSearchParams<{ char: string; hskMin?: string; hskMax?: string }>();
  const rootChar = decodeURIComponent(params.char ?? '打');
  const initialRange = parseRange(params.hskMin, params.hskMax);

  const [query, setQuery] = useState(rootChar);
  const [rootWord, setRootWord] = useState(rootChar);
  const [range, setRange] = useState<HskRange>(initialRange);
  const [direction, setDirection] = useState<'TB' | 'LR' | 'BT' | 'RL'>('TB');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [explorerWord, setExplorerWord] = useState<VocabularyWord | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadedCount, setLoadedCount] = useState(INITIAL_WORD_BATCH);
  const [pageIndex, setPageIndex] = useState(0);

  const suggestions = useMemo(() => searchDatabase(query).slice(0, 8), [query]);

  const wordPool = useMemo(() => {
    const inRange = filterByHskRange(vocabulary, range);
    return inRange.filter((word) => extractChineseChars(word.simplified).includes(rootChar));
  }, [range, rootChar]);

  const rankedAll = useMemo(
    () => rankWordsForRoot(wordPool, range, rootWord, true),
    [wordPool, range, rootWord],
  );

  const totalAvailable = rankedAll.length;
  const effectiveLoaded = Math.min(loadedCount, totalAvailable);
  const loadedWords = useMemo(
    () => rankedAll.slice(0, effectiveLoaded),
    [rankedAll, effectiveLoaded],
  );
  const pages = totalWordPages(effectiveLoaded, WORDS_PER_GRAPH_PAGE);
  const safePage = Math.min(pageIndex, Math.max(0, pages - 1));

  const pagesRef = useRef(pages);
  const effectiveLoadedRef = useRef(effectiveLoaded);
  const totalAvailableRef = useRef(totalAvailable);
  pagesRef.current = pages;
  effectiveLoadedRef.current = effectiveLoaded;
  totalAvailableRef.current = totalAvailable;

  useEffect(() => {
    setLoadedCount(INITIAL_WORD_BATCH);
    setPageIndex(0);
  }, [range, rootChar, rootWord]);

  useEffect(() => {
    setPageIndex((prev) => Math.min(prev, Math.max(0, pages - 1)));
  }, [pages]);

  const loadMore = useCallback(() => {
    setLoadedCount((prev) => Math.min(prev + LOAD_MORE_WORD_BATCH, totalAvailableRef.current));
  }, []);

  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  const goFirstPage = useCallback(() => setPageIndex(0), []);
  const goPrevPage = useCallback(() => setPageIndex((prev) => Math.max(0, prev - 1)), []);
  const goNextPage = useCallback(() => {
    setPageIndex((prev) => {
      const maxPage = Math.max(0, pagesRef.current - 1);
      if (prev < maxPage) {
        if ((prev + 2) * WORDS_PER_GRAPH_PAGE >= effectiveLoadedRef.current - WORDS_PER_GRAPH_PAGE) {
          loadMoreRef.current();
        }
        return prev + 1;
      }
      if (effectiveLoadedRef.current < totalAvailableRef.current) {
        loadMoreRef.current();
        return prev + 1;
      }
      return prev;
    });
  }, []);

  const graph = useMemo(
    () =>
      buildVocabularyGraphPage(
        wordPool,
        range,
        rootWord,
        direction,
        safePage,
        WORDS_PER_GRAPH_PAGE,
        effectiveLoaded,
      ),
    [wordPool, range, rootWord, direction, safePage, effectiveLoaded],
  );

  const pageStart = safePage * WORDS_PER_GRAPH_PAGE + 1;
  const pageEnd = Math.min((safePage + 1) * WORDS_PER_GRAPH_PAGE, effectiveLoaded);
  const canGoNext = safePage < pages - 1 || effectiveLoaded < totalAvailable;

  const selectedWord =
    explorerWord ??
    selectedNode?.word ??
    graph?.nodes.find((node) => node.id === graph.rootId)?.word ??
    null;

  const applyRoot = (word: VocabularyWord) => {
    setRootWord(word.simplified);
    setQuery(word.simplified);
    setShowSuggestions(false);
    setSelectedNode(null);
    setExplorerWord(null);
    setPageIndex(0);
  };

  const openExplorer = (node: GraphNode) => {
    setSelectedNode(node);
    setExplorerWord(node.word);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.row}>
          <Pressable onPress={goToOverview} style={styles.chip}>
            <Text style={styles.chipText}>← Overview</Text>
          </Pressable>
          <Text style={[styles.title, { flex: 1 }]}>Character: {rootChar}</Text>
        </View>
        <Text style={styles.subtitle}>
          {totalAvailable} words · 2-char priority · {WORDS_PER_GRAPH_PAGE} per page
        </Text>
      </View>

      <ScrollView
        style={local.controlsScroll}
        contentContainerStyle={styles.controls}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        <View style={local.pageBar}>
          <Pressable
            onPress={goFirstPage}
            disabled={safePage === 0}
            style={[local.pageBtn, safePage === 0 && local.pageBtnDisabled]}
          >
            <Text style={local.pageBtnText}>⏮</Text>
          </Pressable>
          <Pressable
            onPress={goPrevPage}
            disabled={safePage === 0}
            style={[local.pageBtn, safePage === 0 && local.pageBtnDisabled]}
          >
            <Text style={local.pageBtnText}>↑</Text>
          </Pressable>
          <Text style={local.pageInfo}>
            {safePage + 1}/{pages} · words {pageStart}–{pageEnd} / {effectiveLoaded}
          </Text>
          <Pressable
            onPress={goNextPage}
            disabled={!canGoNext}
            style={[local.pageBtn, !canGoNext && local.pageBtnDisabled]}
          >
            <Text style={local.pageBtnText}>↓</Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Root word</Text>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder={`Search 2-char words with ${rootChar}...`}
            placeholderTextColor="#64748b"
            onSubmitEditing={() => {
              setRootWord(query);
              setShowSuggestions(false);
              setSelectedNode(null);
              setExplorerWord(null);
              setPageIndex(0);
            }}
          />
          <Pressable
            style={[styles.chip, styles.chipActive]}
            onPress={() => {
              setRootWord(query);
              setShowSuggestions(false);
              setSelectedNode(null);
              setExplorerWord(null);
              setPageIndex(0);
            }}
          >
            <Text style={[styles.chipText, styles.chipTextActive]}>Go</Text>
          </Pressable>
        </View>

        {showSuggestions && suggestions.length > 0 ? (
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 120, backgroundColor: '#1e293b', borderRadius: 10 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => applyRoot(item)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: '#334155',
                }}
              >
                <Text style={{ color: '#f8fafc', fontSize: 15 }}>
                  {item.simplified} · {item.traditional}
                </Text>
                <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                  {item.pinyin} — HSK {item.hskLevel}
                </Text>
              </Pressable>
            )}
          />
        ) : null}

        <HskRangePicker
          range={range}
          onChange={(next) => {
            setRange(next);
            setSelectedNode(null);
            setExplorerWord(null);
          }}
        />
        <LayoutDirectionPicker direction={direction} onChange={setDirection} />
      </ScrollView>

      <VocabularyGraph
        graph={graph}
        selectedId={selectedNode?.id ?? null}
        onSelect={openExplorer}
      />

      <Pressable
        onPress={() => selectedWord && setExplorerWord(selectedWord)}
        disabled={!selectedWord}
      >
        <WordDetailPanel word={selectedWord} />
        {selectedWord ? (
          <Text
            style={{
              color: '#38bdf8',
              textAlign: 'center',
              fontSize: 12,
              paddingBottom: 10,
              backgroundColor: '#1e293b',
            }}
          >
            Tap for full-screen swipe explorer ↑↓←→
          </Text>
        ) : null}
      </Pressable>

      <WordExplorer
        visible={explorerWord !== null}
        word={explorerWord}
        pool={loadedWords}
        graph={graph}
        onClose={() => setExplorerWord(null)}
        onWordChange={(word) => {
          setExplorerWord(word);
          const node = graph?.nodes.find((item) => item.id === word.id) ?? null;
          setSelectedNode(node);
        }}
      />
    </SafeAreaView>
  );
}

const local = StyleSheet.create({
  controlsScroll: {
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: 220,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 4,
  },
  pageBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
  },
  pageBtnDisabled: {
    opacity: 0.35,
  },
  pageBtnText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  pageInfo: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
  },
});
