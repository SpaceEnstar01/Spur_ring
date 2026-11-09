import { useEffect, useMemo, useRef, useState } from "react";
import { DetailDrawer } from "./DetailDrawer";
import { demoAnchor, demoCaptures, demoOnDay } from "./ideaDemoData";
import {
  chapterSourceLabel,
  chapterStatusLabel,
  formatDay,
  localDateKey,
  overviewSentence,
  recordsMarkdown,
  recordsSentence,
  taskStatusSentence,
  tasksMarkdown,
  type IdeaCapture,
  type IdeaChapter,
  type IdeaView,
} from "./ideaModel";

const soonApps = [
  ["Notion", "文档与数据库"],
  ["Google Drive", "云端文件夹"],
  ["Google Docs", "在线协作文档"],
  ["Obsidian", "本地 Markdown 知识库"],
  ["OneDrive", "云端文件存储"],
];

const blankCopy = "No ideas captured on this day.\n\nYour next idea is just one moment away.";

export function IdeaPage() {
  const today = useMemo(() => new Date(), []);
  const [day, setDay] = useState(() => demoAnchor);
  const [month, setMonth] = useState(() => demoAnchor);
  const [view, setView] = useState<IdeaView>("records");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [openChapter, setOpenChapter] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const dateRef = useRef<HTMLDivElement>(null);
  const dayKey = localDateKey(day);
  const demo = demoOnDay(day);
  const dayCaptures = demo.captures;
  const dayChapters = demo.chapters;
  const counts = demo.counts;
  const dayLabel =
    localDateKey(day) === localDateKey(today) ? "今天" : `${day.getMonth() + 1}月${day.getDate()}日`;
  const ideaDocument = drafts[dayKey] ?? demo.document;

  useEffect(() => {
    if (!calendarOpen) return;
    function pointer(event: MouseEvent) {
      if (!dateRef.current?.contains(event.target as Node)) setCalendarOpen(false);
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") setCalendarOpen(false);
    }
    document.addEventListener("mousedown", pointer);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", pointer);
      document.removeEventListener("keydown", key);
    };
  }, [calendarOpen]);

  function updateDraft(value: string) {
    setDrafts((current) => ({ ...current, [dayKey]: value }));
  }

  function currentText() {
    if (view === "ideas") return ideaDocument || blankCopy;
    if (view === "tasks") {
      return dayChapters.length ? tasksMarkdown(dayChapters, dayLabel) : blankCopy;
    }
    return dayCaptures.length ? recordsMarkdown(dayCaptures, dayLabel) : blankCopy;
  }

  function chooseDay(next: Date) {
    setDay(next);
    setMonth(next);
    setCalendarOpen(false);
    setOpenChapter("");
    setNotice("");
  }

  async function copyCurrent() {
    const text = currentText();
    try {
      await navigator.clipboard.writeText(text);
      setNotice("已复制到剪贴板");
    } catch {
      const area = window.document.createElement("textarea");
      area.value = text;
      window.document.body.append(area);
      area.select();
      const ok = window.document.execCommand("copy");
      area.remove();
      setNotice(ok ? "已复制到剪贴板" : "复制失败，请手动选择文本");
    }
  }

  function exportCurrent() {
    const text = currentText();
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `Spur-${dayKey}-${view}.md`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Markdown 已导出");
  }

  const headings = {
    ideas: [demo.title || "未执行想法", "可编辑的思考资产，支持复制与导出"],
    tasks: ["Agent 任务 · Chapters", "每项任务独立成章，详情请在 Spur 手机 App 查看"],
    records: ["全部原始记录 · 时间线", "每句话保留时间与状态，录音仍在手机端"],
  }[view];

  return (
    <section className="idea-page">
      <p className="idea-crumb">WORKSPACE / IDEA</p>
      <div className="idea-top">
        <div>
          <h1>From Idea to Content</h1>
          <p>每一天的想法和任务都留在这一天。</p>
        </div>
        <div className="idea-top-tools">
          <span className="idea-example">Example</span>
          <div className="idea-date" ref={dateRef}>
          <button
            type="button"
            className="idea-date-button"
            aria-expanded={calendarOpen}
            onClick={() => {
              setMonth(day);
              setCalendarOpen((open) => !open);
            }}
          >
            <CalendarIcon />
            {formatDay(day).replace(`${day.getFullYear()}年`, "")}
            {localDateKey(day) === localDateKey(today) ? " · 今天" : ""}
          </button>
          {calendarOpen && (
            <IdeaCalendar
              month={month}
              selected={day}
              marked={markedDays(month, demoCaptures)}
              onMonth={setMonth}
              onSelect={chooseDay}
              today={today}
            />
          )}
          </div>
        </div>
      </div>
      <div className="idea-stats" role="tablist" aria-label="当天内容">
        {(
          [
            ["records", counts.records, "全部原始记录"],
            ["tasks", counts.tasks, "Agent 任务"],
            ["ideas", counts.ideas, "未执行想法"],
          ] as const
        ).map(([id, count, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            className={view === id ? "active" : ""}
            onClick={() => {
              setView(id);
              setNotice("");
            }}
          >
            <strong>{count}</strong>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <section className="idea-work">
        <header>
          <div>
            <h2>{headings[0]}</h2>
            <p>{headings[1]}</p>
          </div>
          <div className="idea-actions">
            <button type="button" onClick={() => void copyCurrent()}>
              复制原文
            </button>
            <button type="button" onClick={exportCurrent}>
              导出 Markdown
            </button>
            <button
              type="button"
              onClick={() => {
                setAppsOpen(true);
                setNotice("访客网站还不能把想法写入 Notion。");
              }}
            >
              同步 Notion
            </button>
            <button
              type="button"
              onClick={() =>
                setNotice("Idea 页不会发起任务。需要创作时，请回到首页对话框。")
              }
            >
              Agent 创作
            </button>
            <button type="button" onClick={() => setAppsOpen(true)}>
              连接应用
            </button>
          </div>
        </header>
        <div className="idea-body">
          {view === "ideas" && ideaDocument ? (
            <>
              <p className="idea-summary">{overviewSentence(counts, dayLabel)}</p>
              <textarea
                className="idea-editor"
                aria-label="可编辑 Markdown 想法文档"
                value={ideaDocument}
                onChange={(event) => updateDraft(event.target.value)}
              />
              <p className="idea-hint">
                整理稿可以修改、复制和导出。原始记录不会被这里的编辑覆盖。
              </p>
            </>
          ) : view === "tasks" && dayChapters.length ? (
            <>
              <p className="idea-summary">{taskStatusSentence(dayChapters, dayLabel)}</p>
              <IdeaChapterList
                chapters={dayChapters}
                openId={openChapter}
                onOpen={setOpenChapter}
              />
            </>
          ) : view === "records" && dayCaptures.length ? (
            <>
              <p className="idea-summary">{recordsSentence(dayCaptures, dayLabel)}</p>
              {dayCaptures.map((item) => (
                <article className="idea-record" key={item.id}>
                  <time>{clock(item.at)}</time>
                  <p>{item.text}</p>
                  <small>{item.status || "未标记"}</small>
                </article>
              ))}
            </>
          ) : (
            <IdeaBlank />
          )}
          {notice && (
            <p className="idea-notice" role="status">
              {notice}
            </p>
          )}
        </div>
      </section>
      {appsOpen && (
        <DetailDrawer title="连接应用" onClose={() => setAppsOpen(false)}>
          <h2>连接应用</h2>
          <p>这些保存位置尚未在访客网站开放，不会显示为已连接。</p>
          <div className="idea-apps">
            {soonApps.map(([name, detail]) => (
              <article key={name}>
                <strong>{name}</strong>
                <span>{detail}</span>
                <button type="button" disabled>
                  即将支持
                </button>
              </article>
            ))}
          </div>
          <p>YouTube 仍在侧栏的连接应用里管理。</p>
        </DetailDrawer>
      )}
    </section>
  );
}

function IdeaChapterList({
  chapters,
  openId,
  onOpen,
}: {
  chapters: IdeaChapter[];
  openId: string;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="idea-chapters">
      {chapters.map((chapter, index) => {
        const open = openId === chapter.id;
        return (
          <article key={`${chapter.source}:${chapter.id}`}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => onOpen(open ? "" : chapter.id)}
            >
              <span>Chapter {String(index + 1).padStart(2, "0")}</span>
              <strong>{chapter.title}</strong>
              <em className={"idea-status idea-status-" + chapter.status}>
                {chapterStatusLabel[chapter.status]}
              </em>
            </button>
            {open && (
              <div className="idea-chapter-detail">
                <h3>任务目标</h3>
                <p>{chapter.goal}</p>
                {chapter.summary && (
                  <>
                    <h3>摘要</h3>
                    <p>{chapter.summary}</p>
                  </>
                )}
                <small>来源 · {chapterSourceLabel(chapter.source)}</small>
                <div>
                  <strong>请前往 Spur 手机 App 查看任务详情</strong>
                  <p>View details in the Spur App</p>
                  <small>完整执行过程与任务成果请在手机端查看。当前网页不提供跳转。</small>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function IdeaBlank() {
  return (
    <div className="idea-blank">
      <strong>No ideas captured on this day.</strong>
      <p>Your next idea is just one moment away.</p>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M4 9.5h16" />
    </svg>
  );
}

function IdeaCalendar({
  month,
  selected,
  marked,
  today,
  onMonth,
  onSelect,
}: {
  month: Date;
  selected: Date;
  marked: Map<number, number>;
  today: Date;
  onMonth: (next: Date) => void;
  onSelect: (next: Date) => void;
}) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1).getDay();
  const count = new Date(year, monthIndex + 1, 0).getDate();
  return (
    <div className="idea-calendar" role="dialog" aria-label="选择日期">
      <div>
        <button
          type="button"
          aria-label="上个月"
          onClick={() => onMonth(new Date(year, monthIndex - 1, 1))}
        >
          ‹
        </button>
        <strong>
          {year} 年 {monthIndex + 1} 月
        </strong>
        <button
          type="button"
          aria-label="下个月"
          onClick={() => onMonth(new Date(year, monthIndex + 1, 1))}
        >
          ›
        </button>
      </div>
      <div className="idea-calendar-grid">
        {"日一二三四五六".split("").map((label) => (
          <span key={label}>{label}</span>
        ))}
        {Array.from({ length: first }, (_, index) => (
          <i key={"blank-" + index} />
        ))}
        {Array.from({ length: count }, (_, index) => {
          const date = index + 1;
          const next = new Date(year, monthIndex, date, 12);
          const selectedDay =
            selected.getFullYear() === year &&
            selected.getMonth() === monthIndex &&
            selected.getDate() === date;
          return (
            <button
              key={date}
              type="button"
              className={selectedDay ? "selected" : ""}
              aria-current={selectedDay ? "date" : undefined}
              onClick={() => onSelect(next)}
            >
              {date}
              {(marked.get(date) ?? 0) > 0 && <small>{marked.get(date)}</small>}
            </button>
          );
        })}
      </div>
      <button type="button" className="idea-today" onClick={() => onSelect(today)}>
        Today
      </button>
    </div>
  );
}

function markedDays(month: Date, items: Array<{ at: string }>) {
  const marks = new Map<number, number>();
  for (const item of items) {
    const time = new Date(item.at);
    if (
      time.getFullYear() === month.getFullYear() &&
      time.getMonth() === month.getMonth()
    ) {
      const date = time.getDate();
      marks.set(date, (marks.get(date) ?? 0) + 1);
    }
  }
  return marks;
}

function clock(iso: string) {
  const time = new Date(iso);
  if (Number.isNaN(time.getTime())) return iso;
  return `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
}

