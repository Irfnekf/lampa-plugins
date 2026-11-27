// Підбірки аніме з AniList для каталогу «Аніме» в LMX Pack.
// AniList знає сезони, тренди й оцінки аніме-глядачів краще за TMDB; id AniList переводимо в id TMDB
// за відкритою таблицею Fribb/anime-lists. Результат — anime_lists.json у корені (його віддає GitHub Pages).
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const OUT = 'anime_lists.json';
const MAP_URL = 'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json';
const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
const UA_SEASON = ['Зима', 'Весна', 'Літо', 'Осінь'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function al(query, variables) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (r.status === 429) { await sleep(65000); continue; }
    const j = await r.json();
    if (j.errors) throw new Error(JSON.stringify(j.errors));
    await sleep(2500);
    return j.data.Page.media;
  }
  throw new Error('AniList rate limit');
}

const Q = `query($p:Int,$sort:[MediaSort],$season:MediaSeason,$year:Int,$status:MediaStatus,$status_not:MediaStatus,$pop:Int,$fmt:[MediaFormat],$genre:[String],$tag:[String],$after:FuzzyDateInt,$rank:Int){
  Page(page:$p,perPage:50){ media(type:ANIME,isAdult:false,countryOfOrigin:"JP",format_in:$fmt,genre_in:$genre,tag_in:$tag,minimumTagRank:$rank,startDate_greater:$after,
    sort:$sort,season:$season,seasonYear:$year,status:$status,status_not:$status_not,popularity_greater:$pop){ id format } } }`;
const FMT = ['TV', 'TV_SHORT', 'ONA', 'MOVIE'];
const q = (v) => al(Q, { fmt: FMT, ...v });
const two = async (v) => [...await q({ ...v, p: 1 }), ...await q({ ...v, p: 2 })];

function seasonOf(d, shift) {
  let q = Math.floor(d.getUTCMonth() / 3) + (shift || 0), y = d.getUTCFullYear();
  if (q > 3) { q -= 4; y++; }
  return { s: SEASONS[q], y, name: UA_SEASON[q] + ' ' + y };
}

async function main() {
  const map = {};
  const full = await (await fetch(MAP_URL)).json();
  for (const e of full) {
    if (!e.anilist_id || !e.themoviedb_id) continue;
    const t = e.themoviedb_id;
    if (t.tv) map[e.anilist_id] = ['tv', +t.tv];
    else if (Array.isArray(t.movie) && t.movie.length) map[e.anilist_id] = ['movie', +t.movie[0]];
    else if (t.movie) map[e.anilist_id] = ['movie', +t.movie];
  }

  const now = new Date(), cur = seasonOf(now, 0), nxt = seasonOf(now, 1);
  const Y = now.getUTCFullYear();
  const raw = {
    trend: await q({ p: 1, sort: ['TRENDING_DESC'], status_not: 'NOT_YET_RELEASED' }),
    season: await two({ sort: ['POPULARITY_DESC'], season: cur.s, year: cur.y }),
    next: await q({ p: 1, sort: ['POPULARITY_DESC'], season: nxt.s, year: nxt.y }),
    top: await two({ sort: ['SCORE_DESC'], pop: 40000 }),
    // найпопулярніше за кількістю глядачів (усі часи)
    popular: await two({ sort: ['POPULARITY_DESC'] }),
    // топ аніме-фільмів за оцінками
    movies: await two({ sort: ['SCORE_DESC'], fmt: ['MOVIE'], pop: 15000 }),
    // найкраще минулого року
    lastyear: await q({ p: 1, sort: ['SCORE_DESC'], year: Y - 1, pop: 8000 }),
    // жанри й теги AniList (з 2010 року, за популярністю)
    romance: await q({ p: 1, sort: ['POPULARITY_DESC'], genre: ['Romance'], after: 20100000 }),
    psych: await q({ p: 1, sort: ['POPULARITY_DESC'], genre: ['Psychological'], after: 20100000 }),
    revenge: await q({ p: 1, sort: ['POPULARITY_DESC'], tag: ['Revenge'], rank: 85, after: 20000000 }),
    survival: await q({ p: 1, sort: ['POPULARITY_DESC'], tag: ['Survival'], rank: 85, after: 20000000 }),
    antihero: await q({ p: 1, sort: ['POPULARITY_DESC'], tag: ['Anti-Hero'], rank: 85, after: 20000000 }),
  };

  const lists = {};
  for (const k of Object.keys(raw)) {
    const seen = {}, out = [];
    for (const m of raw[k]) {
      const t = map[m.id];
      if (!t) continue;
      const key = t[0] + t[1];
      if (seen[key]) continue;   // сезони одного серіалу в TMDB — один тайтл
      seen[key] = 1;
      out.push(t);
      if (out.length >= 60) break;
    }
    lists[k] = out;
  }
  if (lists.trend.length < 10 || lists.top.length < 20) throw new Error('too few mapped: ' + JSON.stringify(Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length]))));

  const data = { v: 2, season: cur.name, next: nxt.name, lastyear: Y - 1, lists };
  const prev = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  const body = JSON.stringify(data);
  if (prev && JSON.stringify({ ...JSON.parse(prev), t: undefined }) === JSON.stringify({ ...data, t: undefined })) { console.log('no changes'); return; }
  writeFileSync(OUT, JSON.stringify({ ...data, t: Date.now() }));
  console.log('written', Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length])));
}

main().catch((e) => { console.error(e); process.exit(1); });
