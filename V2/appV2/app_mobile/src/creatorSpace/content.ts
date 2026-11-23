export const videos = [
  {
    title: '10 英镑逛完周末市集，我吃到了什么',
    author: '@城市漫游Leo',
    age: '2 天前',
    plays: '120 万',
    lift: '4.2',
    duration: '0:58',
    color: '#9A745B',
  },
  {
    title: '我在伦敦只花现金生活了一周',
    author: '@一人食Yuki',
    age: '4 天前',
    plays: '38 万',
    lift: '3.1',
    duration: '8:14',
    color: '#76816E',
  },
  {
    title: '超市午餐套餐涨价后，还值不值',
    author: '@NomadKai',
    age: '昨天',
    plays: '64 万',
    lift: '2.6',
    duration: '0:41',
    color: '#AF916C',
  },
  {
    title: '夜间巴士上层的一镜到底',
    author: '@NightLDN',
    age: '11 月 16 日收藏',
    plays: '',
    lift: '',
    duration: '0:35',
    color: '#575E70',
  },
];
export const accounts = [
  { name: '@城市漫游Leo', stats: '近 30 天 12 条 · 爆款 3 条' },
  { name: '@一人食Yuki', stats: '近 30 天 6 条 · 爆款 2 条' },
  { name: '@NomadKai', stats: '近 30 天 9 条 · 爆款 1 条' },
  { name: '@周末去哪儿Tom', stats: '近 30 天 7 条 · 爆款 1 条' },
  { name: '@伦敦慢生活Ivy', stats: '近 30 天 4 条 · 暂无爆款' },
  { name: '@伦敦打工人Amy', stats: '最近 2 条都在讲平价午餐' },
];
export const hotTopics = [
  ['民生 · 今天', '连锁超市午餐套餐集体涨价', '和你的「便利店系列」直接相关。'],
  ['交通 · 昨天', '伦敦夜间巴士线路调整', '和你昨天记的「夜间巴士视角」有关。'],
  [
    '节日 · 本周起',
    '圣诞市集陆续开幕',
    '可以套用「10 英镑逛市集」的余额倒数结构，在 11 月底前拍。',
  ],
];
export const scriptTitle = '伦敦便利店，5 英镑能吃到什么？';
export const marketTitle = '伦敦圣诞市集，10 英镑能吃到什么？';
export const shootTitle = '伦敦租房避坑 3：签约前要看清的 5 笔费用';
export const published = [
  ['一镑能买什么：伦敦超市一镑区挑战', '11 月 9 日', '18.6 万', '41%'],
  ['伦敦租房避坑 2：押金怎么要回来', '11 月 2 日', '9.4 万', '29%'],
  ['一个人在伦敦过万圣节', '10 月 31 日', '5.2 万', '24%'],
  ['伦敦租房避坑 1：看房要问的 6 个问题', '10 月 26 日', '7.1 万', '31%'],
];
export const originalEnding = '你觉得哪家最值？';
export const suggestedEnding = '你所在的城市，5 英镑能吃到什么？评论区告诉我。';
export const marketStructure =
  '预算钩子 → 三段余额倒数 → 最后一镑反转 → 提问式结尾';
export const shots = [
  ['合同特写，手指划过费用条款', '15:02', 'IMG_3018', '6 秒'],
  ['公寓楼门口空镜', '15:06', 'IMG_3019', '5 秒'],
  ['暖气和水电账单特写', '15:14', 'IMG_3021', '16 秒'],
  ['口播：押金和退租扣款', '15:21', 'IMG_3024', '20 秒'],
  ['口播：中介费和续约费', '15:29', 'IMG_3026', '24 秒'],
  ['结尾提问口播', '15:37', 'IMG_3028', '12 秒'],
];

export type Detail =
  | { kind: 'recordings' | 'recording' }
  | { kind: 'video' | 'account' | 'review'; index: number }
  | { kind: 'script' | 'versions'; title: string }
  | { kind: 'production'; title: string; step: number };
