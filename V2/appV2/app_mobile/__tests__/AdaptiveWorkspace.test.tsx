import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import {
  WorkspaceExamples,
  TaskTransformation,
  exampleTaskId,
} from '../src/adaptive/WorkspaceExamples';
import { AdaptivePattern } from '../src/adaptive/Patterns';
import { patternKinds, presentationForTask } from '../src/adaptive/model';
import { workspaceExamples } from '../src/adaptive/examples';
import { parseEnvelope, initialState, IntentItem } from '../src/intent/model';
let renderer: TestRenderer.ReactTestRenderer;
async function mount(node: React.ReactElement) {
  await act(async () => {
    renderer = TestRenderer.create(node);
  });
}
async function press(label: string) {
  const button = renderer.root.findAll(
    n =>
      n.props.accessibilityLabel === label &&
      typeof n.props.onPress === 'function',
  )[0];
  if (!button) throw new Error(`Missing control: ${label}`);
  await act(async () => {
    button.props.onPress();
  });
}
const text = () => JSON.stringify(renderer.toJSON());
const example = (kind: string) =>
  workspaceExamples.find(entry => entry.kind === kind)!;
afterEach(async () => {
  await act(async () => renderer?.unmount());
});
test('all twenty patterns render on the homepage examples and can be collapsed', async () => {
  await mount(<WorkspaceExamples />);
  expect(workspaceExamples).toHaveLength(20);
  expect(workspaceExamples.map(e => e.kind)).toEqual([...patternKinds]);
  for (const kind of patternKinds)
    expect(
      renderer.root.findAll(
        n =>
          n.props.testID === `adaptive-${kind}` && typeof n.type === 'string',
      ),
    ).toHaveLength(1);
  await press('Hide examples');
  expect(text()).not.toContain('Travel beyond the postcard');
  await press('Show examples');
  await press('Today composition');
  expect(text()).toContain('Ready to send');
  expect(text()).not.toContain('A stronger opening.');
});
test('one task preserves identity and approval is separate from simulated execution', async () => {
  const network = jest.spyOn(globalThis, 'fetch');
  await mount(<TaskTransformation />);
  await press('Preview preparation');
  await press('Preview approval');
  await press('Allow email');
  expect(text()).toContain('Approved — awaiting execution');
  expect(text()).not.toContain('Email sent');
  await press('Simulate failed execution');
  expect(text()).toContain('Unable to send email');
  await press('Retry execution preview');
  await press('Simulate successful execution');
  expect(text()).toContain('Email sent');
  expect(text()).toContain('Simulated result');
  expect(
    renderer.root.findAll(
      n =>
        n.props.testID === `lifecycle-${exampleTaskId}` &&
        typeof n.type === 'string',
    ),
  ).toHaveLength(1);
  expect(network).not.toHaveBeenCalled();
  network.mockRestore();
});
test('inline decision can be answered and changed', async () => {
  await mount(<AdaptivePattern entry={example('question')} />);
  await press('Continue');
  expect(text()).toContain('Continuing tonight');
  await press('Change answer');
  await press('Tomorrow');
  expect(text()).toContain('Moved to tomorrow');
});
test('checklist supports completion independently of details', async () => {
  await mount(<AdaptivePattern entry={example('todo')} />);
  await press('Complete Confirm Paris video cover');
  expect(
    renderer.root.findAll(
      n =>
        n.props.accessibilityRole === 'checkbox' && typeof n.type === 'string',
    )[0].props.accessibilityState.checked,
  ).toBe(true);
  await press('Details for Confirm Paris video cover');
  expect(text()).toContain('Personal checklist');
});
test('analytical interaction exposes actual sample numbers', async () => {
  await mount(<AdaptivePattern entry={example('analytics')} />);
  await press('Mon 60000 views');
  expect(text()).toContain('60,000');
  await press('Explore insights');
  expect(text()).toContain('25%');
  expect(text()).toContain('Illustrative metrics');
});
test('email approval never claims a real send', async () => {
  await mount(<AdaptivePattern entry={example('approval')} />);
  await press('Approve');
  expect(text()).toContain('no email sent');
  await press('Edit');
  expect(
    renderer.root.findAllByProps({ accessibilityLabel: 'Edit email draft' })
      .length,
  ).toBeGreaterThan(0);
});
test('visual choices and revision toggles respond immediately', async () => {
  await mount(<AdaptivePattern entry={example('visual_decision')} />);
  await press('Choose Coastal light');
  expect(text()).toContain('Selected: ');
  await act(async () => renderer.unmount());
  await mount(<AdaptivePattern entry={example('comparison')} />);
  await press('Original');
  expect(text()).toContain('Today I’m going');
  await press('Spur’s revision');
  expect(text()).toContain('Everyone visits');
});
test('next action dismisses without starting execution', async () => {
  await mount(<AdaptivePattern entry={example('next_action')} />);
  await press('Not now');
  expect(text()).not.toContain('Create outline');
  await press('Restore suggestion');
  await press('Create outline');
  expect(text()).toContain('simulated task only');
});
test('real task selection is deterministic and state wins over appearance', () => {
  const intent = parseEnvelope(
    JSON.stringify({
      reply: 'Saved',
      intents: [
        {
          kind: 'idea',
          frame: 'idea',
          title: 'Idea',
          summary: 'A thought',
          sourceSpan: 'idea',
          confidence: 0.95,
        },
      ],
    }),
    'idea',
  ).intents[0];
  const item = { ...intent, state: initialState(intent) } as IntentItem;
  expect(presentationForTask(item)).toBe('notification');
  expect(presentationForTask({ ...item, state: 'working' })).toBe(
    'agent_execution',
  );
  expect(presentationForTask({ ...item, state: 'completed' })).toBe(
    'completion',
  );
});

test.each([
  ['notification', 'View script', 'OPENING'],
  ['research_report', 'View full report', 'The real cost of a day'],
  ['completion', 'View result', 'strongest direction'],
  ['completion_artifact', 'View script', 'SCENE 01'],
  [
    'generated_deliverable',
    'Preview presentation',
    'clearer channel direction',
  ],
])(
  '%s opens real sample content and can close it',
  async (kind, control, content) => {
    await mount(<AdaptivePattern entry={example(kind)} />);
    await press(control);
    expect(text()).toContain(content);
    await press('Close preview');
    expect(text()).not.toContain(content);
  },
);
test('recording transformation reveals source and individual extraction steps', async () => {
  await mount(<AdaptivePattern entry={example('recording')} />);
  await press('Expand recording transcript');
  await press('New content direction extracted');
  expect(text()).toContain('Local life, beyond');
});
test('execution steps advance only on explicit taps and can replay', async () => {
  await mount(<AdaptivePattern entry={example('agent_execution')} />);
  for (let i = 0; i < 3; i++) await press('Preview next stage');
  expect(text()).toContain('Three directions are ready');
  await press('Replay stages');
  expect(text()).toContain('Searching recent');
});
test('preference correction stays explicit and does not turn into permanent memory', async () => {
  await mount(<AdaptivePattern entry={example('memory_update')} />);
  expect(text()).toContain('INFERRED');
  await press('Correct it');
  const input = renderer.root.findAll(
    n =>
      n.props.accessibilityLabel === 'Correct preference' &&
      typeof n.props.onChangeText === 'function',
  )[0];
  await act(async () =>
    input.props.onChangeText('I prefer practical travel titles.'),
  );
  await press('Save preference');
  expect(text()).toContain('I prefer practical travel titles.');
  expect(text()).toContain('CONFIRMED IN THIS PREVIEW');
});
test('file refinement records request without claiming to modify an artifact', async () => {
  await mount(<AdaptivePattern entry={example('generated_deliverable')} />);
  await press('Refine');
  const input = renderer.root.findAll(
    n =>
      n.props.accessibilityLabel === 'Refinement request' &&
      typeof n.props.onChangeText === 'function',
  )[0];
  await act(async () => input.props.onChangeText('Focus on YouTube'));
  await press('Save refinement request');
  expect(text()).toContain('Focus on YouTube');
  expect(text()).toContain('no actual file was modified');
});
test('important action can be denied or allowed without sending anything', async () => {
  await mount(<AdaptivePattern entry={example('action_approval')} />);
  await press('Deny');
  expect(text()).toContain('Action declined');
  await press('Reset approval');
  await press('Allow');
  expect(text()).toContain('not sent');
});
test('schedule details and title selection are interactive', async () => {
  await mount(<AdaptivePattern entry={example('schedule')} />);
  await press('10:30 Review video script');
  expect(text()).toContain('no calendar event was created');
  await act(async () => renderer.unmount());
  await mount(<AdaptivePattern entry={example('choice')} />);
  await press('Choose 48 Hours in Paris');
  expect(text()).toContain('Selected: ');
});

test('long report, approval and artifact content stays closed until the user opens it', async () => {
  await mount(<WorkspaceExamples />);
  expect(text()).not.toContain('SCENE 01');
  expect(text()).not.toContain('The real cost of a day\n');
  expect(text()).toContain('13 | ');
  expect(text()).toContain('20 | ');
  const deny = renderer.root.findAll(
    n =>
      n.props.accessibilityLabel === 'Deny' &&
      typeof n.props.onPress === 'function',
  )[0];
  expect(deny.props.style({ pressed: false }).flat()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ flex: 1, alignSelf: 'stretch' }),
    ]),
  );
});
