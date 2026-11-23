import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { originalEnding, scriptTitle, marketTitle } from './content';

export type ScriptVersion = {
  reason: string;
  hook: string;
  body: string;
  turn: string;
  ending: string;
  pending: boolean;
};
export type Topic = {
  title: string;
  source: string;
  versions: ScriptVersion[];
  current: number;
  confirmed: boolean;
};
const first: ScriptVersion = {
  reason: '按视频结构写成四段初稿',
  hook: '三家便利店，今天去哪里吃午饭？',
  body: '三家店各买一份午餐，每家报一次分量、味道和还剩多少钱。',
  turn: '只剩最后 1 镑，还能买到什么？',
  ending: originalEnding,
  pending: false,
};
const priceHook = '5 英镑，三家便利店，看我能不能吃饱。';
function newTopic(title: string, source: string): Topic {
  return {
    title,
    source,
    versions: [
      {
        reason: '建立选题',
        hook: '',
        body: '',
        turn: '',
        ending: '',
        pending: false,
      },
    ],
    current: 0,
    confirmed: false,
  };
}
const initialTopics: Topic[] = [
  newTopic(marketTitle, '结构参考：周末市集 · 热点：圣诞市集陆续开幕'),
  {
    title: scriptTitle,
    source: '3 条灵感 · 1 个视频拆解 · 1 个热点',
    current: 3,
    confirmed: false,
    versions: [
      first,
      {
        ...first,
        reason: '午餐套餐涨价，补进选题依据',
        body: '先比较涨价前后的价格，再记录三家店的分量、味道和余额。',
      },
      { ...first, reason: '按口述修改，开头直接亮价格', hook: priceHook },
      {
        ...first,
        reason: '戒指灵感「反问式结尾」，新增一个待采用的写法',
        hook: priceHook,
        pending: true,
      },
    ],
  },
];

interface State {
  topics: Topic[];
  saved: string[];
  accountSuggestion: 'new' | 'ignored' | 'followed';
  recordTags: Record<string, string>;
  tagRecording: (name: string, tag: string) => void;
  classification: string;
  mailDismissed: boolean;
  saveItem: (value: string) => void;
  setAccount: (value: State['accountSuggestion']) => void;
  classify: (tag: string) => void;
  dismissMail: () => void;
  addTopic: (title: string, source: string) => void;
  revise: (title: string, draft: ScriptVersion) => void;
  restore: (title: string, index: number) => void;
  confirm: (title: string) => void;
}
export const useCreatorSpace = create<State>()(
  persist(
    set => ({
      topics: initialTopics,
      saved: [],
      accountSuggestion: 'new',
      classification: '',
      recordTags: {},
      tagRecording: (name, tag) =>
        set(s => ({
          recordTags: { ...s.recordTags, [name]: tag },
          ...(name === '夜间巴士视角' ? { classification: tag } : {}),
        })),
      mailDismissed: false,
      saveItem: value =>
        set(s => ({
          saved: [value, ...s.saved.filter(item => item !== value)],
        })),
      setAccount: accountSuggestion => set({ accountSuggestion }),
      classify: classification =>
        set(s => ({
          classification,
          recordTags: { ...s.recordTags, 夜间巴士视角: classification },
        })),
      dismissMail: () => set({ mailDismissed: true }),
      addTopic: (title, source) =>
        set(s => ({
          topics: s.topics.some(t => t.title === title)
            ? s.topics
            : [newTopic(title, source), ...s.topics],
        })),
      revise: (title, draft) =>
        set(s => ({
          topics: s.topics.map(t =>
            t.title === title
              ? {
                  ...t,
                  versions: [...t.versions, draft],
                  current: t.versions.length,
                }
              : t,
          ),
        })),
      restore: (title, index) =>
        set(s => ({
          topics: s.topics.map(t =>
            t.title === title && t.versions[index]
              ? { ...t, current: index }
              : t,
          ),
        })),
      confirm: title =>
        set(s => ({
          topics: s.topics.map(t =>
            t.title === title ? { ...t, confirmed: true } : t,
          ),
        })),
    }),
    {
      name: 'spur-creator-space-v3',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
