const cache = new Map()

async function fetchCached(url, ttl = 30000) {
  const now = Date.now()
  const hit = cache.get(url)
  if (hit && now - hit.ts < ttl) return hit.data
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  const data = await res.json()
  cache.set(url, { data, ts: now })
  return data
}

// ── streamed.pk ───────────────────────────────────────────
// Proxy first (server-side, works on Vercel for everyone), then direct
// from the browser — some ISPs reset server-side TLS to streamed.pk while
// browsers with Encrypted Client Hello still get through.
const STREAMED_DIRECT = 'https://streamed.pk/api'
async function fetchStreamed(path, ttl) {
  try { return await fetchCached(`/streamed-api${path}`, ttl) }
  catch { return fetchCached(`${STREAMED_DIRECT}${path}`, ttl) }
}
export async function getLiveMatches() {
  return fetchStreamed('/matches/live', 15000)
}
export async function getFootballMatches() {
  return fetchStreamed('/matches/football', 30000)
}
export async function getTodayMatches() {
  return fetchStreamed('/matches/all-today', 30000)
}
export async function getStreams(source, id) {
  return fetchStreamed(`/stream/${source}/${id}`, 20000)
}
export function getBadgeUrl(badge) {
  return `https://streamed.pk/api/images/badge/${badge}.webp`
}

// Last-resort streams when the stream API is unreachable on every path
// (some ISPs block streamed.pk outright while the embed player domain
// still loads). Embed URLs follow a fixed pattern, so build them directly.
const STREAM_EMBED_BASE = 'https://embed.st/embed'
export function syntheticStreams(sources, perSource = 3) {
  return (sources ?? []).slice(0, 2).flatMap(({ source, id }) =>
    Array.from({ length: perSource }, (_, i) => ({
      id,
      source,
      streamNo: i + 1,
      hd: false,
      language: `${source} · stream ${i + 1}`,
      embedUrl: `${STREAM_EMBED_BASE}/${source}/${id}/${i + 1}`,
    }))
  )
}

// ── Opening Ceremony (streamed.pk PPV event) ──────────────
export const CEREMONY_ID = 'ppv-fifa-world-cup-opening-ceremony-mexico'
const CEREMONY_THUMB_PATH = '/images/proxy/GwZg7AZpYEZgHCAjAJgCzuAQ1sFKBWSYAU2DFLABM8E9g1gDCFJMd46Tp51jwywYAE50IGCBpYQ8YDSohhIkCGAQQKbCOwqQAYxBlE0koeCIap2cP37ShkNKyb+YQdoJaXhYElx7NITdWCG0yTU9ZMDc1UjUgA.webp'
export const CEREMONY_THUMB = `/streamed-api${CEREMONY_THUMB_PATH}`
export const CEREMONY_THUMB_DIRECT = `https://streamed.pk/api${CEREMONY_THUMB_PATH}`
export const CEREMONY_FALLBACK_SOURCES = [{ source: 'admin', id: CEREMONY_ID }]

// Look the ceremony up on streamed.pk so the live badge and stream sources
// track the real event; live list first, then today's events.
export async function findCeremonyMatch() {
  const probe = async (fn, live) => {
    try {
      const m = ((await fn()) ?? []).find(x =>
        x?.id === CEREMONY_ID || /opening\s*ceremony/i.test(x?.title ?? ''))
      return m ? { ...m, live } : null
    } catch { return null }
  }
  return (await probe(getLiveMatches, true))
      ?? (await probe(getTodayMatches, false))
      ?? null
}

// ── worldcup26.ir (via Next.js rewrite proxy) ─────────────
export async function getWCGames() {
  const data = await fetchCached('/worldcup-api/get/games', 12000)
  return data?.games ?? []
}
export async function getWCTeams() {
  const data = await fetchCached('/worldcup-api/get/teams', 300000)
  return data?.teams ?? []
}
export async function getWCGroups() {
  const data = await fetchCached('/worldcup-api/get/groups', 30000)
  return data?.groups ?? []
}
export async function getWCStadiums() {
  const data = await fetchCached('/worldcup-api/get/stadiums', 300000)
  return data?.stadiums ?? []
}

// ── Live scores from TheSportsDB (free) ───────────────────
// worldcup26.ir's schedule/teams are reliable but its live in-play feed lags
// badly (matches sit on "notstarted 0-0" well after kickoff). TheSportsDB
// carries accurate live scores + status for the FIFA World Cup, so we overlay
// those onto the schedule, joined by exact kickoff time (UTC).
const WC_SDB_LEAGUE = 4429
const WC_SDB_SEASON = '2026'
const WC_SDB_ROUNDS = [1, 2, 3] // group-stage matchdays (72 matches)

function sdbStatusToElapsed(s) {
  const up = String(s ?? '').trim().toUpperCase()
  if (['FT', 'AET', 'PEN', 'MATCH FINISHED', 'AWARDED', 'FINISHED'].includes(up)) return 'finished'
  if (['NS', 'NOT STARTED', '', 'TBD', 'POSTP', 'CANC'].includes(up)) return 'notstarted'
  return String(s).trim() // 1H / 2H / HT / ET / LIVE / minute → live
}

// Map keyed by "YYYY-MM-DDTHH:MM" (UTC kickoff) → live score record
export async function getWC2026LiveScores() {
  const urls = [
    ...WC_SDB_ROUNDS.map(r => `https://www.thesportsdb.com/api/v1/json/123/eventsround.php?id=${WC_SDB_LEAGUE}&r=${r}&s=${WC_SDB_SEASON}`),
    `https://www.thesportsdb.com/api/v1/json/123/eventsseason.php?id=${WC_SDB_LEAGUE}&s=${WC_SDB_SEASON}`, // catches knockouts as scheduled
  ]
  const lists = await Promise.all(urls.map(u =>
    fetchCached(u, 12000).then(d => d?.events).catch(() => null)
  ))
  const map = new Map()
  for (const events of lists) {
    for (const e of events ?? []) {
      const ts = (e.strTimestamp || `${e.dateEvent}T${e.strTime || '00:00:00'}`).slice(0, 16)
      if (!ts || ts.length < 16) continue
      map.set(ts, {
        home: e.strHomeTeam, away: e.strAwayTeam,
        hs: e.intHomeScore == null ? null : Number(e.intHomeScore),
        as: e.intAwayScore == null ? null : Number(e.intAwayScore),
        elapsed: sdbStatusToElapsed(e.strStatus),
      })
    }
  }
  return map
}

// Loose national-team name comparison across the two feeds
function sameNation(a, b) {
  // strip accents via NFD (combining marks land in U+0300–U+036F), then keep a–z0–9
  const n = s => String(s ?? '').toLowerCase().normalize('NFD')
    .split('').filter(c => { const k = c.charCodeAt(0); return !(k >= 0x300 && k <= 0x36f) }).join('')
    .replace(/[^a-z0-9]/g, '')
  const x = n(a), y = n(b)
  if (!x || !y) return false
  return x === y || x.includes(y) || y.includes(x)
}

// Overlay TheSportsDB live scores/status onto worldcup26.ir games. Names for
// scorers stay from worldcup26 (TheSportsDB free tier omits goal details).
export function applyLiveScores(games, teamsMap, liveMap) {
  if (!liveMap?.size) return games
  return games.map(game => {
    const ko = parseMatchDate(game.local_date, game.stadium_id)
    if (!ko) return game
    const rec = liveMap.get(ko.toISOString().slice(0, 16))
    if (!rec || rec.elapsed === 'notstarted') return game
    const homeName = teamsMap?.[game.home_team_id]?.name_en
    const swapped = !sameNation(homeName, rec.home) && sameNation(homeName, rec.away)
    const hs = swapped ? rec.as : rec.hs
    const as = swapped ? rec.hs : rec.as
    return {
      ...game,
      home_score: hs ?? game.home_score,
      away_score: as ?? game.away_score,
      time_elapsed: rec.elapsed,
      finished: rec.elapsed === 'finished' ? 'TRUE' : game.finished,
    }
  })
}

// ── helpers ───────────────────────────────────────────────
export function getFlagUrl(iso2, size = 160) {
  if (!iso2) return ''
  return `https://flagcdn.com/w${size}/${iso2.toLowerCase()}.png`
}

export async function getWikipediaImage(slug) {
  if (!slug) return null
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`
    const data = await fetchCached(url, 3600000)
    return data?.originalimage?.source ?? data?.thumbnail?.source ?? null
  } catch {
    return null
  }
}

// ── TheSportsDB (free, key=123) ───────────────────────────
// Returns { cutout, thumb, fanart, banner, render }
// fanart/banner = wide rectangular action shots (hero backgrounds)
// cutout = transparent full-body PNG, thumb = square headshot
const NO_IMAGES = { cutout: null, thumb: null, fanart: null, banner: null, render: null }
export async function getSportsDBPlayerImages(playerName) {
  if (!playerName) return NO_IMAGES
  try {
    const q = encodeURIComponent(playerName.replace(/ /g, '_'))
    const url = `https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p=${q}`
    const data = await fetchCached(url, 3600000)
    const p = data?.player?.[0]
    if (!p) return NO_IMAGES
    return {
      cutout: p.strCutout || null,
      thumb:  p.strThumb  || null,
      fanart: p.strFanart1 || p.strFanart2 || p.strFanart3 || p.strFanart4 || null,
      banner: p.strBanner || null,
      render: p.strRender || null,
    }
  } catch {
    return NO_IMAGES
  }
}

// Team imagery from TheSportsDB — wide fanart/banner action shots keyed by
// team name, so the hero background follows whatever match is featured.
const NO_TEAM_IMAGES = { fanart: null, banner: null, badge: null }
export async function getSportsDBTeamImages(teamName) {
  if (!teamName) return NO_TEAM_IMAGES
  try {
    const q = encodeURIComponent(teamName)
    const data = await fetchCached(`https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=${q}`, 3600000)
    const t = (data?.teams ?? []).find(x => x.strSport === 'Soccer') ?? data?.teams?.[0]
    if (!t) return NO_TEAM_IMAGES
    return {
      fanart: t.strFanart1 || t.strFanart2 || t.strFanart3 || t.strFanart4 || null,
      banner: t.strBanner || null,
      badge:  t.strBadge  || null,
    }
  } catch {
    return NO_TEAM_IMAGES
  }
}

// Dynamic squad list from TheSportsDB — fallback for teams without a curated
// roster, so Key Players / star player / shirt numbers work for every side.
function mapPosition(p) {
  const s = String(p ?? '').toLowerCase()
  if (s.includes('keeper')) return 'GK'
  if (s.includes('back') || s.includes('defen')) return 'DF'
  if (s.includes('midfield')) return 'MF'
  return 'FW'
}
const POS_ORDER = { FW: 0, MF: 1, DF: 2, GK: 3 }
export async function getSportsDBTeamRoster(teamName) {
  if (!teamName) return []
  try {
    const q = encodeURIComponent(teamName)
    const data = await fetchCached(`https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=${q}`, 3600000)
    const team = (data?.teams ?? []).find(x => x.strSport === 'Soccer')
    if (!team?.idTeam) return []
    const r = await fetchCached(`https://www.thesportsdb.com/api/v1/json/123/lookup_all_players.php?id=${team.idTeam}`, 3600000)
    return (r?.player ?? [])
      .filter(p => p?.strPlayer)
      .map(p => ({
        name: p.strPlayer,
        pos:  mapPosition(p.strPosition),
        num:  p.strNumber ? Number(p.strNumber) : '',
      }))
      .sort((a, b) => (POS_ORDER[a.pos] ?? 9) - (POS_ORDER[b.pos] ?? 9))
  } catch {
    return []
  }
}

// worldcup26.ir reports each match's kickoff in its VENUE local time. The
// tournament (11 Jun – 19 Jul 2026) sits entirely inside US/Canada DST, and
// Mexico runs no DST, so each host city has a single fixed UTC offset for the
// whole event. Map by stadium id → offset (minutes from UTC).
export const STADIUM_TZ_OFFSET = {
  1: -360, 2: -360, 3: -360,                       // Mexico City, Guadalajara, Monterrey (CST)
  4: -300, 5: -300, 6: -300,                       // Dallas, Houston, Kansas City (CDT)
  7: -240, 8: -240, 9: -240, 10: -240, 11: -240, 12: -240, // Atlanta, Miami, Boston, Philadelphia, NY/NJ, Toronto (EDT)
  13: -420, 14: -420, 15: -420, 16: -420,          // Vancouver, Seattle, SF Bay Area, Los Angeles (PDT)
}
// How long after kickoff we still treat a match as "live" if the feed's
// status field hasn't flipped yet (covers feed lag). ~match + stoppage + half-time.
const LIVE_WINDOW_MS = 140 * 60 * 1000

// Parse "MM/DD/YYYY HH:MM" (venue local) into an absolute instant, so every
// display via toLocale* renders in the viewer's own timezone.
export function parseMatchDate(localDate, stadiumId) {
  if (!localDate) return null
  try {
    const [datePart, timePart] = localDate.split(' ')
    const [mm, dd, yyyy] = datePart.split('/').map(Number)
    const [HH, MM] = (timePart ?? '00:00').split(':').map(Number)
    const off = STADIUM_TZ_OFFSET[stadiumId]
    if (off == null) {
      // Unknown venue — fall back to the viewer's local time (legacy behaviour)
      return new Date(yyyy, mm - 1, dd, HH, MM)
    }
    return new Date(Date.UTC(yyyy, mm - 1, dd, HH, MM) - off * 60000)
  } catch {
    return null
  }
}

export function matchStatus(game) {
  if (!game) return 'upcoming'
  const fin = String(game.finished).toUpperCase() === 'TRUE'
  const t = String(game.time_elapsed ?? '').toLowerCase().trim()
  if (fin || t === 'fulltime' || t === 'ft') return 'finished'
  // Feed reports an in-play marker (minute, "HT", etc.) — definitely live
  if (t && t !== 'notstarted' && t !== 'not started') return 'live'
  // Feed still says not started: trust the schedule so a match that has
  // clearly kicked off isn't stuck on "upcoming" while the feed catches up.
  const ko = parseMatchDate(game.local_date, game.stadium_id)
  if (ko) {
    const now = Date.now(), start = ko.getTime()
    if (now >= start) return now < start + LIVE_WINDOW_MS ? 'live' : 'finished'
  }
  return 'upcoming'
}

// Parse a scorers string like "Mbappé 23', Giroud 45+2'" into entries
export function parseScorers(raw) {
  if (!raw) return []
  const str = String(raw).trim()
  if (!str || str.toLowerCase() === 'null') return []
  return str.split(/[,;]/).map(s => s.trim()).filter(Boolean).map(entry => {
    const minuteMatch = entry.match(/(\d+(?:\+\d+)?)\s*['′]?\s*$/)
    const minute = minuteMatch ? minuteMatch[1] : null
    const name = entry.replace(/\(?\d+(?:\+\d+)?\s*['′]?\)?\s*$/, '').replace(/[()]/g, '').trim()
    return { name: name || entry, minute }
  })
}

// Tally real tournament goals per player from game scorer fields
export function computeTopScorers(games, teamsMap) {
  const tally = new Map()
  for (const g of games ?? []) {
    if (matchStatus(g) === 'upcoming') continue
    for (const side of ['home', 'away']) {
      const team = teamsMap?.[g[`${side}_team_id`]]
      for (const { name } of parseScorers(g[`${side}_scorers`])) {
        const key = `${name.toLowerCase()}|${team?.id ?? side}`
        const cur = tally.get(key) ?? { name, team, goals: 0 }
        cur.goals += 1
        tally.set(key, cur)
      }
    }
  }
  return [...tally.values()].sort((a, b) => b.goals - a.goals)
}

// Real tournament goals for one player (matched by last name) on a given team
export function playerGoalsFromGames(games, teamId, playerName) {
  if (!playerName || teamId == null) return 0
  const last = String(playerName).toLowerCase().split(' ').pop()
  let n = 0
  for (const g of games ?? []) {
    for (const side of ['home', 'away']) {
      if (String(g[`${side}_team_id`]) !== String(teamId)) continue
      for (const s of parseScorers(g[`${side}_scorers`])) {
        if (s.name.toLowerCase().includes(last)) n++
      }
    }
  }
  return n
}

// streamed.pk lists WC matches as PPV events: ppv-{home}-vs-{away} on the
// "admin" source — build those ids straight from the team names so every
// match has stream sources even when the lookup lists miss it.
function streamedSlug(name) {
  return String(name ?? '').toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
export function guessedMatchSources(homeName, awayName) {
  const h = streamedSlug(homeName), a = streamedSlug(awayName)
  if (!h || !a) return []
  return [
    { source: 'admin', id: `ppv-${h}-vs-${a}` },
    { source: 'admin', id: `ppv-${a}-vs-${h}` },
  ]
}

// Fuzzy match: find a streamed.pk football match by team names
export function findStreamedMatch(homeTeamName, awayTeamName, streamedMatches) {
  if (!streamedMatches?.length || !homeTeamName || !awayTeamName) return null
  const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const hn = norm(homeTeamName)
  const an = norm(awayTeamName)
  return streamedMatches.find(m => {
    const t = norm(m.title)
    const homeOk = hn.length > 2 && t.includes(hn.slice(0, 5))
    const awayOk = an.length > 2 && t.includes(an.slice(0, 5))
    return homeOk && awayOk
  }) ?? null
}
