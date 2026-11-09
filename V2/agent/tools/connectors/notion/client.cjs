const { credential } = require('../auth.cjs');

const NOTION_VERSION = '2022-06-28';
const API = 'https://api.notion.com/v1';
const MAX_TEXT = 12000;
const MAX_PAGES = 20;
const MAX_BLOCK_REQUESTS = 6;
const MAX_BLOCKS = 20;
const MAX_TOP_LEVEL = 50;
const EDITABLE = new Set([
  'paragraph',
  'heading_1',
  'heading_2',
  'heading_3',
  'bulleted_list_item',
  'numbered_list_item',
]);

function richText(items) {
  return (items || []).map(item => item.plain_text || '').join('');
}

function cleanTitle(value) {
  return String(value || '').trim().replace(/^《(.+)》$/u, '$1').trim();
}

function pageId(value) {
  const raw = String(value || '').trim();
  const match = raw.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})|([0-9a-f]{32})/i,
  );
  if (!match) throw new Error('Provide a Notion page ID or URL.');
  const hex = (match[1] || match[2]).replace(/-/g, '').toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function looksLikeId(value) {
  return /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})|([0-9a-f]{32})/i.test(String(value || ''));
}

function pageTitle(page) {
  const properties = page.properties || {};
  for (const property of Object.values(properties)) {
    if (property && property.type === 'title') {
      const title = richText(property.title).trim();
      if (title) return title;
    }
  }
  return 'Untitled';
}

function blockText(block) {
  if (!block) return '';
  if (block.type === 'child_page') return block.child_page?.title || '';
  const data = block[block.type] || {};
  return richText(data.rich_text).trim();
}

function blockLine(block) {
  const type = block.type;
  const data = block[type] || {};
  const text = richText(data.rich_text).trim();
  if (type === 'heading_1') return text ? `# ${text}` : '';
  if (type === 'heading_2') return text ? `## ${text}` : '';
  if (type === 'heading_3') return text ? `### ${text}` : '';
  if (type === 'bulleted_list_item') return text ? `- ${text}` : '';
  if (type === 'numbered_list_item') return text ? `1. ${text}` : '';
  if (type === 'to_do') return `${data.checked ? '[x]' : '[ ]'} ${text}`.trim();
  if (type === 'quote') return text ? `> ${text}` : '';
  if (type === 'code') return text;
  if (type === 'callout' || type === 'toggle' || type === 'paragraph') return text;
  if (type === 'child_page') return data.title ? `[Page] ${data.title}` : '';
  return '';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function notion(path, options = {}, attempt = 0) {
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${credential('NOTION_TOKEN')}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    if (attempt < 1) return notion(path, options, attempt + 1);
    throw new Error('Notion network request failed.');
  }
  if (response.status === 429 && attempt < 1) {
    const retryAfter = Number(response.headers.get('retry-after'));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 5) * 1000 : 1000;
    await sleep(wait);
    return notion(path, options, attempt + 1);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.message || `Notion request failed (${response.status})`;
    if (response.status === 401) throw new Error('Notion token was rejected.');
    if (response.status === 403) {
      const denied = data?.code === 'restricted_resource' || /permission|capability/i.test(message);
      throw new Error(denied
        ? 'The Notion integration is not allowed to change this content.'
        : 'This Notion page is not shared with the integration.');
    }
    if (response.status === 404) throw new Error('The Notion page or block was not found.');
    if (response.status === 429) throw new Error('Notion is rate limiting requests. Try this write again shortly.');
    throw new Error(message);
  }
  return data;
}

function toBlock(input) {
  const type = String(input?.type || 'paragraph');
  if (!EDITABLE.has(type)) throw new Error(`Unsupported block type: ${type}.`);
  const content = String(input?.text ?? input?.content ?? '').trim();
  if (!content) throw new Error('Block text is empty.');
  if (content.length > 2000) throw new Error('Block text exceeds 2000 characters.');
  const rich = { type: 'text', text: { content } };
  if (input?.url) {
    let url;
    try { url = new URL(String(input.url)); } catch { url = null; }
    if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) throw new Error('Block link must be an http(s) URL.');
    rich.text.link = { url: url.toString() };
  }
  return { object: 'block', type, [type]: { rich_text: [rich] } };
}

function asBlocks(value, allowEmpty) {
  let blocks = value;
  if (typeof blocks === 'string' && blocks.trim()) {
    try { blocks = JSON.parse(blocks); } catch { throw new Error('Blocks must be an array.'); }
  }
  if (blocks == null) blocks = [];
  if (!Array.isArray(blocks)) throw new Error('Blocks must be an array.');
  if (!blocks.length && allowEmpty) return [];
  if (!blocks.length) throw new Error('At least one block is required.');
  if (blocks.length > MAX_BLOCKS) throw new Error(`At most ${MAX_BLOCKS} blocks can be written at once.`);
  return blocks.map(toBlock);
}

function candidate(page) {
  return { id: page.id, title: page.title, url: page.url || '' };
}

async function listPages(query) {
  const pages = [];
  let cursor = undefined;
  for (let attempt = 0; attempt < 2 && pages.length < MAX_PAGES; attempt += 1) {
    const data = await notion('/search', {
      method: 'POST',
      body: {
        query: query || undefined,
        filter: { property: 'object', value: 'page' },
        page_size: Math.min(10, MAX_PAGES - pages.length),
        start_cursor: cursor,
      },
    });
    for (const page of data.results || []) {
      if (page.object !== 'page') continue;
      pages.push({
        id: page.id,
        title: pageTitle(page),
        url: page.url || '',
      });
    }
    if (!data.has_more || !data.next_cursor) break;
    cursor = data.next_cursor;
  }
  return pages.slice(0, MAX_PAGES);
}

async function resolveParent(parent) {
  const raw = String(parent || '').trim();
  const title = cleanTitle(raw);
  if (!title) return { ok: false, created: false, reason: 'parent_required', candidates: [] };
  if (looksLikeId(raw)) return { ok: true, id: pageId(raw) };
  const pages = await listPages(title.slice(0, 200));
  const exact = pages.filter(page => page.title === title);
  if (exact.length === 1) return { ok: true, id: exact[0].id };
  const candidates = (exact.length ? exact : pages).slice(0, 8).map(candidate);
  return {
    ok: false,
    created: false,
    reason: exact.length ? 'parent_ambiguous' : 'parent_not_found',
    candidates,
  };
}

async function blockChildren(id, requests) {
  const lines = [];
  let cursor = undefined;
  do {
    if (requests.count >= MAX_BLOCK_REQUESTS) break;
    requests.count += 1;
    const path = `/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ''}`;
    const data = await notion(path);
    for (const block of data.results || []) {
      const line = blockLine(block);
      if (line) lines.push(line);
      if (block.has_children && block.type !== 'child_page' && requests.depth < 2) {
        requests.depth += 1;
        lines.push(...(await blockChildren(block.id, requests)));
        requests.depth -= 1;
      }
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return lines;
}

async function topLevelBlocks(id) {
  const blocks = [];
  let cursor = undefined;
  let requests = 0;
  do {
    if (requests >= 2 || blocks.length >= MAX_TOP_LEVEL) break;
    requests += 1;
    const path = `/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ''}`;
    const data = await notion(path);
    for (const block of data.results || []) {
      blocks.push({ id: block.id, type: block.type, text: blockText(block).slice(0, 500) });
      if (blocks.length >= MAX_TOP_LEVEL) break;
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

async function readPage(value) {
  const id = pageId(value);
  const page = await notion(`/pages/${id}`);
  const requests = { count: 0, depth: 0 };
  const text = (await blockChildren(id, requests)).join('\n').trim().slice(0, MAX_TEXT);
  return {
    id: page.id,
    title: pageTitle(page),
    url: page.url || '',
    text,
    blocks: await topLevelBlocks(id),
    truncated: text.length >= MAX_TEXT,
  };
}

async function createPage({ parent, title, blocks } = {}) {
  const titleText = cleanTitle(title);
  if (!titleText || titleText.length > 200) throw new Error('Page title is required and must be at most 200 characters.');
  const resolved = await resolveParent(parent);
  if (!resolved.ok) return { created: false, reason: resolved.reason, candidates: resolved.candidates };
  const page = await notion('/pages', {
    method: 'POST',
    body: {
      parent: { page_id: resolved.id },
      properties: { title: { title: [{ type: 'text', text: { content: titleText } }] } },
      children: asBlocks(blocks, true),
    },
  });
  return {
    created: true,
    id: page.id,
    url: page.url || '',
    title: pageTitle(page),
    parentId: resolved.id,
  };
}

async function appendBlocks({ page, blocks } = {}) {
  const id = pageId(page);
  const data = await notion(`/blocks/${id}/children`, {
    method: 'PATCH',
    body: { children: asBlocks(blocks, false) },
  });
  const meta = await notion(`/pages/${id}`);
  return {
    appended: true,
    id,
    url: meta.url || '',
    title: pageTitle(meta),
    blocks: (data.results || []).map(block => ({ id: block.id, type: block.type, text: blockText(block) })),
  };
}

async function updateBlock({ block, text } = {}) {
  const id = pageId(block);
  const content = String(text ?? '').trim();
  if (!content) throw new Error('Replacement text is required.');
  if (content.length > 2000) throw new Error('Block text exceeds 2000 characters.');
  const current = await notion(`/blocks/${id}`);
  if (!EDITABLE.has(current.type)) throw new Error(`This block type cannot be edited: ${current.type}.`);
  const before = blockText(current);
  const updated = await notion(`/blocks/${id}`, {
    method: 'PATCH',
    body: { [current.type]: { rich_text: [{ type: 'text', text: { content } }] } },
  });
  return { updated: true, id: updated.id, type: updated.type, before, after: blockText(updated) };
}

module.exports = {
  listPages,
  readPage,
  createPage,
  appendBlocks,
  updateBlock,
  pageId,
  pageTitle,
  blockLine,
};
