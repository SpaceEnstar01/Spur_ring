import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import type { AudioAgentConfig } from './config.js'

export type ReportResult = {
  filePath: string
  url: string
}

export async function createReportPage(input: {
  config: AudioAgentConfig
  id: string
  transcript: string
  agentOutput: string
}): Promise<ReportResult> {
  const reportsDir = join(input.config.appRoot, 'reports')
  await mkdir(reportsDir, { recursive: true })

  const fileName = `${input.id}.html`
  const filePath = join(reportsDir, fileName)
  await writeFile(filePath, buildReportHtml(input))

  return {
    filePath,
    url: buildReportUrl(input.config, fileName),
  }
}

function buildReportUrl(config: AudioAgentConfig, fileName: string): string {
  const baseUrl =
    config.volcengine.publicBaseUrl || `http://localhost:${config.port}`

  return `${baseUrl.replace(/\/$/, '')}/reports/${encodeURIComponent(fileName)}`
}

function buildReportHtml(input: {
  id: string
  transcript: string
  agentOutput: string
}): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Audio Agent Report</title>
    <style>
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f6f7f8;
        color: #202124;
      }
      main {
        width: min(920px, calc(100vw - 32px));
        margin: 40px auto;
      }
      section {
        background: #fff;
        border: 1px solid #dadce0;
        border-radius: 8px;
        padding: 20px;
        margin: 16px 0;
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
        line-height: 1.6;
      }
      .meta {
        color: #5f6368;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Audio Agent Report</h1>
      <p class="meta">Task ID: ${escapeHtml(input.id)}</p>
      <section>
        <h2>Agent 输出</h2>
        <pre>${escapeHtml(input.agentOutput)}</pre>
      </section>
      <section>
        <h2>语音转写</h2>
        <pre>${escapeHtml(input.transcript)}</pre>
      </section>
    </main>
  </body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
