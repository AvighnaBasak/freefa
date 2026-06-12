'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { getFlagUrl, matchStatus, parseMatchDate, getSportsDBPlayerImages, getSportsDBTeamImages, getSportsDBTeamRoster, getFootballMatches, getLiveMatches, getTodayMatches, findStreamedMatch, guessedMatchSources, playerGoalsFromGames } from '@/utils/api'
import { getPlayersForTeam, getStarPlayer } from '@/data/players'
import { useWC } from './Providers'
import HeatMap from './HeatMap'
import StreamPlayer from './StreamPlayer'
import AdBlockerModal from './AdBlockerModal'
import WatchTogether from './WatchTogether'
import styles from './MatchDetail.module.css'

// Real tournament-form rows from the live group standings
const FORM_ROWS = [
  { label: 'Points',        key: 'pts' },
  { label: 'Matches Played',key: 'mp'  },
  { label: 'Wins',          key: 'w'   },
  { label: 'Draws',         key: 'd'   },
  { label: 'Losses',        key: 'l'   },
  { label: 'Goals For',     key: 'gf'  },
  { label: 'Goals Against', key: 'ga'  },
]

export default function MatchDetail({ game, onClose }) {
  const { teamsMap, games, standingsMap, stadiumsMap } = useWC()
  const [playerImg, setPlayerImg]       = useState(null)
  const [imgLoaded, setImgLoaded]       = useState(false)
  const [streamSources, setStreamSources] = useState(null)
  const [showAdModal, setShowAdModal]   = useState(false)
  const [showPlayer, setShowPlayer]     = useState(false)
  const [statsOpen, setStatsOpen]       = useState(false)   // live stats under the player
  const [activeTab, setActiveTab]       = useState('stats') // stats | players | heatmap
  const [visible, setVisible]           = useState(false)
  const overlayRef = useRef(null)

  const homeTeam = teamsMap?.[game?.home_team_id]
  const awayTeam = teamsMap?.[game?.away_team_id]
  const status   = matchStatus(game)
  const hIso     = homeTeam?.iso2 ?? ''
  const aIso     = awayTeam?.iso2 ?? ''
  const date     = parseMatchDate(game?.local_date, game?.stadium_id)
  // Squads: curated file first, dynamic TheSportsDB roster as fallback
  const [dynRosters, setDynRosters] = useState({ home: [], away: [] })
  useEffect(() => {
    let stale = false
    setDynRosters({ home: [], away: [] })
    const sides = [
      ['home', hIso, homeTeam?.name_en],
      ['away', aIso, awayTeam?.name_en],
    ]
    sides.forEach(([side, iso, name]) => {
      if (!name || getPlayersForTeam(iso ?? '').length > 0) return
      getSportsDBTeamRoster(name).then(list => {
        if (!stale && list.length) setDynRosters(prev => ({ ...prev, [side]: list.slice(0, 6) }))
      })
    })
    return () => { stale = true }
  }, [hIso, aIso, homeTeam?.name_en, awayTeam?.name_en])

  const curatedHome = getPlayersForTeam(hIso)
  const curatedAway = getPlayersForTeam(aIso)
  const homePlayers = curatedHome.length ? curatedHome : dynRosters.home
  const awayPlayers = curatedAway.length ? curatedAway : dynRosters.away
  const star = getStarPlayer(hIso) ?? getStarPlayer(aIso) ?? homePlayers[0] ?? awayPlayers[0] ?? null
  const stadium  = stadiumsMap?.[game?.stadium_id]
  const homeForm = standingsMap?.[game?.home_team_id]
  const awayForm = standingsMap?.[game?.away_team_id]

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  // Close on ESC
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Background art — wide images only: star fanart → home/away team fanart
  useEffect(() => {
    let stale = false
    setPlayerImg(null)
    ;(async () => {
      if (star?.name) {
        const p = await getSportsDBPlayerImages(star.name)
        if (stale) return
        const wide = p.fanart || p.banner
        if (wide) { setPlayerImg(wide); return }
      }
      for (const name of [homeTeam?.name_en, awayTeam?.name_en]) {
        if (!name) continue
        const t = await getSportsDBTeamImages(name)
        if (stale) return
        const wide = t.fanart || t.banner
        if (wide) { setPlayerImg(wide); return }
      }
    })()
    return () => { stale = true }
  }, [star?.name, homeTeam?.name_en, awayTeam?.name_en])

  // Find streaming sources from streamed.pk: lookup lists first, then the
  // known ppv-{home}-vs-{away} admin pattern as a guaranteed fallback.
  useEffect(() => {
    const hn = homeTeam?.name_en, an = awayTeam?.name_en
    if (!hn || !an) return
    let stale = false
    ;(async () => {
      let found = null
      for (const fn of [getLiveMatches, getTodayMatches, getFootballMatches]) {
        try {
          found = findStreamedMatch(hn, an, await fn())
          if (found?.sources?.length) break
        } catch { /* list unavailable — try the next one */ }
      }
      if (stale) return
      const sources = [...(found?.sources ?? [])]
      for (const g of guessedMatchSources(hn, an)) {
        if (!sources.some(s => s.source === g.source && s.id === g.id)) sources.push(g)
      }
      setStreamSources(sources)
    })()
    return () => { stale = true }
  }, [homeTeam?.name_en, awayTeam?.name_en])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  const handleWatch = () => setShowAdModal(true)
  const handleProceed = () => { setShowAdModal(false); setShowPlayer(true) }

  return (
    <>
      <div
        className={`${styles.overlay} ${visible ? styles.overlayVisible : ''}`}
        ref={overlayRef}
        onClick={e => e.target === overlayRef.current && handleClose()}
      >
        <div className={`${styles.panel} ${visible ? styles.panelVisible : ''}`}>

          {/* ── Player background ── */}
          <div className={styles.bgLayer}>
            {playerImg && (
              <img
                src={playerImg}
                alt={star?.name}
                className={`${styles.bgImg} ${imgLoaded ? styles.bgImgLoaded : ''}`}
                onLoad={() => setImgLoaded(true)}
              />
            )}
            <div className={styles.bgGrad} />
            <div className={styles.bgBottom} />
          </div>

          {/* ── Header bar ── */}
          <div className={styles.header}>
            <button className={styles.backBtn} onClick={handleClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M5 12l7-7M5 12l7 7"/>
              </svg>
              Back
            </button>

            <div className={styles.headerMeta}>
              {status === 'live' && <span className="live-badge"><div className="live-dot"/>LIVE</span>}
              {status === 'finished' && <span className={styles.ftBadge}>Full Time</span>}
              <span className={styles.groupLabel}>
                {game?.type === 'group' ? `Group ${game.group} · Matchday ${game.matchday}` : (game?.type ?? 'Knockout')}
              </span>
            </div>

            {!showPlayer && (
              <button className={styles.watchBtn} onClick={handleWatch}>
                <svg viewBox="0 0 24 24" fill="currentColor" style={{width: 11, height: 11, marginRight: 5}}>
                  <path d="M8 5v14l11-7z"/>
                </svg>
                {status === 'live' ? 'Watch Live' : 'Watch Now'}
              </button>
            )}
          </div>

          {/* ── Score section ── */}
          <div className={styles.scoreSection}>
            <TeamBlock team={homeTeam} score={game?.home_score} scorers={game?.home_scorers} side="home" />

            <div className={styles.centerBlock}>
              {status !== 'upcoming' ? (
                <>
                  <div className={styles.bigScore}>
                    <span>{game?.home_score ?? 0}</span>
                    <span className={styles.bigScoreSep}>:</span>
                    <span>{game?.away_score ?? 0}</span>
                  </div>
                  {status === 'live' && (
                    <div className={styles.liveTime}>
                      {game?.time_elapsed && game.time_elapsed !== 'live' ? `${game.time_elapsed}′` : '●  LIVE'}
                    </div>
                  )}
                  {status === 'finished' && <div className={styles.ftText}>Full Time</div>}
                </>
              ) : (
                <div className={styles.upcomingBlock}>
                  <div className={styles.bigVS}>VS</div>
                  <div className={styles.kickoff}>
                    {date?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className={styles.kickoffDate}>
                    {date?.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>
                </div>
              )}
            </div>

            <TeamBlock team={awayTeam} score={game?.away_score} scorers={game?.away_scorers} side="away" />
          </div>

          {/* ── Stream player (shown after ad blocker modal) ── */}
          {showPlayer && (
            <div className={styles.playerSection}>
              <StreamPlayer
                sources={streamSources ?? []}
                matchTitle={`${homeTeam?.name_en ?? ''} vs ${awayTeam?.name_en ?? ''}`}
              />

              {/* Tools under the player: live stats reveal + watch together */}
              <div className={styles.playerTools}>
                <button
                  className={`${styles.statsToggle} ${statsOpen ? styles.statsToggleOn : ''}`}
                  onClick={() => setStatsOpen(v => !v)}
                  aria-expanded={statsOpen}
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    <rect x="6" y="11" width="3" height="6" rx="1" fill="currentColor"/>
                    <rect x="10.5" y="6" width="3" height="11" rx="1" fill="currentColor"/>
                    <rect x="15" y="9" width="3" height="8" rx="1" fill="currentColor"/>
                  </svg>
                  Live Stats
                  <svg viewBox="0 0 10 6" fill="none" className={styles.statsChevron} aria-hidden="true">
                    <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                </button>
                <WatchTogether matchTitle={`${homeTeam?.name_en ?? ''} vs ${awayTeam?.name_en ?? ''}`}/>
              </div>
            </div>
          )}

          {/* ── Tabs (hidden behind "Live Stats" while the player is open) ── */}
          {(!showPlayer || statsOpen) && (<>
          <div className={styles.tabs}>
            {[['stats','Team Form'], ['players','Key Players'], ['heatmap','Heat Map']].map(([id, label]) => (
              <button
                key={id}
                className={`${styles.tab} ${activeTab === id ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Tab content ── */}
          <div className={styles.tabContent}>

            {activeTab === 'stats' && (
              <>
                {stadium && (
                  <div className={styles.venueRow}>
                    <span className={styles.venueIcon}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: 14, height: 14, verticalAlign: 'middle'}}>
                        <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="12" cy="10" r="3"/>
                      </svg>
                    </span>
                    <span className={styles.venueName}>{stadium.name_en}</span>
                    <span className={styles.venueMeta}>
                      {stadium.city_en}, {stadium.country_en}
                      {stadium.capacity ? ` · ${Number(stadium.capacity).toLocaleString()} seats` : ''}
                    </span>
                  </div>
                )}
                <div className={styles.statsGrid}>
                  {FORM_ROWS.map(({ label, key }) => {
                    const hv = Number(homeForm?.[key] ?? 0)
                    const av = Number(awayForm?.[key] ?? 0)
                    const total = hv + av
                    const hp = total === 0 ? 50 : Math.round((hv / total) * 100)
                    return (
                      <div key={label} className={styles.statRow}>
                        <span className={styles.sValH}>{hv}</span>
                        <div className={styles.sCenter}>
                          <span className={styles.sLabel}>{label}</span>
                          <div className={styles.sBar}>
                            <div className={styles.sBarH} style={{ width: `${hp}%` }}/>
                            <div className={styles.sBarA} style={{ width: `${100-hp}%` }}/>
                          </div>
                        </div>
                        <span className={styles.sValA}>{av}</span>
                      </div>
                    )
                  })}
                </div>
                <div className={styles.statsNote}>Group-stage form · live from official standings</div>
              </>
            )}

            {activeTab === 'players' && (
              <div className={styles.playersGrid}>
                <div className={styles.playersCol}>
                  <div className={styles.colHead}>
                    <img src={getFlagUrl(hIso, 40)} alt="" className={styles.colFlag}/>
                    {homeTeam?.name_en}
                  </div>
                  {homePlayers.map((p, i) => (
                    <DetailPlayerCard key={i} player={p} goals={playerGoalsFromGames(games, game?.home_team_id, p.name)} />
                  ))}
                </div>
                <div className={styles.playersCol}>
                  <div className={styles.colHead}>
                    <img src={getFlagUrl(aIso, 40)} alt="" className={styles.colFlag}/>
                    {awayTeam?.name_en}
                  </div>
                  {awayPlayers.map((p, i) => (
                    <DetailPlayerCard key={i} player={p} goals={playerGoalsFromGames(games, game?.away_team_id, p.name)} />
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'heatmap' && (
              <div className={styles.heatWrap}>
                <HeatMap homeIso={hIso} awayIso={aIso} />
                <div className={styles.heatLegend}>
                  <span style={{ color: 'var(--red)' }}>● {homeTeam?.name_en}</span>
                  <span style={{ color: '#60a5fa' }}>● {awayTeam?.name_en}</span>
                </div>
                <div className={styles.statsNote}>Simulated visualization — real tracking data is not provided by the API</div>
              </div>
            )}

          </div>
          </>)}
        </div>
      </div>

      {showAdModal && <AdBlockerModal onProceed={handleProceed} onClose={() => setShowAdModal(false)} />}
    </>
  )
}

function TeamBlock({ team, score, scorers, side }) {
  const iso = team?.iso2 ?? ''
  return (
    <div className={`${styles.teamBlock} ${side === 'away' ? styles.teamBlockAway : ''}`}>
      <img src={getFlagUrl(iso, 160)} alt={team?.name_en} className={styles.bigFlag}
        onError={e => { e.target.style.display = 'none' }}/>
      <div className={styles.teamBlockName}>{team?.name_en ?? '—'}</div>
      <div className={styles.teamBlockCode}>{team?.fifa_code ?? ''}</div>
      {scorers && scorers !== 'null' && (
        <div className={styles.scorers}>{String(scorers).split(',').map((s, i) => (
          <span key={i} className={styles.scorer}>{s.trim()}</span>
        ))}</div>
      )}
    </div>
  )
}

function DetailPlayerCard({ player, goals = 0 }) {
  const [img, setImg] = useState(null)
  useEffect(() => {
    let stale = false
    setImg(null)
    if (!player?.name) return
    getSportsDBPlayerImages(player.name).then(({ thumb }) => {
      if (!stale) setImg(thumb ? `${thumb}/small` : null)
    })
    return () => { stale = true }
  }, [player?.name])

  return (
    <div className={styles.dPlayerCard}>
      <div className={styles.dAvatar}>
        {img
          ? <img src={img} alt={player.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}/>
          : <span className={styles.dAvatarFallback}>{player.num !== '' ? `#${player.num}` : player.name?.[0] ?? '?'}</span>}
      </div>
      <div className={styles.dInfo}>
        <div className={styles.dName}>{player.name}</div>
        <div className={styles.dMeta}>{player.pos}{player.num !== '' ? ` · #${player.num}` : ''}</div>
        {goals > 0 && (
          <div className={styles.dStats}>
            <span className={styles.dStat}>{goals} goal{goals !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  )
}
