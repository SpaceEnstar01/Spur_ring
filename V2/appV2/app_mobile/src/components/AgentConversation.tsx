import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { IntentItem } from '../intent/model';
import { stateLabels } from '../intent/model';
import { answerChoices, interactionFor } from '../intent/interaction';
import { Icon } from './Icon';
type Props = {
  item: IntentItem;
  onOpen: (item: IntentItem) => void;
  onRespond?: (item: IntentItem, text: string) => void;
  onPause?: (item: IntentItem) => void;
};
export function AgentConversation({ item, onOpen, onRespond, onPause }: Props) {
  const mode = interactionFor(item);
  const reply = (text: string) =>
    onRespond ? onRespond(item, text) : onOpen(item);
  const prompt =
    mode === 'question'
      ? item.questions[0] || item.summary || item.title
      : item.title;
  return (
    <View
      style={[s.root, mode === 'thought' && s.thought]}
      testID={`agent-interaction-${mode}`}
    >
      <View style={s.byline}>
        <Icon
          name={mode === 'paused' ? 'clock' : 'sparkles'}
          color="#8A92A1"
          size={14}
        />
        <Text style={s.caption}>
          {mode === 'thought'
            ? 'Noted'
            : mode === 'paused'
            ? 'On hold'
            : mode === 'status'
            ? 'In progress'
            : 'Spur'}
          {item.pinned ? ' · Pinned' : ''}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Intent ${item.title}`}
        onPress={() => onOpen(item)}
      >
        <Text style={[s.prompt, mode === 'thought' && s.thoughtText]}>
          {prompt}
        </Text>
      </Pressable>
      {mode === 'thought' ? (
        <Text style={s.caption}>Saved as a thought. No reminder.</Text>
      ) : mode === 'paused' ? (
        <Text style={s.body}>Paused. Continue whenever you are ready.</Text>
      ) : mode === 'status' ? (
        <Text style={s.body}>
          {stateLabels[item.state]} · Open to check the latest details.
        </Text>
      ) : mode === 'change' ? (
        <>
          <Text style={s.body}>{item.summary}</Text>
          {!!item.replacement && (
            <Text style={s.change}>→ {item.replacement}</Text>
          )}
          <Text style={s.caption}>
            Review the original and choose which item to update.
          </Text>
        </>
      ) : mode === 'checklist' ? (
        <View style={s.list}>
          {item.checklist.slice(0, 4).map((step, i) => (
            <Text key={i} style={s.body}>
              ○ {step}
            </Text>
          ))}
        </View>
      ) : mode === 'confirm' ? (
        <Text style={s.body}>
          {item.frame === 'reminder'
            ? `${
                item.dateText || 'When should this happen?'
              } · Confirm a time before adding an Agent reminder.`
            : `${item.summary}\nKeep this direction and prepare the next step?`}
        </Text>
      ) : (
        <>
          {item.questions.length > 1 && (
            <Text style={s.caption}>
              {item.questions.length - 1} more details to clarify
            </Text>
          )}
          {item.email && (
            <View style={s.draft}>
              <Text style={s.caption}>Prepared draft · Not sent</Text>
              <Text style={s.body}>{item.email.subject}</Text>
            </View>
          )}
        </>
      )}
      {mode !== 'thought' && (
        <View style={s.actions}>
          {mode === 'confirm' ? (
            <>
              <Choice
                text={
                  item.frame === 'reminder'
                    ? 'Choose time'
                    : 'Yes, review next step'
                }
                onPress={() =>
                  item.frame === 'reminder'
                    ? onOpen(item)
                    : reply(
                        'Yes, keep this direction. Help me prepare the next step.',
                      )
                }
              />
              {!!onPause && (
                <Choice text="Not now" onPress={() => onPause(item)} />
              )}
            </>
          ) : mode === 'question' ? (
            <>
              {answerChoices(prompt).map(answer => (
                <Choice
                  key={answer}
                  text={answer}
                  onPress={() => reply(`Regarding “${prompt}”: ${answer}.`)}
                />
              ))}
              <Choice
                text="Answer this"
                onPress={() => reply(`Regarding “${prompt}”: `)}
              />
              {!!item.email && (
                <Choice text="Review draft" onPress={() => onOpen(item)} />
              )}
              {!!onPause && (
                <Choice text="Later" onPress={() => onPause(item)} />
              )}
            </>
          ) : (
            <Choice
              text={
                mode === 'paused'
                  ? 'Review & continue'
                  : mode === 'change'
                  ? 'Review change'
                  : mode === 'checklist'
                  ? 'Open checklist'
                  : 'View details'
              }
              onPress={() => onOpen(item)}
            />
          )}
        </View>
      )}
    </View>
  );
}
export function Choice({
  text,
  onPress,
  selected = false,
}: {
  text: string;
  onPress: () => void;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[s.choice, selected && s.selected]}
    >
      <Text style={[s.choiceText, selected && s.selectedText]}>{text}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  root: {
    paddingVertical: 17,
    marginBottom: 15,
    paddingHorizontal: 5,
    gap: 10,
  },
  thought: {
    maxWidth: '90%',
    paddingLeft: 15,
    borderLeftWidth: 2,
    borderLeftColor: '#DED7EB',
  },
  byline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  caption: { fontSize: 11, color: '#89909A', lineHeight: 17 },
  prompt: { fontSize: 18, lineHeight: 27, color: '#192333', fontWeight: '500' },
  thoughtText: { fontSize: 17, fontWeight: '400' },
  body: { color: '#667080', fontSize: 14, lineHeight: 22 },
  change: { color: '#426858', fontSize: 16, lineHeight: 24 },
  list: { gap: 9 },
  draft: { padding: 13, borderRadius: 12, backgroundColor: '#FAF7F1', gap: 5 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 3 },
  choice: {
    borderWidth: 1,
    borderColor: '#E2E5EA',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFF',
  },
  choiceText: { color: '#344155', fontSize: 12, fontWeight: '500' },
  selected: { backgroundColor: '#24364A', borderColor: '#24364A' },
  selectedText: { color: '#FFF' },
});
