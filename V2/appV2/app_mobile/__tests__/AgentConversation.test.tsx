import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AgentConversation } from '../src/components/AgentConversation';
import { ConversationExample } from '../src/components/ConversationExample';
import { conversationExamples } from '../src/agent/conversationExamples';
import { answerChoices, interactionFor } from '../src/intent/interaction';
import { legacyPresentation } from '../src/intent/legacyPresentation';
import type { IntentItem } from '../src/intent/model';
const base: IntentItem = legacyPresentation({
  id: 'one',
  title: 'Prepare a shoot',
  text: 'Prepare a shoot',
  time: 1,
  file: {
    uri: 'file:///one',
    name: 'one',
    timestamp: 1,
    size: 1,
    aiReply: 'A prepared report',
    aiReplyState: 'done',
  },
});
let renderer: TestRenderer.ReactTestRenderer;
afterEach(async () => {
  await act(() => renderer?.unmount());
});
function press(text: string) {
  const target = renderer.root
    .findAll(
      node =>
        typeof node.type !== 'string' &&
        node.props.accessibilityRole === 'button',
    )
    .find(
      node =>
        node.findAll(
          child =>
            typeof child.type === 'string' && child.props.children === text,
        ).length,
    );
  if (!target) throw new Error(`Missing ${text}`);
  target.props.onPress();
}
test('workflow changes choose conversations without converting semantic types or inventing outcomes', () => {
  expect(interactionFor({ ...base, kind: 'idea', frame: 'idea' })).toBe(
    'thought',
  );
  expect(
    interactionFor({
      ...base,
      frame: 'email',
      questions: ['Who should receive it?'],
    }),
  ).toBe('question');
  expect(interactionFor({ ...base, frame: 'reminder', dueAt: undefined })).toBe(
    'confirm',
  );
  expect(
    interactionFor({ ...base, frame: 'reminder', dueAt: Date.now() }),
  ).toBe('delivery');
  expect(
    interactionFor({ ...base, state: 'paused', questions: ['Who?'] }),
  ).toBe('paused');
  expect(
    interactionFor({ ...base, state: 'completed', questions: ['Who?'] }),
  ).toBe('delivery');
  expect(
    interactionFor({ ...base, checklist: ['Charge camera'], sections: [] }),
  ).toBe('checklist');
});
test('answer routes to the selected item; later only requests pause and never sends a message', async () => {
  const item = {
    ...base,
    frame: 'email' as const,
    questions: ['Who receives the draft?'],
  };
  const snapshot = JSON.stringify(item),
    onRespond = jest.fn(),
    onOpen = jest.fn(),
    onPause = jest.fn();
  await act(() => {
    renderer = TestRenderer.create(
      <AgentConversation
        item={item}
        onOpen={onOpen}
        onRespond={onRespond}
        onPause={onPause}
      />,
    );
  });
  await act(() => press('Answer this'));
  expect(onRespond).toHaveBeenCalledWith(
    item,
    expect.stringContaining(item.questions[0]),
  );
  expect(onOpen).not.toHaveBeenCalled();
  await act(() => press('Later'));
  expect(onPause).toHaveBeenCalledWith(item);
  expect(JSON.stringify(item)).toBe(snapshot);
});
test('a thought offers no unsolicited task or confirmation actions', async () => {
  await act(() => {
    renderer = TestRenderer.create(
      <AgentConversation
        item={{ ...base, kind: 'idea', frame: 'idea' }}
        onOpen={jest.fn()}
        onPause={jest.fn()}
      />,
    );
  });
  const output = JSON.stringify(renderer.toJSON());
  expect(output).toContain('No reminder');
  expect(output).not.toContain('Not now');
  expect(output).not.toContain('Answer this');
});
test('reference choices reveal a next step and can be changed locally', async () => {
  await act(() => {
    renderer = TestRenderer.create(
      <ConversationExample example={conversationExamples[0]} />,
    );
  });
  await act(() => press('Three practical tests'));
  expect(JSON.stringify(renderer.toJSON())).toContain(
    'same task on your phone',
  );
  await act(() => press('A day in real life'));
  expect(JSON.stringify(renderer.toJSON())).toContain('morning-to-evening');
  expect(JSON.stringify(renderer.toJSON())).not.toContain(
    'same task on your phone',
  );
});
test('preparation checkboxes toggle independently and do not complete real tasks', async () => {
  const example = conversationExamples.find(
    item => item.format === 'checklist',
  )!;
  await act(() => {
    renderer = TestRenderer.create(<ConversationExample example={example} />);
  });
  const checkboxes = () =>
    example.lines!.map(
      line =>
        renderer.root.findAll(
          node =>
            node.props.accessibilityLabel === line &&
            typeof node.props.onPress === 'function',
        )[0],
    );
  await act(() => checkboxes()[0].props.onPress());
  expect(checkboxes()[0].props.accessibilityState.checked).toBe(true);
  expect(checkboxes()[1].props.accessibilityState.checked).toBe(false);
  await act(() => checkboxes()[0].props.onPress());
  expect(checkboxes()[0].props.accessibilityState.checked).toBe(false);
});

test('answer suggestions do not invent recipients or extract user facts', () => {
  expect(answerChoices('Who is the audience?')).toEqual([
    'Brand partner',
    'My team',
    'Just for me',
  ]);
  expect(answerChoices('Who receives the draft?')).toEqual([]);
  expect(answerChoices('What is the filming location?')).toEqual([
    'Indoors',
    'Outdoors',
    'Both',
  ]);
});
