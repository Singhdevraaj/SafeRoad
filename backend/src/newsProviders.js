// News sources. Google News RSS needs no key and is always on. GNews and NewsData.io are
// optional extras (add a key in .env); each is capped by a daily budget so free plans never run out.
import { XMLParser } from 'fast-xml-parser';
import { canSpend, isTripped, spend, trip } from './quota.js';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
const DAY = 86400000;
const WINDOW_DAYS = 183;

const asText = (value) => (typeof value === 'string' ? value : value && typeof value === 'object' ? value['#text'] || '' : '');
export const stripMarkup = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

const TOPICS = {
  road: {
    google: '("road accident" OR "car crash" OR "highway crash" OR collision OR pothole OR "road damage" OR "traffic disruption" OR "road closure" OR "vehicle fire")',
    keyed: '(accident OR crash OR pothole OR "road closure" OR "highway")',
  },
  women: {
    google: '("women safety" OR harassment OR molestation OR "eve teasing" OR stalking OR "chain snatching" OR "crime against women")',
    keyed: '(harassment OR molestation OR "women safety" OR stalking OR "chain snatching")',
  },
};

function normalise(item, provider) {
  const published = item.publishedAt ? new Date(item.publishedAt) : null;
  const ok = published && !Number.isNaN(published.getTime());
  return {
    title: stripMarkup(item.title),
    url: item.url,
    source: item.source || 'News result',
    sourceUrl: item.sourceUrl || item.url,
    publishedAt: ok ? published.toISOString() : null,
    snippet: stripMarkup(item.snippet || '').slice(0, 900),
    ageMs: ok ? Date.now() - published.getTime() : Infinity,
    provider,
  };
}

export function parseGoogleRss(xml) {
  const channel = parser.parse(xml)?.rss?.channel;
  const raw = channel?.item ? (Array.isArray(channel.item) ? channel.item : [channel.item]) : [];
  return raw.map((item) => normalise({
    title: asText(item.title), url: asText(item.link), source: asText(item.source), sourceUrl: item.source?.['@_url'],
    publishedAt: item.pubDate, snippet: asText(item.description),
  }, 'google'));
}

async function googleNews(area, topic) {
  const after = new Date(Date.now() - WINDOW_DAYS * DAY).toISOString().slice(0, 10);
  const url = new URL('https://news.google.com/rss/search');
  url.searchParams.set('q', `${TOPICS[topic].google} ${area} after:${after}`);
  url.searchParams.set('hl', 'en-IN');
  url.searchParams.set('gl', 'IN');
  url.searchParams.set('ceid', 'IN:en');
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 SafeTravel/1.0' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Google News HTTP ${response.status}`);
  return parseGoogleRss(await response.text());
}

async function gnews(area, topic) {
  const key = process.env.GNEWS_API_KEY;
  if (!key || isTripped('gnews') || !canSpend('gnews')) return [];
  const url = new URL('https://gnews.io/api/v4/search');
  url.searchParams.set('q', `${TOPICS[topic].keyed} AND "${area.split(',')[0].trim()}"`);
  url.searchParams.set('lang', 'en');
  url.searchParams.set('country', 'in');
  url.searchParams.set('max', '10');
  url.searchParams.set('sortby', 'publishedAt');
  url.searchParams.set('apikey', key);
  spend('gnews');
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (response.status === 403 || response.status === 429) { trip('gnews', 3600 * 1000); return []; }
  if (!response.ok) throw new Error(`GNews HTTP ${response.status}`);
  const { articles = [] } = await response.json();
  return articles.map((a) => normalise({ title: a.title, url: a.url, source: a.source?.name, sourceUrl: a.source?.url, publishedAt: a.publishedAt, snippet: a.description }, 'gnews'));
}

async function newsdata(area, topic) {
  const key = process.env.NEWSDATA_API_KEY;
  if (!key || isTripped('newsdata') || !canSpend('newsdata')) return [];
  const url = new URL('https://newsdata.io/api/1/latest');
  url.searchParams.set('apikey', key);
  url.searchParams.set('q', `${TOPICS[topic].keyed} AND "${area.split(',')[0].trim()}"`.slice(0, 480));
  url.searchParams.set('country', 'in');
  url.searchParams.set('language', 'en');
  spend('newsdata');
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (response.status === 401 || response.status === 403 || response.status === 429) { trip('newsdata', 3600 * 1000); return []; }
  if (!response.ok) throw new Error(`NewsData HTTP ${response.status}`);
  const { results = [] } = await response.json();
  return results.map((a) => normalise({
    title: a.title, url: a.link, source: a.source_name || a.source_id, sourceUrl: a.source_url,
    publishedAt: a.pubDate ? (/[zZ]|[+-]\d\d:?\d\d$/.test(a.pubDate) ? a.pubDate : `${a.pubDate.replace(' ', 'T')}Z`) : null, snippet: a.description,
  }, 'newsdata'));
}

const titleKey = (title) => title.toLowerCase().replace(/\s+-\s+[^-]+$/, '').replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 70);

// Pulls from every available source in parallel, merges duplicates, newest first.
export async function fetchArticles(area, topic = 'road') {
  const safeTopic = TOPICS[topic] ? topic : 'road';
  const settled = await Promise.allSettled([googleNews(area, safeTopic), gnews(area, safeTopic), newsdata(area, safeTopic)]);
  const names = ['google', 'gnews', 'newsdata'];
  const providers = {};
  const seen = new Set();
  const merged = [];
  settled.forEach((result, i) => {
    providers[names[i]] = result.status === 'fulfilled' ? result.value.length : `error: ${result.reason?.message || 'failed'}`;
    if (result.status !== 'fulfilled') return;
    for (const article of result.value) {
      const key = titleKey(article.title);
      if (!article.title || !article.url || article.ageMs < 0 || article.ageMs > WINDOW_DAYS * DAY || seen.has(key)) continue;
      seen.add(key);
      merged.push(article);
    }
  });
  if (settled[0].status === 'rejected' && !merged.length) throw settled[0].reason;
  merged.sort((a, b) => a.ageMs - b.ageMs);
  return { articles: merged.slice(0, 30).map((article, index) => ({ ...article, index })), providers };
}
