function plain(value) {
  return value.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
}
function bingResults(html) {
  const results=[];
  for (const item of html.matchAll(/<li\b[^>]*class=["']?b_algo\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const heading=item[1].match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
    const link=heading?.[1].match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    try {
      let url=new URL(plain(link[1]));
      if (/(^|\.)bing\.com$/.test(url.hostname) && url.pathname === '/ck/a') {
        const encoded=url.searchParams.get('u');
        if (encoded?.startsWith('a1')) url=new URL(Buffer.from(encoded.slice(2),'base64url').toString('utf8'));
      }
      if (!['http:','https:'].includes(url.protocol) || /(^|\.)bing\.com$/.test(url.hostname)) continue;
      results.push({title:plain(link[2]),url:url.href,snippet:plain(item[1].match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '').slice(0,1000)});
    } catch {}
  }
  return results.slice(0,8);
}
module.exports={bingResults};
