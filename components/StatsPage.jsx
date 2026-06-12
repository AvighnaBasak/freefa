'use client'
import { useMemo, useState, useEffect } from 'react'
import { useWC } from './Providers'
import { matchStatus, getFlagUrl, computeTopScorers, getSportsDBPlayerImages } from '@/utils/api'
import styles from './StatsPage.module.css'

/* ── Proper football iconography (inline SVG, no emojis) ── */

// Classic soccer ball: pentagon + seams
const BallIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.7"/>
    <path d="M12 8.2l3.62 2.63-1.38 4.25H9.76L8.38 10.83 12 8.2z" fill="currentColor"/>
    <path d="M12 8.2V2.9M15.62 10.83l5.05-1.64M14.24 15.08l3.12 4.3M9.76 15.08l-3.12 4.3M8.38 10.83L3.33 9.19"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

// Referee whistle
const WhistleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M13.5 7.5H21v4.2l-3.6 1a5.9 5.9 0 1 1-5.6-5.2h1.7z"
      stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
    <circle cx="11.4" cy="13.6" r="1.9" fill="currentColor"/>
    <path d="M7 4.5L8.4 6.8M11.5 2.5l.3 2.8M3.5 8l2.6 1.3"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
)

// Bar chart
const ChartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 20h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    <rect x="6"  y="11" width="3.2" height="6" rx="1" fill="currentColor"/>
    <rect x="10.5" y="6" width="3.2" height="11" rx="1" fill="currentColor"/>
    <rect x="15" y="9" width="3.2" height="8" rx="1" fill="currentColor"/>
  </svg>
)

// Live broadcast signal
const LiveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="2.4" fill="currentColor"/>
    <path d="M8.2 15.8a5.4 5.4 0 0 1 0-7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.4 18.6a9.4 9.4 0 0 1 0-13.2M18.6 5.4a9.4 9.4 0 0 1 0 13.2"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
  </svg>
)

// Calendar
const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" strokeWidth="1.7"/>
    <path d="M8 2.8V7M16 2.8V7M3.5 10.5h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    <rect x="7" y="13.5" width="3" height="3" rx="0.8" fill="currentColor"/>
  </svg>
)

// Trophy
const TrophyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0V4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
    <path d="M7.5 5.5H4.2a2.6 2.6 0 0 0 2.6 4.4M16.5 5.5h3.3a2.6 2.6 0 0 1-2.6 4.4"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    <path d="M12 14v3.5M8.5 20.5h7M10 20.5v-3h4v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// Golden boot (empty-state art)
const BootIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M10 12v14c0 1 .6 2 1.6 2.3l16.8 5.4c.9.3 1.6 1.2 1.6 2.2v.6H42a2 2 0 0 0 2-2v-2.2a4 4 0 0 0-2.7-3.8L28 24l-8-12h-10z"
      stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/>
    <path d="M4 37h26M22 27l-2.5 3M27 28.6L24.5 32M14 37v4M22 37v4M30 37v4"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
  </svg>
)

// Fetches TheSportsDB headshot for one player
function usePlayerThumb(name) {
  const [thumb, setThumb] = useState(null)
  useEffect(() => {
    let stale = false
    if (!name) return
    getSportsDBPlayerImages(name).then(({ thumb: t }) => {
      if (!stale) setThumb(t || null)
    })
    return () => { stale = true }
  }, [name])
  return thumb
}

function ScorerRow({ p, i }) {
  const thumb = usePlayerThumb(p.name)
  return (
    <div className={styles.rankRow}>
      <span className={`${styles.rankPos} ${i === 0 ? styles.gold : i === 1 ? styles.silver : i === 2 ? styles.bronze : ''}`}>
        {i + 1}
      </span>
      {thumb
        ? <img src={`${thumb}/tiny`} alt={p.name} className={styles.rankAvatar} onError={e => { e.target.style.display = 'none' }}/>
        : <span className={styles.rankAvatarFallback}>{p.name?.[0] ?? '?'}</span>
      }
      <div className={styles.scorerInfo}>
        <span className={styles.rankName}>{p.name}</span>
        <span className={styles.scorerTeam}>
          {p.team?.iso2 && (
            <img src={getFlagUrl(p.team.iso2, 40)} alt="" className={styles.scorerTeamFlag}
              onError={e => { e.target.style.display = 'none' }}/>
          )}
          {p.team?.name_en ?? '—'}
        </span>
      </div>
      <span className={styles.rankGoals}>{p.goals}<em>G</em></span>
    </div>
  )
}

// Golden Boot podium for the top 3 (2nd · 1st · 3rd layout)
function Podium({ scorers }) {
  const thumbs = [usePlayerThumb(scorers[0]?.name), usePlayerThumb(scorers[1]?.name), usePlayerThumb(scorers[2]?.name)]
  const order = [1, 0, 2] // visual: silver, gold, bronze
  const medal = [styles.podiumGold, styles.podiumSilver, styles.podiumBronze]
  return (
    <div className={styles.podium}>
      {order.map(idx => {
        const p = scorers[idx]
        if (!p) return <div key={idx} className={styles.podiumSlot}/>
        return (
          <div key={idx} className={`${styles.podiumSlot} ${medal[idx]}`}>
            <div className={styles.podiumAvatar}>
              {thumbs[idx]
                ? <img src={`${thumbs[idx]}/small`} alt={p.name} onError={e => { e.target.style.display = 'none' }}/>
                : <span>{p.name?.[0] ?? '?'}</span>}
            </div>
            <span className={styles.podiumName}>{p.name}</span>
            <span className={styles.podiumTeam}>
              {p.team?.iso2 && <img src={getFlagUrl(p.team.iso2, 40)} alt=""/>}
              {p.team?.fifa_code ?? ''}
            </span>
            <div className={styles.podiumStep}>
              <span className={styles.podiumRank}>{idx + 1}</span>
              <span className={styles.podiumGoals}>{p.goals} goal{p.goals !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function StatsPage() {
  const { games, teams, teamsMap } = useWC()

  const finished = useMemo(() => games.filter(g => matchStatus(g) === 'finished'), [games])
  const live     = useMemo(() => games.filter(g => matchStatus(g) === 'live'),     [games])

  const totalGoals   = useMemo(() => finished.reduce((s, g) => s + Number(g.home_score ?? 0) + Number(g.away_score ?? 0), 0), [finished])
  const avgGoals     = finished.length ? (totalGoals / finished.length).toFixed(2) : '—'
  const highestScore = useMemo(() => {
    return finished.reduce((best, g) => {
      const tot = Number(g.home_score ?? 0) + Number(g.away_score ?? 0)
      return tot > best.total ? { game: g, total: tot } : best
    }, { game: null, total: -1 })
  }, [finished])

  const teamGoals = useMemo(() => {
    const m = {}
    finished.forEach(g => {
      m[g.home_team_id] = (m[g.home_team_id] ?? 0) + Number(g.home_score ?? 0)
      m[g.away_team_id] = (m[g.away_team_id] ?? 0) + Number(g.away_score ?? 0)
    })
    return Object.entries(m)
      .map(([id, goals]) => ({ team: teamsMap[id], goals }))
      .filter(x => x.team && x.goals > 0)
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 10)
  }, [finished, teamsMap])

  // Top scorers tallied from real match scorer data — never fabricated
  const topScorers = useMemo(() => computeTopScorers(games, teamsMap).slice(0, 12), [games, teamsMap])

  const CARDS = [
    { icon: <BallIcon/>,     num: totalGoals,      label: 'Goals Scored',     tint: styles.tintRed   },
    { icon: <WhistleIcon/>,  num: finished.length, label: 'Matches Played',   tint: styles.tintBlue  },
    { icon: <ChartIcon/>,    num: avgGoals,        label: 'Avg Goals / Match', tint: styles.tintGreen },
    { icon: <LiveIcon/>,     num: live.length,     label: 'Live Now',         tint: styles.tintLive, red: true },
    { icon: <CalendarIcon/>, num: games.length - finished.length - live.length, label: 'Remaining', tint: styles.tintGold },
    { icon: <TrophyIcon/>,   num: teams.length || 48, label: 'Teams', tint: styles.tintViolet },
  ]

  return (
    <div className={`${styles.page} page`}>

      {/* ── Page hero ── */}
      <div className={styles.pageHero}>
        <div className={styles.pageHeroBg} aria-hidden="true"/>
        <div className={styles.pageHeroInner}>
          <span className="page-kicker">FIFA World Cup 2026™</span>
          <h1 className="page-title">Tournament <em>Stats</em></h1>
          <p className="page-sub">Live numbers, straight from the official match feed</p>
        </div>
      </div>

      <div className={styles.inner}>

        {/* ── Overview cards ── */}
        <div className={styles.overviewGrid}>
          {CARDS.map(({ icon, num, label, tint, red }) => (
            <div key={label} className={styles.overCard}>
              <div className={`${styles.overIcon} ${tint}`}>{icon}</div>
              <div className={`${styles.overNum} ${red && Number(num) > 0 ? styles.overRed : ''}`}>{num}</div>
              <div className={styles.overLabel}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Golden Boot ── */}
        <section className={styles.bootCard}>
          <div className={styles.bootHead}>
            <span className={styles.bootKicker}>Golden Boot Race</span>
            <h2 className={styles.bootTitle}>Top Scorers</h2>
          </div>

          {topScorers.length >= 3 && <Podium scorers={topScorers.slice(0, 3)}/>}

          {topScorers.length === 0 ? (
            <div className={styles.bootEmpty}>
              <BootIcon/>
              <strong>The Golden Boot race hasn&rsquo;t started yet.</strong>
              <span>Every goal scored in the tournament is tallied here, straight from the match feed.</span>
            </div>
          ) : (
            <div className={styles.scorerList}>
              {(topScorers.length >= 3 ? topScorers.slice(3) : topScorers).map((p, i) => (
                <ScorerRow
                  key={`${p.name}-${p.team?.id ?? i}`}
                  p={p}
                  i={topScorers.length >= 3 ? i + 3 : i}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Top scoring teams ── */}
        <div className={styles.rankCard}>
          <div className={styles.rankTitle}>
            <BallIcon/>
            Top Scoring Teams
          </div>
          {teamGoals.length === 0 && (
            <div className={styles.noData}>
              {finished.length === 0
                ? 'No completed matches yet — team goal tallies appear once play begins.'
                : 'No goals recorded yet.'}
            </div>
          )}
          {teamGoals.map(({ team, goals }, i) => (
            <div key={team?.id ?? i} className={styles.rankRow}>
              <span className={`${styles.rankPos} ${i === 0 ? styles.gold : i === 1 ? styles.silver : i === 2 ? styles.bronze : ''}`}>
                {i + 1}
              </span>
              {team?.iso2 && (
                <img src={getFlagUrl(team.iso2, 40)} alt={team.name_en} className={styles.rankFlag}
                  onError={e => { e.target.style.display = 'none' }}/>
              )}
              <span className={styles.rankName}>{team?.name_en ?? '—'}</span>
              <div className={styles.rankBar}>
                <div className={styles.rankBarFill}
                  style={{ width: `${(goals / (teamGoals[0]?.goals || 1)) * 100}%` }}/>
              </div>
              <span className={styles.rankGoals}>{goals}<em>G</em></span>
            </div>
          ))}
        </div>

        {/* ── Highest scoring match ── */}
        {highestScore.game && (
          <div className={styles.highlightCard}>
            <div className={styles.highlightLabel}>Highest Scoring Match</div>
            <div className={styles.highlightContent}>
              <span className={styles.highlightTeam}>
                <img src={getFlagUrl(teamsMap[highestScore.game.home_team_id]?.iso2, 80)} alt=""
                  onError={e => { e.target.style.display = 'none' }}/>
                {teamsMap[highestScore.game.home_team_id]?.name_en ?? '—'}
              </span>
              <span className={styles.highlightScore}>
                {highestScore.game.home_score}–{highestScore.game.away_score}
              </span>
              <span className={`${styles.highlightTeam} ${styles.highlightTeamAway}`}>
                {teamsMap[highestScore.game.away_team_id]?.name_en ?? '—'}
                <img src={getFlagUrl(teamsMap[highestScore.game.away_team_id]?.iso2, 80)} alt=""
                  onError={e => { e.target.style.display = 'none' }}/>
              </span>
            </div>
            <div className={styles.highlightSub}>{highestScore.total} goals total</div>
          </div>
        )}

      </div>
    </div>
  )
}
