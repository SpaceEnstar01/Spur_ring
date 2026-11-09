const {createRequire} = require('node:module');
const {appendFileSync, mkdirSync, writeFileSync, readFileSync} = require('node:fs');
const {join} = require('node:path');
const {randomUUID} = require('node:crypto');

const {publicUrl, startPublicProxy, fetchPublic} = require('./public-network.cjs');
const {bingResults} = require('./search-results.cjs');

function pageSource(text) {
  const match = text.match(/Page URL:\s*(https?:\/\/[^\s]+)/i);
  return match ? match[1].replace(/[),.;]+$/, '') : '';
}

function textResult(result, toolName, outputDir) {
  const text = Array.isArray(result.content)
    ? result.content.filter((block) => block && block.type === 'text').map((block) => block.text).join('\n')
    : '';
  if (result.isError) throw new Error(text || `${toolName} failed`);
  const match = text.match(/\[Snapshot\]\((\.playwright-mcp\/[A-Za-z0-9_.-]+\.yml)\)/);
  let snapshot = '';
  if (match && outputDir) {
    const raw = readFileSync(join(outputDir,match[1]),'utf8');
    const main = raw.search(/(?:^|\n)\s*- main(?:\s|:)/);
    snapshot = '\n### Page content\n'+(main >= 0 ? raw.slice(main) : raw);
  }
  return (text+snapshot).slice(0,24000);
}

exports.inject = ['tools'];
exports.apply = async function apply(ctx) {
  const root = process.env.SPUR_PLAYWRIGHT_MCP_ROOT;
  const outputDir = process.env.SPUR_RESEARCH_OUTPUT;
  if (!root || !outputDir) throw new Error('Playwright MCP runtime paths are not configured.');

  const requireFromPlaywright = createRequire(join(root, 'package.json'));
  const {Client} = requireFromPlaywright('@modelcontextprotocol/sdk/client/index.js');
  const {StdioClientTransport} = requireFromPlaywright('@modelcontextprotocol/sdk/client/stdio.js');
  const cliPath = join(root, 'cli.js');
  const proxy = await startPublicProxy({onBlocked:event => appendFileSync(join(outputDir,'network-events.jsonl'),JSON.stringify({at:new Date().toISOString(),...event})+'\n')});
  process.env.SPUR_PUBLIC_PROXY_URL = proxy.url;
  const configPath = join(outputDir,'browser-config.json');
  writeFileSync(configPath, JSON.stringify({browser:{contextOptions:{serviceWorkers:'block',acceptDownloads:false},launchOptions:{args:['--disable-quic','--force-webrtc-ip-handling-policy=disable_non_proxied_udp']}}}));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cliPath, '--headless', '--browser', 'chrome', '--isolated', '--no-webmcp', '--config', configPath, '--proxy-server', proxy.url, '--proxy-bypass', '<-loopback>', '--init-page', join(__dirname,'read-only-page.cjs')],
    cwd: outputDir,
    env: {
      PATH: process.env.PATH || '',
      HOME: process.env.HOME || '',
      LANG: process.env.LANG || 'en_US.UTF-8',
    },
  });
  const client = new Client({name: 'spur-playwright-bridge', version: '1.0.0'});
  try { await client.connect(transport); } catch (error) { await proxy.close(); throw error; }
  const {tools} = await client.listTools();
  const available = new Set(tools.map((tool) => tool.name));
  for (const required of ['browser_navigate', 'browser_snapshot']) {
    if (!available.has(required)) {
      await client.close();
      await proxy.close();
      throw new Error(`Playwright MCP did not provide required read-only tool: ${required}`);
    }
  }

  const evidenceDir = join(outputDir, 'evidence');
  mkdirSync(evidenceDir, {recursive: true});
  const logFile = join(outputDir, 'tool-events.jsonl');
  const disposers = [];
  let callCount = 0;
  const output = {
    schema: {
      type: 'object',
      properties: {text: {type: 'string'}, source: {type: 'string'}},
      required: ['text', 'source'],
      additionalProperties: false,
    },
    render: (_args, value) => [{type: 'text', text: value.text}],
  };

  const register = (name, description, parameters, invoke) => {
    disposers.push(ctx.tools.register({name, description, parameters, output, async execute(args) {
      callCount += 1;
      if (callCount > 20) throw new Error('Playwright research call limit reached.');
      const id = `playwright-${randomUUID()}`;
      const event = {at: new Date().toISOString(), event: 'call', id, tool: name, args};
      appendFileSync(logFile, `${JSON.stringify(event)}\n`);
      try {
        const result = await invoke(args || {});
        const source = pageSource(result) || (typeof args?.url === 'string' ? args.url : '');
        const summary = {id, tool: name, source, available: true, text: result};
        writeFileSync(join(evidenceDir, `${id}.json`), JSON.stringify(summary, null, 2));
        appendFileSync(logFile, `${JSON.stringify({at: new Date().toISOString(), event: 'result', id, tool: name, source, available: true})}\n`);
        return {text: result, source};
      } catch (error) {
        appendFileSync(logFile, `${JSON.stringify({at: new Date().toISOString(), event: 'result', id, tool: name, available: false, error: String(error).slice(0, 300)})}\n`);
        throw error;
      }
    }}));
  };

  register(
    'browser_navigate',
    'Open any public HTTP/HTTPS website for research, comparisons, planning or fact checking. Public network checks apply to every connection. Read-only, no login or form submissions.',
    {url: {type: 'string', required: true}},
    async ({url}) => {
      const safeUrl = publicUrl(url).href;
      return textResult(await client.callTool({name: 'browser_navigate', arguments: {url: safeUrl}}), 'browser_navigate', outputDir);
    },
  );
  register(
    'browser_snapshot',
    'Read a structured text snapshot of the currently open public page.',
    {},
    async () => textResult(await client.callTool({name: 'browser_snapshot', arguments: {}}), 'browser_snapshot', outputDir),
  );

  register(
    'web_fetch',
    'Read public HTTP/HTTPS HTML or text without a browser. Useful when a page loads poorly. Uses DNS-pinned public-network policy and revalidates redirects. Does not execute JavaScript; HTML formatting may be lost.',
    {url:{type:'string',required:true}},
    async ({url}) => {
      const result = await fetchPublic(url);
      const text = result.text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/[ \t]+/g,' ').trim();
      return `Page URL: ${result.url}\nHTTP ${result.status}\n${text.slice(0,23500)}`;
    },
  );

  register(
    'web_search',
    'Search the public web for any topic, not only videos. Returns search-page evidence; follow relevant result URLs with browser_navigate and verify facts. If a search engine is blocked, try another provider and report failure honestly.',
    {query:{type:'string',required:true},engine:{type:'string',enum:['bing','google','duckduckgo']}},
    async ({query,engine='bing'}) => {
      if (typeof query !== 'string' || !query.trim() || query.length > 1000) throw new Error('Search query must contain 1–1000 characters.');
      const base = {bing:'https://www.bing.com/search?q=',google:'https://www.google.com/search?q=',duckduckgo:'https://duckduckgo.com/?q='}[engine];
      if (!base) throw new Error('Unknown search provider.');
      if (engine === 'bing') {
        try {
          const fetched = await fetchPublic(base+encodeURIComponent(query));
          const results = bingResults(fetched.text);
          if (results.length) return `Page URL: ${fetched.url}\n${JSON.stringify({query,results,evidence:'Search snippets are discovery evidence. Read original pages before making detailed claims.'})}`;
        } catch {}
      }
      const navigation = textResult(await client.callTool({name:'browser_navigate',arguments:{url:base+encodeURIComponent(query)}}),'web_search', outputDir);
      const snapshot = textResult(await client.callTool({name:'browser_snapshot',arguments:{}}),'browser_snapshot',outputDir);
      return navigation.split('### Snapshot')[0]+'\nSearch results are only evidence if actual result links and snippets are present below. Empty, consent or challenge pages are not successful search results; try another engine.\n'+snapshot;
    },
  );

  ctx.effect(() => () => {
    for (const dispose of disposers) dispose();
    void client.close().finally(() => proxy.close());
  }, 'spur-playwright-bridge');
};
