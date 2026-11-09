import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { IntentItem } from '../intent/model';
import { IntentUpdateCard } from '../components/IntentUpdateCard';
import { Icon } from '../components/Icon';
import { presentationForTask } from './model';
import { s } from './Patterns';
type Props = {
  item: IntentItem;
  onOpen: (item: IntentItem) => void;
  onRespond: (item: IntentItem, answer: string) => void;
  onPause?: (item: IntentItem) => void;
  onComplete: (item: IntentItem) => void;
};
// Production rendering reads real state only. No fixture actions, no simulated progress.
export function RealAdaptiveItem(props: Props) {
  const { item, onOpen, onComplete } = props;
  const pattern = presentationForTask(item);
  if (pattern === 'notification' || pattern === 'completion')
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Intent ${item.title}`}
        onPress={() => onOpen(item)}
        style={s.realLine}
      >
        <View style={s.inline}>
          <Icon
            name={
              pattern === 'completion'
                ? 'check'
                : item.kind === 'idea'
                ? 'sparkles'
                : 'note'
            }
            color={pattern === 'completion' ? '#328768' : '#3165C8'}
            size={18}
          />
          <View style={s.flex}>
            <Text style={s.message}>{item.title}</Text>
            <Text numberOfLines={2} style={s.body}>
              {item.summary}
            </Text>
            <Text style={s.meta}>
              {item.kind === 'idea'
                ? 'Saved thought · No reminder'
                : pattern === 'completion'
                ? 'Completed · View result'
                : 'View context'}{' '}
              ·{' '}
              {new Date(item.updatedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  if (pattern === 'todo')
    return (
      <View style={s.listRow}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={`Mark complete: ${item.title}`}
          accessibilityState={{
            checked: item.state === 'completed',
            disabled: !['pending', 'waiting', 'ready'].includes(item.state),
          }}
          disabled={!['pending', 'waiting', 'ready'].includes(item.state)}
          onPress={() => onComplete(item)}
          style={s.checkTarget}
        >
          <View style={s.checkbox} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Intent ${item.title}`}
          onPress={() => onOpen(item)}
          style={s.flex}
        >
          <Text style={s.listTitle}>{item.title}</Text>
          <Text style={s.meta}>{item.summary}</Text>
        </Pressable>
        <Text style={[s.meta, s.dueLabel]}>{item.dateText || 'Open'}</Text>
      </View>
    );
  if (pattern === 'question')
    return (
      <View style={s.realQuestion}>
        <Text style={s.meta}>NEEDS YOUR INPUT</Text>
        <Text style={s.title}>{item.title}</Text>
        <Text style={s.body}>{item.questions[0] || item.summary}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Review ${item.title}`}
          onPress={() => onOpen(item)}
          style={s.button}
        >
          <Text style={s.action}>Review & respond →</Text>
        </Pressable>
      </View>
    );
  return <IntentUpdateCard {...props} />;
}
