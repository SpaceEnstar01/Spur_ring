const API = 'https://www.googleapis.com/youtube/v3';

function credential() {
  const token = String(process.env.YOUTUBE_ACCESS_TOKEN || '').trim();
  const key = String(process.env.YOUTUBE_API_KEY || '').trim();
  if (!token && !key) {
    throw new Error('YouTube is not configured. Add YOUTUBE_API_KEY, or complete OAuth at http://127.0.0.1:4173/api/youtube/oauth/start.');
  }
  return { token, key };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function youtube(path, params, attempt = 0, forceKey = false) {
  const { token, key } = credential();
  const useToken = Boolean(token) && !forceKey;
  if (!useToken && !key) throw new Error('YouTube access token was rejected.');
  const url = new URL(`${API}${path}`);
  for (const [name, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value));
  }
  if (!useToken) url.searchParams.set('key', key);
  let response;
  try {
    response = await fetch(url, { headers: useToken ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    if (attempt < 1) return youtube(path, params, attempt + 1, forceKey);
    throw new Error('YouTube network request failed.');
  }
  if (response.status === 401 && useToken && key && attempt < 1) return youtube(path, params, attempt + 1, true);
  if (response.status === 429 && attempt < 1) {
    await sleep(1000);
    return youtube(path, params, attempt + 1, forceKey);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const reason = data?.error?.errors?.[0]?.reason || '';
    if (response.status === 401) throw new Error('YouTube access was rejected.');
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') throw new Error('YouTube API quota is exhausted for today.');
    if (response.status === 403) throw Object.assign(new Error('YouTube refused this request.'), { reason: ['commentsDisabled', 'forbidden', 'insufficientPermissions'].includes(reason) ? reason : 'forbidden' });
    if (response.status === 404) throw new Error('The YouTube resource was not found.');
    throw new Error('YouTube request failed.');
  }
  return data;
}

function asList(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
  const text = value.trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(item => String(item).trim()).filter(Boolean);
    } catch {}
  }
  return text.split(/[\s,]+/).map(item => item.trim()).filter(Boolean);
}

function videoId(value) {
  const text = String(value || '').trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(text)) return text;
  try {
    const url = new URL(text);
    if (url.hostname === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';
    const watch = url.searchParams.get('v');
    if (watch) return watch;
    const parts = url.pathname.split('/').filter(Boolean);
    const marker = parts.findIndex(part => part === 'shorts' || part === 'embed' || part === 'live');
    if (marker >= 0 && parts[marker + 1]) return parts[marker + 1];
  } catch {}
  return '';
}

function channelRef(value) {
  const text = String(value || '').trim();
  if (/^UC[\w-]{20,}$/.test(text)) return { id: text };
  if (text.startsWith('@')) return { handle: text.slice(1) };
  try {
    const url = new URL(text);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'channel' && parts[1]) return { id: parts[1] };
    if (parts[0]?.startsWith('@')) return { handle: parts[0].slice(1) };
    if (parts[0]) return { handle: parts[0].replace(/^@/, '') };
  } catch {}
  return { handle: text.replace(/^@/, '') };
}

function count(value) {
  return value === undefined || value === null || value === '' ? null : Number(value);
}

async function searchVideos({ query, publishedWithinDays, maxResults, pageToken, order } = {}) {
  const text = String(query || '').trim().slice(0, 120);
  if (!text) throw new Error('A search query is required.');
  const days = Number(publishedWithinDays);
  const boundedDays = Number.isFinite(days) && days > 0 ? Math.min(Math.floor(days), 365) : 0;
  const sort = ['viewCount', 'relevance', 'date'].includes(order) ? order : (boundedDays ? 'viewCount' : 'relevance');
  const data = await youtube('/search', {
    part: 'snippet',
    type: 'video',
    q: text,
    maxResults: Math.min(Math.max(Number(maxResults) || 8, 1), 15),
    order: sort,
    publishedAfter: boundedDays ? new Date(Date.now() - boundedDays * 86400000).toISOString() : undefined,
    pageToken: pageToken ? String(pageToken).slice(0, 200) : undefined,
  });
  const videos = (data.items || []).map(item => ({
    videoId: item.id?.videoId || '',
    title: item.snippet?.title || '',
    publishedAt: item.snippet?.publishedAt || '',
    channelId: item.snippet?.channelId || '',
    channelTitle: item.snippet?.channelTitle || '',
    url: item.id?.videoId ? `https://www.youtube.com/watch?v=${item.id.videoId}` : '',
  })).filter(item => item.videoId);
  return { query: text, order: sort, publishedWithinDays: boundedDays || null, videos, nextPageToken: data.nextPageToken || null };
}

async function videoDetails(input) {
  const ids = [...new Set(asList(input?.videos ?? input?.video).map(videoId).filter(Boolean))].slice(0, 15);
  if (!ids.length) throw new Error('Provide at least one YouTube video ID or URL.');
  const data = await youtube('/videos', { part: 'snippet,statistics,contentDetails', id: ids.join(','), maxResults: ids.length });
  const videos = (data.items || []).map(item => ({
    videoId: item.id,
    title: item.snippet?.title || '',
    publishedAt: item.snippet?.publishedAt || '',
    channelId: item.snippet?.channelId || '',
    channelTitle: item.snippet?.channelTitle || '',
    duration: item.contentDetails?.duration || '',
    viewCount: count(item.statistics?.viewCount),
    likeCount: count(item.statistics?.likeCount),
    commentCount: count(item.statistics?.commentCount),
    url: `https://www.youtube.com/watch?v=${item.id}`,
  }));
  return { videos, missing: ids.filter(id => !videos.some(video => video.videoId === id)) };
}

function publicChannel(item) {
  return {
    channelId: item.id,
    title: item.snippet?.title || '',
    customUrl: item.snippet?.customUrl || '',
    publishedAt: item.snippet?.publishedAt || '',
    description: String(item.snippet?.description || '').slice(0, 280),
    subscriberCount: item.statistics?.hiddenSubscriberCount ? null : count(item.statistics?.subscriberCount),
    hiddenSubscriberCount: Boolean(item.statistics?.hiddenSubscriberCount),
    videoCount: count(item.statistics?.videoCount),
    viewCount: count(item.statistics?.viewCount),
    url: `https://www.youtube.com/channel/${item.id}`,
  };
}

async function channelDetails(input) {
  const refs = asList(input?.channels ?? input?.channel).slice(0, 8).map(channelRef);
  if (!refs.length) throw new Error('Provide at least one channel ID, handle, or URL.');
  const channels = [];
  const ids = [...new Set(refs.filter(ref => ref.id).map(ref => ref.id))];
  if (ids.length) {
    const data = await youtube('/channels', { part: 'snippet,statistics', id: ids.join(','), maxResults: ids.length });
    channels.push(...(data.items || []).map(publicChannel));
  }
  for (const handle of [...new Set(refs.filter(ref => ref.handle).map(ref => ref.handle))].slice(0, 5)) {
    const data = await youtube('/channels', { part: 'snippet,statistics', forHandle: handle });
    channels.push(...(data.items || []).map(publicChannel));
  }
  const seen = new Set();
  return {
    channels: channels.filter(channel => {
      if (seen.has(channel.channelId)) return false;
      seen.add(channel.channelId);
      return true;
    }),
  };
}

async function myChannel() {
  const data = await youtube('/channels', { part: 'snippet,contentDetails,statistics', mine: 'true' });
  const item = (data.items || [])[0];
  if (!item) return { channel: null, videos: [], reason: 'This authorized Google account has no YouTube channel.' };
  const channel = publicChannel(item);
  const uploads = item.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return { channel, videos: [] };
  const playlist = await youtube('/playlistItems', { part: 'snippet', playlistId: uploads, maxResults: 5 });
  const ids = (playlist.items || []).map(entry => entry.snippet?.resourceId?.videoId).filter(Boolean);
  if (!ids.length) return { channel, videos: [] };
  const details = await videoDetails({ videos: ids });
  const byId = new Map(details.videos.map(video => [video.videoId, video]));
  return { channel, videos: ids.map(id => byId.get(id)).filter(Boolean) };
}

function completeDayRange(days) {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const iso = date => date.toISOString().slice(0, 10);
  return { startDate: iso(start), endDate: iso(end), days };
}

async function analyticsReport(params) {
  const { token } = credential();
  if (!token) {
    return { status: 'permission_denied', detail: 'YouTube Analytics requires the authorized Google account.' };
  }
  const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports');
  for (const [name, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value));
  }
  let response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    return { status: 'error', detail: 'YouTube Analytics network request failed.' };
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const reason = data?.error?.errors?.[0]?.reason || '';
    if (response.status === 401 || response.status === 403) {
      return { status: 'permission_denied', detail: 'YouTube Analytics rejected this authorized account.' };
    }
    if (response.status === 400) return { status: 'unsupported', detail: reason || 'This report is not supported.' };
    return { status: 'error', detail: reason || 'YouTube Analytics request failed.' };
  }
  const headers = (data.columnHeaders || []).map(header => header.name);
  const rows = (data.rows || []).map(row => {
    const item = {};
    headers.forEach((name, index) => { item[name] = row[index]; });
    return item;
  });
  return { status: rows.length ? 'ok' : 'no_data', rows };
}

async function myAnalytics() {
  const range = completeDayRange(28);
  const base = { ids: 'channel==MINE', startDate: range.startDate, endDate: range.endDate };
  const summary = await analyticsReport({
    ...base,
    metrics: 'views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost',
  });
  const daily = await analyticsReport({
    ...base,
    dimensions: 'day',
    metrics: 'views,estimatedMinutesWatched,averageViewDuration',
    sort: 'day',
  });
  const videos = await analyticsReport({
    ...base,
    dimensions: 'video',
    metrics: 'views,estimatedMinutesWatched,averageViewDuration',
    sort: '-views',
    maxResults: 10,
  });
  const traffic = await analyticsReport({
    ...base,
    dimensions: 'insightTrafficSourceType',
    metrics: 'views,estimatedMinutesWatched',
    sort: '-views',
  });
  const top = (videos.rows || []).find(row => row.video);
  let retention;
  if (!top) {
    retention = { status: 'no_data', detail: 'No per-video Analytics rows were returned, so audience retention was not queried.' };
  } else {
    retention = await analyticsReport({
      ...base,
      filters: `video==${top.video}`,
      dimensions: 'elapsedVideoTimeRatio',
      metrics: 'audienceWatchRatio,relativeRetentionPerformance',
    });
    retention.videoId = top.video;
    if (retention.status === 'unsupported') {
      retention.detail = 'Audience retention is not available for this video or report combination.';
    }
  }
  return {
    source: 'YouTube Analytics API reports.query',
    range,
    summary,
    daily,
    videos,
    traffic,
    retention,
  };
}

async function myComments() {
  const data = await youtube('/channels', { part: 'id', mine: 'true' });
  const channelId = data.items?.[0]?.id || '';
  if (!channelId) return { channelId: null, comments: [], reason: 'This authorized Google account has no YouTube channel.' };
  let threads;
  try {
    threads = await youtube('/commentThreads', {
      part: 'snippet',
      allThreadsRelatedToChannelId: channelId,
      maxResults: 20,
      order: 'time',
      textFormat: 'plainText',
    });
  } catch (error) {
    if (['commentsDisabled', 'forbidden', 'insufficientPermissions'].includes(error.reason)) {
      return { channelId, comments: [], reason: 'Comments are not available for this authorized channel.' };
    }
    throw error;
  }
  const comments = [];
  for (const item of (threads.items || []).slice(0, 20)) {
    const top = item.snippet?.topLevelComment?.snippet || {};
    const text = String(top.textOriginal || top.textDisplay || '').replace(/\s+/g, ' ').trim().slice(0, 400);
    if (!text) continue;
    comments.push({
      videoId: top.videoId || null,
      author: String(top.authorDisplayName || '').slice(0, 80),
      publishedAt: top.publishedAt || null,
      likeCount: Number.isFinite(Number(top.likeCount)) ? Number(top.likeCount) : null,
      replyCount: Number.isFinite(Number(item.snippet?.totalReplyCount)) ? Number(item.snippet.totalReplyCount) : null,
      text,
    });
  }
  return { channelId, comments };
}

module.exports = { searchVideos, videoDetails, channelDetails, myChannel, myAnalytics, myComments, videoId, channelRef };
