#!/usr/bin/env python3
"""Prepare verified CPython 3.12 Linux x86_64 wheels. No credentials or system installs."""
import hashlib,json,pathlib,subprocess,sys,urllib.request
from pip._vendor.packaging.tags import cpython_tags,compatible_tags,parse_tag
BASE=pathlib.Path(__file__).resolve().parent
SOURCE=BASE.parents[1]/'runtime'/'Agent-Reach'
DEST=BASE/'research-wheels'
DEST.mkdir(exist_ok=True)
platforms=['manylinux_2_28_x86_64','manylinux2014_x86_64','manylinux_2_17_x86_64','manylinux1_x86_64','manylinux_2_5_x86_64']
tags=list(cpython_tags((3,12),abis=['cp312'],platforms=platforms))+list(compatible_tags((3,12),interpreter='cp312',platforms=platforms))
rank={tag:i for i,tag in enumerate(tags)}
records=[]
def digest(file):return hashlib.sha256(file.read_bytes()).hexdigest()
def download(url,file,sha):
 if not file.exists() or digest(file)!=sha:
  tmp=file.with_suffix(file.suffix+'.part')
  with urllib.request.urlopen(url,timeout=60) as response:tmp.write_bytes(response.read())
  if digest(tmp)!=sha:raise RuntimeError('SHA256 mismatch: '+file.name)
  tmp.replace(file)
 print('VERIFIED '+file.name,flush=True)
 records.append((sha,file.name))
requirements=[]
for line in (BASE/'research-requirements.lock').read_text().splitlines():
 if not line or line.startswith('#'):continue
 requirements.append(tuple(line.split('==',1)))
for name,version in [('pip','25.0.1')]+requirements:
 if name=='agent-reach':continue
 with urllib.request.urlopen(f'https://pypi.org/pypi/{name}/{version}/json',timeout=45) as response:release=json.load(response)
 candidates=[]
 for f in release['urls']:
  if f['packagetype']!='bdist_wheel' or f.get('yanked'):continue
  wheel_tags=parse_tag('-'.join(f['filename'][:-4].split('-')[-3:]))
  ranks=[rank[t] for t in wheel_tags if t in rank]
  if ranks:candidates.append((min(ranks),f))
 if not candidates:raise RuntimeError('No compatible Linux wheel: '+name+'=='+version)
 f=min(candidates,key=lambda item:item[0])[1]
 download(f['url'],DEST/f['filename'],f['digests']['sha256'])
# Agent-Reach is pure Python; build its wheel from reviewed local source on Mac.
subprocess.run([sys.executable,'-m','pip','wheel','--no-deps','--wheel-dir',str(DEST),str(SOURCE)],check=True)
wheels=list(DEST.glob('agent_reach-*-py3-none-any.whl'))
if len(wheels)!=1:raise RuntimeError('Expected exactly one locally built Agent-Reach wheel.')
records.append((digest(wheels[0]),wheels[0].name))
(BASE/'research-wheels'/'SHA256SUMS').write_text(''.join(sha+'  '+name+'\n' for sha,name in records))
(DEST/'provenance.json').write_text(json.dumps({'target':'CPython 3.12 linux/amd64','source':str(SOURCE),'sourceCommit':subprocess.check_output(['git','-C',str(SOURCE),'rev-parse','HEAD'],text=True).strip(),'files':[name for _,name in records],'note':'PyPI wheels verified against release JSON; Agent-Reach wheel built from local source.'},indent=2))
print('LINUX_WHEELHOUSE_READY',flush=True)
