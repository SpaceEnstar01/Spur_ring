import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ConfirmGroup } from './confirmChoices';

export function ConfirmOptions({
  groups,
  disabled,
  onSelect,
}: {
  groups: ConfirmGroup[];
  disabled?: boolean;
  onSelect: (value: string) => void;
}) {
  if (!groups.length) return null;
  return (
    <View style={styles.wrap}>
      {groups.map(group => (
        <ChoiceGroup
          key={group.id}
          group={group}
          disabled={disabled}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}

function ChoiceGroup({
  group,
  disabled,
  onSelect,
}: {
  group: ConfirmGroup;
  disabled?: boolean;
  onSelect: (value: string) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <View style={styles.group}>
      <Text style={styles.prompt}>{group.prompt}</Text>
      <View style={styles.row}>
        {group.options.map(option => {
          const on = picked.includes(option);
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              disabled={disabled}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => {
                if (!group.multiple) {
                  onSelect(option);
                  return;
                }
                setPicked(current =>
                  current.includes(option)
                    ? current.filter(item => item !== option)
                    : [...current, option],
                );
              }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {group.multiple ? (
        <Pressable
          accessibilityRole="button"
          disabled={disabled || !picked.length}
          onPress={() => onSelect(picked.join('、'))}
        >
          <Text style={styles.done}>确定</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  group: { marginTop: 10 },
  prompt: { fontSize: 13, lineHeight: 18, color: '#626B79' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#E0E3E8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: '#141D32', borderColor: '#141D32' },
  chipText: { fontSize: 13, color: '#141D32' },
  chipTextOn: { color: '#fff' },
  done: { marginTop: 8, fontSize: 13, fontWeight: '600', color: '#3165C8' },
});
