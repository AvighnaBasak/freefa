'use client'
import { useMemo, useEffect, useRef } from 'react'
import { useWC } from './Providers'
import HeroMatch from './HeroMatch'
import MatchCard from './MatchCard'
import CeremonyCard from './Ceremony'
import { matchStatus, parseMatchDate } from '@/utils/api'
import styles from './HomePage.module.css'

export default function HomePage() {
  const { games, teamsMap, setSelected } = useWC()
  const stageRef = useRef(null)

  // Scroll-driven hero minimize: stage scales down into a rounded window
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const p = Math.min(1, Math.max(0, window.scrollY / 240))
        el.style.setProperty('--shrink', p.toFixed(3))
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])

  // Sort: live first → today → upcoming by date
  const sorted = useMemo(() => {
    if (!games.length) return []
    return [...games].sort((a, b) => {
      const sa = matchStatus(a), sb = matchStatus(b)
      const order = { live: 0, upcoming: 1, finished: 2 }
      if (order[sa] !== order[sb]) return order[sa] - order[sb]
      const da = parseMatchDate(a.local_date)?.getTime() ?? 0
      const db = parseMatchDate(b.local_date)?.getTime() ?? 0
      return da - db
    })
  }, [games])

  const featured  = sorted[0] ?? null
  const restGames = sorted.slice(1)

  // Today's games + next upcoming
  const displayGames = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

    const todayGames = restGames.filter(g => {
      const d = parseMatchDate(g.local_date)
      return d && d >= today && d < tomorrow
    })
    const upcoming = restGames.filter(g => {
      const d = parseMatchDate(g.local_date)
      return d && d >= tomorrow
    }).slice(0, 8 - todayGames.length)

    return [...todayGames, ...upcoming].slice(0, 8)
  }, [restGames])

  const liveCnt  = games.filter(g => matchStatus(g) === 'live').length
  const todayCnt = games.filter(g => {
    const d = parseMatchDate(g.local_date)
    if (!d) return false
    const today = new Date(); today.setHours(0,0,0,0)
    const tom = new Date(today); tom.setDate(tom.getDate()+1)
    return d >= today && d < tom
  }).length

  return (
    <div className={styles.page}>

      {/* ── Full-bleed hero stage (minimizes on scroll) ── */}
      <div ref={stageRef} className={styles.stage}>
        {featured ? (
          <HeroMatch
            game={featured}
            homeTeam={teamsMap[featured.home_team_id]}
            awayTeam={teamsMap[featured.away_team_id]}
            onClick={() => setSelected(featured)}
          />
        ) : (
          <div className={styles.loading}>
            <div className={styles.spinner}/>
            <span>Loading World Cup 2026 data…</span>
          </div>
        )}
      </div>

      {/* ── Below the fold: tournament data ── */}
      <div className={`${styles.below} page`}>

        {/* Stats strip */}
        <div className={`${styles.statsStrip} glass`}>
          <div className={styles.stripItem}>
            <span className={styles.stripNum}>{games.length}</span>
            <span className={styles.stripLabel}>Total Matches</span>
          </div>
          <div className={styles.stripDivider}/>
          <div className={styles.stripItem}>
            <span className={`${styles.stripNum} ${liveCnt > 0 ? styles.stripRed : ''}`}>{liveCnt}</span>
            <span className={styles.stripLabel}>Live Now</span>
          </div>
          <div className={styles.stripDivider}/>
          <div className={styles.stripItem}>
            <span className={styles.stripNum}>{todayCnt}</span>
            <span className={styles.stripLabel}>Today</span>
          </div>
          <div className={styles.stripDivider}/>
          <div className={styles.stripItem}>
            <span className={styles.stripNum}>48</span>
            <span className={styles.stripLabel}>Teams</span>
          </div>
          <div className={styles.stripDivider}/>
          <div className={styles.stripItem}>
            <span className={styles.stripNum}>12</span>
            <span className={styles.stripLabel}>Groups</span>
          </div>
          <div className={styles.stripDivider}/>
          <div className={styles.stripItem}>
            <span className={styles.stripNum}>3</span>
            <span className={styles.stripLabel}>Host Nations</span>
          </div>
        </div>

        {/* Opening Ceremony */}
        <section>
          <div className="section-header">
            <h2 className="section-title">Special Event</h2>
            <div className="section-divider"/>
          </div>
          <CeremonyCard/>
        </section>

        {/* Matches grid */}
        {displayGames.length > 0 && (
          <section>
            <div className="section-header">
              <h2 className="section-title">Today &amp; Upcoming</h2>
              <div className="section-divider"/>
            </div>
            <div className={styles.grid}>
              {displayGames.map(g => (
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
        )}

        {/* All live */}
        {liveCnt > 1 && (
          <section>
            <div className="section-header">
              <h2 className="section-title">
                <span className="live-badge" style={{ marginRight: 10 }}><span className="live-dot"/>LIVE</span>
                All Live
              </h2>
              <div className="section-divider"/>
            </div>
            <div className={styles.grid}>
              {games.filter(g => matchStatus(g) === 'live').map(g => (
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
        )}

      </div>
    </div>
  )
}
