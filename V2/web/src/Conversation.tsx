import { useState, useEffect } from "react";
import { TaskInput } from "./TaskInput";
import { ResultContent } from "./ResultContent";
import { AgentWorkspace } from "./AgentWorkspace";
import { DetailDrawer } from "./DetailDrawer";
import { statusLabel } from "./Sidebar";
import { resourceUrl, type Task } from "./taskApi";
export function Conversation({
  task,
  tasks,
  onContinue,
  onRefresh,
}: {
  task: Task;
  tasks: Task[];
  onContinue: (text: string) => void;
  onRefresh: (id: string) => void;
}) {
  const [input, setInput] = useState(""),
    [preview, setPreview] = useState<Task | null>(null);
  const chain: Task[] = [],
    seen = new Set<string>();
  let current: Task | undefined = task;
  while (current && !seen.has(current.id)) {
    chain.unshift(current);
    seen.add(current.id);
    current = tasks.find((t) => t.id === current?.parentId);
  }
  useEffect(() => {
    setInput("");
    setPreview(null);
  }, [task.id]);
  const working = ["running", "submitting"].includes(task.status);
  return (
    <section className="conversation" aria-label="任务对话">
      <div className="conversation-messages">
        {chain.map((t) => (
          <article className="conversation-turn" key={t.id}>
            <div className="user-bubble">{t.title}</div>
            <div className="agent-message">
              <div className="conversation-agent">
                ✧ <strong>Spur</strong>
                <span>{statusLabel[t.status]}</span>
              </div>
              <details className="compact-activity">
                <summary>
                  Agent Activity{" "}
                  <span>
                    {t.events.length} 条实际活动 · {statusLabel[t.status]}
                  </span>
                </summary>
                {(t.plan || t.result?.plan)?.steps.map((step, i) => (
                  <div className="compact-step" key={"p" + i}>
                    <span>{step.status === "completed" ? "✓" : "○"}</span>
                    <div>
                      <strong>{step.title}</strong>
                      <small>{step.status}</small>
                      {step.evidence && <p>{step.evidence}</p>}
                    </div>
                  </div>
                ))}
                {t.events.map((event, i) => (
                  <div className="compact-step" key={i}>
                    <span>
                      {event.available === false
                        ? "!"
                        : event.event === "result"
                        ? "✓"
                        : "↗"}
                    </span>
                    <div>
                      <strong>{event.tool || "Agent 活动"}</strong>
                      <small>
                        {event.event === "result" ? "已返回结果" : "开始调用"} ·{" "}
                        {new Date(event.observedAt).toLocaleTimeString()}
                      </small>
                    </div>
                  </div>
                ))}
                {!t.events.length && (
                  <p className="quiet-note">
                    {["running", "submitting"].includes(t.status)
                      ? "等待 Agent 返回真实执行记录。"
                      : "没有可展示的工具活动。"}
                  </p>
                )}
              </details>
              {t.result ? (
                <>
                  <ResultContent text={t.result.response} />
                  {Boolean(
                    t.result.artifacts?.length ||
                      t.result.media?.length ||
                      t.result.videoJobs?.length
                  ) && (
                    <button
                      className="artifact-preview"
                      onClick={() => setPreview(t)}
                    >
                      ▤ 查看交付成果 <span>打开预览 →</span>
                    </button>
                  )}
                  {t.result.sources?.map((s, i) => {
                    const url = resourceUrl(s.url);
                    return url ? (
                      <a
                        className="conversation-source"
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {s.title || "查看来源"} ↗
                      </a>
                    ) : null;
                  })}
                </>
              ) : (
                <p className="quiet-note">
                  {t.queue?.state === "queued"
                    ? `排队中 · 前方有 ${Math.max(0,t.queue.position-1)} 个等待任务，当前 ${t.queue.active}/2 个任务正在运行。轮到后会自动开始，可先离开页面。`
                    : t.queue?.state === "dispatching"
                    ? "正在确认任务启动状态，请勿重复提交。"
                    : t.status === "running"
                    ? "Spur is working on it…"
                    : t.status === "submitting"
                    ? "正在提交任务…"
                    : t.status === "finished"
                    ? "正在取回成果…"
                    : "尚未取得任务成果。"}
                </p>
              )}
              {(t.error || t.connectionError) && (
                <div className="task-error" role="status">
                  {t.error || t.connectionError}
                  <button onClick={() => onRefresh(t.id)}>
                    查询原任务状态 ↗
                  </button>
                </div>
              )}
              <details className="task-reference">
                <summary>任务信息</summary>
                <code>{t.id}</code>
                <p>离开此页面不会取消后台任务。</p>
              </details>
            </div>
          </article>
        ))}
      </div>
      <div className="conversation-composer">
        <TaskInput
          compact
          value={input}
          onChange={setInput}
          disabled={working || task.status === "unknown"}
          onSubmit={() => {
            onContinue(input);
            setInput("");
          }}
        />
        <p>继续补充需求 · 外部发送、发布等操作仍需明确批准</p>
      </div>
      {preview && (
        <DetailDrawer title="交付成果" onClose={() => setPreview(null)}>
          <AgentWorkspace
            task={preview}
            onContinue={onContinue}
            onRefresh={() => onRefresh(preview.id)}
          />
        </DetailDrawer>
      )}
    </section>
  );
}
