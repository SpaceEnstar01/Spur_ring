import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AgentExample = {
  id: string;
  label: string;
  title: string;
  summary: string;
  color: string;
  request: string;
  metrics: { label: string; value: string }[];
  sections: { title: string; text: string }[];
};
export const agentExamples: AgentExample[] = [
  {
    id: 'travel-insight-v1',
    label: '旅行视频 · 数据洞察',
    title: '下一条旅行视频，拍什么？',
    summary: '从选题、开场与收藏动机，找到旅行内容的下一步。',
    color: '#E4EEE8',
    request: '帮我看看旅行短视频的数据，分析什么内容更值得做。',
    metrics: [
      { label: '示例视频', value: '3 条' },
      { label: '观察维度', value: '4 项' },
      { label: '内容方向', value: '实用攻略' },
    ],
    sections: [
      {
        title: '示例视频数据',
        text: '以下为教学用虚构数据，非实时搜索：\nA「海边三天两夜」：播放 12,000，点赞 600，收藏 480。\nB「城市漫步随拍」：播放 18,000，点赞 900，收藏 180。\nC「周末路线与预算」：播放 9,000，点赞 360，收藏 540。',
      },
      {
        title: '分析维度',
        text: '① 播放：观察选题吸引力，但不代表内容质量。\n② 点赞 / 播放：这组样本中 A、B 为 5%，C 为 4%。\n③ 收藏 / 播放：A 为 4%，B 为 1%，C 为 6%。\n④ 内容结构：比较路线、预算和氛围镜头，寻找可复用的信息价值。',
      },
      {
        title: '分析结论',
        text: '在这组示例中，氛围随拍获得更多播放，路线与预算获得更高收藏比例。可以推测：好看帮助内容被看见，而可执行的信息更容易被留存。样本过小，不能据此认定平台规律或因果关系。',
      },
      {
        title: '建议下一步',
        text: '试做一条「周末目的地 + 路线 + 人均预算」视频。前三秒交代目的地和亮点，中段展示路线，结尾给出交通与费用。发布后再比较真实数据，不保证流量或收益。',
      },
    ],
  },
  {
    id: 'video-script-v1',
    label: '短视频 · 脚本拆解',
    title: '把一个旅行灵感，变成脚本',
    summary: '拆出开场钩子、内容推进和结尾，让想法变得可拍。',
    color: '#E9E9F4',
    request: '分析旅行视频的脚本框架，帮我整理一个可以参考的例子。',
    metrics: [
      { label: '示例时长', value: '45 秒' },
      { label: '叙事结构', value: '4 段' },
      { label: '视频主题', value: '周末出逃' },
    ],
    sections: [
      {
        title: '示例主题与分析摘要',
        text: '虚构示例：「只有一个周末，也能去看海」。以时间有限的观众为对象，用低门槛的路线承诺吸引注意，再通过路线、体验和信息清单推进。不是对某条真实爆款的抓取或复现。',
      },
      {
        title: '具体脚本',
        text: '00–03 秒｜镜头：海边日出快切。旁白：「只有两天，也想去看海？」\n03–12 秒｜镜头：车站、地图和步行。旁白：「先确定交通，再把住处放在步行可达的位置。」\n12–32 秒｜镜头：海边步道、街巷、小店。旁白：「第一天慢慢逛，第二天留给日出。预算、天气与营业时间，出发前查好。」\n32–45 秒｜镜头：路线清单。旁白：「把你的出发城市和预算记下来，下一步就能排路线。」',
      },
      {
        title: '框架与各段作用',
        text: '① 问题开场：让观众快速判断是否与自己有关。\n② 路线铺垫：降低「如何开始」的不确定性。\n③ 体验与细节：用具体镜头承载信息，避免只喊口号。\n④ 下一步：给出准备清单，不编造已完成的预订或行程。',
      },
      {
        title: '怎么用到你的想法',
        text: '先录下「想去哪里、和谁去、最在意什么」。Spur 可根据转写梳理内容方向，你再补充真实交通、预算和素材。本示例未联网查价，也未发布视频。',
      },
    ],
  },
];
export const useExampleSettings = create<{
  deletedIds: string[];
  remove: (id: string) => void;
}>()(
  persist(
    set => ({
      deletedIds: [],
      remove: id =>
        set(state => ({ deletedIds: [...new Set([...state.deletedIds, id])] })),
    }),
    {
      name: 'spur-agent-example-visibility-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
