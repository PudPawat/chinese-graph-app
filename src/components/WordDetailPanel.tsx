import { Text, View } from 'react-native';
import type { VocabularyWord } from '../types/vocabulary';
import { HSK_COLORS } from '../lib/graphEngine';
import { graphStyles as styles } from '../constants/theme';

interface Props {
  word: VocabularyWord | null;
}

export function WordDetailPanel({ word }: Props) {
  if (!word) {
    return (
      <View style={styles.detailPanel}>
        <Text style={styles.subtitle}>Tap a node to see translations</Text>
      </View>
    );
  }

  const hskColor = HSK_COLORS[word.hskLevel] ?? '#64748b';

  return (
    <View style={styles.detailPanel}>
      <View style={styles.row}>
        <Text style={styles.detailTitle}>{word.simplified}</Text>
        <View style={[styles.detailBadge, { backgroundColor: hskColor }]}>
          <Text style={styles.detailBadgeText}>HSK {word.hskLevel}</Text>
        </View>
      </View>
      <Text style={styles.detailPinyin}>{word.pinyin}</Text>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Traditional</Text>
        <Text style={styles.detailValue}>{word.traditional}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>English</Text>
        <Text style={styles.detailValue}>{word.english}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Thai</Text>
        <Text style={styles.detailValue}>{word.thai || '—'}</Text>
      </View>
    </View>
  );
}
