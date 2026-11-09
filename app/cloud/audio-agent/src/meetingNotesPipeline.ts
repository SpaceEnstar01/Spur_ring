import type { AudioAgentConfig } from './config.js'
import { completeChatPrompt } from './agent.js'

export type RecordingSummaryPipelineResult = {
  polishedTranscript: string
  meetingNotes: string
  notesLanguage: 'zh' | 'en'
}

/**
 * Two-step meeting pipeline (Tencent Meeting–like feel):
 * 1) Full-text polish (keep content, fix fluency/format)
 * 2) Structured meeting notes from the polished text
 */
export async function runRecordingSummaryPipeline(
  rawTranscript: string,
  config: AudioAgentConfig,
): Promise<RecordingSummaryPipelineResult> {
  const raw = rawTranscript.trim()
  if (!raw) {
    return {
      polishedTranscript: '',
      meetingNotes: '# 空录音\n\n## 一句话总结\n（无有效转写内容）\n',
      notesLanguage: 'zh',
    }
  }

  const notesLanguage = detectNotesLanguage(raw)

  const polishedTranscript = (
    await completeChatPrompt(
      buildPolishTranscriptPrompt(raw, notesLanguage),
      config,
      'You polish speech transcripts into readable full text. Never summarize away content. Return only the polished transcript.',
    )
  ).trim()

  const sourceForNotes = polishedTranscript || raw
  const meetingNotes = (
    await completeChatPrompt(
      buildMeetingNotesPrompt(sourceForNotes, notesLanguage),
      config,
      'You write structured meeting minutes for a recording-ring app. Follow the required structure and language exactly. Never invent owners or deadlines. Return only the minutes.',
    )
  ).trim()

  return {
    polishedTranscript: polishedTranscript || raw,
    meetingNotes,
    notesLanguage,
  }
}

/** ≥50% Latin letters among letters → English notes; otherwise Chinese. */
export function detectNotesLanguage(text: string): 'zh' | 'en' {
  const latin = (text.match(/[A-Za-z]/g) || []).length
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const total = latin + cjk
  if (total === 0) return 'zh'
  return latin / total >= 0.5 ? 'en' : 'zh'
}

function buildPolishTranscriptPrompt(
  rawTranscript: string,
  notesLanguage: 'zh' | 'en',
): string {
  const languageRule =
    notesLanguage === 'en'
      ? 'Output language: English (transcript is mostly English or about half English). Keep necessary Chinese names/terms if present.'
      : '输出语言：中文（转写以中文为主）。专有名词可保留英文。'

  return `你是录音 App 的「全文转写润色」助手。

任务：把 ASR 原始转写整理成【可读全文】，供用户阅读。这不是摘要，也不是会议纪要。

必须遵守：
1. 保留几乎全部信息：人名、数字、时间、结论、故事细节尽量不删。
2. 去掉口头禅与无效重复（嗯/啊/就是/那个/所以所以等），理顺病句，但不改变原意。
3. 按话题或说话节奏分段、换行；段落之间空一行。
4. 若能明确区分不同说话人，用「说话人A / 说话人B」或名字标注；无法判断则不要硬编。
5. ${languageRule}
6. 不要添加原文没有的事实；不要写成条目纪要；不要开场白或结尾说明。
7. 只输出润色后的全文。

原始转写：
<transcript>
${rawTranscript}
</transcript>`
}

function buildMeetingNotesPrompt(
  polishedTranscript: string,
  notesLanguage: 'zh' | 'en',
): string {
  if (notesLanguage === 'en') {
    return `You are the meeting-notes assistant for a recording-ring app. Turn the readable transcript into structured minutes with a Tencent Meeting–like feel.

LANGUAGE (hard rule): Write the ENTIRE minutes in English. The transcript is mostly English or roughly half English. Keep Chinese proper nouns only when necessary.

Hard rules:
- Use only facts from the transcript. Never invent attendees, owners, or deadlines.
- Unknown fields: "TBD", "Not provided", or "Unrecognized".
- No preamble. Return Markdown only.

Use this structure (keep section headings even if empty; say "Not clearly mentioned in the discussion"):

# {Concise specific title}

**Time:** Not provided
**Type:** {Meeting / Interview / Discussion / Report / Other}
**Attendees:** {list if known, else Unrecognized}

## One-line summary
{1-2 sentences}

## Key conclusions
1. …
2. …

## Discussion points
- …

## Action items
| Item | Owner | Due |
|------|-------|-----|
| … | TBD | TBD |

## Open questions
- …

## Shareable blurb
> {3-5 sentences for a group chat}

Readable transcript:
<transcript>
${polishedTranscript}
</transcript>`
  }

  return `你是录音戒指 App 的会议纪要助手。请把下面的【可读转写】整理成接近「腾讯会议 AI 纪要」体感的结构化纪要。

语言（硬性）：全程使用【中文】。已判定转写以中文为主（英文字母占比 < 50%）。专有名词可保留英文。禁止输出 Executive Summary / Key Points 等英文模板标题。

硬性规则：
- 只使用转写中出现的信息；禁止编造参会人、时间、负责人、截止日期。
- 未知项写「待指定」「待定」「未提供」或「未识别」。
- 不要开场白、不要“以下是纪要”。
- 只输出纪要正文（Markdown）。

请严格按下列结构输出（小节若确无内容，保留标题并写一句“未在讨论中明确提及”）：

# {简洁具体的会议标题}

**时间：** 未提供
**类型：** {会议/访谈/讨论/汇报/其他}
**参与人：** {能识别则列出，否则写未识别}

## 一句话总结
{用 1-2 句概括目的与结果}

## 关键结论
1. …
2. …

## 讨论要点
- …

## 待办事项
| 事项 | 负责人 | 期限 |
|------|--------|------|
| … | 待指定 | 待定 |

## 未决问题
- …

## 可转发摘要
> {3-5 句，适合直接发到群里}

可读转写：
<transcript>
${polishedTranscript}
</transcript>`
}
