export type AudioTaskType = 'recording_summary' | 'agent_command' | 'agent_image'

export const DEFAULT_AUDIO_TASK_TYPE: AudioTaskType = 'agent_command'

export function isAudioTaskType(value: unknown): value is AudioTaskType {
  return (
    value === 'recording_summary' ||
    value === 'agent_command' ||
    value === 'agent_image'
  )
}

export function buildTaskPrompt(transcript: string, taskType: AudioTaskType): string {
  if (taskType === 'recording_summary') return recordingSummaryPrompt(transcript)
  if (taskType === 'agent_image') return transcript.trim()
  return agentCommandPrompt(transcript)
}

function recordingSummaryPrompt(transcript: string): string {
  // Kept for callers that still use buildTaskPrompt(recording_summary).
  // Prefer runRecordingSummaryPipeline() for production Recordings flow.
  return `请基于转写生成腾讯会议体感的中文会议纪要（含一句话总结、关键结论、讨论要点、待办表、未决问题、可转发摘要）。不要编造负责人与截止日期。

转写：
<transcript>
${transcript}
</transcript>`
}

function agentCommandPrompt(transcript: string): string {
  return `You are an action-oriented AI voice agent for an international productivity product.

The transcript is a short voice command. Infer the user's intent and complete it directly. Possible tasks include writing content, translation, rewriting, summarizing, capturing ideas, creating plans or to-dos, and answering questions. Never use the meeting-minutes template unless explicitly requested.

Language: Follow an explicitly requested language. Otherwise, answer English in English and Chinese in Chinese. For mixed or unclear input, prefer English while preserving necessary Chinese names and context.

Perform the task immediately without repeating or explaining the transcript. Produce a usable final result. Turn idea-capture requests into concise notes with informative titles. Make conservative assumptions when only minor details are missing; if essential information is absent, ask one concise clarification question. Never invent facts. Return only the final answer in clean Markdown without greetings or meta commentary.

Voice command transcript:
<transcript>
${transcript}
</transcript>`
}
