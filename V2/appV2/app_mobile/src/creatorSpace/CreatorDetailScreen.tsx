import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {
  accounts,
  marketStructure,
  originalEnding,
  published,
  scriptTitle,
  shootTitle,
  shots,
  suggestedEnding,
  videos,
  type Detail,
} from './content';
import { useCreatorSpace, type ScriptVersion } from './store';
import {
  Artboard,
  area,
  type BoardName,
  type Control,
  type Band,
} from './Artboard';
import { Button, Card, Words, s, muted } from './ui';

const fields = [
  ['hook', '钩子'],
  ['body', '主体'],
  ['turn', '转折'],
  ['ending', '结尾'],
] as const;
const formats = ['Spur 自动剪辑', 'CapCut', 'Premiere Pro', 'DaVinci Resolve'];
const durations = ['72.0 秒', '68.5 秒', '74.0 秒', '70.5 秒'];
const pageTitles: Record<Detail['kind'], string> = {
  video: '视频拆解',
  account: '账号拆解',
  script: '脚本',
  versions: '版本管理',
  production: '拍摄与剪辑',
  review: '复盘',
  recordings: '录音记录',
  recording: '录音详情',
};
type Props = NativeStackScreenProps<RootStackParamList, 'CreatorDetail'>;
function wrap(text: string, limit: number): [string, string] {
  const chars = Array.from(text);
  return [chars.slice(0, limit).join(''), chars.slice(limit).join('')];
}
export function CreatorDetailScreen({ navigation, route }: Props) {
  const d = route.params.detail;
  const space = useCreatorSpace();
  const topic =
    'title' in d ? space.topics.find(t => t.title === d.title) : undefined;
  const current = topic?.versions[topic.current];
  const [step, setStep] = useState(d.kind === 'production' ? d.step : 0);
  const [draft, setDraft] = useState<ScriptVersion | null>(null);
  const [format, setFormat] = useState(0);
  const [clip, setClip] = useState(1);
  const [trims, setTrims] = useState([5, 4, 14, 19, 18, 12]);
  const [switches, setSwitches] = useState([true, true, false]);
  const [editing, setEditing] = useState(false);
  const [request, setRequest] = useState('');
  const open = (detail: Detail) =>
    navigation.push('CreatorDetail', { detail, parent: pageTitles[d.kind] });
  const back = () => navigation.goBack();
  const controls: Control[] = [
    area(route.params.parent || '返回', 0, 0, 145, 52, back),
  ];
  const labels: Record<string, string> = {};
  const hidden: Band[] = [];
  const shapeProps: Record<string, Record<string, string>> = {};
  const extra: React.ReactNode[] = [];
  const add = (
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    press: () => void,
  ) => controls.push(area(text, x, y, w, h, press));
  const row = (text: string, y: number, h: number, press: () => void) =>
    add(text, 20, y, 350, h, press);
  const info = (title: string, body: string) => Alert.alert(title, body);
  const unavailable = (title: string) =>
    info(title, '这份设计示例没有附带视频素材。');
  let page: BoardName;
  if (d.kind === 'video') {
    page = 'video';
    const v = videos[d.index];
    const [line1, line2] = wrap(v.title, 16);
    if (d.index !== 0) {
      labels['10 英镑逛完周末市集，我吃到了什'] = line1;
      labels['么'] = line2;
      labels['@城市漫游Leo · 0:58 · 120 万播放 · 高于均值 4.2 倍'] = [
        v.author,
        v.duration,
        v.plays && v.plays + '播放',
      ]
        .filter(Boolean)
        .join(' · ');
      labels['这个结构已用在「5 英镑」脚本里'] = '结构模板示例 · 周末市集';
    }
    if (space.saved.includes(marketStructure))
      labels['存为结构模板'] = '已存模板';
    add('存为结构模板', 20, 877, 173, 54, () =>
      space.saveItem(marketStructure),
    );
    add('用这个结构翻拍', 196, 877, 174, 54, () => {
      const title = '翻拍 · ' + v.title;
      space.addTopic(title, marketStructure);
      open({ kind: 'script', title });
    });
  } else if (d.kind === 'account') {
    page = 'account';
    const a = accounts[d.index];
    if (d.index) {
      labels['@城市漫游Leo'] = a.name;
      labels['L'] = a.name.slice(-1);
      labels['城市生活与探店'] = a.stats;
      labels['12'] = a.stats.match(/天 (\d+)/)?.[1] || '—';
      labels['28 万'] = '—';
      labels['3'] = a.stats.match(/爆款 (\d+)/)?.[1] || '—';
      labels['这个账号的爆款公式'] = '爆款公式 · 原稿示例';
      labels['他的爆款视频'] = '视频拆解示例';
    }
    row('10 英镑逛完周末市集，我吃到了什么', 582, 90, () =>
      open({ kind: 'video', index: 0 }),
    );
    ['20 英镑坐地铁吃遍 5 个区', '一天只用 1 张公交卡能去哪'].forEach((t, i) =>
      row(t, 683 + 100 * i, 90, () =>
        info(
          t,
          i ? '71 万播放 · 高于均值 2.5 倍' : '96 万播放 · 高于均值 3.4 倍',
        ),
      ),
    );
  } else if (d.kind === 'review') {
    page = 'review';
    const [title, date, plays, rate] = published[d.index];
    if (d.index) {
      const lines = wrap(title, 16);
      labels['一镑能买什么：伦敦超市一镑区挑'] = lines[0];
      labels['战'] = lines[1];
      labels['11 月 9 日发布 · 0:52 · #便利店系列'] = date + '发布';
      labels['18.6 万'] = plays;
      labels['41%'] = rate;
      labels['1,240'] = '—';
      labels['观众在哪里离开'] = '留存曲线 · 原稿示例';
      labels['做得好'] = '复盘参考 · 一镑挑战';
    }
  } else if (d.kind === 'script' && topic && current) {
    page = 'script';
    labels[scriptTitle] = topic.title;
    if (topic.title !== scriptTitle) {
      labels['短视频 · 60 秒 · #便利店系列 · 语气：我的口播'] =
        '短视频 · 选题草稿';
      labels['你有 3 条灵感指向它；同类视频本周有 2 条高于均'] =
        topic.source.slice(0, 22);
      labels['值；午餐套餐刚涨价。'] = topic.source.slice(22, 45);
      labels['来源：3 条灵感 · 1 个视频拆解 · 1 个热点'] = '来源：创作空间';
      [
        '参考：你的偏好「开头先亮价格」',
        '来自：上周四的灵感、周日的市集录音',
        '来自：周日的市集录音',
        '来自：今天 09:12 的灵感',
        '5 英镑挑战：伦敦三家便利店谁最值',
        '午餐套餐涨价后，我用 5 英镑试了三家',
        '画面：5 英镑纸币特写，三家店招牌快切',
        '画面：结账小票特写 → 开盒 → 第一口反应',
        '画面：零钱特写，货架扫镜',
        '画面：三份午餐并排俯拍，定格',
      ].forEach(k => {
        labels[k] = '';
      });
      hidden.push({ start: 850, end: 941 });
    }
    if (topic.title !== scriptTitle || topic.current !== 3) {
      labels['“5 英镑，三家便利店，看我能不能吃饱。”'] = (
        current.hook || '待撰写'
      ).slice(0, 22);
      const lines = wrap(current.body || '待撰写', 21);
      labels['三家店各买一份午餐，每家报一次分量、味道和'] = lines[0];
      labels['还剩多少钱。'] = lines[1].slice(0, 23);
      labels['“只剩最后 1 镑，还能买到什么？”'] = (
        current.turn || '待撰写'
      ).slice(0, 22);
      labels['“你觉得哪家最值？”'] = (current.ending || '待撰写').slice(0, 22);
    }
    if (!current.pending) {
      hidden.push({ start: 697, end: 814 });
      hidden.sort((a, b) => a.start - b.start);
    }
    add('版本管理', 270, 5, 104, 46, () =>
      open({ kind: 'versions', title: topic.title }),
    );
    ['保留原结尾', '采用新结尾'].forEach((label, i) =>
      add(label, 37 + 163 * i, 766, 155, 45, () =>
        space.revise(topic.title, {
          ...current,
          pending: false,
          reason: label,
          ending: i ? suggestedEnding : originalEnding,
        }),
      ),
    );
    add('口述修改', 20, 945, 174, 54, () => setDraft({ ...current }));
    fields.forEach(([key, label], i) =>
      row('编辑' + label, [293, 401, 530, 638][i], i === 3 ? 58 : 93, () =>
        setDraft({ ...current }),
      ),
    );
    if (topic.confirmed) labels['确认脚本'] = '查看拍摄';
    add('确认脚本', 198, 945, 172, 54, () => {
      if (!fields.some(([k]) => current[k].trim())) {
        setDraft({ ...current });
        return;
      }
      space.confirm(topic.title);
      open({ kind: 'production', title: topic.title, step: 0 });
    });
  } else if (d.kind === 'versions' && topic) {
    page = 'versions';
    labels['伦敦便利店，5 英镑能吃到什么？ · 共 4 版 · 当前 v4'] =
      topic.title +
      ' · 共 ' +
      topic.versions.length +
      ' 版 · 当前 v' +
      (topic.current + 1);
    if (topic.title === scriptTitle) {
      if (topic.current !== 3) labels['当前'] = '恢复';
      const ys = [674, 543, 391, 228];
      topic.versions.slice(0, 4).forEach((v, i) => {
        row('恢复 v' + (i + 1), ys[i] - 21, 45, () =>
          space.restore(topic.title, i),
        );
        if (topic.current === i && i !== 3)
          labels['v' + (i + 1)] = '✓ v' + (i + 1);
      });
    } else hidden.push({ start: 200, end: 818 });
    topic.versions.forEach((v, i) => {
      if (topic.title === scriptTitle && i < 4) return;
      extra.unshift(
        <Card key={i}>
          <Words kind="title">
            v{i + 1}
            {i === topic.current ? '　当前' : ''}
          </Words>
          <Words>{v.reason}</Words>
          {i !== topic.current && (
            <Button
              label="回到这一版"
              onPress={() => space.restore(topic.title, i)}
            />
          )}
        </Card>,
      );
    });
  } else if (d.kind === 'production') {
    page = (['shoot', 'import', 'edit'] as const)[step];
    const title = d.title;
    if (title !== shootTitle) {
      const lines = wrap(title, 16);
      labels['伦敦租房避坑 3：签约前要看清的 5'] = lines[0];
      labels['笔费用'] = lines[1];
      labels['短视频 · 目标约 70 秒 · #伦敦租房 · 周日 15:00 拍摄'] =
        '拍摄与剪辑 · 示例流程';
    }
    ['1 拍摄', '2 导入', '3 剪辑'].forEach((v, i) =>
      add(v, 20 + 117 * i, 178, 117, 52, () => setStep(i)),
    );
    if (step === 0) row('从相册导入素材', 850, 58, () => setStep(1));
    if (step === 1) row('自动剪辑', 1056, 58, () => setStep(2));
    if (step === 2) {
      formats.forEach((_, i) => {
        const x = i % 2 ? 199 : 37,
          y = i < 2 ? 620.38 : 688.38;
        shapeProps[x + ',' + y] = {
          fill: i === format ? '#EDF4EE' : '#FFFFFF',
        };
        shapeProps[x + 0.5 + ',' + (y + 0.5)] = {
          stroke: i === format ? '#225849' : '#DDE6DF',
        };
      });
      switches.forEach((enabled, i) => {
        const y = 1253.38 + 61 * i;
        shapeProps['309,' + y] = { fill: enabled ? '#225849' : '#BFCEC3' };
        for (const dy of [3, 5])
          shapeProps[(i === 2 ? '312,' : '330,') + (y + dy)] = {
            x: enabled ? '330' : '312',
          };
      });
      if (format !== 0) {
        labels['@206,258.58'] = formats[format];
        labels['@184,480.58'] = durations[format];
      }
      formats.forEach((name, i) =>
        add(
          name,
          36 + 162 * (i % 2),
          617 + 68 * Math.floor(i / 2),
          157,
          61,
          () => setFormat(i),
        ),
      );
      add('预览视频', 30, 236, 138, 271, () => unavailable('视频预览'));
      add('重新自动剪辑', 247, 536, 112, 43, () => unavailable('重新自动剪辑'));
      row('输入剪辑要求', 890, 47, () => setEditing(true));
      ['开头再快一点', '第 4 段太长了', '字幕放大一点'].forEach((text, i) =>
        add(
          text,
          i === 1 ? 149 : 36,
          i === 2 ? 982 : 939,
          i === 1 ? 142 : 113,
          42,
          () => {
            setRequest(text);
            setEditing(true);
          },
        ),
      );
      const starts = [36, 65, 99, 143, 220, 306, 353];
      shots.forEach((shot, i) =>
        add(
          '镜头 ' + (i + 1),
          starts[i],
          1104,
          starts[i + 1] - starts[i],
          49,
          () => setClip(i),
        ),
      );
      labels['镜头 2 · 公寓楼门口空镜'] =
        '镜头 ' + (clip + 1) + ' · ' + shots[clip][0];
      labels['用了 4.0 秒 · 素材共 5 秒'] =
        '用了 ' + trims[clip].toFixed(1) + ' 秒 · 素材共 ' + shots[clip][3];
      [-1, 1].forEach((delta, i) =>
        add(i ? '延长镜头' : '缩短镜头', 258 + 48 * i, 1160, 46, 53, () =>
          setTrims(old =>
            old.map((n, j) =>
              j === clip
                ? Math.max(1, Math.min(parseInt(shots[j][3], 10), n + delta))
                : n,
            ),
          ),
        ),
      );
      ['自动字幕', '去掉口误和停顿', '背景音乐'].forEach((t, i) => {
        row(t, 1230 + 61 * i, 59, () =>
          setSwitches(old => old.map((v, j) => (j === i ? !v : v))),
        );
      });
      row('导出到相册', 1430, 60, () => unavailable('导出到相册'));
    }
  } else if (d.kind === 'recordings' || d.kind === 'recording') {
    page = d.kind === 'recordings' ? 'recordings' : 'recording';
    if (page === 'recordings') {
      const rows = [190, 405, 620];
      const names = ['夜间巴士视角', '暖气费另算', '超市价签对比'];
      rows.forEach((y, i) => {
        row(names[i], y, 110, () =>
          info(names[i], space.recordTags[names[i]] || '待归类'),
        );
        ['Spur 建议', '#便利店系列', '#伦敦租房'].forEach((tag, j) =>
          add(
            names[i] + tag,
            j === 2 ? 146 : 36,
            y + (j ? 154 : 109),
            j ? 105 : 255,
            42,
            () =>
              space.tagRecording(
                names[i],
                tag === 'Spur 建议'
                  ? ['夜间伦敦', '#伦敦租房', '#便利店系列'][i]
                  : tag,
              ),
          ),
        );
      });
      const tags = space.recordTags;
      [
        'Spur 建议 · 新系列「夜间伦敦」',
        'Spur 建议 · #伦敦租房',
        'Spur 建议 · #便利店系列',
      ].forEach((v, i) => {
        if (tags[names[i]]) labels[v] = '已归入 ' + tags[names[i]];
      });
      add('全部按 Spur 建议', 240, 140, 130, 44, () =>
        names.forEach((n, i) =>
          space.tagRecording(n, ['夜间伦敦', '#伦敦租房', '#便利店系列'][i]),
        ),
      );
      row('周末市集边走边说', 868, 79, () => open({ kind: 'recording' }));
      row('反问式结尾', 949, 181, () =>
        open({ kind: 'versions', title: scriptTitle }),
      );
    } else {
      if (space.recordTags['周末市集边走边说'])
        labels['#便利店系列'] = space.recordTags['周末市集边走边说'];
      row('播放示例录音', 147, 80, () =>
        info('录音示例', '设计稿没有附带这段录音的音频文件。'),
      );
      row('修改归类', 725, 56, () =>
        Alert.alert(
          '修改归类',
          undefined,
          ['#便利店系列', '#伦敦租房', '夜间伦敦'].map(t => ({
            text: t,
            onPress: () => space.tagRecording('周末市集边走边说', t),
          })),
        ),
      );
    }
  } else
    return (
      <SafeAreaView style={s.root}>
        <Button label="返回创作空间" onPress={back} />
      </SafeAreaView>
    );
  if (route.params.parent) {
    const original =
      page === 'versions'
        ? '脚本'
        : page === 'recording'
        ? '录音记录'
        : page === 'video' || page === 'account'
        ? '发现'
        : '创作';
    if (page !== 'recordings') labels[original] = route.params.parent;
  }
  return (
    <SafeAreaView style={s.root}>
      <Artboard
        page={page}
        controls={controls}
        labels={labels}
        hidden={hidden}
        shapeProps={shapeProps}
      >
        {extra.length > 0 && <View style={s.page}>{extra}</View>}
      </Artboard>
      <Modal
        visible={draft !== null || editing}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={() => {
          setDraft(null);
          setEditing(false);
        }}
      >
        <SafeAreaProvider style={s.root}>
          <SafeAreaView style={s.root}>
            <View style={s.editorHeader}>
              <Words kind="hero">{draft ? '修改脚本' : '剪辑要求'}</Words>
              <Button
                label="取消"
                onPress={() => {
                  setDraft(null);
                  setEditing(false);
                }}
              />
            </View>
            <KeyboardAvoidingView
              style={s.root}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={s.page}
              >
                {draft ? (
                  fields.map(([key, label]) => (
                    <Card key={key}>
                      <Words kind="title">{label}</Words>
                      <TextInput
                        multiline
                        style={s.input}
                        accessibilityLabel={label}
                        placeholder={
                          {
                            hook: '写下第一句口播',
                            body: '展开这段内容',
                            turn: '写下转折或新发现',
                            ending: '用一句话收尾',
                          }[key]
                        }
                        placeholderTextColor={muted}
                        value={draft[key]}
                        onChangeText={value =>
                          setDraft({ ...draft, [key]: value })
                        }
                      />
                    </Card>
                  ))
                ) : (
                  <TextInput
                    multiline
                    style={s.input}
                    accessibilityLabel="剪辑要求"
                    placeholder="写下想调整的镜头、节奏或字幕"
                    placeholderTextColor={muted}
                    value={request}
                    onChangeText={setRequest}
                  />
                )}
              </ScrollView>
              <View style={s.editorFooter}>
                <Button
                  primary
                  label={draft ? '保存新版本' : '保存剪辑要求'}
                  onPress={() => {
                    if (topic && draft) {
                      space.revise(topic.title, {
                        ...draft,
                        pending: false,
                        reason: '修改脚本',
                      });
                      setDraft(null);
                    } else if (request.trim()) {
                      space.saveItem('剪辑要求 · ' + request.trim());
                      setEditing(false);
                    }
                  }}
                />
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </SafeAreaView>
  );
}
