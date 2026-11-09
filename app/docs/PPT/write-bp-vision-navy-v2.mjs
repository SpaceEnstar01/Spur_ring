/**
 * Spur investor BP v2 — same frame as v1 (write-bp-vision-navy.mjs).
 * Copy only: tech / product / vision. Less slogan, less metaphor.
 *
 *   node app/docs/PPT/write-bp-vision-navy-v2.mjs
 *
 * v1 file BP_vision_navy.pptx is left untouched.
 */
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pptxPkg = join(here, '../../../agent/tools/pptx/package.json')
const require = createRequire(pptxPkg)
const PptxGenJS = require('pptxgenjs')

const FONT = 'PingFang SC'
const OUT = join(here, 'BP_vision_navy_v2.pptx')
const BG = join(here, 'ppt_image/bp-bg-02-steel-blue.png')

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

function addBg(slide, path = BG) {
  slide.addImage({
    path,
    x: 0, y: 0, w: W, h: H,
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
  slide.addText('Spur\n录音戒指，下一代 AI 硬件的入口', {
    x: 0.72, y: 2.05, w: 7.6, h: 1.85,
    fontFace: FONT, fontSize: 36, color: C.white, bold: true, margin: 0,
  })
  slide.addText('戴上就能记，记完在自己的系统里整理成文档。\n让每个人随身携带一个可行动的智能体——想法一出口，世界就开始执行。', {
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
  addOneLiner(slide, '录音产品停在转写和纪要。缺连续入口，也缺执行闭环。')

  const pains = [
    { k: '记不住', v: '灵感和对话出现得突然。掏手机、解锁、找 App，思路已经断了。备忘、录音、聊天各记一截。' },
    { k: '找不回', v: '没有连续、第一手、只属于这个人的输入。助理没有身体，只能等人打开一块屏幕。' },
    { k: '做不成', v: '转写和总结已经商品化。会议结论、灵感提纲、待办，仍要人手搬进下一个工具。' },
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
  slide.addText('现有方案：录音笔要携带，录音豆要夹持，软件语音过不了锁屏和口袋。健康戒指不处理这件事。', {
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
  addKicker(slide, '产品  ·  入口')
  addTitle(slide, '下一代硬件的入口')
  addOneLiner(slide, '下一代交互从手上开始：按一下，意图进系统。')

  slide.addText('戒指是 AI 交互的硬件入口。即时触发、拾音、本地缓存；锁屏和走路时也能把话送进去。', {
    x: M, y: 1.68, w: 7.55, h: 0.85,
    fontFace: FONT, fontSize: 14, color: C.mist, margin: 0,
  })
  slide.addText('App 与 Harness智能系统接在后面：同步、转写、整理、检索，以及经授权的执行。', {
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
  slide.addText('灵感走整理到方案 / 任务；会议走纪要到待办。', {
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
  addKicker(slide, '技术  ·  Harness')
  addTitle(slide, '自建下一代智能 OS')
  addOneLiner(slide, '采集、理解、出件、再改必须在自己的运行时里完成。模型可替换。')

  addCard(slide, { x: M, y: 1.68, w: 12.35, h: 1.05, fill: C.deep })
  slide.addText('戒指数据是内部闭环：连续、第一手、只属于佩戴者。若只把声音送进 Cursor / Codex / WorkBuddy，记忆和工具轨迹会落在对方系统里，入口和操作系统拆开。自建 Harness 是架构选择，不是再做一款编程助手。', {
    x: M + 0.22, y: 1.76, w: 11.9, h: 0.88,
    fontFace: FONT, fontSize: 13, color: C.mist, valign: 'middle', margin: 0,
  })

  const cols = [
    { k: 'Cursor / Codex', v: '面向代码仓库。输入是文件、终端和坐在 IDE 前的人。' },
    { k: 'WorkBuddy 等', v: '面向桌面办公。输入是已经打开的屏幕和键盘。' },
    { k: 'Spur Harness', v: '面向身上正在发生的工作。输入是戒指里的私人声音；工具、技能、办公出件在同一运行时。' },
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
  slide.addText('外购 ASR 与通用模型；自建中间层：路由、模板、权限、记忆与评测。可对接外部 Agent，闭环不外包。', {
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
    { layer: '硬件', st: '研发完成', d: '功能原型：按键录音、本地缓存、BLE 同步。规格目标见工程附录（重量、续航、拾音）。下一步是 EVT / DVT / PVT，不是从零定义形态。' },
    { layer: 'App', st: '准备上线', d: '同步、转写、纪要、Agent Flow。真机已跑通云端中文 PDF / PPT，并在 App 内打开。上线对象是第一批日常佩戴用户。' },
    { layer: 'Harness', st: '已经搭建', d: '自建运行时、技能与工具、办公出件链路已在自己的系统里转。技术底座已经落地，不是规划页。' },
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
  slide.addText('下一拍（未上线）：同一张卡用上一版正文 + 修订意见再生成。首批用户：创作者、创业者、会议密集的职场。', {
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
  addOneLiner(slide, '按键录音  →  BLE 同步与理解  →  Agent Flow 出件。')

  const steps = [
    { n: '01', k: '按键即录', v: '长按开始 / 结束；双击标记重点；离线写入本地缓存，恢复连接后续传。录音状态可见。' },
    { n: '02', k: '同步理解', v: 'BLE 进入 App：转写、时间戳、检索、纪要与待办提取。输入连续留在自己的记录库。' },
    { n: '03', k: 'Agent Flow 出件', v: '任务在自建 Harness 中执行。现网已支持中文 PDF / PPT，生成后在 App 内打开。' },
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
  addKicker(slide, '愿景')
  addTitle(slide, '一年 / 三年 / 五年')
  addOneLiner(slide, '按阶段交付物写，不按收入写。')

  const years = [
    { y: '1 年', k: '可交付的入口 + 可上线的系统', v: '小批量录音戒指、上线 App、已在跑的 Harness。走完 EVT / DVT / PVT；约 1,000 枚验证佩戴、同步与出件。两条闭环（灵感 / 会议）在 α 用户里跑通。' },
    { y: '3 年', k: '个人智能操作系统进入日常', v: '采集—理解—分流—出件成为默认路径：纪要、PDF、PPT、待办；该上电脑的任务下发到 PC。同卡修订与记忆开始沉淀。有真实使用，而不只是架构图。' },
    { y: '5 年', k: '这一阶段的技术愿景交卷', v: '个人 Agent 具备身体（戒指）、操作系统（Harness）和可迁移的记忆轨迹。模型可替换；入口与系统仍在 Spur。再往后的多端与现实服务，是下一阶段。' },
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
  addKicker(slide, '技术')
  addTitle(slide, '越用越强')
  addOneLiner(slide, '壁垒在中间层与轨迹，不在多调几次通用模型。')

  addCard(slide, { x: M, y: 1.68, w: 6.05, h: 2.85 })
  slide.addText('产品能力  ·  下一拍', {
    x: M + 0.22, y: 1.86, w: 5.6, h: 0.34,
    fontFace: FONT, fontSize: 15, color: C.accent, bold: true, margin: 0,
  })
  slide.addText('同一张 Agent Flow 卡带着上一版正文和用户修订再生成 PDF / 纪要。当前出件是一次生成，这项尚未上线。', {
    x: M + 0.22, y: 2.28, w: 5.6, h: 1.95,
    fontFace: FONT, fontSize: 14, color: C.mist, margin: 0,
  })

  addCard(slide, { x: 6.8, y: 1.68, w: 6.05, h: 2.85 })
  slide.addText('系统能力  ·  中间层', {
    x: 7.02, y: 1.86, w: 5.6, h: 0.34,
    fontFace: FONT, fontSize: 15, color: C.accent, bold: true, margin: 0,
  })
  slide.addText('沉淀旧稿、改法、是否被采用，以及戒指声学与转写修正。形成场景评测和行动工作流。基础模型外购，中间层自建。', {
    x: 7.02, y: 2.28, w: 5.6, h: 1.95,
    fontFace: FONT, fontSize: 14, color: C.mist, margin: 0,
  })

  slide.addText('长期叠在同一主体里的四层', {
    x: M, y: 4.7, w: 12.35, h: 0.32,
    fontFace: FONT, fontSize: 13, color: C.muted, margin: 0,
  })
  const moat = ['硬件入口', '个人数据', '场景中间层', '工具与出件']
  moat.forEach((m, i) => {
    const x = M + i * 3.15
    addCard(slide, { x, y: 5.1, w: 3.0, h: 0.72, fill: C.deep })
    slide.addText(m, {
      x, y: 5.1, w: 3.0, h: 0.72,
      fontFace: FONT, fontSize: 15, color: C.white, bold: true, align: 'center', valign: 'middle',
    })
  })
  slide.addText('日历、任务、知识库、个人 Agent 可连接。入口、运行时与记忆不拆给三家。', {
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
  addOneLiner(slide, '工程化入口、把 Harness 做成可用 OS、合规、第一批验证用户。')

  slide.addText('本轮验证三件事：硬件是否买得动、戴得住；能否稳定量产交付；声音入口驱动 Agent 是否是真实需求。任务周期约 8–12 个月。页上不写金额与估值。', {
    x: M, y: 1.62, w: 12.35, h: 0.7,
    fontFace: FONT, fontSize: 13, color: C.mist, margin: 0,
  })

  const uses = [
    { n: '01', k: '戒指工程化与小批量', v: 'EVT → DVT → PVT；核心料与供应商；可靠性、续航、连接。约 1,000 枚验证良率与佩戴。入口不稳，Harness 无法进入日常。' },
    { n: '02', k: 'Harness / App / 云', v: '运行时、技能与工具、办公出件、同步与个人记忆、部署与安全。这是操作系统本身的工程。' },
    { n: '03', k: '知识产权、认证、合规', v: '可销售、可进渠道。录音状态必须可见，不提供隐蔽模式。' },
    { n: '04', k: '用研、众筹与 α 用户', v: '创作者、创业者、会议密集职场。用真实修订启动中间层的第一批数据。' },
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
  slide.addText('工程时间轴：第 1–2 月 EVT  →  第 3–5 月 DVT  →  第 6–8 月 PVT 及约 1,000 枚  →  第 8–12 月交付与迭代。', {
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
  slide.addText('愿景', {
    x: 0.72, y: 1.15, w: 7.4, h: 0.3,
    fontFace: FONT, fontSize: 12, color: C.accent, bold: true, margin: 0,
  })
  slide.addText('让个人智能离开聊天框，\n长在手上，\n跑在自己的系统里。', {
    x: 0.72, y: 1.6, w: 7.8, h: 2.35,
    fontFace: FONT, fontSize: 28, color: C.white, bold: true, margin: 0,
  })
  slide.addText('戒指是入口。Harness 是操作系统。\n模型可以换；采集、记忆和出件留在 Spur。', {
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
    caption: '戒指 + 系统界面，后补',
  })
  addFooter(slide, 10)
}

async function main() {
  const pres = new PptxGenJS()
  pres.defineLayout({ name: 'WIDE_16X9', width: W, height: H })
  pres.layout = 'WIDE_16X9'
  pres.author = 'Spur'
  pres.title = 'Spur  ·  智能长在手上'
  pres.subject = '技术 · 产品 · 愿景  ·  v2'

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
