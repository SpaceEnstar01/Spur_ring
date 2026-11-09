import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Linking } from 'react-native';
import { RealAppConnections } from '../src/components/RealAppConnections';
import {
  readAppConnections,
  startAppConnection,
} from '../src/services/appConnections';
jest.mock('../src/services/appConnections', () => ({
  readAppConnections: jest.fn(),
  startAppConnection: jest.fn(),
  disconnectApp: jest.fn(),
}));
jest.mock('../src/components/IntegrationIcon', () => ({
  IntegrationIcon: () => null,
}));
let renderer: TestRenderer.ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  (readAppConnections as jest.Mock).mockResolvedValue({
    connections: [
      {
        provider: 'youtube',
        state: 'disconnected',
        configured: true,
        label: '',
      },
      {
        provider: 'notion',
        state: 'disconnected',
        configured: false,
        label: '',
      },
    ],
  });
});
afterEach(() => {
  if (renderer) act(() => renderer.unmount());
});
async function mount() {
  await act(async () => {
    renderer = TestRenderer.create(<RealAppConnections />);
  });
}
function button(label: string) {
  return renderer.root.findAll(
    n =>
      n.props.accessibilityLabel === label &&
      typeof n.props.onPress === 'function',
  )[0];
}

test('loads actual state, keeps unconnected provider disconnected and disables missing OAuth configuration', async () => {
  await mount();
  expect(readAppConnections).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(renderer.toJSON())).not.toContain('已连接');
  await act(async () => button('Notion 未连接').props.onPress());
  expect(JSON.stringify(renderer.toJSON())).toContain('管理员尚未配置');
  const connect = button('授权连接 Notion');
  expect(connect.props.disabled).toBe(true);
  expect(startAppConnection).not.toHaveBeenCalled();
});
test('opens only provider official URL after an explicit connect tap, without assuming completion', async () => {
  (startAppConnection as jest.Mock).mockResolvedValue({
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=test',
  });
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await mount();
  expect(open).not.toHaveBeenCalled();
  await act(async () => button('YouTube 未连接').props.onPress());
  const connect = button('授权连接 YouTube');
  await act(async () => connect.props.onPress());
  expect(open).toHaveBeenCalledWith(
    'https://accounts.google.com/o/oauth2/v2/auth?state=test',
  );
  expect(JSON.stringify(renderer.toJSON())).not.toContain('已连接');
});
test('failed status check never displays cached connected badges', async () => {
  (readAppConnections as jest.Mock).mockRejectedValue(new Error('网络不可用'));
  await mount();
  expect(JSON.stringify(renderer.toJSON())).toContain('网络不可用');
  expect(JSON.stringify(renderer.toJSON())).not.toContain('已连接');
});
