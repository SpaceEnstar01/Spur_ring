export type AlarmIntent =
  | { kind: 'none' }
  | { kind: 'confirm'; reason: string }
  | { kind: 'alarm'; fireAt: number; title: string };

const digits = '零一二三四五六七八九';
export function chineseNumber(value: string): number {
  if (/^\d+$/.test(value)) return Number(value);
  if (value === '两') return 2;
  if (/^[零一二三四五六七八九]$/.test(value)) return digits.indexOf(value);
  if (/^[一二三四五六七八九]?十[一二三四五六七八九]?$/.test(value)) {
    const [tens, units] = value.split('十');
    return (
      (tens ? digits.indexOf(tens) : 1) * 10 +
      (units ? digits.indexOf(units) : 0)
    );
  }
  return NaN;
}
const num = '[0-9零一二三四五六七八九十两]{1,3}';

// Intentionally narrow, deterministic grammar. Analysis/model prose is never an execution instruction.
export function parseAlarmIntent(
  text: string,
  recordedAt: number,
  now = Date.now(),
): AlarmIntent {
  const s = text
    .trim()
    .replace(/[。！!？?]+$/, '')
    .replace(/\s+/g, '');
  if (!/(闹钟|提醒我|叫我)/.test(s)) return { kind: 'none' };
  if (
    /(不要|不用|别|取消|不想|如果|假如|比如|例如|他说|她说|引用|考虑|可能|也许|要不要|怎么|如何|能不能|能否|吗|？|\?)/.test(
      s,
    )
  )
    return { kind: 'none' };
  const prefix =
    '(?:请)?(?:帮我|给我|替我)?(?:设置|设定|设|定|创建|添加)(?:一个)?(?:闹钟)?';
  const tail = '(?:的)?(?:闹钟)?(?:[，,]?(?:提醒我|叫我).{0,24})?';
  const relative = s.match(
    new RegExp(`^${prefix}(${num})(分钟|小时)后${tail}$`),
  );
  if (relative) {
    const count = chineseNumber(relative[1]);
    const fireAt =
      recordedAt + count * (relative[2] === '小时' ? 3600000 : 60000);
    return Number.isFinite(count) &&
      count > 0 &&
      count <= 1440 &&
      fireAt > now + 5000
      ? { kind: 'alarm', fireAt, title: 'Spur 录音闹钟' }
      : { kind: 'confirm', reason: '时间已过或间隔无效，请填写新的明确指令' };
  }
  const match = s.match(
    new RegExp(
      `^${prefix}(今天|明天|后天)?(凌晨|早上|早晨|上午|中午|下午|晚上)?(${num})(?:点|时|[:：])(半|一刻|三刻|${num}分?)?${tail}$`,
    ),
  );
  if (!match)
    return {
      kind: 'confirm',
      reason:
        '请确认一条指令，例如：帮我定明天早上八点的闹钟（暂不支持重复或多个闹钟）',
    };
  const [, day, period, hourText, minuteText] = match;
  let hour = chineseNumber(hourText);
  const minute = !minuteText
    ? 0
    : minuteText === '半'
    ? 30
    : minuteText === '一刻'
    ? 15
    : minuteText === '三刻'
    ? 45
    : chineseNumber(minuteText.replace(/分$/, ''));
  if (!day || (!period && hour >= 1 && hour <= 12))
    return { kind: 'confirm', reason: '请说清日期和上午或下午，避免设错时间' };
  if (
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59 ||
    (period && hour > 12)
  )
    return { kind: 'confirm', reason: '时间无效，请重新确认' };
  if (period === '下午' || period === '晚上')
    hour = hour < 12 ? hour + 12 : hour;
  if (period === '中午' && hour < 11)
    return { kind: 'confirm', reason: '中午时间不明确，请使用 24 小时制' };
  if (
    (period === '凌晨' ||
      period === '早上' ||
      period === '早晨' ||
      period === '上午') &&
    hour === 12
  )
    return { kind: 'confirm', reason: '十二点含义不明确，请使用 24 小时制' };
  const date = new Date(recordedAt);
  date.setDate(date.getDate() + ({ 今天: 0, 明天: 1, 后天: 2 }[day] ?? 0));
  date.setHours(hour, minute, 0, 0);
  if (date.getHours() !== hour || date.getMinutes() !== minute)
    return { kind: 'confirm', reason: '该时间在当前时区不存在，请重新确认' };
  if (!Number.isFinite(date.getTime()) || date.getTime() <= now + 5000)
    return {
      kind: 'confirm',
      reason: '录音对应的时间已经过去，请重新确认日期',
    };
  return { kind: 'alarm', fireAt: date.getTime(), title: 'Spur 录音闹钟' };
}
