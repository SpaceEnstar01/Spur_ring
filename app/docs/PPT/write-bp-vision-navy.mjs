/**
 * Spur investor BP — 10-slide navy vision deck.
 * Tokens match Harness / write-pdf navy: #002D58, accent #0070C0.
 *
 * 第一版。不要改 OUT。第二版见 write-bp-vision-navy-v2.mjs。
 *
 *   node app/docs/PPT/write-bp-vision-navy.mjs
 *
 * Images: labeled placeholders only. Drop photos in PowerPoint later.
 */
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pptxPkg = join(here, '../../../agent/tools/pptx/package.json')
const require = createRequire(pptxPkg)
const PptxGenJS = require('pptxgenjs')

const FONT = 'PingFang SC'
const OUT = join(here, 'BP_vision_navy.pptx')

const C = {
  navy: '002D58',
  deep: '001A38',
  card: '003666',
  cardAlt: '0A3F6E',
  accent: '0070C0',
  white: 'FFFFFF',
  mist: 'D4E2EF',
  muted: '8AA4BB',
  line: '1A4A78',
  chip: '004A80',
}

const W = 13.333
const H = 7.5
const M = 0.48

function addBg(slide) {
  slide.addShape('rect', {
    x: 0, y: 0, w: W, h: H,
    fill: { color: C.navy },
    line: { color: C.navy },
  })
}

function addAccentRule(slide, x, y, w = 0.42) {
  slide.addShape('rect', {
    x, y, w, h: 0.055,
    fill: { color: C.accent },
    line: { color: C.accent },
  })
}

function addFooter(slide, n) {
  slide.addShape('rect', {
    x: 0, y: 7.22, w: W, h: 0.28,
    fill: { color: C.deep },
    line: { color: C.deep },
  })
  slide.addText('SPUR  ·  录音戒指  ·  个人智能 OS', {
    x: M, y: 7.22, w: 8.2, h: 0.28,
    fontFace: FONT, fontSize: 10, color: C.muted, valign: 'middle',
  })
  slide.addText(`${n}  /  10`, {
    x: 10.6, y: 7.22, w: 2.25, h: 0.28,
    fontFace: FONT, fontSize: 10, color: C.muted, align: 'right', valign: 'middle',
  })
}

function addKicker(slide, label) {
  slide.addText(label, {
    x: M, y: 0.28, w: 8.8, h: 0.28,
    fontFace: FONT, fontSize: 11, color: C.accent, bold: true, margin: 0,
  })
}

function addTitle(slide, title) {
  slide.addText(title, {
    x: M, y: 0.52, w: 12.3, h: 0.46,
    fontFace: FONT, fontSize: 26, color: C.white, bold: true, margin: 0,
  })
}

function addOneLiner(slide, line, y = 1.02) {
  addAccentRule(slide, M, y)
  slide.addText(line, {
    x: M, y: y + 0.1, w: 12.35, h: 0.42,
    fontFace: FONT, fontSize: 16, color: C.mist, bold: true, margin: 0,
  })
}

function addPlaceholder(slide, { x, y, w, h, label, caption }) {
  slide.addShape('roundRect', {
    x, y, w, h,
    fill: { color: C.deep },
    line: { color: C.line, pt: 1.25 },
    rectRadius: 0.08,
  })
  slide.addText(label, {
    x, y: y + h / 2 - 0.28, w, h: 0.28,
    fontFace: FONT, fontSize: 12, color: C.accent, align: 'center', bold: true, margin: 0,
  })
  if (caption) {
    slide.addText(caption, {
      x: x + 0.12, y: y + h / 2 + 0.02, w: w - 0.24, h: 0.32,
      fontFace: FONT, fontSize: 10, color: C.muted, align: 'center', margin: 0,
    })
  }
}

function addCard(slide, { x, y, w, h, fill = C.card }) {
  slide.addShape('roundRect', {
    x, y, w, h,
    fill: { color: fill },
    line: { color: C.line, pt: 0.75 },
    rectRadius: 0.07,
  })
}

function slide01(pres) {
  const slide = pres.addSlide()
  addBg(slide)
  slide.addShape('rect', {
    x: 0, y: 0, w: 0.12, h: H,
    fill: { color: C.accent },
    line: { color: C.accent },
  })
  slide.addText('SPUR', {
    x: 0.72, y: 1.05, w: 7.4, h: 0.42,
    fontFace: FONT, fontSize: 14, color: C.accent, bold: true, charSpacing: 3, margin: 0,
  })
  slide.addText('录音戒指  ·  个人智能操作系统', {
    x: 0.72, y: 1.48, w: 7.6, h: 0.32,
    fontFace: FONT, fontSize: 13, color: C.muted, margin: 0,
  })
  slide.addText('智能长在手上，\n跑在自己的系统里。', {
    x: 0.72, y: 2.05, w: 7.6, h: 1.85,
    fontFace: FONT, fontSize: 36, color: C.white, bold: true, margin: 0,
  })
  slide.addText('让每个人的智能，长在自己手上，跑在自己的系统里。\n想到就记下；说完，就做成。', {
    x: 0.72, y: 4.12, w: 7.5, h: 0.95,
    fontFace: FONT, fontSize: 15, color: C.mist, margin: 0,
  })
  addPlaceholder(slide, {
    x: 8.7, y: 1.35, w: 4.1, h: 4.85,
    label: '待放入 · 戒指主视觉',
    caption: '佩戴 / 产品照，后补',
  })
  addFooter(slide, 1)
}

function slide02(pres) {
  const slide = pres.addSlide()
  addBg(slide)
  addKicker(slide, '问题')
  addTitle(slide, '世界卡在哪')
  addOneLiner(slide, '记不住、找不回、说了做不成。手机和聊天框打断现实。')

  const pains = [
    { k: '记不住', v: '想记时来不及；记下之后找不到。灵感和对话散落在备忘、录音和聊天框里。' },
    { k: '找不回', v: '录音、备忘、会议、助理彼此割裂。没有连续、第一手、只属于这个人的输入。' },
    { k: '做不成', v: '转写和总结已经成熟。缺的是执行闭环：说完，落成可改的结果，而不是又一段文字。' },
  ]
  pains.forEach((p, i) => {
    const x = M + i * 4.12
    addCard(slide, { x, y: 1.72, w: 3.95, h: 3.15 })
    addAccentRule(slide, x + 0.22, 1.94)
    slide.addText(p.k, {
      x: x + 0.22, y: 2.12, w: 3.5, h: 0.42,
      fontFace: FONT, fontSize: 20, color: C.white, bold: true, margin: 0,
    })
    slide.addText(p.v, {
      x: x + 0.22, y: 2.64, w: 3.5, h: 1.9,
      fontFace: FONT, fontSize: 13, color: C.mist, margin: 0,
    })
  })
  slide.addText('现有方案要携带、夹持、入耳或掏手机。摩擦高，入口断，系统没有身体。', {
    x: M, y: 5.05, w: 12.35, h: 0.36,
    fontFace: FONT, fontSize: 13, color: C.muted, margin: 0,
  })
  addPlaceholder(slide, {
    x: M, y: 5.5, w: 12.35, h: 1.5,
    label: '待放入 · 场景对照（可选）',
    caption: '打断现实的手机 / 聊天框 vs 手上入口，后补',
  })
  addFooter(slide, 2)
}

function slide03(pres) {
  const slide = pres.addSlide()
  addBg(slide)
  addKicker(slide, '第一核  ·  入口')
  addTitle(slide, '戒指是身体和感官')
  addOneLiner(slide, '戒指是个人智能的感官，不是又一个健康指环。')

  slide.addText('不是再做一个智能戒指。Agent 困在聊天框里，没有连续、第一手、低摩擦的私人输入，所以记不住你，也做不完事。', {
    x: M, y: 1.68, w: 7.55, h: 0.85,
    fontFace: FONT, fontSize: 14, color: C.mist, margin: 0,
  })
  slide.addText('戒指是发射器：按一下，采集真实世界的声音，把灵感和对话变成只属于这个人的记忆燃料。没有这一层，再强的模型也只是公摊大脑。', {
    x: M, y: 2.55, w: 7.55, h: 1.05,
    fontFace: FONT, fontSize: 14, color: C.white, margin: 0,
  })

  const steps = ['记录', '理解', '行动']
  steps.forEach((s, i) => {
    const x = M + i * 2.55
    addCard(slide, { x, y: 3.8, w: 2.35, h: 0.72, fill: C.deep })
    slide.addText(s, {
      x, y: 3.8, w: 2.35, h: 0.72,
      fontFace: FONT, fontSize: 16, color: C.white, bold: true, align: 'center', valign: 'middle',
    })
    if (i < 2) {
      slide.addText('→', {
        x: x + 2.28, y: 3.8, w: 0.32, h: 0.72,
        fontFace: FONT, fontSize: 16, color: C.accent, align: 'center', valign: 'middle',
      })
    }
  })
  slide.addText('最低摩擦的声音入口，接到可检索、可行动的个人记忆。', {
    x: M, y: 4.68, w: 7.55, h: 0.4,
    fontFace: FONT, fontSize: 13, color: C.muted, margin: 0,
  })
  addPlaceholder(slide, {
    x: 8.55, y: 1.68, w: 4.3, h: 4.95,
    label: '待放入 · 戒指产品 / 佩戴',
    caption: '硬件主图，后补',
  })
  addFooter(slide, 3)
}

function slide04(pres) {
  const slide = pres.addSlide()
  addBg(slide)
  addKicker(slide, '第二核  ·  Harness')
  addTitle(slide, '自建下一代智能 OS')
  addOneLiner(slide, '数据在自己闭环，所以要自建 OS；不是去做下一个 Cursor。')

  addCard(slide, { x: M, y: 1.68, w: 12.35, h: 1.05, fill: C.deep })
  slide.addText('戒指采到的是连续、第一手、只属于这个人的声音记忆。采集 → 理解 → 出件 → 再改，必须转在 Spur 内部。只做别人的麦克风，记忆和改稿轨迹就沉淀在别人家里——我们变成外设。', {
    x: M + 0.22, y: 1.76, w: 11.9, h: 0.88,
    fontFace: FONT, fontSize: 13, color: C.mist, valign: 'middle', margin: 0,
  })

  const cols = [
    { k: 'Cursor / Codex', v: '给代码仓库用的智能系统。输入是文件和终端。' },
    { k: 'WorkBuddy', v: '给桌面办公用的智能系统。输入是已经坐在电脑前的人。' },
    { k: 'Spur Harness', v: '给身上正在发生的生活和工作用的 OS。输入是戒指里的私人声音。' },
  ]
  cols.forEach((c, i) => {
    const x = M + i * 4.12
    addCard(slide, { x, y: 2.9, w: 3.95, h: 1.85, fill: i === 2 ? C.cardAlt : C.card })
    if (i === 2) addAccentRule(slide, x + 0.2, 3.08)
    slide.addText(c.k, {
      x: x + 0.2, y: 3.18, w: 3.55, h: 0.36,
      fontFace: FONT, fontSize: 14, color: i === 2 ? C.accent : C.white, bold: true, margin: 0,
    })
    slide.addText(c.v, {
      x: x + 0.2, y: 3.56, w: 3.55, h: 1.0,
      fontFace: FONT, fontSize: 13, color: C.mist, margin: 0,
    })
  })
  slide.addText('模型可以调用外面的。记忆、工具轨迹、办公载荷不能外包。录音戒指是入口，Harness 是座舱和导航。', {
    x: M, y: 4.9, w: 8.0, h: 0.55,
    fontFace: FONT, fontSize: 13, color: C.white, margin: 0,
  })
  addPlaceholder(slide, {
    x: 8.7, y: 4.88, w: 4.15, h: 1.95,
    label: '待放入 · Harness 界面',
    caption: '运行时 / 技能卡，后补',
  })
  addFooter(slide, 4)
}

function slide05(pres) {
  const slide = pres.addSlide()
  addBg(slide)
  addKicker(slide, '进度')
  addTitle(slide, '现在做成了什么')
  addOneLiner(slide, '硬件研发完成  ·  App 准备上线  ·  Harness 已搭建。')

  const rows = [
    { layer: '硬件', st: '研发完成', d: '功能原型已有：按键录音、本地缓存、BLE 同步。下一步是工程化与小批量，不是从零发明戒指。' },
    { layer: 'App', st: '准备上线', d: '同步、转写、纪要、Agent Flow。真机已跑通云端出 PDF / PPT，并在 App 内打开。上线是给第一批人戴着日常用。' },
    { layer: 'Harness', st: '已经搭建', d: '自建运行时、技能与工具、办公出件在自己的系统里转。第二核不是愿景页，是已在跑的操作系统雏形。' },
  ]
  rows.forEach((r, i) => {
    const y = 1.68 + i * 1.18
    addCard(slide, { x: M, y, w: 8.15, h: 1.08 })
    slide.addText(r.layer, {
      x: M + 0.2, y: y + 0.12, w: 2.1, h: 0.32,
      fontFace: FONT, fontSize: 16, color: C.white, bold: true, margin: 0,
    })
    slide.addShape('roundRect', {
      x: M + 2.4, y: y + 0.14, w: 1.7, h: 0.28,
      fill: { color: C.chip },
      line: { color: C.accent, pt: 0.75 },
      rectRadius: 0.06,
    })
    slide.addText(r.st, {
      x: M + 2.4, y: y + 0.14, w: 1.7, h: 0.28,
      fontFace: FONT, fontSize: 10, color: C.mist, align: 'center', valign: 'middle',
    })
    slide.addText(r.d, {
      x: M + 0.2, y: y + 0.48, w: 7.75, h: 0.5,
      fontFace: FONT, fontSize: 12, color: C.mist, margin: 0,
    })
  })
  addPlaceholder(slide, {
    x: 8.9, y: 1.68, w: 3.95, h: 3.55,
    label: '待放入 · 真机 / App / Harness',
    caption: '三层各一张，后补',
  })
  slide.addText('下一拍（方向，尚未上线）：同一张卡带着上一版正文和新意见改。首批：创作者、创业者、会议密集的职场。', {
    x: M, y: 5.35, w: 12.35, h: 0.55,
    fontFace: FONT, fontSize: 12, color: C.muted, margin: 0,
  })
  addFooter(slide, 5)
}

function slide06(pres) {
  const slide = pres.addSlide()
  addBg(slide)
  addKicker(slide, '产品')
  addTitle(slide, '产品怎么用')
  addOneLiner(slide, '按键即录  →  同步理解  →  Agent Flow 出结果。')

  const steps = [
    { n: '01', k: '按键即录', v: '手上已有采集。最低摩擦，把真实世界的声音收进只属于这个人的记忆。' },
    { n: '02', k: '同步理解', v: 'BLE 进 App：转写、检索、纪要。连续输入，而不是又开一个聊天框。' },
    { n: '03', k: '出结果', v: 'Agent Flow 在自建 Harness 里走。云端生成 PDF / PPT，App 内打开——办公是声音记忆的一种载荷。' },
  ]
  steps.forEach((s, i) => {
    const x = M + i * 4.12
    addCard(slide, { x, y: 1.68, w: 3.95, h: 2.55 })
    slide.addText(s.n, {
      x: x + 0.2, y: 1.82, w: 3.55, h: 0.28,
      fontFace: FONT, fontSize: 12, color: C.accent, bold: true, margin: 0,
    })
    slide.addText(s.k, {
      x: x + 0.2, y: 2.12, w: 3.55, h: 0.38,
      fontFace: FONT, fontSize: 18, color: C.white, bold: true, margin: 0,
    })
    slide.addText(s.v, {
      x: x + 0.2, y: 2.56, w: 3.55, h: 1.45,
      fontFace: FONT, fontSize: 13, color: C.mist, margin: 0,
    })
  })
  const caps = ['待放入 · 戒指按键', '待放入 · App 同步 / 纪要', '待放入 · Agent Flow 出件']
  caps.forEach((label, i) => {
    addPlaceholder(slide, {
      x: M + i * 4.12, y: 4.4, w: 3.95, h: 2.4,
      label,
      caption: '后补',
    })
  })
  addFooter(slide, 6)
}

function slide07(pres) {
  const slide = pres.addSlide()
  addBg(slide)
  addKicker(slide, '阶段')
  addTitle(slide, '一年 / 三年 / 五年')
  addOneLiner(slide, '一年能戴能用；三年成为日常；五年交卷「有身体的个人智能」。')

  const years = [
    { y: '1 年', k: '入口能戴出去，系统能天天用', v: '我们打造了可小批量交付的录音戒指 + 能上线的 App + 已在跑的 Harness。约 1,000 枚级验证佩戴与同步；α 用户「想到就记下、说完就做成」跑通；EVT / DVT / PVT 走完。证明这不是实验室演示。' },
    { y: '3 年', k: '个人智能的默认工作方式', v: '我们打造了被一小群人每天戴着的入口，和真正用起来的个人智能操作系统。采集—理解—出件是日常，不是功能清单。戒指是入口，Harness 是座舱——指得着真实使用，而不是架构图。' },
    { y: '5 年', k: '完成这一阶段的愿景', v: '我们打造了个人智能离开聊天框、长在手上的完整形态：自己的感官、自己的 OS、自己的记忆与轨迹。模型可以换；入口和系统还在。「个人 Agent 第一次有身体、有操作系统」被做出来。' },
  ]
  years.forEach((item, i) => {
    const x = M + i * 4.12
    addCard(slide, { x, y: 1.68, w: 3.95, h: 5.1 })
    slide.addText(item.y, {
      x: x + 0.22, y: 1.86, w: 3.5, h: 0.36,
      fontFace: FONT, fontSize: 20, color: C.accent, bold: true, margin: 0,
    })
    slide.addText(item.k, {
      x: x + 0.22, y: 2.28, w: 3.5, h: 0.85,
      fontFace: FONT, fontSize: 15, color: C.white, bold: true, margin: 0,
    })
    slide.addText(item.v, {
      x: x + 0.22, y: 3.22, w: 3.5, h: 3.25,
      fontFace: FONT, fontSize: 13, color: C.mist, margin: 0,
    })
  })
  addFooter(slide, 7)
}

function slide08(pres) {
  const slide = pres.addSlide()
  addBg(slide)
  addKicker(slide, '飞轮')
  addTitle(slide, '越用越强')
  addOneLiner(slide, '记忆和改稿轨迹进系统，不是进一次对话就扔。')

  addCard(slide, { x: M, y: 1.68, w: 6.05, h: 2.85 })
  slide.addText('产品迭代  ·  要做', {
    x: M + 0.22, y: 1.86, w: 5.6, h: 0.34,
    fontFace: FONT, fontSize: 15, color: C.accent, bold: true, margin: 0,
  })
  slide.addText('第二次改 PDF / 纪要，带着上一版正文和用户改法，在同一张卡上改。这是下一拍，不是已经上线的功能。', {
    x: M + 0.22, y: 2.28, w: 5.6, h: 1.95,
    fontFace: FONT, fontSize: 14, color: C.mist, margin: 0,
  })

  addCard(slide, { x: 6.8, y: 1.68, w: 6.05, h: 2.85 })
  slide.addText('数据飞轮  ·  系统变聪明', {
    x: 7.02, y: 1.86, w: 5.6, h: 0.34,
    fontFace: FONT, fontSize: 15, color: C.accent, bold: true, margin: 0,
  })
  slide.addText('把「旧稿 / 改法 / 是否被接受」沉淀进 Harness。以后写类似东西能用上。多调几次云端模型 API，系统不会因此变聪明。', {
    x: 7.02, y: 2.28, w: 5.6, h: 1.95,
    fontFace: FONT, fontSize: 14, color: C.mist, margin: 0,
  })

  slide.addText('壁垒在四件事叠在一家手里', {
    x: M, y: 4.7, w: 12.35, h: 0.32,
    fontFace: FONT, fontSize: 13, color: C.muted, margin: 0,
  })
  const moat = ['硬件入口', '个人数据', 'AI 理解', '生态连接']
  moat.forEach((m, i) => {
    const x = M + i * 3.15
    addCard(slide, { x, y: 5.1, w: 3.0, h: 0.72, fill: C.deep })
    slide.addText(m, {
      x, y: 5.1, w: 3.0, h: 0.72,
      fontFace: FONT, fontSize: 15, color: C.white, bold: true, align: 'center', valign: 'middle',
    })
  })
  slide.addText('日历、任务、知识库、个人 Agent。入口 × 系统 × 记忆必须在一家手里。', {
    x: M, y: 5.92, w: 12.35, h: 0.32,
    fontFace: FONT, fontSize: 12, color: C.muted, margin: 0,
  })
  addFooter(slide, 8)
}

function slide09(pres) {
  const slide = pres.addSlide()
  addBg(slide)
  addKicker(slide, '本轮')
  addTitle(slide, '这轮钱干什么')
  addOneLiner(slide, '入口工程化、系统做真、合规、第一批每天戴着的人。')

  slide.addText('钱不是维持公司，而是把入口做稳、系统做真、让第一批人每天戴着。本轮要验证：愿不愿意买、愿不愿意戴；能否量产交付；Agent 入口是不是真需求。任务周期约 8–12 个月。', {
    x: M, y: 1.62, w: 12.35, h: 0.7,
    fontFace: FONT, fontSize: 13, color: C.mist, margin: 0,
  })

  const uses = [
    { n: '01', k: '戒指工程化与小批量', v: 'EVT → DVT → PVT；锁核心料与供应商；可靠性 / 续航 / 连接。约 1,000 枚验证良率与真实佩戴。没有稳定入口，Harness 只是演示。' },
    { n: '02', k: 'Harness / App / 云', v: '运行时、技能与工具、办公出件、同步与个人记忆、部署与安全。这是下一代智能系统本身，不是戒指的附属页。' },
    { n: '03', k: '知识产权、认证、合规', v: '能卖、能进渠道、能给机构看的产品，而不是实验室原型。' },
    { n: '04', k: '用研、众筹与 α 用户', v: '第一批高频用户是否真的每天用。用他们的改稿和纠错，启动飞轮的第一圈。' },
  ]
  uses.forEach((u, i) => {
    const x = M + (i % 2) * 6.2
    const y = 2.42 + Math.floor(i / 2) * 1.55
    addCard(slide, { x, y, w: 5.98, h: 1.42 })
    slide.addText(`${u.n}   ${u.k}`, {
      x: x + 0.2, y: y + 0.12, w: 5.55, h: 0.32,
      fontFace: FONT, fontSize: 14, color: C.white, bold: true, margin: 0,
    })
    slide.addText(u.v, {
      x: x + 0.2, y: y + 0.48, w: 5.55, h: 0.82,
      fontFace: FONT, fontSize: 12, color: C.mist, margin: 0,
    })
  })
  slide.addText('工程时间轴（不跟金额绑）：第 1–2 月 EVT  →  第 3–5 月 DVT  →  第 6–8 月 PVT 及约 1,000 枚  →  第 8–12 月交付与迭代。', {
    x: M, y: 5.62, w: 12.35, h: 0.4,
    fontFace: FONT, fontSize: 12, color: C.muted, margin: 0,
  })
  addFooter(slide, 9)
}

function slide10(pres) {
  const slide = pres.addSlide()
  addBg(slide)
  slide.addShape('rect', {
    x: 0, y: 0, w: 0.12, h: H,
    fill: { color: C.accent },
    line: { color: C.accent },
  })
  slide.addText('收束', {
    x: 0.72, y: 1.15, w: 7.4, h: 0.3,
    fontFace: FONT, fontSize: 12, color: C.accent, bold: true, margin: 0,
  })
  slide.addText('不是在卖一枚戒指，\n是让个人智能离开演示、\n进入生活。', {
    x: 0.72, y: 1.6, w: 7.8, h: 2.35,
    fontFace: FONT, fontSize: 28, color: C.white, bold: true, margin: 0,
  })
  slide.addText('智能长在手上，跑在自己的系统里。\n想到就记下；说完，就做成。', {
    x: 0.72, y: 4.15, w: 7.6, h: 0.75,
    fontFace: FONT, fontSize: 15, color: C.mist, margin: 0,
  })
  slide.addText('hispurring.com', {
    x: 0.72, y: 5.15, w: 7.6, h: 0.36,
    fontFace: FONT, fontSize: 16, color: C.accent, bold: true, margin: 0,
  })
  addPlaceholder(slide, {
    x: 8.7, y: 1.35, w: 4.1, h: 4.85,
    label: '待放入 · 收束主图',
    caption: '戒指 + 手上生活，后补',
  })
  addFooter(slide, 10)
}

async function main() {
  const pres = new PptxGenJS()
  pres.defineLayout({ name: 'WIDE_16X9', width: W, height: H })
  pres.layout = 'WIDE_16X9'
  pres.author = 'Spur'
  pres.title = 'Spur  ·  智能长在手上'
  pres.subject = '产品与愿景  ·  10 页'

  slide01(pres)
  slide02(pres)
  slide03(pres)
  slide04(pres)
  slide05(pres)
  slide06(pres)
  slide07(pres)
  slide08(pres)
  slide09(pres)
  slide10(pres)

  await pres.writeFile({ fileName: OUT })
  console.log(OUT)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
