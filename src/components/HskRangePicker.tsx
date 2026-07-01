import { Pressable, Text, View } from 'react-native';
import type { HskRange } from '../types/vocabulary';
import { HSK_LEVELS } from '../lib/graphEngine';
import { graphStyles as styles } from '../constants/theme';

interface Props {
  range: HskRange;
  onChange: (range: HskRange) => void;
}

export function HskRangePicker({ range, onChange }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>HSK range</Text>
      <View style={styles.row}>
        {HSK_LEVELS.map((level) => {
          const isMin = range.min === level;
          const isMax = range.max === level;
          const inRange = level >= range.min && level <= range.max;

          return (
            <Pressable
              key={level}
              onPress={() => {
                if (level < range.min) onChange({ min: level, max: range.max });
                else if (level > range.max) onChange({ min: range.min, max: level });
                else if (Math.abs(level - range.min) <= Math.abs(level - range.max)) {
                  onChange({ min: level, max: range.max });
                } else {
                  onChange({ min: range.min, max: level });
                }
              }}
              style={[styles.chip, inRange && styles.chipActive]}
            >
              <Text style={[styles.chipText, inRange && styles.chipTextActive]}>
                {level}
                {isMin ? '↓' : ''}
                {isMax ? '↑' : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.chipText}>
        HSK {range.min}–{range.max}
      </Text>
    </View>
  );
}

interface DirectionPickerProps {
  direction: 'TB' | 'LR' | 'BT' | 'RL';
  onChange: (direction: 'TB' | 'LR' | 'BT' | 'RL') => void;
}

const DIRECTIONS: Array<{ id: 'TB' | 'LR' | 'BT' | 'RL'; label: string }> = [
  { id: 'TB', label: '↓ Top' },
  { id: 'BT', label: '↑ Bottom' },
  { id: 'LR', label: '→ Right' },
  { id: 'RL', label: '← Left' },
];

export function LayoutDirectionPicker({ direction, onChange }: DirectionPickerProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>Layout</Text>
      {DIRECTIONS.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => onChange(item.id)}
          style={[styles.chip, direction === item.id && styles.chipActive]}
        >
          <Text style={[styles.chipText, direction === item.id && styles.chipTextActive]}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
