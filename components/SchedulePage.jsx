'use client'
import { useMemo, useState } from 'react'
import { useWC } from './Providers'
import MatchCard from './MatchCard'
import CeremonyCard from './Ceremony'
import { matchStatus, parseMatchDate } from '@/utils/api'
import styles from './SchedulePage.module.css'

const FILTERS = [
  ['all', 'All'],
  ['live', 'Live'],
  ['today', 'Today'],
  ['upcoming', 'Upcoming'],
  ['finished', 'Finished'],
]

const SearchIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const isToday = g => {
  const d = parseMatchDate(g.local_date)
  if (!d) return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tom = new Date(today); tom.setDate(tom.getDate() + 1)
  return d >= today && d < tom
}

export default function SchedulePage() {
  const { games, teamsMap, setSelected } = useWC()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const counts = useMemo(() => ({
    all:      games.length,
    live:     games.filter(g => matchStatus(g) === 'live').length,
    today:    games.filter(isToday).length,
    upcoming: games.filter(g => matchStatus(g) === 'upcoming').length,
    finished: games.filter(g => matchStatus(g) === 'finished').length,
  }), [games])

  const filtered = useMemo(() => {
    let list = [...games]
    if (filter === 'live')     list = list.filter(g => matchStatus(g) === 'live')
    if (filter === 'today')    list = list.filter(isToday)
    if (filter === 'finished') list = list.filter(g => matchStatus(g) === 'finished')
    if (filter === 'upcoming') list = list.filter(g => matchStatus(g) === 'upcoming')

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(g => {
        const h = teamsMap[g.home_team_id]?.name_en?.toLowerCase() ?? ''
        const a = teamsMap[g.away_team_id]?.name_en?.toLowerCase() ?? ''
        return h.includes(q) || a.includes(q)
      })
    }
    return list
  }, [games, teamsMap, filter, search])

  // Group by calendar date
  const byDate = useMemo(() => {
    const map = new Map()
    filtered.forEach(g => {
      const d = parseMatchDate(g.local_date)
      const key = d ? d.toDateString() : 'TBD'
      if (!map.has(key)) map.set(key, { date: d, games: [] })
      map.get(key).games.push(g)
    })
    return [...map.entries()].sort(([a, va], [b, vb]) => {
      if (a === 'TBD') return 1
      if (b === 'TBD') return -1
      return va.date - vb.date
    })
  }, [filtered])

  const todayKey = new Date().toDateString()

  return (
    <div className={`${styles.page} page`}>

      {/* ── Page hero ── */}
      <div className={styles.pageHero}>
        <div className={styles.pageHeroBg} aria-hidden="true"/>
        <div className={styles.pitchLines} aria-hidden="true"/>
        <div className={styles.pageHeroInner}>
          <span className="page-kicker">FIFA World Cup 2026™</span>
          <h1 className="page-title">Match <em>Schedule</em></h1>
          <p className="page-sub">
            {games.length || 104} matches · Group Stage to the Final · USA, Mexico &amp; Canada
          </p>
        </div>
      </div>

      <div className={styles.inner}>

        {/* ── Opening Ceremony ── */}
        <CeremonyCard/>

        {/* ── Sticky control bar ── */}
        <div className={styles.controlBar}>
          <label className={styles.search}>
            <SearchIcon/>
            <input
              type="text"
              placeholder="Search teams…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search teams"
            />
          </label>
          <div className={styles.filters} role="group" aria-label="Filter matches">
            {FILTERS.map(([v, l]) => (
              <button
                key={v}
                aria-pressed={filter === v}
                className={`${styles.filterBtn} ${filter === v ? styles.filterActive : ''}`}
                onClick={() => setFilter(v)}
              >
                {v === 'live' && counts.live > 0 && <span className="live-dot"/>}
                {l}
                <span className={styles.filterCount}>{counts[v]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Empty state ── */}
        {byDate.length === 0 && (
          <div className={styles.empty}>
            <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <circle cx="24" cy="24" r="19" stroke="currentColor" strokeWidth="2"/>
              <path d="M24 14l4.7 3.4-1.8 5.5h-5.8l-1.8-5.5L24 14z" fill="currentColor"/>
              <path d="M24 14V8M28.7 17.4l5.7-2M26.9 22.9l3.6 4.7M21.1 22.9l-3.6 4.7M19.3 17.4l-5.7-2"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>No matches found{search ? ` for “${search}”` : ''}.</span>
            {(search || filter !== 'all') && (
              <button className={styles.emptyReset} onClick={() => { setSearch(''); setFilter('all') }}>
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* ── Matchday sections ── */}
        {byDate.map(([key, { date, games: dayGames }]) => {
          const live = dayGames.filter(g => matchStatus(g) === 'live').length
          return (
            <section key={key} className={styles.day}>
              <div className={styles.dayRail}>
                <div className={`${styles.dayBlock} ${key === todayKey ? styles.dayBlockToday : ''}`}>
                  <span className={styles.dayNum}>{date ? date.getDate() : '--'}</span>
                  <span className={styles.dayMonth}>
                    {date ? date.toLocaleDateString([], { month: 'short' }) : 'TBD'}
                  </span>
                </div>
                <div className={styles.dayMeta}>
                  <span className={styles.dayName}>
                    {key === todayKey
                      ? 'Today'
                      : date?.toLocaleDateString([], { weekday: 'long' }) ?? 'Date TBD'}
                  </span>
                  <span className={styles.dayCount}>
                    {dayGames.length} match{dayGames.length !== 1 ? 'es' : ''}
                    {live > 0 && <em className={styles.dayLive}> · {live} live</em>}
                  </span>
                </div>
                <div className={styles.dayLine} aria-hidden="true"/>
              </div>

              <div className={styles.grid}>
                {dayGames.map(g => (
                  <MatchCard
                    key={g.id ?? g._id}
                    game={g}
                    homeTeam={teamsMap[g.home_team_id]}
                    awayTeam={teamsMap[g.away_team_id]}
                    onClick={() => setSelected(g)}
                  />
                ))}
              </div>
            </section>
          )
        })}

      </div>
    </div>
  )
}
