import {existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs'
import {join} from 'node:path'
export function saveTaskResult(folder,result){
  const file=join(folder,'result.json');const tmp=file+'.tmp';
  writeFileSync(tmp,JSON.stringify(result),{mode:0o600});renameSync(tmp,file)
}
export function readTaskResult(folder,runId,collect){
  const file=join(folder,'result.json')
  if(existsSync(file)){
    const result=JSON.parse(readFileSync(file,'utf8'))
    if(typeof result.response!=='string'||!result.response.trim()||result.runId!==runId)throw Error('任务结果记录无效')
    return result
  }
  // Old completed tasks already retained final stdout: recover without executing again.
  const terminal=join(folder,'terminal.txt')
  if(!existsSync(terminal))return null
  const answer=readFileSync(terminal,'utf8').trim()
  if(!answer)return null
  const result={response:answer,runId,...collect()};saveTaskResult(folder,result);return result
}
