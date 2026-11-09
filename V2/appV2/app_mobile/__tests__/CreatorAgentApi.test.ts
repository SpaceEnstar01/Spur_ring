import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';
import {
  getCreatorAgentToken,
  saveCreatorAgentToken,
  testCreatorAgentConnection,
} from '../src/services/creatorAgentApi';

const base = 'https://agent.example.com';
const token = 'abcdefghijklmnopqrstuvwxyzABCDEFG12345678_-';
let secureValues: Map<string, string>;

beforeEach(() => {
  secureValues = new Map();
  NativeModules.SpurIdentity = {
    read: jest.fn(async (scope: string) => secureValues.get(scope) || null),
    write: jest.fn(async (scope: string, value: string) => {
      secureValues.set(scope, value);
      return true;
    }),
  };
  jest.clearAllMocks();
});

test('stores Personal Agent bearer in native secure storage, scoped to its service URL', async () => {
  await saveCreatorAgentToken(base, token);

  expect(await getCreatorAgentToken(base)).toBe(token);
  expect(await getCreatorAgentToken('https://other.example.com')).toBe('');
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test('rejects malformed bearer values before storing them', async () => {
  await expect(saveCreatorAgentToken(base, 'not-a-token')).rejects.toThrow(
    '访问令牌格式无效',
  );
  expect(NativeModules.SpurIdentity.write).not.toHaveBeenCalled();
});

test('connection check sends the secure bearer and requires a ready Agent', async () => {
  await saveCreatorAgentToken(base, token);
  global.fetch = jest.fn(async (_url, options) => {
    const headers = options?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${token}`);
    return {
      ok: true,
      status: 200,
      json: async () => ({ status: 'ready' }),
    } as Response;
  });

  await expect(
    testCreatorAgentConnection(base, new AbortController().signal),
  ).resolves.toBeUndefined();
});

test('enrolls one connection identity concurrently and stores it only in secure storage', async () => {
  const {
    getConnectionCredential,
  } = require('../src/services/creatorAgentApi');
  const credential = 'c'.repeat(43);
  global.fetch = jest.fn(
    async () => ({ ok: true, json: async () => ({ credential }) } as Response),
  );
  const result = await Promise.all([
    getConnectionCredential(base, token),
    getConnectionCredential(base, token),
  ]);
  expect(result).toEqual([credential, credential]);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(await getConnectionCredential(base, token)).toBe(credential);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test('an old server cannot silently fall back to developer grants', async () => {
  const {
    getConnectionCredential,
  } = require('../src/services/creatorAgentApi');
  global.fetch = jest.fn(
    async () =>
      ({
        ok: false,
        status: 404,
        json: async () => ({ error: 'not found' }),
      } as Response),
  );
  await expect(getConnectionCredential(base, token)).rejects.toThrow(
    '云端已更新',
  );
  expect(NativeModules.SpurIdentity.write).not.toHaveBeenCalled();
});
