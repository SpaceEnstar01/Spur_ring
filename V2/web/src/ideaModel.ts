export type IdeaView = "ideas" | "tasks" | "records";

export type IdeaChapterStatus =
  | "submitting"
  | "running"
  | "finished"
  | "failed"
  | "unknown"
  | "pending";

export type IdeaChapter = {
  id: string;
  source: string;
  at: string;
  title: string;
  status: IdeaChapterStatus;
  goal: string;
  summary?: string;
};

export type IdeaCapture = {
  id: string;
  at: string;
  text: string;
  status: string;
  chapterIds: string[];
};

export type DatedChapterInput = {
  id: string;
  source: string;
  at: string;
  title: string;
  status: string;
  goal: string;
  summary?: string;
};

const chapterStatuses = new Set<IdeaChapterStatus>([
  "submitting",
  "running",
  "finished",
  "failed",
  "unknown",
  "pending",
]);

export const chapterStatusLabel: Record<IdeaChapterStatus, string> = {
  submitting: "提交中",
  running: "执行中",
  finished: "已完成",
  failed: "执行失败",
  unknown: "待核对",
  pending: "待执行",
};

export function localDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function sameLocalDay(iso: string, day: Date) {
  const parsed = new Date(iso);
  return !Number.isNaN(parsed.getTime()) && localDateKey(parsed) === localDateKey(day);
}

export function formatDay(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function ideaDraftKey(scope: string, day: string) {
  return `spur.web.idea.draft.v1:${scope}:${day}`;
}

export function asChapter(input: DatedChapterInput): IdeaChapter {
  const title = input.title.trim() || "未命名任务";
  return {
    id: input.id,
    source: input.source,
    at: input.at,
    title,
    goal: input.goal.trim() || title,
    summary: input.summary?.trim() || undefined,
    status: chapterStatuses.has(input.status as IdeaChapterStatus)
      ? (input.status as IdeaChapterStatus)
      : "unknown",
  };
}

export function chaptersForDay(items: DatedChapterInput[], day: Date) {
  return items
    .filter((item) => sameLocalDay(item.at, day))
    .map(asChapter)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export function webTaskChapters(
  tasks: Array<{ id: string; title: string; createdAt: string; status: string }>
): DatedChapterInput[] {
  return tasks.map((task) => ({
    id: task.id,
    source: "web",
    at: task.createdAt,
    title: task.title,
    status: task.status,
    goal: task.title,
  }));
}

export function chapterSourceLabel(source: string) {
  if (source === "web") return "网页任务";
  if (source === "ring") return "戒指";
  if (source === "app") return "手机 App";
  return source;
}

export function ideaCounts(captures: IdeaCapture[], chapters: IdeaChapter[]) {
  return {
    records: captures.length,
    tasks: chapters.length,
    ideas: captures.filter((item) => item.chapterIds.length === 0).length,
  };
}

export function documentForDay(day: Date) {
  return `# 今日想法

> ${formatDay(day)} · 想法文档 · 本地整理稿

## 今日概览

这一天还没有从戒指同步的原始记录。

## 整理后的想法

暂无整理内容。

## 后续可展开

- 
`;
}

export function overviewSentence(
  counts: { records: number; tasks: number; ideas: number },
  dayLabel = "今天"
) {
  return `${dayLabel}有 ${counts.records} 条原始记录、${counts.tasks} 项 Agent 任务、${counts.ideas} 条未执行想法。整理稿可以编辑、复制和导出，不会覆盖原始转写。`;
}

export function taskStatusSentence(chapters: IdeaChapter[], dayLabel = "今天") {
  if (!chapters.length) {
    return `${dayLabel}还没有 Agent 任务。戒指和手机 App 的任务接通后，也会按各自的状态出现在这里。`;
  }
  const parts = (Object.keys(chapterStatusLabel) as IdeaChapterStatus[])
    .map((status) => {
      const count = chapters.filter((item) => item.status === status).length;
      return count ? `${count} 项${chapterStatusLabel[status]}` : "";
    })
    .filter(Boolean);
  return `${dayLabel}有 ${chapters.length} 项 Agent 任务：${parts.join("，")}。`;
}

export function recordsSentence(captures: IdeaCapture[], dayLabel = "今天") {
  if (!captures.length) return `${dayLabel}没有原始记录。录音保留在手机端，网页不播放。`;
  return `${dayLabel}保留 ${captures.length} 条原始转写。编辑想法文档不会改写这些原文。`;
}

export function tasksMarkdown(chapters: IdeaChapter[], dayLabel = "今天") {
  if (!chapters.length) return `# Agent 任务\n\n${taskStatusSentence(chapters, dayLabel)}\n`;
  return [
    "# Agent 任务",
    "",
    taskStatusSentence(chapters, dayLabel),
    "",
    ...chapters.flatMap((chapter, index) => [
      `## Chapter ${String(index + 1).padStart(2, "0")} ${chapter.title}`,
      "",
      `状态：${chapterStatusLabel[chapter.status]}`,
      `来源：${chapterSourceLabel(chapter.source)}`,
      "",
      "任务目标：",
      chapter.goal,
      "",
      "请前往 Spur 手机 App 查看任务详情。",
      "",
    ]),
  ].join("\n");
}

export function recordsMarkdown(captures: IdeaCapture[], dayLabel = "今天") {
  if (!captures.length) return `# 全部原始记录\n\n${recordsSentence(captures, dayLabel)}\n`;
  return [
    "# 全部原始记录",
    "",
    recordsSentence(captures, dayLabel),
    "",
    ...captures.map((item) => {
      const time = new Date(item.at);
      const clock = Number.isNaN(time.getTime())
        ? item.at
        : `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
      return `## ${clock}\n\n${item.text}\n\n状态：${item.status || "未标记"}`;
    }),
  ].join("\n\n");
}
