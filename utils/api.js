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
  const data = await fetchCached('/worldcup-api/get/games', 20000)
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

export function matchStatus(game) {
  if (!game) return 'upcoming'
  const fin = String(game.finished).toUpperCase() === 'TRUE'
  const t = String(game.time_elapsed ?? '').toLowerCase().trim()
  if (fin || t === 'fulltime' || t === 'ft') return 'finished'
  if (!t || t === 'notstarted' || t === 'not started') return 'upcoming'
  return 'live'
}

export function parseMatchDate(localDate) {
  if (!localDate) return null
  // format: "06/11/2026 13:00"
  try {
    const [datePart, timePart] = localDate.split(' ')
    const [mm, dd, yyyy] = datePart.split('/')
    return new Date(`${yyyy}-${mm}-${dd}T${timePart}:00`)
  } catch {
    return null
  }
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
