const http = require('node:http');
const { URL } = require('node:url');

const PORT = Number(process.env.PORT || 7000);
const SITE = 'https://redetoons.cc';
const ADDON_ID = 'com.redetoons.stremio';
const PAGE_SIZE = Math.min(Math.max(Number(process.env.PAGE_SIZE || 100), 1), 100);
const CACHE_TTL = Number(process.env.CACHE_TTL_MS || 300000);
const SEARCH_CLIENT = '20260731-2';
const cache = new Map();

const EXTRAS = [{ name: 'search', isRequired: false }, { name: 'skip', isRequired: false }];
const catalogs = [
  { id: 'animes', name: 'RedeToons - Animes', type: 'series', source: { type: 'anime', mediaType: 'tv' } },
  { id: 'series', name: 'RedeToons - Séries', type: 'series', source: { type: 'tv', mediaType: 'tv' } },
  { id: 'filmes', name: 'RedeToons - Filmes', type: 'movie', source: { type: 'movie', mediaType: 'movie' } },
  { id: 'acao', name: 'RedeToons - Ação', type: 'series', source: { type: 'tv', genre: 'acao', mediaType: 'tv' } },
  { id: 'aventura', name: 'RedeToons - Aventura', type: 'series', source: { type: 'tv', genre: 'aventura', mediaType: 'tv' } },
  { id: 'animacao', name: 'RedeToons - Animação', type: 'series', source: { type: 'tv', genre: 'animacao', mediaType: 'tv' } },
  { id: 'comedia', name: 'RedeToons - Comédia', type: 'series', source: { type: 'tv', genre: 'comedia', mediaType: 'tv' } },
  { id: 'crime', name: 'RedeToons - Crime', type: 'series', source: { type: 'tv', genre: 'crime', mediaType: 'tv' } },
  { id: 'drama', name: 'RedeToons - Drama', type: 'series', source: { type: 'tv', genre: 'drama', mediaType: 'tv' } },
  { id: 'fantasia', name: 'RedeToons - Fantasia', type: 'series', source: { type: 'tv', genre: 'fantasia', mediaType: 'tv' } },
  { id: 'infantil', name: 'RedeToons - Infantil', type: 'series', source: { type: 'tv', genre: 'infantil', mediaType: 'tv' } },
  { id: 'misterio', name: 'RedeToons - Mistério', type: 'series', source: { type: 'tv', genre: 'misterio', mediaType: 'tv' } },
  { id: 'ficcao', name: 'RedeToons - Ficção científica', type: 'series', source: { type: 'tv', genre: 'ficcao-cientifica', mediaType: 'tv' } },
  { id: 'terror', name: 'RedeToons - Terror', type: 'series', source: { type: 'tv', genre: 'terror', mediaType: 'tv' } },
  { id: 'novidades', name: 'RedeToons - Novidades', type: 'series', source: { type: 'tv', genre: 'novidades', mediaType: 'tv' } },
];

const MANIFEST = {
  id: ADDON_ID,
  version: '1.0.0',
  name: 'RedeToons',
  description: 'Catálogos de filmes, séries, animes e animações do RedeToons para Stremio.',
  logo: `${SITE}/favicon.ico`,
  resources: ['catalog', 'meta', 'stream'],
  types: ['movie', 'series'],
  idPrefixes: ['rt:'],
  catalogs: catalogs.map((c) => ({ type: c.type, id: c.id, name: c.name, extra: EXTRAS })),
  behaviorHints: { configurable: false, configurationRequired: false },
};

function send(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'cache-control': 'public, max-age=60',
  });
  res.end(JSON.stringify(body));
}

function clean(value, max = 10000) {
  if (value == null) return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : undefined;
}

function cached(key) {
  const item = cache.get(key);
  return item && item.expires > Date.now() ? item.value : null;
}

function putCache(key, value) {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL });
  return value;
}

async function api(path, options = {}) {
  const key = `${options.method || 'GET'}:${path}`;
  const hit = cached(key);
  if (hit) return hit;
  const response = await fetch(`${SITE}${path}`, {
    ...options,
    headers: { accept: 'application/json', ...(options.headers || {}) },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`RedeToons API HTTP ${response.status}`);
  const data = await response.json();
  return putCache(key, data);
}

function imageUrl(path, size = 'w500') {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function contentId(mediaType, tmdbId) {
  return `rt:${mediaType}:${Number(tmdbId)}`;
}

function metaFromItem(item, forcedType) {
  const mediaType = forcedType || (item.media_type === 'movie' ? 'movie' : 'series');
  return {
    id: contentId(mediaType === 'movie' ? 'movie' : 'tv', item.id),
    type: mediaType,
    name: clean(item.title || item.name) || `RedeToons ${item.id}`,
    poster: imageUrl(item.poster_path, 'w500'),
    background: imageUrl(item.backdrop_path, 'w1280'),
    year: Number(String(item.year || '').slice(0, 4)) || undefined,
    description: clean(item.overview),
    website: `${SITE}/${mediaType === 'movie' ? 'filme' : 'serie'}/${item.id}`,
  };
}

async function catalogItems(source, page, limit) {
  const params = new URLSearchParams({ mode: 'browse', type: source.type, page: String(page), limit: String(limit) });
  if (source.genre && source.genre !== 'novidades') params.set('genre', source.genre);
  const data = await api(`/api/catalog?${params}`);
  return Array.isArray(data.items) ? data.items : [];
}

async function searchItems(query) {
  const params = new URLSearchParams({ q: query, cv: SEARCH_CLIENT });
  const data = await api(`/api/search?${params}`, { headers: { 'X-Search-Client': SEARCH_CLIENT } });
  return Array.isArray(data.results) ? data.results : [];
}

async function tmdb(type, id) {
  const params = new URLSearchParams({ language: 'pt-BR', region: 'BR', include_image_language: 'pt,en,null', append_to_response: 'images,videos' });
  return api(`/api/tmdb/${type}/${id}?${params}`);
}

async function playable(id) {
  const data = await api(`/api/series-playable/${id}`);
  return Array.isArray(data.episodes) ? data.episodes : [];
}

async function playLink(id, season, episode) {
  const params = new URLSearchParams({ contract: '3', tmdbId: String(id), type: 'tv', season: String(season), episode: String(episode) });
  return api(`/api/play-link?${params}`);
}

function overviewFromDetails(details) {
  return clean(details.overview || details.description);
}

function titleFromDetails(details, mediaType) {
  return clean(mediaType === 'movie' ? details.title : details.name) || `RedeToons ${details.id}`;
}

function videoId(tmdbId, season, episode) {
  return `rt:tv:${Number(tmdbId)}:s${Number(season)}:e${Number(episode)}`;
}

async function handleCatalog(res, catalogId, url, extra) {
  const catalog = catalogs.find((c) => c.id === catalogId);
  if (!catalog) return send(res, 404, { metas: [] });
  const query = clean(extra.search || url.searchParams.get('search'));
  const skip = Math.max(Number(extra.skip || url.searchParams.get('skip') || 0) || 0, 0);
  let items;
  if (query) items = await searchItems(query);
  else items = await catalogItems(catalog.source, Math.floor(skip / PAGE_SIZE) + 1, PAGE_SIZE);
  const filtered = items.filter((item) => {
    if (catalog.type === 'movie') return item.media_type === 'movie';
    return item.media_type === 'tv';
  });
  return send(res, 200, { metas: filtered.slice(0, PAGE_SIZE).map((item) => metaFromItem(item, catalog.type)) });
}

async function handleMeta(res, rawId) {
  const parts = decodeURIComponent(rawId).split(':');
  const mediaType = parts[1];
  const id = Number(parts[2]);
  if (!id || !['tv', 'movie'].includes(mediaType)) return send(res, 404, { meta: null });
  const details = await tmdb(mediaType, id);
  const type = mediaType === 'movie' ? 'movie' : 'series';
  const meta = {
    id: contentId(mediaType, id),
    type,
    name: titleFromDetails(details, mediaType),
    poster: imageUrl(details.poster_path, 'w500'),
    background: imageUrl(details.backdrop_path, 'w1280'),
    description: overviewFromDetails(details),
    year: Number(String(details.release_date || details.first_air_date || '').slice(0, 4)) || undefined,
    genres: Array.isArray(details.genres) ? details.genres.map((g) => g.name).filter(Boolean) : undefined,
    website: `${SITE}/${mediaType === 'movie' ? 'filme' : 'serie'}/${id}`,
  };
  if (mediaType === 'tv') {
    const episodes = await playable(id);
    meta.videos = episodes.map((ep) => ({
      id: videoId(id, ep.s, ep.e),
      title: clean(ep.name) || `Episódio ${ep.e}`,
      name: clean(ep.name) || `Episódio ${ep.e}`,
      season: Number(ep.s) || 1,
      episode: Number(ep.e) || undefined,
      available: true,
      website: `${SITE}/serie/${id}`,
    })).filter((ep) => ep.episode);
  }
  return send(res, 200, { meta });
}

function variantLabel(variant, data) {
  const quality = clean(variant.quality || '').toLowerCase();
  if (quality.includes('dub')) return 'Dublado';
  if (quality.includes('leg')) return 'Legendado';
  if (data.is_legendado === true) return 'Legendado';
  if (data.is_legendado === false) return 'Dublado';
  return 'RedeToons';
}

async function handleStream(res, rawId) {
  const match = decodeURIComponent(rawId).match(/^rt:tv:(\d+):s(\d+):e(\d+)$/);
  if (!match) return send(res, 200, { streams: [] });
  const [, id, season, episode] = match;
  const data = await playLink(id, season, episode);
  const variants = Array.isArray(data.variants) ? data.variants : [];
  const streams = [];
  const seen = new Set();
  for (const variant of variants) {
    const url = typeof variant.url === 'string' ? variant.url : variant.mirrors?.[0];
    if (!/^https?:\/\//i.test(url || '') || seen.has(url)) continue;
    seen.add(url);
    const label = variantLabel(variant, data);
    streams.push({
      name: `RedeToons — ${label}`,
      title: `Temporada ${season} · Episódio ${episode}${variant.quality ? ` · ${variant.quality}` : ''}`,
      url,
      externalUrl: `${SITE}/serie/${id}`,
      behaviorHints: { bingeGroup: `redetoons-tv-${id}-${label.toLowerCase()}` },
    });
  }
  if (!streams.length && typeof data.url === 'string' && /^https?:\/\//i.test(data.url)) {
    streams.push({ name: `RedeToons — ${data.is_legendado ? 'Legendado' : 'Dublado'}`, title: `Temporada ${season} · Episódio ${episode}`, url: data.url, externalUrl: `${SITE}/serie/${id}` });
  }
  return send(res, 200, { streams });
}

function parseExtras(value) {
  const out = {};
  for (const token of String(value || '').split('&')) {
    const index = token.indexOf('=');
    if (index > 0) out[decodeURIComponent(token.slice(0, index))] = decodeURIComponent(token.slice(index + 1));
  }
  return out;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const rawPath = url.pathname.replace(/\/$/, '');
    const path = rawPath.replace(/\.json$/, '');
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
    if (path === '' || path === '/health') return send(res, 200, { ok: true, service: ADDON_ID });
    if (rawPath === '/manifest.json' || path === '/manifest') return send(res, 200, MANIFEST);
    let match = path.match(/^\/catalog\/(series|movie)\/([^/]+)(?:\/(.*))?$/);
    if (match) return await handleCatalog(res, match[2], url, parseExtras(match[3]));
    match = path.match(/^\/meta\/(series|movie)\/([^/]+)$/);
    if (match) return await handleMeta(res, match[2]);
    match = path.match(/^\/stream\/series\/([^/]+)$/);
    if (match) return await handleStream(res, match[1]);
    return send(res, 404, { error: 'Not found' });
  } catch (error) {
    console.error(error);
    return send(res, 502, { error: 'Fonte temporariamente indisponível' });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`RedeToons Stremio addon listening on ${PORT}`));
