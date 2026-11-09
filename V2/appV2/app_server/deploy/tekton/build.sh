#!/usr/bin/env bash
# Run in ACK Workbench Shell, not inside the repo-server container.
set +x
set -euo pipefail
umask 077

spur_script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
spur_expected_revision=${1:?Pass the full reviewed source commit SHA}
if [[ ! "$spur_expected_revision" =~ ^[0-9a-f]{40}$ ]]; then
  printf 'Expected a full 40-character commit SHA.\n' >&2
  exit 1
fi

# Refuse to overwrite unrelated resources or restart an earlier build on reruns.
if kubectl -n ci-dev get secret spur-api-source-ssh >/dev/null 2>&1; then
  printf 'spur-api-source-ssh already exists; stop and inspect before retrying.\n' >&2
  exit 1
fi
if kubectl -n ci-dev get pipeline spur-api-build >/dev/null 2>&1; then
  printf 'spur-api-build already exists; stop and inspect before retrying.\n' >&2
  exit 1
fi

# Validate the pipeline server-side before persisting any build resources.
kubectl create --dry-run=server -f "$spur_script_dir/pipeline.yaml" >/dev/null

# Keep all credential values off the terminal and out of process arguments.
spur_key_b64=$(kubectl -n argocd get secret repo-aed-ops-gitops \
  -o jsonpath='{.data.sshPrivateKey}')
spur_hosts_b64=$(kubectl -n ci-dev get secret tekton-aed-cmdb-source-ssh \
  -o jsonpath='{.data.known_hosts}')
if [[ -z "$spur_key_b64" || -z "$spur_hosts_b64" ]]; then
  printf 'Source key or trusted known_hosts is missing; no build started.\n' >&2
  exit 1
fi
printf '{"apiVersion":"v1","kind":"Secret","metadata":{"name":"spur-api-source-ssh","namespace":"ci-dev","labels":{"app.kubernetes.io/name":"spur-api"}},"type":"Opaque","data":{"id_rsa":"%s","known_hosts":"%s"}}\n' \
  "$spur_key_b64" "$spur_hosts_b64" | kubectl create -f -
unset spur_key_b64 spur_hosts_b64

kubectl create -f "$spur_script_dir/pipeline.yaml"
spur_build_tag="build-$(date -u +%Y%m%d-%H%M%S)-${spur_expected_revision:0:7}"

# Empty dockerconfig matches the existing RRSA-based ACR task contract.
# Only the new source workspace is provisioned (1 GiB); no public service is created.
kubectl create -f - <<YAML
apiVersion: tekton.dev/v1
kind: PipelineRun
metadata:
  generateName: spur-api-build-
  namespace: ci-dev
  labels:
    app.kubernetes.io/name: spur-api
spec:
  pipelineRef:
    name: spur-api-build
  taskRunTemplate:
    serviceAccountName: tekton-build
  timeouts:
    pipeline: 1h0m0s
  params:
    - name: git_ref
      value: main
    - name: expected_revision
      value: "$spur_expected_revision"
    - name: build_tag
      value: "$spur_build_tag"
    - name: image
      value: "aed-acr-registry-vpc.cn-hangzhou.cr.aliyuncs.com/aed-images/spur-api:$spur_build_tag"
  workspaces:
    - name: source
      volumeClaimTemplate:
        spec:
          accessModes: [ReadWriteOnce]
          storageClassName: tekton-local-source
          resources:
            requests:
              storage: 1Gi
    - name: source_ssh_directory
      secret:
        secretName: spur-api-source-ssh
    - name: dockerconfig
      emptyDir: {}
YAML

printf '\nBuild requested. Check status and logs; this is NOT an application deployment.\n'
kubectl -n ci-dev get pipelineruns -l app.kubernetes.io/name=spur-api
