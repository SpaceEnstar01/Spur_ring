import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { PartnershipDemo } from '../src/components/PartnershipDemo';
let renderer: TestRenderer.ReactTestRenderer;
function label(text: string) {
  return renderer.root.findAll(
    n => n.props.accessibilityLabel === text && typeof n.type !== 'string',
  )[0];
}
function press(text: string) {
  const found = renderer.root
    .findAll(
      n => n.props.accessibilityRole === 'button' && typeof n.type !== 'string',
    )
    .find(
      n =>
        n.findAll(c => typeof c.type === 'string' && c.props.children === text)
          .length,
    );
  if (!found) throw new Error(`Missing ${text}`);
  found.props.onPress();
}
beforeEach(async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await act(() => {
    renderer = TestRenderer.create(<PartnershipDemo />);
  });
  await act(() => label('Review brand partnership workflow').props.onPress());
});
afterEach(async () => {
  await act(() => renderer.unmount());
  jest.restoreAllMocks();
});
test('commercial overview exposes fictional sources and distinguishes fit from interest', () => {
  const tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain('Reference scenario');
  expect(tree).toContain('No audience size');
  expect(tree).toContain('Northline Audio');
  expect(tree).toContain('match is not evidence of brand interest');
});
test('outreach approval only changes demo state after confirmation', async () => {
  await act(() => label('Review Luma Gear opportunity').props.onPress());
  await act(() => press('Review Outreach Step'));
  expect(JSON.stringify(renderer.toJSON())).toContain('Draft ready');
  const [, text, actions] = (Alert.alert as jest.Mock).mock.calls[0];
  expect(text).toContain('No email is sent');
  await act(() =>
    actions
      .find((a: { text: string }) => a.text === 'Continue Workflow')
      .onPress(),
  );
  expect(JSON.stringify(renderer.toJSON())).toContain('Awaiting reply');
  expect(JSON.stringify(renderer.toJSON())).toContain('No email sent');
});
test('interested reply leads to creator follow-up without an invented deal or quote', async () => {
  await act(() => label('Review Northline Audio opportunity').props.onPress());
  const tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain('Creator: confirm willingness');
  expect(tree).toContain('fictional source example');
  await act(() => press('Mark for My Follow-up'));
  expect(JSON.stringify(renderer.toJSON())).toContain(
    'Marked for your follow-up',
  );
});
