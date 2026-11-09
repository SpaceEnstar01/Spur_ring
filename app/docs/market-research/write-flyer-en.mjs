/**
 * Spur market-research flyer — English, A4 portrait.
 *
 *   node app/docs/market-research/write-flyer-en.mjs
 */
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync, mkdirSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(here, '../../../agent/tools/pptx/package.json'))
const PptxGenJS = require('pptxgenjs')
const QRCode = require('qrcode')

const SURVEY_URL = 'https://www.hispurring.com'
const CONTACT_EMAIL = '17302289985@163.com'
const HERO = join(here, '../logo/spur-app-store-hero.png')
const OUT = join(here, 'Spur-flyer-en-A4.pptx')
const QR_TMP = join(here, '_qr-survey.png')

const FONT = 'Helvetica'
const W = 8.27
const H = 11.69
const M = 0.45

const C = {
  blue: '1A5FD4',
  navy: '0D2B5E',
  white: 'FFFFFF',
  ink: '1A1A1A',
  muted: '4A5568',
  line: 'CBD5E1',
  card: 'F4F7FB',
}

async function main() {
  mkdirSync(here, { recursive: true })
  await QRCode.toFile(QR_TMP, SURVEY_URL, {
    width: 512,
    margin: 1,
    color: { dark: '#0D2B5E', light: '#FFFFFF' },
  })

  const pres = new PptxGenJS()
  pres.defineLayout({ name: 'A4_P', width: W, height: H })
  pres.layout = 'A4_P'
  pres.title = 'Spur Ring · Market Research Flyer'

  const slide = pres.addSlide()
  slide.background = { color: C.white }

  // Hero (landscape asset, full width top)
  const heroH = 4.35
  slide.addImage({ path: HERO, x: 0, y: 0, w: W, h: heroH })

  // Cover Chinese tagline band + English tagline
  slide.addShape('rect', {
    x: 0, y: 2.05, w: W, h: 0.55,
    fill: { color: C.blue, transparency: 8 },
    line: { color: C.blue },
  })
  slide.addText('Your personal AI agent', {
    x: M, y: 2.1, w: W - M * 2, h: 0.45,
    fontFace: FONT, fontSize: 22, color: C.white, bold: true, align: 'center', margin: 0,
  })

  // Intro
  slide.addText('Spur Ring', {
    x: M, y: heroH + 0.22, w: W - M * 2, h: 0.38,
    fontFace: FONT, fontSize: 26, color: C.navy, bold: true, margin: 0,
  })
  slide.addText(
    'A ring on your finger. A private voice entry to your AI—capture ideas and meetings, get organized results in the Spur app.',
    {
      x: M, y: heroH + 0.62, w: W - M * 2, h: 0.72,
      fontFace: FONT, fontSize: 11.5, color: C.muted, margin: 0,
    },
  )

  // Features
  const features = [
    { k: 'On your hand', v: 'One press to capture voice—no need to unlock your phone.' },
    { k: 'Organized for you', v: 'Transcripts, notes, and meeting summaries in the Spur app.' },
    { k: 'Ready to act', v: 'Turn what you said into tasks and documents you can use.' },
  ]
  features.forEach((f, i) => {
    const y = heroH + 1.45 + i * 1.05
    slide.addShape('roundRect', {
      x: M, y, w: W - M * 2, h: 0.92,
      fill: { color: C.card },
      line: { color: C.line, pt: 0.75 },
      rectRadius: 0.08,
    })
    slide.addShape('rect', {
      x: M + 0.12, y: y + 0.18, w: 0.08, h: 0.56,
      fill: { color: C.blue },
      line: { color: C.blue },
    })
    slide.addText(f.k, {
      x: M + 0.32, y: y + 0.12, w: 6.5, h: 0.32,
      fontFace: FONT, fontSize: 14, color: C.navy, bold: true, margin: 0,
    })
    slide.addText(f.v, {
      x: M + 0.32, y: y + 0.44, w: 6.8, h: 0.4,
      fontFace: FONT, fontSize: 11, color: C.muted, margin: 0,
    })
  })

  // Footer
  const footY = 10.05
  slide.addShape('rect', {
    x: 0, y: footY, w: W, h: H - footY,
    fill: { color: C.navy },
    line: { color: C.navy },
  })
  slide.addText('Scan to take the survey', {
    x: M, y: footY + 0.28, w: 4.8, h: 0.38,
    fontFace: FONT, fontSize: 18, color: C.white, bold: true, margin: 0,
  })
  slide.addText(`www.hispurring.com\n${CONTACT_EMAIL}`, {
    x: M, y: footY + 0.68, w: 4.8, h: 0.55,
    fontFace: FONT, fontSize: 13, color: C.white, margin: 0,
  })
  slide.addImage({
    path: QR_TMP,
    x: W - M - 1.15, y: footY + 0.22, w: 1.15, h: 1.15,
  })

  await pres.writeFile({ fileName: OUT })
  console.log(OUT)
  console.log('QR →', SURVEY_URL)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
