import React, { useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { Artboard, area, type Band } from './Artboard';
import {
  accounts,
  marketTitle,
  published,
  scriptTitle,
  shootTitle,
  suggestedEnding,
  videos,
  type Detail,
} from './content';
import { useCreatorSpace } from './store';
import { Card, Words, s } from './ui';

type Props = {
  menu: () => void;
  device: () => void;
  deviceLabel: string;
  open: (detail: Detail, parent?: string) => void;
};
const discovery = ['videos', 'accounts', 'trends', 'favorites'] as const;
const creation = ['topics', 'scripts', 'shoots', 'published'] as const;
const discoveryLabels = ['爆款清单', '对标账号', '热点事件', '我的收藏'];
const creationLabels = ['全部选题', '脚本中', '拍摄中', '已发布'];
type MainPage =
  | 'today'
  | (typeof discovery)[number]
  | (typeof creation)[number];
export function CreatorSpace(props: Props) {
  const [page, setPage] = useState<MainPage>('today');
  const [lastDiscovery, setLastDiscovery] =
    useState<(typeof discovery)[number]>('videos');
  const [lastCreation, setLastCreation] =
    useState<(typeof creation)[number]>('topics');
  const space = useCreatorSpace();
  const topic = space.topics.find(t => t.title === scriptTitle)!;
  const version = topic.versions[topic.current];
  const discover = (p: (typeof discovery)[number]) => {
    setLastDiscovery(p);
    setPage(p);
  };
  const create = (p: (typeof creation)[number]) => {
    setLastCreation(p);
    setPage(p);
  };
  const parent =
    page === 'today'
      ? '今日'
      : discovery.some(p => p === page)
      ? '发现'
      : '创作';
  const open = (d: Detail) => props.open(d, parent);
  const script = (title: string) => open({ kind: 'script', title });
  const video = (index: number) => open({ kind: 'video', index });
  const production = (step: number, title = shootTitle) =>
    open({ kind: 'production', title, step });
  const controls = [
    area('打开侧边栏', 0, 0, 64, 53, props.menu),
    area('戒指' + props.deviceLabel, 267, 5, 111, 49, props.device),
    area('今日', 20, 107, 117, 54, () => setPage('today')),
    area('发现', 137, 107, 116, 54, () => discover(lastDiscovery)),
    area('创作', 253, 107, 117, 54, () => create(lastCreation)),
  ];
  const add = (
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    fn: () => void,
  ) => controls.push(area(label, x, y, w, h, fn));
  const row = (label: string, y: number, h: number, fn: () => void) =>
    add(label, 20, y, 350, h, fn);
  const labels: Record<string, string> = { 已连接: props.deviceLabel };
  const hidden: Band[] = [];
  const extra: React.ReactNode[] = [];
  if (discovery.some(p => p === page))
    discovery.forEach((p, i) =>
      add(discoveryLabels[i], 15 + 78 * i, 171, 78, 45, () => discover(p)),
    );
  if (creation.some(p => p === page))
    creation.forEach((p, i) =>
      add(
        creationLabels[i],
        [15, 93, 157, 221][i],
        171,
        i === 0 ? 78 : 64,
        45,
        () => create(p),
      ),
    );
  const addItem = (title: string, subtitle: string, fn?: () => void) =>
    extra.push(
      <Card key={title} onPress={fn}>
        <Words kind="title">{title}</Words>
        <Words kind="meta">{subtitle}</Words>
      </Card>,
    );
  if (page === 'today') {
    row('看爆款清单', 297, 46, () => discover('videos'));
    row('打开脚本', 400, 94, () => script(scriptTitle));
    labels['2'] = String(
      Number(version.pending) + Number(!space.mailDismissed),
    );
    if (!version.pending) {
      hidden.push({ start: 396, end: 660 });
      labels['新结尾等你确认。对标账号新出了 3 条爆款。'] =
        '结尾已处理。对标账号新出了 3 条爆款。';
    }
    if (space.mailDismissed) hidden.push({ start: 660, end: 905 });
    const decide = (accept: boolean) =>
      space.revise(scriptTitle, {
        ...version,
        ending: accept ? suggestedEnding : version.ending,
        pending: false,
        reason: accept ? '采用新结尾' : '保留原结尾',
      });
    add('不用新结尾', 37, 589, 155, 46, () => decide(false));
    add('采用', 200, 589, 153, 46, () => decide(true));
    add('不用邮件草稿', 37, 830, 155, 48, space.dismissMail);
    add('发送', 200, 830, 153, 48, () =>
      Linking.openURL(
        'mailto:?subject=' +
          encodeURIComponent('跟进合作报价') +
          '&body=' +
          encodeURIComponent(
            '您好，想跟进一下上周发的合作报价。如果需要调整档期或内容形式，我这边都可以配合。',
          ),
      ).catch(() => Alert.alert('无法打开邮件', '请先配置邮件应用。')),
    );
    ['夜间伦敦', '#便利店系列', '#伦敦租房'].forEach((v, i) =>
      add(v, [35, 35, 143][i], i ? 1102 : 1058, i ? 105 : 246, 41, () =>
        space.classify(v),
      ),
    );
    if (space.classification) {
      labels['等你归类'] = '已归类';
      labels['Spur 建议 · 新系列「夜间伦敦」'] =
        '已归入 ' + space.classification;
    }
    row('还有 2 条，在录音记录', 1152, 55, () => open({ kind: 'recordings' }));
  } else if (page === 'videos') {
    [260, 422, 570].forEach((y, i) =>
      row(videos[i].title, y, i === 0 ? 151 : 138, () => video(i)),
    );
  } else if (page === 'accounts') {
    accounts
      .slice(0, 5)
      .forEach((a, i) =>
        row(a.name, 260 + i * 65, 64, () =>
          open({ kind: 'account', index: i }),
        ),
      );
    if (space.accountSuggestion === 'new') {
      add('忽略', 37, 717, 155, 47, () => space.setAccount('ignored'));
      add('关注', 200, 717, 153, 47, () => space.setAccount('followed'));
    } else {
      hidden.push({ start: 600, end: 786 });
      if (space.accountSuggestion === 'followed') {
        labels['5 个对标账号 · 每天 8:00 检查更新'] =
          '6 个对标账号 · 每天 8:00 检查更新';
        addItem(accounts[5].name, accounts[5].stats, () =>
          open({ kind: 'account', index: 5 }),
        );
      }
    }
  } else if (page === 'trends') {
    row('查看关联脚本', 366, 46, () => script(scriptTitle));
    const idea = '伦敦夜间巴士线路调整';
    if (space.saved.includes(idea)) labels['存为灵感'] = '已收藏';
    row('存为灵感', 544, 48, () => space.saveItem(idea));
    row('新建选题', 742, 50, () => {
      space.addTopic('圣诞市集陆续开幕', '热点事件 · 圣诞市集陆续开幕');
      create('scripts');
    });
  } else if (page === 'favorites') {
    row(videos[0].title, 260, 111, () => video(0));
    row(videos[3].title, 504, 113, () => video(3));
    row('伦敦租房合同里最容易忽略的条款', 383, 110, () =>
      Alert.alert(
        '伦敦租房合同里最容易忽略的条款',
        '网页文章 · 11 月 14 日收藏\n已关联 #伦敦租房',
      ),
    );
    if (space.saved.length)
      labels['3 条 · 在视频 App 里分享到 Spur，或对戒指说“收藏这条”'] =
        3 + space.saved.length + ' 条 · 已收藏';
    space.saved.forEach(v => addItem(v, '我的收藏'));
  } else if (page === 'topics' || page === 'scripts') {
    row(marketTitle, 260, page === 'topics' ? 115 : 164, () =>
      script(marketTitle),
    );
    row(
      scriptTitle,
      page === 'topics' ? 385 : 442,
      page === 'topics' ? 90 : 156,
      () => script(scriptTitle),
    );
    if (!version.pending) labels['新结尾等你采用'] = '查看当前脚本';
    if (page === 'topics') {
      row(shootTitle, 485, 94, () => production(0));
      published
        .slice(0, 2)
        .forEach(([t], i) =>
          row(t, 586 + 101 * i, 96, () => open({ kind: 'review', index: i })),
        );
      row('更早的 10 条已发布', 800, 47, () => create('published'));
    } else {
      row('发现 › 视频拆解', 652, 27, () => video(0));
      row('发现 › 热点事件', 680, 29, () => discover('trends'));
      if (topic.confirmed) hidden.push({ start: 436, end: 608 });
    }
    const added = space.topics.filter(
      t => t.title !== scriptTitle && t.title !== marketTitle,
    );
    for (const t of added.filter(t => page === 'topics' || !t.confirmed))
      addItem(t.title, t.source, () => script(t.title));
    if (page === 'scripts')
      labels['2 个选题在写脚本'] =
        space.topics.filter(t => !t.confirmed).length + ' 个选题在写脚本';
    if (page === 'topics' && added.length)
      labels['共 15 个选题'] = '共 ' + (15 + added.length) + ' 个选题';
  } else if (page === 'shoots') {
    row(shootTitle, 260, 135, () => production(0));
    ['1 拍摄', '2 导入', '3 剪辑'].forEach((v, i) =>
      add(v, 35 + i * 61, 396, 61, 47, () => production(i)),
    );
    for (const t of space.topics.filter(t => t.confirmed))
      addItem(t.title, '已确认脚本 · 拍摄中', () => production(0, t.title));
    labels['1 个选题在拍摄与剪辑'] =
      1 + space.topics.filter(t => t.confirmed).length + ' 个选题在拍摄与剪辑';
  } else if (page === 'published') {
    published.forEach(([t], i) =>
      row(t, [260, 365, 436, 507][i], i ? 70 : 100, () =>
        open({ kind: 'review', index: i }),
      ),
    );
    row('还有更早的 8 条', 578, 44, () =>
      Alert.alert('更早的发布记录', '设计稿提供了上面四条作品的示例内容。'),
    );
  }
  return (
    <Artboard
      page={page}
      controls={controls}
      labels={labels}
      hidden={hidden}
      shapeProps={
        ['已连接', '录音中', '同步中'].includes(props.deviceLabel)
          ? undefined
          : { '351,27': { fill: '#90958B' } }
      }
    >
      {extra.length > 0 && <View style={s.page}>{extra}</View>}
    </Artboard>
  );
}
