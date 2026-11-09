import { runCreatorAgentTask } from '../src/services/creatorAgentApi';
jest.mock('../src/services/creatorAgentApi', () => ({
  newCreatorAgentRequestId: () => 'request',
  runCreatorAgentTask: jest.fn(),
}));
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';
import {
  apiFetch,
  chat,
  getApiUrl,
  getDefaultApiUrl,
  normalizeApiUrl,
  PRODUCTION_API_URL,
  setApiUrl,
  testApiConnection,
} from '../src/services/chatApi';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios', Version: '26.6.2' },
  NativeModules: {
    SuprConfig: { developmentApiUrl: '' },
    SourceCode: { scriptURL: 'file:///main.jsbundle' },
  },
}));
const dev = globalThis as unknown as { __DEV__: boolean };
const originalDev = dev.__DEV__;
beforeEach(async () => {
  await AsyncStorage.clear();
  dev.__DEV__ = true;
  NativeModules.SuprConfig.developmentApiUrl = '';
  NativeModules.SourceCode.scriptURL = 'file:///main.jsbundle';
});
afterEach(() => {
  dev.__DEV__ = originalDev;
  jest.restoreAllMocks();
});

test('device Debug build uses explicit overrides and isolates old Java settings', async () => {
  NativeModules.SuprConfig.developmentApiUrl = 'http://192.168.1.10:8080';
  expect(await getApiUrl()).toBe('http://192.168.1.10:8080');
  await AsyncStorage.setItem('supr-api-url', 'https://old-java.example.com');
  expect(await getApiUrl()).toBe('http://192.168.1.10:8080');
  await setApiUrl('https://api.example.com/');
  expect(await getApiUrl()).toBe('https://api.example.com');
});
test('Metro host is fallback, while Release ignores local build and Metro settings', () => {
  NativeModules.SourceCode.scriptURL =
    'http://192.168.1.20:8088/index.bundle?platform=ios';
  expect(getDefaultApiUrl()).toBe(PRODUCTION_API_URL);
  NativeModules.SuprConfig.developmentApiUrl = 'http://192.168.1.10:8080';
  dev.__DEV__ = false;
  expect(getDefaultApiUrl()).toBe(PRODUCTION_API_URL);
});
test('Release migrates old local/HTTP settings but preserves explicit public HTTPS override', async () => {
  dev.__DEV__ = false;
  expect(await getApiUrl()).toBe('https://api.hispurring.com');
  for (const url of [
    'http://127.0.0.1:8080',
    'http://192.168.1.10:8080',
    'https://192.168.1.10:8080',
    'https://localhost',
    'http://api.example.com',
    'invalid',
  ]) {
    await AsyncStorage.setItem('spur-v2-audio-agent-api-url', url);
    expect(await getApiUrl()).toBe(PRODUCTION_API_URL);
    expect(
      await AsyncStorage.getItem('spur-v2-audio-agent-api-url'),
    ).toBeNull();
  }
  await setApiUrl('https://api.example.com/');
  expect(await getApiUrl()).toBe('https://api.example.com');
  await expect(setApiUrl('http://192.168.1.10:8080')).rejects.toThrow(
    '公网 HTTPS',
  );
});
test('Release network failure does not incorrectly demand the development Wi-Fi', async () => {
  dev.__DEV__ = false;
  jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new TypeError('Network request failed'));
  await expect(apiFetch('/api/chat', {})).rejects.toThrow(
    '请检查手机网络或稍后重试',
  );
});
test('URL input rejects unsafe protocols, credentials and query strings', () => {
  expect(normalizeApiUrl(' https://api.example.com/ ')).toBe(
    'https://api.example.com',
  );
  for (const url of [
    'ftp://example.com',
    'http://user:pass@example.com',
    'http://example.com?a=1',
    'http://bad host',
    'not-a-url',
  ]) {
    expect(() => normalizeApiUrl(url)).toThrow();
  }
});
test('network failure includes actionable address and keeps cancellation separate', async () => {
  const fetchMock = jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new TypeError('Network request failed'));
  await expect(apiFetch('/api/chat', {})).rejects.toThrow(
    '无法连接 Spur 服务（https://api.hispurring.com）',
  );
  const aborted = Object.assign(new Error('aborted'), { name: 'AbortError' });
  fetchMock.mockRejectedValue(aborted);
  await expect(apiFetch('/api/chat', {})).rejects.toBe(aborted);
});
test('health check uses candidate URL and rejects a different service', async () => {
  const controller = new AbortController();
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true, service: 'audio-agent' }),
  } as Response);
  await testApiConnection('http://192.168.1.10:8080', controller.signal);
  expect(fetchMock).toHaveBeenCalledWith(
    'http://192.168.1.10:8080/health',
    expect.objectContaining({ signal: controller.signal }),
  );
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ message: 'another service' }),
  } as Response);
  await expect(
    testApiConnection('http://192.168.1.10:8080', controller.signal),
  ).rejects.toThrow('不是可用的 Spur 服务');
});
test('chat keeps server validation and model errors visible', async () => {
  (runCreatorAgentTask as jest.Mock).mockRejectedValue(
    new Error('模型服务繁忙'),
  );
  await expect(
    chat([{ role: 'user', content: '你好' }], '', new AbortController().signal),
  ).rejects.toThrow('模型服务繁忙');
});
