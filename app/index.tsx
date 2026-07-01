import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CharacterSphere } from '../src/components/CharacterSphere';
import { HskRangePicker } from '../src/components/HskRangePicker';
import { getManifest } from '../src/lib/database';
import { graphStyles as styles } from '../src/constants/theme';
import type { HskRange } from '../src/types/vocabulary';

export default function OverviewScreen() {
  const router = useRouter();
  const [range, setRange] = useState<HskRange>({ min: 1, max: 4 });
  const [stats, setStats] = useState({ loaded: 100, total: 0 });

  const manifest = getManifest();

  const handleStatsChange = useCallback(
    (next: { loaded: number; total: number }) => {
      setStats((prev) =>
        prev.loaded === next.loaded && prev.total === next.total ? prev : next,
      );
    },
    [],
  );

  const openCharacter = (char: string) => {
    router.push({
      pathname: '/graph/[char]',
      params: { char, hskMin: String(range.min), hskMax: String(range.max) },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>HanGraph Overview</Text>
        <Text style={styles.subtitle}>
          {manifest.counts.words.toLocaleString()} words · {stats.loaded} characters on sphere
          {stats.total > stats.loaded ? ` (${stats.total} total)` : ''}
        </Text>
      </View>

      <View style={styles.controls}>
        <HskRangePicker range={range} onChange={setRange} />
        <View style={styles.row}>
          <Text style={styles.label}>Quick pick</Text>
          {['打', '爱', '学', '人', '中'].map((char) => (
            <Pressable key={char} style={styles.chip} onPress={() => openCharacter(char)}>
              <Text style={styles.chipText}>{char}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <CharacterSphere range={range} onSelectCharacter={openCharacter} onStatsChange={handleStatsChange} />
    </SafeAreaView>
  );
}
