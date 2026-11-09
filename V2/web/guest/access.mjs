// Single-process guest access store. Raw invitation/session secrets are never persisted.
import {randomBytes,createHash} from 'node:crypto'
import {existsSync,mkdirSync,readFileSync,writeFileSync,renameSync,chmodSync,lstatSync} from 'node:fs'
import {join} from 'node:path'
export const SESSION_MS=30*24*60*60*1000
const digest=value=>createHash('sha256').update(value).digest('hex')
const secret=()=>randomBytes(32).toString('base64url')
const valid=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value)
const fail=(status,message)=>Object.assign(new Error(message),{status})
export class GuestAccess {
 constructor(root,{now=Date.now}={}){
  this.now=now;mkdirSync(root,{recursive:true,mode:0o700})
  if(lstatSync(root).isSymbolicLink())throw Error('Guest store cannot be a symbolic link')
  chmodSync(root,0o700);this.file=join(root,'access.json')
  if(existsSync(this.file)){
   if(!lstatSync(this.file).isFile()||lstatSync(this.file).mode&0o077)throw Error('Guest store must be a private regular file')
   this.data=JSON.parse(readFileSync(this.file,'utf8'))
   if(this.data.version!==1||!this.data.tenants||!this.data.invites||!this.data.sessions)throw Error('Invalid guest store')
  }else this.data={version:1,tenants:{},invites:{},sessions:{}}
 }
 save(){const temp=this.file+'.'+randomBytes(8).toString('hex')+'.tmp';writeFileSync(temp,JSON.stringify(this.data),{mode:0o600,flag:'wx'});renameSync(temp,this.file)}
 issue({label='',days=7,tenantId:existing}={}){
  if(!Number.isInteger(days)||days<1||days>30)throw fail(400,'邀请有效期须为1–30天。')
  if(existing&&(!this.data.tenants[existing]||this.data.tenants[existing].revoked))throw fail(404,'访客不存在或已被撤销。')
  const code=secret(),tenantId=existing||'guest-'+randomBytes(12).toString('hex')
  if(!existing)this.data.tenants[tenantId]={id:tenantId,label:String(label).slice(0,80),createdAt:this.now(),revoked:false}
  this.data.invites[digest(code)]={tenantId,expiresAt:this.now()+days*86400000,used:false}
  this.save();return {code,tenantId}
 }
 redeem(code){
  if(!valid(code))throw fail(401,'邀请码无效、已使用或已过期。')
  const invite=this.data.invites[digest(code)],now=this.now()
  if(!invite||invite.used||invite.expiresAt<=now||this.data.tenants[invite.tenantId]?.revoked)throw fail(401,'邀请码无效、已使用或已过期。')
  const token=secret(),expiresAt=now+SESSION_MS
  invite.used=true;invite.usedAt=now
  this.data.sessions[digest(token)]={tenantId:invite.tenantId,createdAt:now,expiresAt}
  this.save();return {token,tenantId:invite.tenantId,expiresAt}
 }
 authenticate(token){
  if(!valid(token))return null
  const s=this.data.sessions[digest(token)]
  if(!s||s.expiresAt<=this.now()||this.data.tenants[s.tenantId]?.revoked)return null
  return {tenantId:s.tenantId,expiresAt:s.expiresAt}
 }
 logout(token){if(valid(token)&&this.data.sessions[digest(token)]){delete this.data.sessions[digest(token)];this.save()}}
 revoke(tenantId){const tenant=this.data.tenants[tenantId];if(!tenant)throw fail(404,'访客不存在。');tenant.revoked=true;this.save()}
}
export function sessionCookie(token,{clear=false}={}){
 if(!clear&&!valid(token))throw Error('Invalid session token')
 return `__Host-spur_guest=${clear?'':token}; Path=/; Max-Age=${clear?0:SESSION_MS/1000}; HttpOnly; Secure; SameSite=Lax`
}
export function sessionFromCookie(header=''){
 if(typeof header!=='string'||header.length>8192)return ''
 const parts=header.split(';').map(x=>x.trim()).filter(x=>x.startsWith('__Host-spur_guest='))
 if(parts.length!==1)return ''
 const value=parts[0].slice('__Host-spur_guest='.length);return valid(value)?value:''
}
