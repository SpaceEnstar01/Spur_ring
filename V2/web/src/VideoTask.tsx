import {useEffect,useState} from 'react'
export type VideoTask = {id:string;status:string;createdAt?:string;error?:string|null;url?:string|null}
const labels:Record<string,string>={submitting:'正在提交',queued:'视频排队中',generating:'正在生成视频',downloading:'正在保存视频',completed:'视频已生成',failed:'视频生成失败',paused:'查询已暂停',submission_unknown:'提交结果暂未确认'}
export function VideoTaskCard({initial,base}:{initial:VideoTask;base:string}){
 const [job,setJob]=useState(initial)
 const [revision,setRevision]=useState(0)
 const [connectionError,setConnectionError]=useState('')
 useEffect(()=>{
  let stopped=false;let timer:ReturnType<typeof setTimeout>|undefined
  const controller=new AbortController()
  const poll=async()=>{
   let terminal=false
   try{
    const response=await fetch(`${base}/api/creator-agent/videos/${initial.id}`,{cache:'no-store',signal:controller.signal})
    if(!response.ok)throw new Error('暂时无法读取视频进度，正在重试。')
    const next=await response.json() as VideoTask
    if(!stopped){setJob(next);setConnectionError('')}
    terminal=['completed','failed','paused','submission_unknown'].includes(next.status)
   }catch{if(!stopped)setConnectionError('暂时无法读取视频进度，正在重试。')}
   if(!stopped&&!terminal)timer=setTimeout(()=>void poll(),5000)
  }
  void poll()
  return()=>{stopped=true;controller.abort();if(timer)clearTimeout(timer)}
 },[initial.id,base,revision])
 async function retry(){
  try{
   const response=await fetch(`${base}/api/creator-agent/videos/${initial.id}/retry`,{method:'POST'})
   if(!response.ok)throw new Error('恢复查询失败，请稍后重试。')
   setJob(await response.json() as VideoTask);setRevision(n=>n+1)
  }catch{setConnectionError('恢复查询失败，请稍后重试。')}
 }
 return <figure className="video-task" data-video-job={initial.id}>
  <div className="video-task-heading"><strong>{labels[job.status]||'正在处理视频'}</strong><span>AI 生成</span></div>
  {job.status==='completed'&&job.url?<><video controls playsInline preload="metadata" src={`${base}${job.url}`} /><figcaption><a href={`${base}${job.url}`} download="spur-video.mp4">下载视频</a></figcaption></>:null}
  {['queued','generating','downloading','submitting'].includes(job.status)?<p>完成后会自动显示在这里，你可以继续聊天。</p>:null}
  {job.error||connectionError?<p role="status">{job.error||connectionError}</p>:null}
  {job.status==='paused'?<button type="button" onClick={()=>void retry()}>恢复查询</button>:null}
 </figure>
}
export function RecentVideoTasks({base,revision=0,excludeIds=[]}:{base:string;revision?:number;excludeIds?:string[]}){
 const [jobs,setJobs]=useState<VideoTask[]>([])
 useEffect(()=>{
  let stopped=false
  void fetch(`${base}/api/creator-agent/videos`,{cache:'no-store'}).then(r=>r.ok?r.json():null).then(result=>{if(!stopped&&Array.isArray(result?.jobs))setJobs(result.jobs)}).catch(()=>{})
  return()=>{stopped=true}
 },[base,revision])
 const visible=jobs.filter(job=>!excludeIds.includes(job.id))
 if(!visible.length)return null
 return <div className="recent-video-tasks"><details open={visible.some(j=>['queued','generating','downloading'].includes(j.status))}><summary>最近的视频任务</summary>{visible.map(job=><VideoTaskCard key={job.id} initial={job} base={base}/>)}</details></div>
}
