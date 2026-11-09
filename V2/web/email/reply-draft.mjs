export function extractEmailDraft(answer) {
  const output = String(answer || '')
  const structured = output.match(/<<SPUR_DRAFT_JSON>>\s*([\s\S]*?)\s*<<END_SPUR_DRAFT_JSON>>/)
  if (structured) {
    try {
      const parsed = JSON.parse(structured[1])
      const subject = typeof parsed.subject === 'string' ? parsed.subject.trim() : ''
      const text = typeof parsed.text === 'string' ? parsed.text.trim() : ''
      return subject && text ? { subject, text } : null
    } catch { return null }
  }
  const section = output.split(/##\s*9[.、]\s*回复草稿/i)[1]
  if (!section) return null
  const subjectMatch = section.match(/\*\*主题\*\*[：:]\s*(.+)/)
  if (!subjectMatch) return null
  let text = section.slice((subjectMatch.index ?? 0) + subjectMatch[0].length)
  text = text.replace(/^\s*\n+/, '').replace(/^>.*(?:\n|$)/gm, '')
  text = text.split(/\n\s*---\s*\n|\n\s*\*\*备注\*\*/i)[0].trim()
  return text ? { subject: subjectMatch[1].trim().replace(/\*+$/, ''), text } : null
}

export function stripDraftMarker(answer) {
  return String(answer || '').replace(/\n?<<SPUR_DRAFT_JSON>>[\s\S]*?<<END_SPUR_DRAFT_JSON>>\s*$/, '').trim()
}
