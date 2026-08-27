import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFile } from 'node:fs/promises'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(here, '..', 'package.json'))
const { PDFDocument, rgb } = require('pdf-lib')
const fontkitMod = require('@pdf-lib/fontkit')
const fontkit = fontkitMod.default ?? fontkitMod

const FONT_CANDIDATES = [
  '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
  '/System/Library/Fonts/Supplemental/Songti.ttc',
  '/System/Library/Fonts/STHeiti Light.ttc',
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/google-noto-cjk/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/noto-cjk/NotoSansCJKsc-Regular.otf',
  '/usr/share/fonts/truetype/noto/NotoSansSC-Regular.otf',
]

function pickFontPath() {
  for (const path of FONT_CANDIDATES) {
    try {
      readFileSync(path)
      return path
    } catch {
      // try next
    }
  }
  throw new Error('No CJK font found on this machine')
}

function wrapLine(text, font, size, maxWidth) {
  const lines = []
  let current = ''
  for (const ch of [...String(text).replace(/\r\n/g, '\n')]) {
    if (ch === '\n') {
      lines.push(current)
      current = ''
      continue
    }
    const trial = current + ch
    if (font.widthOfTextAtSize(trial, size) > maxWidth && current) {
      lines.push(current)
      current = ch
    } else {
      current = trial
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

export async function writeOfficePdf(input, destPath) {
  const title = String(input.title || '').trim() || 'Untitled'
  const bullets = (input.bullets ?? []).map((item) => String(item).trim()).filter(Boolean)
  const body = String(input.body || '').trim()

  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(readFileSync(pickFontPath()), { subset: true })
  const page = pdf.addPage([595.28, 841.89])
  const margin = 48
  const maxWidth = 595.28 - margin * 2
  let y = 841.89 - margin - 8

  const titleSize = 18
  for (const line of wrapLine(title, font, titleSize, maxWidth)) {
    page.drawText(line, { x: margin, y, size: titleSize, font, color: rgb(0.1, 0.1, 0.12) })
    y -= titleSize + 8
  }
  y -= 8

  const bodySize = 11
  if (body) {
    for (const line of wrapLine(body, font, bodySize, maxWidth)) {
      if (y < margin + 40) break
      page.drawText(line, { x: margin, y, size: bodySize, font, color: rgb(0.15, 0.15, 0.18) })
      y -= bodySize + 5
    }
    y -= 6
  }

  for (const bullet of bullets) {
    if (y < margin + 40) break
    for (const line of wrapLine(`• ${bullet}`, font, bodySize, maxWidth)) {
      if (y < margin + 40) break
      page.drawText(line, { x: margin, y, size: bodySize, font, color: rgb(0.15, 0.15, 0.18) })
      y -= bodySize + 5
    }
    y -= 2
  }

  await writeFile(destPath, await pdf.save())
  return destPath
}
