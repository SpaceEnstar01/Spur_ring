/** Local phone-clock alarm parsing for Agent Flow (no ring RTC). */

export type AlarmSchedule = {
  fireAt: number;
  mode: 'relative' | 'absolute';
  label: string;
  status: 'armed' | 'fired' | 'missed' | 'failed';
  buzzTimes: number;
  error?: string;
  firedAt?: number;
};

const DEFAULT_BUZZ_TIMES = 20;

const ALARM_HINT =
  /震动|振动|闹铃|闹钟|提醒|vibrate|vibration|alarm|buzz|remind/i;

/**
 * Parse relative ("1分钟后震动") or absolute ("16:00震动") intents.
 * Returns null when the text is not a timer/alarm command.
 */
export function parseAlarmIntent(text: string, now = Date.now()): AlarmSchedule | null {
  const raw = (text || '').trim();
  if (!raw || !ALARM_HINT.test(raw)) return null;

  const relative = parseRelative(raw, now);
  if (relative) return relative;

  const absolute = parseAbsolute(raw, now);
  if (absolute) return absolute;

  return null;
}

export function formatAlarmCountdown(fireAt: number, now = Date.now()): string {
  const remain = Math.max(0, Math.ceil((fireAt - now) / 1000));
  const m = Math.floor(remain / 60);
  const s = remain % 60;
  if (m <= 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function parseRelative(text: string, now: number): AlarmSchedule | null {
  const normalized = text.replace(/\s+/g, '');

  if (/半分钟|半分钟后/.test(normalized)) {
    return makeRelative(30_000, now, '30秒后');
  }

  const sec =
    normalized.match(/(\d+)\s*秒(?:钟)?(?:后)?/) ||
    text.match(/in\s+(\d+)\s*(?:sec|secs|second|seconds)\b/i);
  if (sec) {
    const n = Number(sec[1]);
    if (n > 0 && n < 24 * 3600) return makeRelative(n * 1000, now, `${n}秒后`);
  }

  const min =
    normalized.match(/(\d+)\s*分(?:钟)?(?:后)?/) ||
    text.match(/in\s+(\d+)\s*(?:min|mins|minute|minutes)\b/i);
  if (min) {
    const n = Number(min[1]);
    if (n > 0 && n < 24 * 60) return makeRelative(n * 60_000, now, `${n}分钟后`);
  }

  const hour =
    normalized.match(/(\d+)\s*小时(?:后)?/) ||
    text.match(/in\s+(\d+)\s*(?:hour|hours|hr|hrs)\b/i);
  if (hour) {
    const n = Number(hour[1]);
    if (n > 0 && n <= 24) return makeRelative(n * 3_600_000, now, `${n}小时后`);
  }

  return null;
}

function parseAbsolute(text: string, now: number): AlarmSchedule | null {
  let hour: number | null = null;
  let minute = 0;

  const colon = text.match(/\b([01]?\d|2[0-3])[:：]([0-5]\d)\b/);
  if (colon) {
    hour = Number(colon[1]);
    minute = Number(colon[2]);
  } else {
    const cn = text.match(/(凌晨|早上|上午|中午|下午|晚上|今晚)?\s*([零〇一二两三四五六七八九十\d]{1,3})\s*点\s*([零〇一二两三四五六七八九十\d半]{0,3})\s*分?/);
    if (cn) {
      const parsedHour = parseChineseHour(cn[2]);
      if (parsedHour == null) return null;
      hour = applyDayPart(parsedHour, cn[1] || '');
      minute = cn[3] ? parseChineseMinute(cn[3]) : 0;
    }
  }

  if (hour == null || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  const base = new Date(now);
  const target = new Date(base);
  target.setSeconds(0, 0);
  target.setHours(hour, minute, 0, 0);
  // If already past (with 5s grace), schedule next day.
  if (target.getTime() <= now - 5_000) {
    target.setDate(target.getDate() + 1);
  }

  const label = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return {
    fireAt: target.getTime(),
    mode: 'absolute',
    label,
    status: 'armed',
    buzzTimes: DEFAULT_BUZZ_TIMES
  };
}

function makeRelative(delayMs: number, now: number, label: string): AlarmSchedule {
  return {
    fireAt: now + delayMs,
    mode: 'relative',
    label,
    status: 'armed',
    buzzTimes: DEFAULT_BUZZ_TIMES
  };
}

function applyDayPart(hour: number, part: string): number {
  if (!part) return hour;
  if (/下午|晚上|今晚/.test(part) && hour < 12) return hour + 12;
  if (/中午/.test(part) && hour < 11) return 12;
  if (/凌晨|早上|上午/.test(part) && hour === 12) return 0;
  return hour;
}

function parseChineseHour(raw: string): number | null {
  if (/^\d+$/.test(raw)) return Number(raw);
  const map: Record<string, number> = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10
  };
  if (raw === '十') return 10;
  if (raw.startsWith('十')) return 10 + (map[raw.slice(1)] ?? 0);
  if (raw.endsWith('十')) return (map[raw[0]] ?? 0) * 10;
  if (raw.length === 2 && raw[1] === '十') return (map[raw[0]] ?? 0) * 10;
  if (raw.length === 3 && raw[1] === '十') return (map[raw[0]] ?? 0) * 10 + (map[raw[2]] ?? 0);
  return map[raw] ?? null;
}

function parseChineseMinute(raw: string): number {
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) return Number(raw);
  if (raw === '半') return 30;
  const n = parseChineseHour(raw);
  return n == null ? 0 : n;
}
