import { useEffect, useState } from 'react'
import { SpurPulse } from './SpurPulse'
import { TaskInput } from './TaskInput'
import { ResultContent } from './ResultContent'
import { VideoTaskCard } from './VideoTask'
import { statusLabel } from './Sidebar'
import { apiBase, resourceUrl, type Task, type Link } from './taskApi'

const toolLabels: Record<string, string> = {
  web_search: '搜索公开资料',
  research_search: '检索平台内容',
  research_native_search: '检索平台原生内容',
  research_capabilities: '检查研究能力',
  browser_navigate: '打开网页',
  browser_snapshot: '读取页面',
  web_fetch: '读取网页正文',
  save_document: '保存文档',
  image_generate: '生成图片',
  video_generate: '提交视频任务',
  update_plan: '更新执行计划',
}
function Links({ items, files = false }: { items: Link[]; files?: boolean }) {
  return (
    <div className="workspace-links">
      {items.map((item, i) => {
        const href = resourceUrl(item.url)
        return href ? (
          <a key={item.url + i} href={href} target="_blank" rel="noreferrer">
            <span className={`link-icon ${files ? 'file-icon' : ''}`}>
              {files ? '▤' : '↗'}
            </span>
            <span>
              <strong>{item.title || '查看来源'}</strong>
              <small>{files ? '打开交付文件' : new URL(href).hostname}</small>
            </span>
            <span>↗</span>
          </a>
        ) : null
      })}
    </div>
  )
}
export function AgentWorkspace({
  task,
  onContinue,
  onRefresh,
}: {
  task: Task
  onContinue: (text: string) => void
  onRefresh: () => void
}) {
  const [tab, setTab] = useState<'result' | 'sources' | 'files'>('result')
  const [followup, setFollowup] = useState('')
  useEffect(() => {
    setTab('result')
    setFollowup('')
  }, [task.id])
  const working = ['running', 'submitting'].includes(task.status)
  const result = task.result
  const sources = result?.sources || []
  const files = result?.artifacts || []
  const plan = task.plan || result?.plan
  const summary =
    task.status === 'finished'
      ? '任务已完成，成果已交付。'
      : task.status === 'failed'
      ? '任务遇到了问题。'
      : task.status === 'unknown'
      ? '任务状态待核对。'
      : task.status === 'submitting'
      ? '正在提交任务…'
      : 'Spur is working on it…'
  return (
    <section className="agent-workspace" aria-label="Agent 工作空间">
      <div className="workspace-title">
        <div>
          <span className="eyebrow">YOUR INTENT, IN MOTION</span>
          <h1>{task.title}</h1>
        </div>
        <span className={`status-pill status-${task.status}`}>
          <span className={`task-dot dot-${task.status}`} />
          {statusLabel[task.status]}
        </span>
      </div>
      <div className="agent-state">
        <SpurPulse state={task.status} small />
        <div>
          <h2>{summary}</h2>
          <p>
            {working
              ? '进度来自 Agent 的实际执行记录。'
              : new Date(task.createdAt).toLocaleString('zh-CN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
          </p>
        </div>
      </div>
      <div className="workspace-columns">
        <section className="activity-panel">
          <div className="panel-label">
            <span>Agent Activity</span>
            <span className="live-label">
              {working ? (
                <>
                  <i />
                  LIVE
                </>
              ) : (
                'EXECUTION'
              )}
            </span>
          </div>
          <div className="intent-block">
            <span>你的任务</span>
            <p>{task.title}</p>
          </div>
          {plan?.steps?.length ? (
            <div className="plan">
              <span className="section-caption">执行计划</span>
              {plan.steps.map((step, i) => (
                <div className={`plan-step step-${step.status}`} key={i}>
                  <span className="step-mark">
                    {step.status === 'completed' ? '✓' : i + 1}
                  </span>
                  <div>
                    <strong>{step.title}</strong>
                    <small>
                      {(
                        {
                          pending: '待处理',
                          in_progress: '执行中',
                          completed: '已完成',
                          blocked: '受阻',
                        } as Record<string, string>
                      )[step.status] || step.status}
                    </small>
                    {step.evidence && <p>{step.evidence}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <div className="observed-events">
            <span className="section-caption">执行活动</span>
            {task.events.length ? (
              task.events.map((e, i) => (
                <div className="activity-event" key={i}>
                  <span
                    className={`event-node ${
                      e.available === false ? 'event-warning' : ''
                    }`}
                  >
                    {e.event === 'result'
                      ? e.available === false
                        ? '!'
                        : '✓'
                      : '·'}
                  </span>
                  <div>
                    <strong>{toolLabels[e.tool || ''] || e.tool}</strong>
                    <p>
                      {e.event === 'result'
                        ? e.available === false
                          ? '工具返回不可用结果'
                          : '收到工具结果'
                        : '工具调用'}
                      <time>
                        {new Date(e.observedAt).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </p>
                    {e.source && resourceUrl(e.source) && (
                      <a
                        href={resourceUrl(e.source)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {new URL(resourceUrl(e.source)!).hostname} ↗
                      </a>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="quiet-note">
                {working
                  ? '任务已交给 Agent，等待执行记录。'
                  : '此任务没有可展示的工具活动。'}
              </p>
            )}
          </div>
          <p className="activity-footnote">仅显示此网页实际查询到的活动。</p>
          {(task.error || task.connectionError) && (
            <div className="task-error" role="status">
              {task.error || task.connectionError}
              <button onClick={onRefresh}>查询原任务状态 ↗</button>
            </div>
          )}
          <details className="task-reference">
            <summary>任务信息</summary>
            <code>{task.id}</code>
            <p>
              刷新页面后可从此浏览器的历史重新查询。关闭网页不等于取消云端任务。
            </p>
          </details>
        </section>
        <section className="live-panel">
          <div className="live-tabs" role="tablist" aria-label="交付内容">
            {(
              [
                ['result', 'Live Workspace'],
                [
                  'sources',
                  `Sources${sources.length ? ' · ' + sources.length : ''}`,
                ],
                ['files', `Files${files.length ? ' · ' + files.length : ''}`],
              ] as const
            ).map(([id, label]) => (
              <button
                role="tab"
                aria-selected={tab === id}
                aria-controls={'panel-' + id}
                id={'tab-' + id}
                onClick={() => setTab(id)}
                key={id}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            className="live-content"
            role="tabpanel"
            id={'panel-' + tab}
            aria-labelledby={'tab-' + tab}
          >
            {tab === 'result' ? (
              result ? (
                <>
                  <div className="deliverable-heading">
                    <span className="document-symbol">▤</span>
                    <div>
                      <span className="eyebrow">DELIVERED BY SPUR</span>
                      <h2>你的任务成果</h2>
                    </div>
                    <span className="complete-check">✓</span>
                  </div>
                  <ResultContent text={result.response} />
                  {result.media?.map((item) => {
                    const url = resourceUrl(item.url)
                    return url ? (
                      <figure className="generated-image" key={item.url}>
                        <a href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt={item.title} />
                        </a>
                        <figcaption>
                          {item.title} ·{' '}
                          <a href={url} download>
                            下载图片
                          </a>
                        </figcaption>
                      </figure>
                    ) : null
                  })}
                  {result.videoJobs?.map((job) => (
                    <VideoTaskCard
                      key={job.id}
                      initial={job}
                      base={apiBase()}
                    />
                  ))}
                  {files.length > 0 && (
                    <div className="inline-files">
                      <span className="section-caption">交付文件</span>
                      <Links items={files} files />
                    </div>
                  )}
                </>
              ) : (
                <div className="workspace-wait">
                  <div className="waiting-document">
                    ▤<span />
                  </div>
                  <h3>
                    {task.status === 'failed'
                      ? '这次任务尚未交付成果'
                      : task.status === 'finished'
                      ? '正在取回任务成果'
                      : '成果正在这里成形'}
                  </h3>
                  <p>
                    {working
                      ? 'Agent 执行后，真实报告、来源和文件会显示在这里。'
                      : '查询原任务即可核对执行结果，无需重复提交。'}
                  </p>
                  <span>RESEARCH · CREATE · DELIVER</span>
                </div>
              )
            ) : tab === 'sources' ? (
              sources.length ? (
                <Links items={sources} />
              ) : (
                <div className="tab-empty">
                  {working
                    ? '来源将在 Agent 返回后展示。'
                    : '本次返回没有结构化来源列表；正文中的来源链接仍可打开。'}
                </div>
              )
            ) : files.length ? (
              <Links items={files} files />
            ) : (
              <div className="tab-empty">
                {working
                  ? '交付文件将在生成后展示。'
                  : '本次没有返回独立文件，文字成果可在 Live Workspace 查看。'}
              </div>
            )}
          </div>
        </section>
      </div>
      <div className="followup">
        <TaskInput
          compact
          value={followup}
          onChange={setFollowup}
          disabled={working}
          onSubmit={() => {
            onContinue(followup)
            setFollowup('')
          }}
        />
        <p>补充需求将基于当前结果创建后续任务。外部发送仍需你明确批准。</p>
      </div>
    </section>
  )
}
