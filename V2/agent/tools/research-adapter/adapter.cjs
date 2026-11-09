const { execFile } = require('node:child_process');
const { mkdirSync, realpathSync } = require('node:fs');
const { dirname, join, isAbsolute } = require('node:path');
const { capabilities, platforms, domains } = require('./capabilities.cjs');
const failure = (platform, code, message) => ({ schemaVersion: 1, ok: false, status: 'failed', platform, provider: null, items: [], error: { code, message } });
function validInput(args) {
  if (!args || typeof args !== 'object' || Object.keys(args).some(k => !['platform', 'query', 'limit'].includes(k))) throw Error('Unexpected research parameters.');
  if (!platforms.includes(args.platform)) throw Error('Platform is not allowlisted.');
  if (typeof args.query !== 'string' || !args.query.trim() || args.query.length > 500 || /^\s*-/.test(args.query) || /[\x00-\x1f]/.test(args.query)) throw Error('Query must contain 1–500 characters and cannot contain CLI flags or control characters.');
  const limit = args.limit === undefined ? 3 : args.limit;
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) throw Error('Limit must be 1–5.');
  return { platform: args.platform, query: args.query.trim(), limit };
}
function runFile(bin, argv, options) {
  return new Promise(resolve => execFile(bin, argv, options, (error, stdout, stderr) => resolve({ error, stdout, stderr })));
}
function createAdapter({ binary, taskRoot, execute = runFile, proxy = '' }) {
  let busy = false, calls = 0;
  const cache = new Map();
  const stopped = new Map();
  return {
    capabilities,
    async search(input) {
      let args;
      try { args = validInput(input); } catch (e) { return failure(input?.platform || null, 'BAD_INPUT', e.message); }
      const route = capabilities().find(row => row.platform === args.platform).actions.search;
      if (!route.enabled) return { ...failure(args.platform, 'ACTION_UNAVAILABLE', route.reason), status: 'unavailable' };
      if (stopped.has(args.platform)) return stopped.get(args.platform);
      const key = JSON.stringify(args);
      if (cache.has(key)) return { ...cache.get(key), cached: true };
      if (busy) return failure(args.platform, 'BUSY', 'One research request is already running in this task.');
      if (calls >= 6) return failure(args.platform, 'BUDGET_EXCEEDED', 'Maximum six searches per task.');
      if (!binary || !isAbsolute(binary) || !taskRoot) return failure(args.platform, 'NEED_SETUP', 'Agent-Reach executable or task workspace is not configured.');
      busy = true; calls++;
      const started = Date.now();
      try {
        mkdirSync(taskRoot, { recursive: true, mode: 0o700 });
        const home = join(realpathSync(taskRoot), 'research-home');
        mkdirSync(home, { recursive: true, mode: 0o700 });
        const query = route.queryScope ? `${args.query} site:${route.queryScope}` : args.query;
        const argv = [route.channel, 'search', query, '--limit', String(args.limit), '--backend', route.backend, '--timeout', '25'];
        const env = { PATH: dirname(binary) + ':/usr/bin:/bin', HOME: home, USERPROFILE: home, LANG: 'en_US.UTF-8' };
        if (proxy) { env.HTTPS_PROXY = proxy; env.HTTP_PROXY = proxy; }
        const result = await execute(binary, argv, { env, cwd: taskRoot, timeout: 30000, killSignal: 'SIGKILL', maxBuffer: 512000, encoding: 'utf8', shell: false });
        let data;
        try { data = JSON.parse(result.stdout); } catch { return failure(args.platform, result.error?.killed ? 'TIMEOUT' : 'UPSTREAM_INVALID', 'Research tool did not return a valid bounded JSON response.'); }
        if (!data.ok || result.error) {
          const allowed = ['NEED_LOGIN', 'PLATFORM_BLOCKED', 'RATE_LIMITED', 'TIMEOUT', 'NEED_SETUP', 'UPSTREAM_BROKEN', 'NOT_FOUND'];
          const code = allowed.includes(data.error?.code) ? data.error.code : 'UPSTREAM_BROKEN';
          // Do not expose upstream Cookie instructions, credentials or raw stderr to the agent.
          const out = { ...failure(args.platform, code, 'Research source unavailable. Stop on login, challenge or rate limit; do not switch tools to evade it.'), provider: 'agent-reach', backend: route.backend, elapsedMs: Date.now() - started };
          if (['NEED_LOGIN', 'PLATFORM_BLOCKED', 'RATE_LIMITED'].includes(code)) stopped.set(args.platform, out);
          cache.set(key, out); return out;
        }
        if (!Array.isArray(data.items) || data.channel !== route.channel || data.backend !== route.backend) return failure(args.platform, 'UPSTREAM_INVALID', 'Unexpected research response channel, backend or items.');
        const items = data.items.slice(0, args.limit).filter(item => {
          try {
            const url = new URL(item.url);
            return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && domains[args.platform].some(d => url.hostname === d || url.hostname.endsWith('.' + d));
          } catch { return false; }
        }).map(item => ({
          title: String(item.title || '').slice(0, 500), url: item.url,
          author: typeof item.author === 'string' ? item.author.slice(0, 300) : null,
          publishedAt: typeof item.published_at === 'string' ? item.published_at : null,
          text: String(item.text || '').slice(0, 6000),
          metrics: args.platform === 'youtube' ? { views: Number.isFinite(item.raw?.view_count) ? item.raw.view_count : null, durationSeconds: Number.isFinite(item.raw?.duration) ? item.raw.duration : null } : {},
          evidenceType: route.scope,
        }));
        if (!items.length) return failure(args.platform, 'INSUFFICIENT_EVIDENCE', 'No usable platform-scoped public results.');
        const out = { schemaVersion: 1, ok: true, status: 'partial', platform: args.platform, provider: 'agent-reach', preferredProvider: capabilities().find(r => r.platform === args.platform).preferredProvider, backend: route.backend, retrievedAt: new Date().toISOString(), elapsedMs: Date.now() - started, items, limits: { complete: false, dateRangeVerified: false, popularityRankingVerified: false, commentsAvailable: false, note: 'Search metadata or indexed text only; no verified recent ranking, full content or audience-comment analysis.' }, error: null };
        cache.set(key, out); return out;
      } catch { return failure(args.platform, 'UPSTREAM_BROKEN', 'Research execution failed; no fabricated result.'); }
      finally { busy = false; }
    },
  };
}
module.exports = { createAdapter, validInput };
