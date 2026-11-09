import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { deviceDisplayName } from '../src/ring/deviceDisplayName';
import { RingSearchScreen } from '../src/screens/RingSearchScreen';
import { useRingStore } from '../src/ring/store/useRingStore';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));
jest.mock('../src/ring/RingConnectionService', () => ({
  ringConnectionService: {
    scan: jest.fn().mockResolvedValue(undefined),
    stopScan: jest.fn(),
  },
}));

test('device labels use an uppercase four-character suffix, not the broadcast name', () => {
  expect(deviceDisplayName({ id: 'D0:9F:D9:DC:F4:C0' })).toBe(
    'Spur Ring · …F4C0',
  );
  expect(deviceDisplayName({ id: 'd0-9f-d9-dc-f4-c0' })).toBe(
    'Spur Ring · …F4C0',
  );
  expect(
    deviceDisplayName({ id: '13AB9F77-1952-4F1B-899A-ABCD1234F4C0' }),
  ).toBe('Spur Ring · …F4C0');
  expect(deviceDisplayName(null)).toBe('Spur Ring');
  expect(deviceDisplayName({ id: ' ' })).toBe('Spur Ring');
});

test('AIZO scan result is branded without changing the actual pairing target', async () => {
  const device = { id: 'D0:9F:D9:DC:F4:C0', name: 'AIZO RING', rssi: -51 };
  useRingStore.setState({ devices: [device], status: 'idle' });
  const navigation = { replace: jest.fn() };
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    await act(() => {
      renderer = TestRenderer.create(
        <RingSearchScreen
          navigation={navigation as never}
          route={{ key: 'scan', name: 'RingSearch' }}
        />,
      );
    });
    const tree = renderer.root
      .findAll(node => typeof node.props.children === 'string')
      .map(node => node.props.children)
      .join('\n');
    expect(tree).toContain('Spur Ring · …F4C0');
    expect(tree).not.toContain('AIZO RING');
    const row = renderer.root.findAll(
      node => node.props.accessibilityLabel === '连接 Spur Ring · …F4C0',
    )[0];
    await act(() => row.props.onPress());
    expect(navigation.replace).toHaveBeenCalledWith('PairingResult', {
      device,
    });
    expect(useRingStore.getState().devices[0]).toEqual(device);
  } finally {
    await act(() => renderer?.unmount());
    useRingStore.setState({ devices: [] });
  }
});
