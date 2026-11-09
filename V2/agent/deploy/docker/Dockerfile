# Build context: /Users/x/X/space/spur/V2 (not the repository root).
FROM ubuntu:24.04@sha256:fe81560990fae86dc4743202b2cb4d3df98d0bcf949173cecef15ce1127ef852 AS runtime-base
ARG NODE_VERSION=24.22.1
ARG NODE_SHA256=6c172a9ab6718f7b801fb5a7bd486af2ee5e32758086a04b84fcce2aa77095e6
ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl xz-utils git python3 tini \
    && curl --fail --location --retry 3 "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" -o /tmp/node.tar.xz \
    && echo "${NODE_SHA256}  /tmp/node.tar.xz" | sha256sum --check - \
    && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 \
    && rm /tmp/node.tar.xz \
    && rm -rf /var/lib/apt/lists/*

FROM runtime-base AS browser-runtime
WORKDIR /opt/spur/V2/agent/runtime/mcp-servers/playwright-mcp
COPY agent/runtime/mcp-servers/playwright-mcp/ ./
# The SDK is an upstream devDependency, but the Spur bridge requires it at runtime.
RUN npm ci --include=dev --ignore-scripts --no-audit --no-fund \
    && ./node_modules/.bin/playwright install --with-deps chrome \
    && google-chrome --version \
    && rm -rf /var/lib/apt/lists/* /root/.npm /tmp/*

# Isolated Python environment; no provider setup, browser import or login runs.
FROM runtime-base AS research-runtime
# Prepared on the host: Linux wheels verified against PyPI release hashes.
COPY agent/deploy/docker/research-wheels/ /tmp/research-wheels/
COPY agent/deploy/docker/research-requirements.lock /tmp/research-requirements.lock
RUN cd /tmp/research-wheels && sha256sum --check SHA256SUMS \
    && python3 -m venv --without-pip /opt/research-venv \
    && PYTHONPATH=/tmp/research-wheels/pip-25.0.1-py3-none-any.whl /opt/research-venv/bin/python -m pip install --no-index --no-cache-dir --find-links=/tmp/research-wheels pip==25.0.1 \
    && /opt/research-venv/bin/pip install --no-index --no-cache-dir --find-links=/tmp/research-wheels -r /tmp/research-requirements.lock agent-reach==1.6.1 \
    && /opt/research-venv/bin/pip check

# MediaCrawler dependencies stay in their own venv so Agent-Reach pins are unchanged.
# No browser profile, cookie, or login session is copied.
FROM runtime-base AS mediacrawler-runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3-venv libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
COPY agent/runtime/MediaCrawler/requirements.txt /tmp/mediacrawler-requirements.txt
RUN python3 -m venv /opt/mediacrawler-venv \
    && /opt/mediacrawler-venv/bin/pip install --upgrade pip \
    && /opt/mediacrawler-venv/bin/pip install --no-cache-dir -r /tmp/mediacrawler-requirements.txt \
    && rm /tmp/mediacrawler-requirements.txt

FROM browser-runtime AS builder
ENV CI=true NODE_ENV=development NODE_OPTIONS=--max-old-space-size=4096
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential pkg-config \
    && npm install --global pnpm@11.7.0 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/spur/V2/agent/runtime/deepseek-harness
COPY agent/runtime/deepseek-harness/ ./
RUN pnpm install --frozen-lockfile \
    && pnpm run build:lib \
    && test -f apps/cli/lib/bin.js
WORKDIR /opt/spur/V2/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --include=dev --ignore-scripts --no-audit --no-fund
COPY web/ ./
RUN npm run build

FROM browser-runtime AS runtime
ENV HOST=0.0.0.0 PORT=4173 \
    HOME=/home/spur \
    SPUR_NODE_BIN=/usr/local/bin/node \
    SPUR_RESEARCH_PYTHON=/usr/bin/python3 \
    DSH_TELEMETRY_DISABLED=1 \
    SPUR_AGENT_REACH_BIN=/opt/research-venv/bin/agent-reach \
    SPUR_RESEARCH_ADAPTER_ENABLED=1 \
    SPUR_MEDIACRAWLER_ROOT=/opt/spur/V2/agent/runtime/MediaCrawler \
    SPUR_MEDIACRAWLER_PYTHON=/opt/mediacrawler-venv/bin/python
RUN groupadd --gid 10001 spur \
    && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin spur \
    && mkdir -p /opt/spur/V2/web/.runtime \
    && chown -R spur:spur /opt/spur/V2/web /home/spur
COPY --from=builder /opt/spur/V2/agent/runtime/deepseek-harness /opt/spur/V2/agent/runtime/deepseek-harness
COPY --from=research-runtime /opt/research-venv /opt/research-venv
COPY --from=mediacrawler-runtime /opt/mediacrawler-venv /opt/mediacrawler-venv
COPY agent/runtime/Agent-Reach/LICENSE /opt/spur/licenses/Agent-Reach-LICENSE
COPY --from=builder /opt/spur/V2/web/dist /opt/spur/V2/web/dist
COPY web/*.mjs /opt/spur/V2/web/
COPY web/email/ /opt/spur/V2/web/email/
COPY agent/tools/playwright-browser/ /opt/spur/V2/agent/tools/playwright-browser/
COPY agent/tools/travel-research/ /opt/spur/V2/agent/tools/travel-research/
COPY agent/tools/personal-workspace/ /opt/spur/V2/agent/tools/personal-workspace/
COPY agent/tools/image-generation/ /opt/spur/V2/agent/tools/image-generation/
COPY agent/tools/video-generation/ /opt/spur/V2/agent/tools/video-generation/
COPY agent/tools/research-adapter/ /opt/spur/V2/agent/tools/research-adapter/
COPY agent/runtime/MediaCrawler/ /opt/spur/V2/agent/runtime/MediaCrawler/
COPY agent/tools/connectors/ /opt/spur/V2/agent/tools/connectors/
COPY agent/deploy/docker/healthcheck.mjs /opt/spur/healthcheck.mjs
WORKDIR /opt/spur/V2/web
USER 10001:10001
EXPOSE 4173
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["node", "/opt/spur/healthcheck.mjs"]
ENTRYPOINT ["/usr/bin/tini", "-g", "--"]
CMD ["node", "server.mjs"]
