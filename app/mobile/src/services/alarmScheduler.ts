import { DeviceEventEmitter } from 'react-native';

import { YanqiangVoiceNative } from '@/native/YanqiangVoiceNative';
import {
  getLocalAgentCard,
  saveAgentCard,
  type LocalAgentCard
} from '@/services/localAgentCards';

export const ALARM_CARD_EVENT = 'spur.agentAlarmCard';

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function armPhoneAlarm(card: LocalAgentCard) {
  if (!card.alarm || card.alarm.status !== 'armed') return;
  cancelPhoneAlarm(card.id);

  const delay = card.alarm.fireAt - Date.now();
  if (delay <= 0) {
    void firePhoneAlarm(card.id);
    return;
  }

  const handle = setTimeout(() => {
    timers.delete(card.id);
    void firePhoneAlarm(card.id);
  }, delay);
  timers.set(card.id, handle);
}

export function cancelPhoneAlarm(cardId: string) {
  const handle = timers.get(cardId);
  if (handle) {
    clearTimeout(handle);
    timers.delete(cardId);
  }
}

export function rearmFutureAlarms(cards: LocalAgentCard[]) {
  for (const card of cards) {
    if (card.alarm?.status === 'armed' && card.alarm.fireAt > Date.now()) {
      armPhoneAlarm(card);
    } else if (card.alarm?.status === 'armed' && card.alarm.fireAt <= Date.now()) {
      void firePhoneAlarm(card.id);
    }
  }
}

async function firePhoneAlarm(cardId: string) {
  const card = await getLocalAgentCard(cardId);
  if (!card?.alarm || card.alarm.status !== 'armed') return;

  const buzzTimes = card.alarm.buzzTimes || 20;
  try {
    if (!YanqiangVoiceNative.isAvailable) {
      throw new Error('YanqiangVoiceModule unavailable');
    }
    await YanqiangVoiceNative.sendVibrationWithType(1, buzzTimes);
    const updated: LocalAgentCard = {
      ...card,
      alarm: {
        ...card.alarm,
        status: 'fired',
        firedAt: Date.now(),
        error: undefined
      },
      summary: `${card.alarm.label} · 已震动 ${buzzTimes} 次`,
      updatedAt: Date.now()
    };
    await saveAgentCard(updated);
    DeviceEventEmitter.emit(ALARM_CARD_EVENT, updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const updated: LocalAgentCard = {
      ...card,
      alarm: {
        ...card.alarm,
        status: 'failed',
        firedAt: Date.now(),
        error: message
      },
      summary: `${card.alarm.label} · 震动失败`,
      updatedAt: Date.now()
    };
    await saveAgentCard(updated);
    DeviceEventEmitter.emit(ALARM_CARD_EVENT, updated);
  }
}
