import { chineseNumber, parseAlarmIntent } from '../src/services/alarmIntent';

const recorded = new Date(2026, 9, 24, 15, 0).getTime();
const parse = (text: string, now = recorded) =>
  parseAlarmIntent(text, recorded, now);
test.each([
  ['帮我定明天早上八点的闹钟', 25, 8, 0],
  ['请帮我设置明天下午三点半的闹钟。', 25, 15, 30],
  ['设置后天23:15的闹钟', 26, 23, 15],
  ['定今天晚上八点一刻的闹钟', 24, 20, 15],
  ['帮我设定明天上午十点三刻的闹钟', 25, 10, 45],
  ['帮我定明天凌晨零点的闹钟', 25, 0, 0],
])('clear one-off command: %s', (text, day, hour, minute) => {
  expect(parse(text)).toEqual({
    kind: 'alarm',
    title: 'Spur 录音闹钟',
    fireAt: new Date(
      2026,
      9,
      day as number,
      hour as number,
      minute as number,
    ).getTime(),
  });
});
test.each([
  '不要帮我定明天早上八点的闹钟',
  '如果明天早上八点有闹钟就好了',
  '比如帮我定明天早上八点的闹钟',
  '他说帮我定明天早上八点的闹钟',
  '考虑设置明天的闹钟',
  '怎么设置闹钟',
  '帮我定明天早上八点的闹钟吗',
  '今天讨论产品设计',
])('non-executable speech is ignored: %s', text =>
  expect(parse(text).kind).toBe('none'),
);
test.each([
  '帮我定八点的闹钟',
  '帮我定明天八点的闹钟',
  '设置每天早上八点的闹钟',
  '设置明天早上八点和九点的闹钟',
  '设置明天早上二十五点的闹钟',
  '设置明天晚上13点的闹钟',
  '设置明天中午两点的闹钟',
  '设置明天早上八点六十分的闹钟',
  '设置今天早上八点的闹钟',
])('ambiguous/unsupported/invalid command needs confirmation: %s', text =>
  expect(parse(text).kind).toBe('confirm'),
);
test('relative duration is anchored to the recording, not synchronization time', () => {
  const text = '帮我定十分钟后的闹钟';
  expect(parse(text)).toMatchObject({
    kind: 'alarm',
    fireAt: recorded + 600000,
  });
  expect(parse(text, recorded + 900000).kind).toBe('confirm');
});
test('old tomorrow is not silently moved to tomorrow of the synchronization day', () => {
  expect(parse('帮我定明天早上八点的闹钟', recorded + 3 * 86400000).kind).toBe(
    'confirm',
  );
});
test.each([
  ['十二', 12],
  ['两', 2],
  ['二十三', 23],
  ['五十九', 59],
  ['十', 10],
])('Chinese numbers %s', (text, expected) =>
  expect(chineseNumber(text as string)).toBe(expected),
);
