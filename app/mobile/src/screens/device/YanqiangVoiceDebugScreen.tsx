import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bluetooth, ChevronLeft, ChevronRight, Link2, Radio, Unlink } from 'lucide-react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppScreen } from '@/components/AppScreen';
import {
  YanqiangVoiceEventNames,
  YanqiangVoiceEvents,
  YanqiangVoiceNative
} from '@/native/YanqiangVoiceNative';
import {
  getRingUiSession,
  setRingUiConnection,
  setRingUiDevices,
  setRingUiInitialized,
  upsertRingUiDevice,
  type ConnectionState,
  type ScanDevice
} from '@/services/ringConnectionSession';
import { colors } from '@/theme/colors';
import { t } from '@/locales';
import type { RootStackParamList } from '@/types/navigation';
import { formatRingDisplayName } from '@/utils/ringDisplayName';

const PHONE_TIMER_DELAY_SEC = 30;
const PHONE_TIMER_BUZZ_TIMES = 5;

export function YanqiangVoiceDebugScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const cached = getRingUiSession();
  const [logs, setLogs] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(cached.initialized);
  const [initializing, setInitializing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<Record<string, ScanDevice>>(cached.devices);
  const [connectionState, setConnectionState] = useState<ConnectionState>(cached.connectionState);
  const [connectedMac, setConnectedMac] = useState<string | null>(cached.connectedMac);
  const [vibrationBusy, setVibrationBusy] = useState(false);
  const [alarmBusy, setAlarmBusy] = useState(false);
  const [phoneTimerBusy, setPhoneTimerBusy] = useState(false);
  const [phoneTimerRemainSec, setPhoneTimerRemainSec] = useState<number | null>(null);
  const phoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPhoneTimer = useCallback(() => {
    if (phoneTimerRef.current) {
      clearTimeout(phoneTimerRef.current);
      phoneTimerRef.current = null;
    }
    if (phoneCountdownRef.current) {
      clearInterval(phoneCountdownRef.current);
      phoneCountdownRef.current = null;
    }
    setPhoneTimerRemainSec(null);
    setPhoneTimerBusy(false);
  }, []);

  useEffect(() => () => clearPhoneTimer(), [clearPhoneTimer]);

  const pushLog = useCallback((text: string) => {
    console.log('[YanqiangVoiceDebug]', text);
    setLogs((prev) => [`${new Date().toLocaleTimeString()} ${text}`, ...prev].slice(0, 60));
  }, []);

  useFocusEffect(
    useCallback(() => {
      const session = getRingUiSession();
      setInitialized(session.initialized);
      setDevices(session.devices);
      setConnectionState(session.connectionState);
      setConnectedMac(session.connectedMac);
      if (session.connectionState === 'connected' && session.connectedMac) {
        pushLog(`ui-restore: connected ${session.connectedMac}`);
      }
    }, [pushLog])
  );

  useEffect(() => {
    pushLog(
      `boot: platform=${Platform.OS} module=${YanqiangVoiceNative.isAvailable ? 'YES' : 'NO'}`
    );
    if (!YanqiangVoiceEvents) return;

    const subscriptions = [
      YanqiangVoiceEvents.addListener(YanqiangVoiceEventNames.scan, (event) => {
        if (event?.type === 'start') {
          setScanning(true);
          pushLog('scan: started');
          return;
        }
        if (event?.type === 'end') {
          setScanning(false);
          pushLog('scan: ended');
          return;
        }
        if (event?.type === 'device' && event.macAddress) {
          const device: ScanDevice = {
            name: event.name || t.device.unnamed,
            macAddress: event.macAddress,
            address: event.address
          };
          upsertRingUiDevice(device);
          setDevices((current) => {
            const next = { ...current, [device.macAddress]: device };
            setRingUiDevices(next);
            return next;
          });
          pushLog(`scan: found ${device.name} ${device.macAddress}`);
        }
      }),
      YanqiangVoiceEvents.addListener(YanqiangVoiceEventNames.connection, (event) => {
        const status = (event?.status as ConnectionState) || 'error';
        setConnectionState(status);
        if (status === 'connected') {
          const mac = event.macAddress || null;
          setConnectedMac(mac);
          setRingUiConnection('connected', mac);
          if (mac) {
            upsertRingUiDevice({
              macAddress: mac,
              name: event.name || t.device.unnamed,
              address: mac
            });
            setDevices(getRingUiSession().devices);
          }
        } else if (status === 'disconnected') {
          setConnectedMac(null);
          setRingUiConnection('disconnected', null);
        } else {
          setRingUiConnection(status);
        }
        pushLog(`connection: ${JSON.stringify(event)}`);
      }),
      YanqiangVoiceEvents.addListener(YanqiangVoiceEventNames.status, (event) =>
        pushLog(`status: ${JSON.stringify(event)}`)
      ),
      YanqiangVoiceEvents.addListener(YanqiangVoiceEventNames.error, (event) =>
        pushLog(`error: ${JSON.stringify(event)}`)
      )
    ];

    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [pushLog]);

  useEffect(() => {
    if (initialized || initializing) return;
    void initialize();
    // Auto-prepare Bluetooth once; scan still waits for user tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function requestBluetoothPermissions() {
    if (Platform.OS !== 'android') return true;
    if (Number(Platform.Version) >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      ]);
      return (
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
      );
    }
    return (
      (await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)) ===
      PermissionsAndroid.RESULTS.GRANTED
    );
  }

  async function initialize() {
    setInitializing(true);
    try {
      await YanqiangVoiceNative.initSdk();
      setInitialized(true);
      setRingUiInitialized(true);
      pushLog('initSdk: success');
      return true;
    } catch (error) {
      pushLog(`initSdk: FAILED ${errorMessage(error)}`);
      return false;
    } finally {
      setInitializing(false);
    }
  }

  async function startScan() {
    try {
      const granted = await requestBluetoothPermissions();
      if (!granted) throw new Error(t.device.permissionDenied);
      if (!initialized) {
        const ok = await initialize();
        if (!ok) throw new Error(t.device.initRequired);
      }
      // Keep the currently connected device visible; only clear other scan results.
      setDevices((current) => {
        const kept =
          connectionState === 'connected' && connectedMac && current[connectedMac]
            ? { [connectedMac]: current[connectedMac] }
            : {};
        setRingUiDevices(kept);
        return kept;
      });
      setScanning(true);
      await YanqiangVoiceNative.startScan();
      setInitialized(true);
      setRingUiInitialized(true);
      pushLog('startScan: accepted');
    } catch (error) {
      setScanning(false);
      const message = errorMessage(error);
      pushLog(`startScan: FAILED ${message}`);
      if (/Bluetooth is turned off|BT_NOT_READY|scanner not ready/i.test(message)) {
        Alert.alert(t.device.bluetoothOffTitle, t.device.bluetoothOffMessage);
      }
    }
  }

  function stopScan() {
    YanqiangVoiceNative.stopScan();
    setScanning(false);
    pushLog('stopScan: requested');
  }

  async function connect(device: ScanDevice) {
    try {
      if (scanning) stopScan();
      setConnectionState('connecting');
      setConnectedMac(device.macAddress);
      setRingUiConnection('connecting', device.macAddress);
      upsertRingUiDevice(device);
      pushLog(`connect: requesting ${device.macAddress}`);
      await YanqiangVoiceNative.connect(device.macAddress);
    } catch (error) {
      setConnectionState('error');
      setRingUiConnection('error', device.macAddress);
      pushLog(`connect: FAILED ${errorMessage(error)}`);
    }
  }

  async function disconnect() {
    try {
      const ok = await YanqiangVoiceNative.disconnect();
      pushLog(`disconnect: result=${String(ok)}`);
      if (ok) {
        setConnectionState('disconnected');
        setConnectedMac(null);
        setRingUiConnection('disconnected', null);
      }
    } catch (error) {
      pushLog(`disconnect: FAILED ${errorMessage(error)}`);
    }
  }

  async function testVibration() {
    setVibrationBusy(true);
    try {
      // type 1 = SystemEvent；立刻连震 10 下
      const result = await YanqiangVoiceNative.sendVibrationWithType(1, 10);
      pushLog(`vibration: ok type=${result.type} times=${result.times ?? 10} mode=${result.mode ?? 'config'}`);
      Alert.alert(t.device.vibrationTest, t.device.vibrationTestOk);
    } catch (error) {
      const message = errorMessage(error);
      pushLog(`vibration: FAILED ${message}`);
      Alert.alert(t.device.vibrationTest, message);
    } finally {
      setVibrationBusy(false);
    }
  }

  async function schedulePhoneTimerVibrate() {
    if (phoneTimerBusy) {
      clearPhoneTimer();
      pushLog('phone-timer: cancelled');
      return;
    }
    if (connectionState !== 'connected') {
      Alert.alert(t.device.phoneTimerVibrate, t.device.phoneTimerNeedConnected);
      return;
    }

    clearPhoneTimer();
    setPhoneTimerBusy(true);
    setPhoneTimerRemainSec(PHONE_TIMER_DELAY_SEC);
    const fireAt = new Date(Date.now() + PHONE_TIMER_DELAY_SEC * 1000);
    const fireLabel = fireAt.toLocaleTimeString();
    pushLog(
      `phone-timer: armed ${PHONE_TIMER_DELAY_SEC}s → buzz x${PHONE_TIMER_BUZZ_TIMES} at ${fireLabel} (phone clock)`
    );
    Alert.alert(
      t.device.phoneTimerVibrate,
      t.device.phoneTimerArmed
        .replace('{sec}', String(PHONE_TIMER_DELAY_SEC))
        .replace('{times}', String(PHONE_TIMER_BUZZ_TIMES))
        .replace('{time}', fireLabel)
    );

    phoneCountdownRef.current = setInterval(() => {
      setPhoneTimerRemainSec((prev) => {
        if (prev == null) return null;
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    phoneTimerRef.current = setTimeout(() => {
      void (async () => {
        if (phoneCountdownRef.current) {
          clearInterval(phoneCountdownRef.current);
          phoneCountdownRef.current = null;
        }
        setPhoneTimerRemainSec(0);
        pushLog(`phone-timer: fire — sending buzz x${PHONE_TIMER_BUZZ_TIMES}`);
        try {
          const result = await YanqiangVoiceNative.sendVibrationWithType(1, PHONE_TIMER_BUZZ_TIMES);
          pushLog(
            `phone-timer: vibration ok times=${result.times ?? PHONE_TIMER_BUZZ_TIMES} mode=${result.mode ?? 'sequential'}`
          );
          Alert.alert(t.device.phoneTimerVibrate, t.device.phoneTimerFired);
        } catch (error) {
          const message = errorMessage(error);
          pushLog(`phone-timer: vibration FAILED ${message}`);
          Alert.alert(t.device.phoneTimerVibrate, message);
        } finally {
          phoneTimerRef.current = null;
          setPhoneTimerBusy(false);
          setPhoneTimerRemainSec(null);
        }
      })();
    }, PHONE_TIMER_DELAY_SEC * 1000);
  }

  async function setOneMinuteAlarm() {
    setAlarmBusy(true);
    try {
      const result = await YanqiangVoiceNative.setOneMinuteAlarm();
      const hh = String(result.hour).padStart(2, '0');
      const mm = String(result.minute).padStart(2, '0');
      pushLog(`alarm: slot=${result.alarmID} at ${hh}:${mm}`);
      Alert.alert(t.device.oneMinuteAlarm, t.device.oneMinuteAlarmOk.replace('{time}', `${hh}:${mm}`));
    } catch (error) {
      const message = errorMessage(error);
      pushLog(`alarm: FAILED ${message}`);
      Alert.alert(t.device.oneMinuteAlarm, message);
    } finally {
      setAlarmBusy(false);
    }
  }

  const deviceList = Object.values(devices);
  const connectedDevice = connectedMac ? devices[connectedMac] : undefined;
  const connectedLabel = connectedMac
    ? formatRingDisplayName(connectedDevice?.name, connectedMac)
    : null;

  return (
    <AppScreen tone="plain" bottomInset={32}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <ChevronLeft color={colors.text} size={22} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.topTitle}>{t.device.title}</Text>
        <View style={styles.backButton} />
      </View>

      <Text style={styles.pageSubtitle}>{t.device.subtitle}</Text>

      <View style={styles.statusCard}>
        <View style={styles.statusIcon}>
          <Radio color={connectionState === 'connected' ? colors.success : colors.text} size={18} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.statusTitle}>{connectionLabel(connectionState)}</Text>
          <Text style={styles.statusText}>
            {initializing
              ? t.device.initializing
              : connectedLabel
                ? connectedLabel
                : t.device.tapToScan}
          </Text>
        </View>
      </View>

      <View style={styles.hintCard}>
        <Text style={styles.hintText}>{t.device.noHardwareHint}</Text>
      </View>

      <Pressable
        style={[styles.primaryButton, (scanning || initializing) && styles.primaryButtonActive]}
        disabled={initializing && !scanning}
        onPress={scanning ? stopScan : () => void startScan()}
      >
        <Bluetooth color="#fff" size={18} />
        <Text style={styles.primaryButtonText}>
          {scanning ? t.device.stopScan : t.device.scanDevices}
        </Text>
      </Pressable>

      {/* Store 1.0: ConnectLaptop / CloudOffice entries removed. Restore: docs/appstore/store/2026-09-12-*.md */}

      {connectionState === 'connected' && connectedMac ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.device.tools}</Text>
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('YanqiangRecordingDebug', { macAddress: connectedMac })}
          >
            <View style={styles.flex}>
              <Text style={styles.rowLabel}>{t.device.recordingDebug}</Text>
              <Text style={styles.rowHint}>{t.device.recordingDebugHint}</Text>
            </View>
            <ChevronRight color={colors.textTertiary} size={18} />
          </Pressable>
          <Pressable
            style={[styles.row, vibrationBusy && styles.disabled]}
            disabled={vibrationBusy}
            onPress={() => void testVibration()}
          >
            <View style={styles.flex}>
              <Text style={styles.rowLabel}>{t.device.vibrationTest}</Text>
              <Text style={styles.rowHint}>{t.device.vibrationTestHint}</Text>
            </View>
            <ChevronRight color={colors.textTertiary} size={18} />
          </Pressable>
          <Pressable
            style={[styles.row, phoneTimerBusy && styles.rowActive]}
            onPress={() => void schedulePhoneTimerVibrate()}
          >
            <View style={styles.flex}>
              <Text style={styles.rowLabel}>
                {phoneTimerBusy && phoneTimerRemainSec != null
                  ? t.device.phoneTimerCounting.replace('{sec}', String(phoneTimerRemainSec))
                  : t.device.phoneTimerVibrate}
              </Text>
              <Text style={styles.rowHint}>{t.device.phoneTimerVibrateHint}</Text>
            </View>
            <ChevronRight color={colors.textTertiary} size={18} />
          </Pressable>
          <Pressable
            style={[styles.row, alarmBusy && styles.disabled]}
            disabled={alarmBusy}
            onPress={() => void setOneMinuteAlarm()}
          >
            <View style={styles.flex}>
              <Text style={styles.rowLabel}>{t.device.oneMinuteAlarm}</Text>
              <Text style={styles.rowHint}>{t.device.oneMinuteAlarmHint}</Text>
            </View>
            <ChevronRight color={colors.textTertiary} size={18} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>{t.device.nearby}</Text>
        <Text style={styles.count}>{deviceList.length}</Text>
      </View>

      {deviceList.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{scanning ? t.device.waitingVendor : t.device.tapToScan}</Text>
        </View>
      ) : (
        deviceList.map((device) => {
          const isCurrent = connectedMac === device.macAddress;
          // iOS RingSDK may emit an automatic-reconnect "connecting" event before the user
          // selects a scanned device. Do not let that stale/global state disable every row.
          // A user-started attempt still disables its own row, while native iOS rejects duplicates.
          const connectDisabled =
            connectionState === 'connecting' && (Platform.OS !== 'ios' || isCurrent);
          const displayName = formatRingDisplayName(device.name, device.macAddress);
          return (
            <View key={device.macAddress} style={styles.deviceCard}>
              <View style={styles.deviceIcon}>
                <Bluetooth color={colors.text} size={18} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.deviceName}>{displayName}</Text>
              </View>
              {isCurrent && connectionState === 'connected' ? (
                <Pressable style={styles.disconnectButton} onPress={() => void disconnect()}>
                  <Unlink color={colors.danger} size={16} />
                  <Text style={styles.disconnectText}>{t.device.disconnect}</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.connectButton, connectDisabled && styles.disabled]}
                  disabled={connectDisabled}
                  onPress={() => void connect(device)}
                >
                  <Link2 color="#fff" size={15} />
                  <Text style={styles.connectText}>
                    {isCurrent && connectionState === 'connecting' ? t.device.connecting : t.device.connect}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })
      )}

      {__DEV__ ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.device.debugLogs}</Text>
          <View style={styles.logBox}>
            {logs.length === 0 ? (
              <Text style={styles.logEmpty}>{t.common.noLogs}</Text>
            ) : (
              logs.map((log, index) => (
                <Text key={`${index}-${log}`} style={styles.logLine}>
                  {log}
                </Text>
              ))
            )}
          </View>
        </View>
      ) : null}
    </AppScreen>
  );
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? error);
  }
  return error instanceof Error ? error.message : String(error);
}

function connectionLabel(state: ConnectionState) {
  if (state === 'connecting') return t.device.connecting;
  if (state === 'connected') return t.device.connected;
  if (state === 'error') return t.device.connectionError;
  return t.device.disconnected;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  topTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700'
  },
  pageSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: -8,
    marginBottom: 14
  },
  hintCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#f5f7f9',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12
  },
  hintText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12
  },
  statusIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f3f3',
    borderWidth: 1,
    borderColor: colors.border
  },
  statusTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800'
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 3
  },
  macText: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 4,
    fontFamily: Platform.select({ android: 'monospace', default: undefined })
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10
  },
  primaryButtonActive: {
    backgroundColor: '#333'
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800'
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 18
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700'
  },
  disabled: { opacity: 0.5 },
  section: {
    marginBottom: 16,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden'
  },
  sectionTitle: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    textTransform: 'uppercase'
  },
  row: {
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border
  },
  rowActive: {
    backgroundColor: '#f0f7ff'
  },
  rowLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700'
  },
  rowHint: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  listTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800'
  },
  count: {
    marginLeft: 8,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700'
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    marginBottom: 16
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 13,
    marginBottom: 9
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f3f3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  deviceName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800'
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.text,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  connectText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff1f1',
    borderRadius: 11,
    paddingHorizontal: 11,
    paddingVertical: 9
  },
  disconnectText: {
    color: colors.danger,
    fontWeight: '800',
    fontSize: 12
  },
  logBox: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 5,
    minHeight: 120
  },
  logEmpty: {
    color: colors.textTertiary,
    fontSize: 12
  },
  logLine: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Platform.select({ android: 'monospace', default: undefined })
  }
});
