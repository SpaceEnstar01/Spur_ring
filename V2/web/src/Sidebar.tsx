import { Icon } from "./Icon";
import type { Task } from "./taskApi";
export type Page =
  | "home"
  | "agent"
  | "workspace"
  | "tasks"
  | "deliverables"
  | "mail"
  | "apps"
  | "idea"
  | "memory";
export const statusLabel: Record<Task["status"], string> = {
  submitting: "提交中",
  running: "执行中",
  finished: "已完成",
  failed: "执行失败",
  unknown: "待核对",
};
export function Sidebar({
  page,
  tasks,
  selected,
  open,
  onClose,
  onPage,
  onTask,
}: {
  page: Page;
  tasks: Task[];
  selected: string;
  open: boolean;
  onClose: () => void;
  onPage: (p: Page) => void;
  onTask: (id: string) => void;
}) {
  return (
    <>
      {open && (
        <button
          className="sidebar-scrim"
          onClick={onClose}
          aria-label="关闭导航"
        />
      )}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <button
            className="brand"
            onClick={() => onPage("home")}
            aria-label="Spur 首页"
          >
            <span className="brand-symbol" />
            Spur<span className="brand-period">.</span>
          </button>
          <button
            className="mobile-close icon-button"
            onClick={onClose}
            aria-label="关闭导航"
          >
            <Icon name="close" />
          </button>
        </div>
        <button className="new-task" onClick={() => onPage("home")}>
          <Icon name="plus" />
          New task<span>↗</span>
        </button>
        <nav aria-label="主导航">
          {(
            [
              ["home", "首页", "⌂"],
              ["idea", "Idea", "✎"],
              ["agent", "Agent", "✧"],
              ["memory", "Memory", "◈"],
            ] as const
          ).map(([id, label, mark]) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => onPage(id)}
            >
              <span className="nav-symbol">{mark}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="history-heading">
          <button onClick={() => onPage("tasks")}>任务历史</button>
          <span>{tasks.length || ""}</span>
        </div>
        <div className="task-history">
          {!tasks.length ? (
            <p className="history-empty">把第一件事交给 Spur。</p>
          ) : (
            tasks.map((t) => (
              <button
                key={t.id}
                onClick={() => onTask(t.id)}
                className={`history-item ${
                  selected === t.id && page === "workspace" ? "current" : ""
                }`}
                title={t.title}
              >
                <span className={`task-dot dot-${t.status}`} />
                <span>{t.title}</span>
                <small>{statusLabel[t.status]}</small>
              </button>
            ))
          )}
        </div>
        <div className="sidebar-bottom">
          <button
            className={`nav-item ${page === "apps" ? "active" : ""}`}
            onClick={() => onPage("apps")}
          >
            <Icon name="link" size={17} />
            连接应用
          </button>
          <div className="space-owner">
            <span className="owner-avatar">S</span>
            <div>
              <strong>Personal workspace</strong>
              <small>你的想法，持续向前。</small>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
