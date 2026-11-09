// Verified public search routes; native platform collection is a separate capability.
const platforms = ['youtube', 'tiktok', 'x', 'reddit', 'xiaohongshu', 'douyin', 'bilibili', 'weibo'];
const domains = {youtube:['youtube.com','youtu.be'],tiktok:['tiktok.com'],x:['x.com','twitter.com'],reddit:['reddit.com','redd.it'],xiaohongshu:['xiaohongshu.com','xhslink.com'],douyin:['douyin.com'],bilibili:['bilibili.com','b23.tv'],weibo:['weibo.com','weibo.cn']};
const publicSearch = {
  reddit: {channel:'reddit',backend:'public-web'},
  tiktok: {channel:'web',backend:'exa',queryScope:'tiktok.com'},
  douyin: {channel:'web',backend:'exa',queryScope:'douyin.com'},
  bilibili: {channel:'web',backend:'exa',queryScope:'bilibili.com'},
  weibo: {channel:'web',backend:'exa',queryScope:'weibo.com'},
};
function capabilities() {
  return platforms.map(platform => ({
    platform,
    preferredProvider: ['xiaohongshu', 'douyin', 'bilibili', 'weibo'].includes(platform) ? 'mediacrawler' : 'agent-reach',
    actions: {
      search: platform === 'youtube'
        ? { enabled: true, provider: 'agent-reach', channel: 'youtube', backend: 'yt-dlp', scope: 'search_metadata', verified: '2026-11-06' }
        : platform === 'xiaohongshu'
          ? { enabled: true, provider: 'agent-reach', channel: 'xiaohongshu', backend: 'public-web', scope: 'search_results', verified: '2026-11-06', fallbackReason: 'MediaCrawler native runtime and dedicated login session are not ready.' }
          : publicSearch[platform]
            ? {enabled:true,provider:'agent-reach',...publicSearch[platform],scope:'search_results',verified:'2026-11-07',verificationEnvironment:'local-mac; ECS pending'}
            : { enabled: false, reason: 'Public search probes returned no usable platform-scoped results; native access is not configured.' },
      details: { enabled: false, reason: 'Not validated; YouTube detail access encountered a platform challenge.' },
      transcript: { enabled: false, reason: 'Not validated in this adapter.' },
      comments: { enabled: false, reason: 'No validated comment access; do not infer audience concerns from snippets.' },
      creator: { enabled: false, reason: 'Not validated in this adapter.' },
    },
    mediaCrawler: { enabled: false, nativeSearchVerifiedLocally:['bilibili','weibo','douyin'].includes(platform), usage:'User confirmed non-commercial open-source learning on 2026-11-07.', reason: 'Public search does not auto-launch native collection. research_native_search requires a configured learning runtime and a dedicated user-authorized session; ECS native collection is not deployed.' },
  }));
}
module.exports = { capabilities, platforms, domains };
