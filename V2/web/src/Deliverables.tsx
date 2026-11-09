import { RecentVideoTasks } from './VideoTask'
import { apiBase, resourceUrl, type Task } from './taskApi'
import { statusLabel } from './Sidebar'
export function Deliverables({
  tasks,
  onTask,
  history = false,
  onHome,
}: {
  tasks: Task[]
  onTask: (id: string) => void
  history?: boolean
  onHome: () => void
}) {
  const visible = history ? tasks : tasks.filter((t) => t.status === 'finished')
  const preview = (text: string) =>
    text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[#*]/g, '')
      .slice(0, 110)
  return (
    <section className="library">
      <span className="eyebrow">YOUR WORK, TOGETHER</span>
      <h1>{history ? '任务历史' : '成果库'}</h1>
      <p className="page-description">
        {history
          ? '从想法到交付，每一件事都有迹可循。'
          : '研究、创作与文件，汇集在一个地方。'}
        <small>此浏览器记录的任务，不代表完整云端历史。</small>
      </p>
      <div className="library-list">
        {visible.length ? (
          visible.map((task) => (
            <article className="library-item" key={task.id}>
              <span className="library-icon">
                {task.status === 'finished' ? '▤' : '◫'}
              </span>
              <div className="library-copy">
                <button onClick={() => onTask(task.id)}>{task.title}</button>
                <p>
                  {(task.result?.response
                    ? preview(task.result.response)
                    : '') || '打开任务，查询真实状态与成果。'}
                </p>
                <div className="library-meta">
                  <span className={`task-dot dot-${task.status}`} />
                  {statusLabel[task.status]}
                  <span>·</span>
                  {new Date(task.createdAt).toLocaleString('zh-CN')}
                </div>
                {task.result?.artifacts?.length ? (
                  <div className="library-downloads">
                    {task.result.artifacts.map((file) => {
                      const href = resourceUrl(file.url)
                      return href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          key={file.url}
                        >
                          ▤ {file.title} ↗
                        </a>
                      ) : null
                    })}
                  </div>
                ) : null}
              </div>
              <button
                className="open-task"
                aria-label={'打开任务：' + task.title}
                onClick={() => onTask(task.id)}
              >
                ↗
              </button>
            </article>
          ))
        ) : (
          <div className="library-empty">
            <span>▤</span>
            <h2>
              {history ? '你的第一项任务，从这里开始' : '好成果，值得留下来'}
            </h2>
            <p>把研究或创作交给 Spur，完成后在这里查看。</p>
            <button className="secondary-button" onClick={onHome}>
              创建任务 ↗
            </button>
          </div>
        )}
      </div>
      <RecentVideoTasks
        base={apiBase()}
        excludeIds={tasks.flatMap(
          (t) => t.result?.videoJobs?.map((j) => j.id) || []
        )}
      />
    </section>
  )
}
