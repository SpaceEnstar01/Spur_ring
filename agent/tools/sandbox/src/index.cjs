'use strict'

const { statSync } = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

exports.name = 'spur-office-sandbox'
exports.inject = ['tools']

function plainText(value) {
  return String(value ?? '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(^|[^*])\*(?!\*)([^*]+)\*(?!\*)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*/g, '')
    .trim()
}

function officeCopy(args) {
  return {
    title: plainText(args.title),
    body: plainText(args.body),
    bullets: Array.isArray(args.bullets) ? args.bullets.map(plainText).filter(Boolean) : [],
  }
}

function stemOf(args, fallback) {
  return String(args.file_stem || args.title || fallback)
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .slice(0, 80)
}

const textFields = {
  title: { type: 'string', required: true, description: 'Plain-text title (no Markdown)' },
  body: { type: 'string', description: 'Optional plain-text paragraph (no Markdown)' },
  bullets: {
    type: 'array',
    description: 'Optional plain-text bullets (no **bold** Markdown)',
    items: { type: 'string' },
  },
}

const fileResult = {
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      path: { type: 'string' },
      bytes: { type: 'number' },
    },
    required: ['path', 'bytes'],
  },
}

exports.apply = function apply(ctx) {
  ctx.tools.register({
    name: 'create_pdf',
    description:
      'Create a real one-page PDF (binary %PDF header, preview-openable). '
      + 'Use this instead of Write/bash for .pdf. Chinese is supported. '
      + 'Pass plain text only: no Markdown (**bold**, headings, backticks).',
    parameters: { ...textFields, file_stem: { type: 'string', description: 'Output basename without .pdf' } },
    output: {
      ...fileResult,
      render: (_args, value) => [{ type: 'text', text: `PDF written: ${value.path} (${value.bytes} bytes)` }],
    },
    async execute(args) {
      const [{ writeOfficePdf }, { officeOutputPath }] = await Promise.all([
        import(pathToFileURL(join(__dirname, '../../pdf/src/write-pdf.mjs')).href),
        import(pathToFileURL(join(__dirname, 'output.mjs')).href),
      ])
      const dest = await officeOutputPath(`${stemOf(args, 'document')}.pdf`)
      await writeOfficePdf(officeCopy(args), dest)
      return { path: dest, bytes: statSync(dest).size }
    },
  })

  ctx.tools.register({
    name: 'create_pptx',
    description:
      'Create a real PowerPoint file (.pptx OOXML). Use this instead of Write/bash for .pptx. '
      + 'Chinese is supported. One title slide with optional body and bullets. '
      + 'Pass plain text only: no Markdown (**bold**, headings, backticks).',
    parameters: { ...textFields, file_stem: { type: 'string', description: 'Output basename without .pptx' } },
    output: {
      ...fileResult,
      render: (_args, value) => [{ type: 'text', text: `PPTX written: ${value.path} (${value.bytes} bytes)` }],
    },
    async execute(args) {
      const [{ writeOfficePptx }, { officeOutputPath }] = await Promise.all([
        import(pathToFileURL(join(__dirname, '../../pptx/src/write-pptx.mjs')).href),
        import(pathToFileURL(join(__dirname, 'output.mjs')).href),
      ])
      const dest = await officeOutputPath(`${stemOf(args, 'slides')}.pptx`)
      await writeOfficePptx(officeCopy(args), dest)
      return { path: dest, bytes: statSync(dest).size }
    },
  })
}
