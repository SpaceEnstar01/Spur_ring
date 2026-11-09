import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import { vendorEvents, vendorModule } from './native';
import { useRingStore } from './store/useRingStore';
import { useRecordingStore } from './store/useRecordingStore';
import type { RingDevice, RingRecording } from './types';
import { recordingKey } from './recordingIdentity';

const LAST_DEVICE = 'supr-last-ring';
class RingConnectionService {
  private ready?: Promise<void>;
  private scanTimer?: ReturnType<typeof setTimeout>;
  private subscriptions: Array<{ remove(): void }> = [];
  private pending?: { id: string; resolve(): void; reject(error: Error): void };
  private connectTimer?: ReturnType<typeof setTimeout>;
  private syncing = false;
  private activeSyncEpoch?: number;
  private initialized = false;
  private scanGeneration = 0;
  private authenticated = false;
  private foreground = false;
  private autoSyncTimer?: ReturnType<typeof setTimeout>;
  private autoSyncPending = false;
  private recordingObserved = false;
  private readySignalHandled = false;
  private deviceEpoch = 0;
  private liveRecordingStartedAt?: number;
  private completedRecordingAt?: number;

  private clearAutoSyncTimer() {
    if (this.autoSyncTimer) clearTimeout(this.autoSyncTimer);
    this.autoSyncTimer = undefined;
  }

  private resetAutomaticSync() {
    this.clearAutoSyncTimer();
    this.deviceEpoch += 1;
    this.authenticated = false;
    this.autoSyncPending = false;
    this.recordingObserved = false;
    this.readySignalHandled = false;
    this.liveRecordingStartedAt = undefined;
    this.completedRecordingAt = undefined;
  }

  private requestAutomaticSync() {
    this.autoSyncPending = true;
    this.scheduleAutomaticSync();
  }

  private scheduleAutomaticSync() {
    if (
      this.autoSyncTimer ||
      !this.autoSyncPending ||
      !this.foreground ||
      !this.authenticated ||
      this.syncing ||
      useRingStore.getState().status !== 'connected'
    )
      return;
    const epoch = this.deviceEpoch;
    // Allow the ring to close its recording file and settle its working state.
    this.autoSyncTimer = setTimeout(() => {
      this.autoSyncTimer = undefined;
      if (
        epoch !== this.deviceEpoch ||
        !this.foreground ||
        !this.authenticated ||
        !this.autoSyncPending ||
        this.syncing ||
        useRingStore.getState().status !== 'connected'
      )
        return;
      this.syncRecordings().catch(() => {
        // One attempt per recording/connection/foreground entry, never an error loop.
        // syncRecordings stores a non-blocking home retry hint.
      });
    }, 1200);
  }

  private async permissions() {
    if (Platform.OS !== 'android') {
      return;
    }
    const names =
      Platform.Version >= 31
        ? [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    const result = await PermissionsAndroid.requestMultiple(names);
    if (
      names.some(name => result[name] !== PermissionsAndroid.RESULTS.GRANTED)
    ) {
      throw new Error('请在系统设置中允许蓝牙 / 附近设备权限后重试。');
    }
  }

  initialize() {
    if (!this.ready) {
      this.ready = this.setup().catch(error => {
        this.ready = undefined;
        throw error;
      });
    }
    return this.ready;
  }

  private async setup() {
    this.subscriptions.forEach(item => item.remove());
    this.subscriptions = [];
    const events = vendorEvents();
    this.foreground = AppState.currentState === 'active';
    this.subscriptions.push(
      AppState.addEventListener('change', state => {
        const wasForeground = this.foreground;
        this.foreground = state === 'active';
        if (!this.foreground) this.clearAutoSyncTimer();
        else if (!wasForeground && this.authenticated && !this.syncing)
          this.requestAutomaticSync();
      }),
      events.addListener('yanqiangVoiceScanEvent', event => {
        if (event.type === 'device' && event.macAddress) {
          useRingStore.getState().addDevice({
            id: event.macAddress,
            name: event.name || '录音戒指',
            rssi: event.rssi,
          });
        }
        if (event.type === 'end') {
          this.finishScan();
        }
      }),
      events.addListener('yanqiangVoiceConnectionChanged', event => {
        const store = useRingStore.getState();
        const expected = this.pending?.id ?? store.selectedDevice?.id;
        if (event.macAddress && expected && event.macAddress !== expected) {
          return;
        }
        if (event.status === 'connected') {
          // Auth/ready can be reported repeatedly. Do not reset a live transfer.
          if (this.authenticated) {
            this.settle();
            return;
          }
          this.authenticated = true;
          store.setStatus('connected');
          const device = store.selectedDevice;
          if (device) {
            AsyncStorage.setItem(LAST_DEVICE, JSON.stringify(device)).catch(
              () => {},
            );
          }
          this.settle();
          this.requestAutomaticSync();
        } else if (event.status === 'connecting') {
          if (!this.authenticated) store.setStatus('authenticating');
        } else {
          this.resetAutomaticSync();
          store.setStatus(event.status === 'error' ? 'failed' : 'disconnected');
          const error = new Error(event.message || '戒指已断开连接，请重试。');
          if (event.status === 'error') {
            store.setError(error.message);
          }
          this.settle(error);
        }
      }),
      events.addListener('yanqiangVoiceStatusUpdate', event => {
        const store = useRingStore.getState();
        if (
          !this.authenticated ||
          !['connected', 'recording', 'syncing'].includes(store.status)
        ) {
          return;
        }
        if (event.status === 'recording' || event.status === 'paused') {
          this.liveRecordingStartedAt ??= Date.now();
          this.recordingObserved = true;
          this.readySignalHandled = false;
          this.clearAutoSyncTimer();
          store.setStatus('recording');
        } else if (event.status === 'syncing') {
          store.setStatus('syncing');
        } else if (
          event.status === 'idle' ||
          event.status === 'ready_to_sync'
        ) {
          // Keep the busy status until both BLE transfer and native conversion finish.
          store.setStatus(this.syncing ? 'syncing' : 'connected');
          if (
            this.recordingObserved ||
            (event.status === 'ready_to_sync' && !this.readySignalHandled)
          ) {
            this.recordingObserved = false;
            this.completedRecordingAt = this.liveRecordingStartedAt;
            this.liveRecordingStartedAt = undefined;
            this.readySignalHandled = true;
            this.requestAutomaticSync();
          } else this.scheduleAutomaticSync();
        }
      }),
      events.addListener('yanqiangVoiceFileReady', (file: RingRecording) => {
        if (
          this.authenticated &&
          this.syncing &&
          this.activeSyncEpoch === this.deviceEpoch &&
          file.uri
        ) {
          useRecordingStore.getState().merge([file]);
        }
      }),
      events.addListener('yanqiangVoiceSyncProgress', event => {
        if (!this.syncing || this.activeSyncEpoch !== this.deviceEpoch) return;
        useRingStore
          .getState()
          .setSyncProgress(
            Math.max(0, Math.min(100, Number(event.progress) || 0)),
          );
      }),
      events.addListener('yanqiangVoiceError', event => {
        const error = new Error(event.message || '戒指通信异常');
        useRingStore.getState().setError(error.message);
        useRingStore.getState().setStatus('failed');
        this.settle(error);
      }),
    );
    await vendorModule().initSdk();
    this.initialized = true;
  }

  async scan() {
    this.stopScan();
    const generation = this.scanGeneration;
    await this.permissions();
    await this.initialize();
    if (generation !== this.scanGeneration) {
      return;
    }
    useRingStore.getState().clearDevices();
    useRingStore.getState().setError(null);
    useRingStore.getState().setStatus('scanning');
    try {
      await vendorModule().startScan();
      if (generation !== this.scanGeneration) {
        vendorModule().stopScan();
        return;
      }
      this.scanTimer = setTimeout(() => this.stopScan(), 12000);
    } catch (error) {
      this.finishScan();
      throw error;
    }
  }

  private finishScan() {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
    }
    if (useRingStore.getState().status === 'scanning') {
      useRingStore.getState().setStatus('idle');
    }
  }

  stopScan() {
    this.scanGeneration += 1;
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
    }
    if (this.initialized) {
      vendorModule().stopScan();
    }
    this.finishScan();
  }

  async connect(device: RingDevice) {
    await this.permissions();
    await this.initialize();
    this.stopScan();
    if (this.pending) {
      throw new Error('正在连接，请稍候。');
    }
    this.resetAutomaticSync();
    useRingStore.getState().selectDevice(device);
    useRingStore.getState().setError(null);
    useRingStore.getState().setSyncError(null);
    useRingStore.getState().setStatus('connecting');
    return new Promise<void>((resolve, reject) => {
      this.pending = { id: device.id, resolve, reject };
      this.connectTimer = setTimeout(() => {
        useRingStore.getState().setStatus('failed');
        this.settle(new Error('连接超时，请确认戒指已激活且未连接其他手机。'));
        vendorModule()
          .disconnect()
          .catch(() => {});
      }, 30000);
      // Native connect resolves after dispatch; authenticated event means success.
      vendorModule()
        .connect(device.id)
        .catch(error => {
          useRingStore.getState().setStatus('failed');
          this.settle(error);
        });
    });
  }

  private settle(error?: Error) {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
    }
    const pending = this.pending;
    this.pending = undefined;
    if (error) {
      pending?.reject(error);
    } else {
      pending?.resolve();
    }
  }

  async disconnect() {
    this.resetAutomaticSync();
    this.settle(new Error('已取消连接'));
    await vendorModule().disconnect();
    useRingStore.getState().setStatus('disconnected');
  }

  async forget() {
    await this.disconnect();
    useRingStore.getState().selectDevice(null);
    await AsyncStorage.removeItem(LAST_DEVICE);
  }

  async reconnectLast() {
    const raw = await AsyncStorage.getItem(LAST_DEVICE);
    if (raw && useRingStore.getState().status === 'idle') {
      const device: RingDevice = JSON.parse(raw);
      await this.connect(device);
    }
  }

  async syncRecordings() {
    if (this.syncing) {
      throw new Error('录音正在同步，请稍候。');
    }
    if (useRingStore.getState().status !== 'connected') {
      throw new Error('请先连接戒指，并结束当前录音。');
    }
    const epoch = this.deviceEpoch;
    const knownFiles = new Set(
      useRecordingStore.getState().files.map(file => recordingKey(file.uri)),
    );
    const commandRecordedAt = this.completedRecordingAt;
    this.completedRecordingAt = undefined;
    this.clearAutoSyncTimer();
    this.autoSyncPending = false;
    this.readySignalHandled = true;
    this.syncing = true;
    this.activeSyncEpoch = epoch;
    useRingStore.getState().setSyncError(null);
    useRingStore.getState().setSyncProgress(0);
    useRingStore.getState().setStatus('syncing');
    try {
      const result = await vendorModule().syncVoiceRecordings();
      if (epoch === this.deviceEpoch && this.authenticated) {
        useRecordingStore.getState().merge(result.files || []);
        const newFiles = useRecordingStore
          .getState()
          .files.filter(file => !knownFiles.has(recordingKey(file.uri)));
        // A single file from an observed live recording can safely inherit its start time.
        // Batch imports/offline recordings retain unknown provenance and require confirmation.
        if (
          newFiles.length === 1 &&
          commandRecordedAt &&
          Date.now() - commandRecordedAt < 10 * 60 * 1000
        ) {
          useRecordingStore
            .getState()
            .merge([{ ...newFiles[0], source: 'ring', commandRecordedAt }]);
        }
        useRingStore.getState().setSyncProgress(100);
      }
    } catch (error) {
      if (epoch === this.deviceEpoch)
        useRingStore.getState().setSyncError('录音同步未完成，请重试');
      throw error;
    } finally {
      this.syncing = false;
      this.activeSyncEpoch = undefined;
      if (
        epoch === this.deviceEpoch &&
        useRingStore.getState().status === 'syncing'
      ) {
        useRingStore.getState().setStatus('connected');
      }
      this.scheduleAutomaticSync();
    }
  }
}
export const ringConnectionService = new RingConnectionService();
