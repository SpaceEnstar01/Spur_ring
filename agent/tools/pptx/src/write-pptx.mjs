import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(here, '..', 'package.json'))
const PptxGenJS = require('pptxgenjs')

const FONT = 'PingFang SC'

export async function writeOfficePptx(input, destPath) {
  const title = String(input.title || '').trim() || 'Untitled'
  const bullets = (input.bullets ?? []).map((item) => String(item).trim()).filter(Boolean)
  const body = String(input.body || '').trim()

  const pres = new PptxGenJS()
  pres.defineLayout({ name: 'A4', width: 11.69, height: 8.27 })
  pres.layout = 'A4'
  pres.author = 'Spur'
  pres.title = title

  const slide = pres.addSlide()
  slide.addText(title, {
    x: 0.5,
    y: 0.35,
    w: 10.6,
    h: 0.7,
    fontSize: 28,
    fontFace: FONT,
    bold: true,
    color: '1A1A1A',
  })

  let y = 1.2
  if (body) {
    slide.addText(body, {
      x: 0.5,
      y,
      w: 10.6,
      h: 1.2,
      fontSize: 16,
      fontFace: FONT,
      color: '333333',
      valign: 'top',
    })
    y = 2.5
  }

  if (bullets.length > 0) {
    slide.addText(
      bullets.map((text) => ({ text, options: { fontFace: FONT, fontSize: 16, color: '333333', breakLine: true } })),
      {
        x: 0.6,
        y,
        w: 10.4,
        h: 5.2,
        fontFace: FONT,
        fontSize: 16,
        color: '333333',
        valign: 'top',
        paraSpaceAfter: 8,
      },
    )
  }

  await pres.writeFile({ fileName: destPath })
  return destPath
}
