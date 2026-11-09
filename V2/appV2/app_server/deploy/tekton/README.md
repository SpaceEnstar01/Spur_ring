# Spur ACK image build

`pipeline.yaml` adds a standalone `ci-dev/spur-api-build` pipeline. It reuses the
existing `ack-common-codeup-clone` and `ack-common-image-build-push` tasks without
modifying them. The pipeline runs the repository Dockerfile, including its tests.
It does not write to GitOps, create an Ingress, or change an existing application.

Before a PipelineRun is created, confirm the shared tasks' current definitions,
ServiceAccount, workspace PVC/storage requirements, source SSH Secret format and
ACR dockerconfig Secret format from the cluster. Do not guess credential names.
The source key must have read access to `my-app-server`; the read-only GitOps
deploy key is not automatically authorized for that repository. ACR credentials
must permit pushing a dedicated `aed-images/spur-api` repository. Confirm that
repository exists or is allowed to be created before triggering the build.

`build.sh <full-commit-sha>` is intended for Workbench. It validates the Pipeline
server-side, creates a new isolated source Secret and Pipeline, and requests one
build using the observed `tekton-build` ServiceAccount and `tekton-local-source`
1 GiB workspace. It never overwrites existing Spur build resources on reruns.
It copies only the GitOps key and the existing source Secret's public known_hosts;
it does not modify either original Secret or expose values. A revision check
stops the build before pushing if `main` has moved from the reviewed commit.

Use a reviewed source commit and a unique image tag for each run. Capture the
resulting image digest for the internal deployment. No SiliconFlow key is needed
or permitted during image build. The initial cloud build passed ACR push
permission checks after repository creation, but failed pulling Maven from
Docker Hub with a network timeout. The Dockerfile now uses the existing private
`base/node:20.16-alinux3` ACR base and installs Java 17/Maven through dnf. It
requires no Docker Hub base-image access. OS package and Maven repository access
and package availability still need verification by an actual cloud build. The
Docker Hub registry map remains empty. No container build success is implied by
a local Maven test run.
