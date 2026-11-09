import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(here, '../../../../agent/tools/pptx/package.json'))
const PptxGenJS = require('pptxgenjs')

const FONT = 'Microsoft YaHei'
const OUT = join(here, 'Spur_BP_律师场景.pptx')

const C = {
  blue: '2E75B6',
  blueDeep: '1F4E79',
  ink: '1A1A1A',
  body: '3D4650',
  muted: '6B7680',
  line: 'D5DDE4',
  card: 'F4F7FA',
  cardBlue: 'E8F2FA',
  bar: 'EEF4F9',
  white: 'FFFFFF',
}

const W = 13.333
const H = 7.5
const M = 0.48

const pres = new PptxGenJS()
pres.defineLayout({ name: 'WIDE_16X9', width: W, height: H })
pres.layout = 'WIDE_16X9'
pres.title = '律师场景'
pres.author = 'Spur'

const slide = pres.addSlide()
slide.addShape('rect', {
  x: 0, y: 0, w: W, h: H,
  fill: { color: C.white },
  line: { color: C.white },
})

slide.addShape('roundRect', {
  x: M, y: 0.28, w: 1.35, h: 0.28,
  fill: { color: C.blue },
  line: { color: C.blue },
  rectRadius: 0.04,
})
slide.addText('SCENE', {
  x: M, y: 0.28, w: 1.35, h: 0.28,
  fontFace: FONT, fontSize: 11, color: C.white, bold: true,
  align: 'center', valign: 'middle', margin: 0,
})

slide.addText('律师：现场的话必须留下，还要变成能办案的材料', {
  x: M, y: 0.66, w: 12.3, h: 0.46,
  fontFace: FONT, fontSize: 24, color: C.ink, bold: true, margin: 0,
})
slide.addText('需求真实。做的不是通用转写，是合规提示 + 法律场景的结构化输出。', {
  x: M, y: 1.14, w: 12.3, h: 0.32,
  fontFace: FONT, fontSize: 14, color: C.muted, margin: 0,
})

const cards = [
  {
    n: '01',
    k: '现场碎片',
    v: '会见当事人、开庭间隙、线下沟通，来不及掏手机打字。案情要点、抗辩思路一闪就过，很容易忘掉。',
  },
  {
    n: '02',
    k: '会见一键成纪要',
    v: '对话留下，会后直接出案情摘要和待办，不用再花几小时整理笔录。',
  },
  {
    n: '03',
    k: '客户跟进沉淀',
    v: '沟通内容生成案情备忘录、跟进记录，方便办案和写代理意见，少一次从头复盘。',
  },
]

cards.forEach((c, i) => {
  const x = M + i * 4.12
  slide.addShape('roundRect', {
    x, y: 1.62, w: 3.95, h: 3.15,
    fill: { color: i === 0 ? C.cardBlue : C.card },
    line: { color: C.line, pt: 0.75 },
    rectRadius: 0.06,
  })
  slide.addText(c.n, {
    x: x + 0.22, y: 1.78, w: 3.5, h: 0.28,
    fontFace: FONT, fontSize: 12, color: C.blue, bold: true, margin: 0,
  })
  slide.addText(c.k, {
    x: x + 0.22, y: 2.1, w: 3.5, h: 0.4,
    fontFace: FONT, fontSize: 16, color: C.ink, bold: true, margin: 0,
  })
  slide.addText(c.v, {
    x: x + 0.22, y: 2.56, w: 3.5, h: 1.95,
    fontFace: FONT, fontSize: 13, color: C.body, margin: 0,
  })
})

slide.addShape('roundRect', {
  x: M, y: 4.94, w: 12.37, h: 1.42,
  fill: { color: C.bar },
  line: { color: C.line, pt: 0.75 },
  rectRadius: 0.06,
})
slide.addText('现实卡点', {
  x: M + 0.22, y: 5.06, w: 12.0, h: 0.3,
  fontFace: FONT, fontSize: 13, color: C.blueDeep, bold: true, margin: 0,
})
slide.addText('会见和当事人对话，各地对录音取证的要求不一样，律师会顾虑证据效力和泄露。输出不能停在逐字稿，要的是案情要点、争议焦点、待办和时间节点。戒指接住现场；Harness 收成结构化文书。先提示合规，再进入法律场景。', {
  x: M + 0.22, y: 5.38, w: 12.0, h: 0.86,
  fontFace: FONT, fontSize: 13, color: C.body, margin: 0,
})

slide.addText('SPUR  ·  第一批付费场景', {
  x: M, y: 7.18, w: 8.2, h: 0.22,
  fontFace: FONT, fontSize: 11, color: C.muted, margin: 0,
})
slide.addText('SCENE', {
  x: 10.6, y: 7.18, w: 2.25, h: 0.22,
  fontFace: FONT, fontSize: 11, color: C.muted, align: 'right', margin: 0,
})

await pres.writeFile({ fileName: OUT })
console.log(OUT)
