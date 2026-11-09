// The application reports missing credentials and runtime dependencies as 503.
// This does not replace an actual model/MCP/browser smoke test.
try {
  const port = process.env.PORT || '4173';
  const response = await fetch(`http://127.0.0.1:${port}/api/creator-agent/health`, {
    signal: AbortSignal.timeout(4000),
    headers: process.env.SPUR_CREATOR_AGENT_TOKEN ? { Authorization: `Bearer ${process.env.SPUR_CREATOR_AGENT_TOKEN}` } : {},
  });
  const health = await response.json();
  if (!response.ok || health.status !== 'ready') process.exitCode = 1;
} catch {
  process.exitCode = 1;
}
