import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ConversationExampleData } from '../agent/conversationExamples';
import { Choice } from './AgentConversation';
export function ConversationExample({
  example,
}: {
  example: ConversationExampleData;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState<number[]>([]);
  const [source, setSource] = useState(false);
  return (
    <View style={s.root} testID={`conversation-example-${example.id}`}>
      <Text style={s.title}>{example.title}</Text>
      <Text style={s.body}>{example.context}</Text>
      {!!example.lines && (
        <View style={[s.lines, example.format === 'change' && s.change]}>
          {example.lines.map((line, index) =>
            example.format === 'checklist' ? (
              <Pressable
                key={line}
                accessibilityRole="checkbox"
                accessibilityLabel={line}
                accessibilityState={{ checked: checked.includes(index) }}
                onPress={() =>
                  setChecked(old =>
                    old.includes(index)
                      ? old.filter(i => i !== index)
                      : [...old, index],
                  )
                }
                style={s.checkRow}
              >
                <Text style={[s.body, checked.includes(index) && s.done]}>
                  {checked.includes(index) ? '✓' : '○'} {line}
                </Text>
              </Pressable>
            ) : (
              <Text
                key={line}
                style={example.format === 'writing' ? s.quote : s.body}
              >
                {line}
              </Text>
            ),
          )}
        </View>
      )}
      <View style={s.actions}>
        {example.options.map((option, index) => (
          <Choice
            key={option.label}
            text={option.label}
            selected={selected === index}
            onPress={() => setSelected(index)}
          />
        ))}
      </View>
      {selected !== null && (
        <View style={s.response} accessibilityLiveRegion="polite">
          <Text style={s.body}>{example.options[selected].response}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setSelected(null)}
          >
            <Text style={s.link}>Choose another direction</Text>
          </Pressable>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`About ${example.title}`}
        onPress={() => setSource(!source)}
      >
        <Text style={s.source}>
          {source
            ? 'Reference scenario · Local walkthrough only. Not connected to your calendar, inbox or task history.'
            : 'About this scenario'}
        </Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  root: { marginVertical: 8, marginBottom: 24, paddingVertical: 12, gap: 11 },
  title: { fontSize: 19, lineHeight: 28, fontWeight: '500', color: '#1B2738' },
  body: { fontSize: 14, lineHeight: 23, color: '#697484' },
  lines: {
    gap: 12,
    paddingLeft: 13,
    borderLeftWidth: 2,
    borderLeftColor: '#DDE4EE',
  },
  change: { borderLeftColor: '#B7D3C4' },
  quote: { fontSize: 16, lineHeight: 26, color: '#37465D' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  response: {
    padding: 15,
    borderRadius: 15,
    backgroundColor: '#F5F8FB',
    gap: 12,
  },
  link: { color: '#5176A0', fontSize: 12 },
  source: { color: '#9299A3', fontSize: 10, lineHeight: 16 },
  checkRow: { paddingVertical: 5 },
  done: { textDecorationLine: 'line-through', color: '#8F9A95' },
});
