'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { getFlagUrl, matchStatus, parseMatchDate, getSportsDBPlayerImages, getSportsDBTeamImages, getSportsDBTeamRoster, parseScorers, playerGoalsFromGames } from '@/utils/api'
import { getPlayersForTeam, getStarPlayer } from '@/data/players'
import { useWC } from './Providers'
import HeatMap from './HeatMap'
import styles from './HeroMatch.module.css'

const FORM_ROWS = [
  { label: 'Points',        key: 'pts' },
  { label: 'Wins',          key: 'w'   },
  { label: 'Goals For',     key: 'gf'  },
  { label: 'Goals Against', key: 'ga'  },
]
const POS_LABEL = { FW: 'Forward', MF: 'Midfielder', DF: 'Defender', GK: 'Goalkeeper' }

const ExpandIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M12 3h5v5M8 17H3v-5M17 3l-6 6M3 17l6-6"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export default function HeroMatch({ game, homeTeam, awayTeam, onClick }) {
  const { games, standingsMap, stadiumsMap } = useWC()

  // heroImg = wide rectangular action shot (fanart/banner) → full-bleed background
  //           falls back to the square thumb shown as a right-anchored portrait
  // cutout  = transparent full-body PNG → performer card
  const [heroImg, setHeroImg]     = useState(null)
  const [heroWide, setHeroWide]   = useState(true)
  const [cutoutImg, setCutoutImg] = useState(null)
  const [thumbLoaded, setThumbLoaded] = useState(false)
  const [toastOpen, setToastOpen] = useState(true)
  const [rosterTab, setRosterTab] = useState('home')
  const [isFs, setIsFs]           = useState(false)
  const heroRef = useRef(null)

  const status = matchStatus(game)
  const hIso   = homeTeam?.iso2 ?? ''
  const aIso   = awayTeam?.iso2 ?? ''
  const date   = parseMatchDate(game?.local_date)

  // Dynamic squads (TheSportsDB) cover teams missing from the curated file
  const [dynRosters, setDynRosters] = useState({ home: [], away: [] })
  useEffect(() => {
    let stale = false
    setDynRosters({ home: [], away: [] })
    const sides = [
      ['home', homeTeam?.iso2, homeTeam?.name_en],
      ['away', awayTeam?.iso2, awayTeam?.name_en],
    ]
    sides.forEach(([side, iso, name]) => {
      if (!name || getPlayersForTeam(iso ?? '').length > 0) return
      getSportsDBTeamRoster(name).then(list => {
        if (!stale && list.length) setDynRosters(prev => ({ ...prev, [side]: list }))
      })
    })
    return () => { stale = true }
  }, [homeTeam?.iso2, homeTeam?.name_en, awayTeam?.iso2, awayTeam?.name_en])

  const squadFor = (iso, side) => {
    const curated = getPlayersForTeam(iso ?? '')
    return curated.length ? curated : dynRosters[side]
  }
  const homeSquad = squadFor(hIso, 'home')
  const awaySquad = squadFor(aIso, 'away')

  // Star player: curated pick first, else leading forward from the live squad
  const homeStar   = getStarPlayer(hIso) ?? homeSquad[0] ?? null
  const awayStarP  = getStarPlayer(aIso) ?? awaySquad[0] ?? null
  const starPlayer = homeStar ?? awayStarP
  const starTeam   = homeStar ? homeTeam : awayTeam
  const starGoals  = playerGoalsFromGames(games, starTeam?.id, starPlayer?.name)

  const stadium     = stadiumsMap?.[game?.stadium_id]
  const homeForm    = standingsMap?.[game?.home_team_id]
  const awayForm    = standingsMap?.[game?.away_team_id]
  const homeScorers = parseScorers(game?.home_scorers)
  const awayScorers = parseScorers(game?.away_scorers)

  const rosterTeam = rosterTab === 'home' ? homeTeam : awayTeam
  const roster     = (rosterTab === 'home' ? homeSquad : awaySquad).slice(0, 3)

  // Fetch hero + cutout images from TheSportsDB.
  // Wide-art chain (full-bleed): star fanart/banner → home team fanart →
  // away team fanart. National-team fanart exists for every side, so the
  // hero stays a horizontal action shot for any featured match. The square
  // headshot is only an anchored-portrait last resort — never stretched.
  const homeName = homeTeam?.name_en ?? null
  const awayName = awayTeam?.name_en ?? null
  useEffect(() => {
    let stale = false
    setHeroImg(null)
    setCutoutImg(null)
    setThumbLoaded(false)
    ;(async () => {
      let portrait = null
      if (starPlayer?.name) {
        const imgs = await getSportsDBPlayerImages(starPlayer.name)
        if (stale) return
        setCutoutImg(imgs.cutout || null)
        const wide = imgs.fanart || imgs.banner
        if (wide) { setHeroWide(true); setHeroImg(wide); return }
        portrait = imgs.render || imgs.thumb || null
      }
      for (const name of [homeName, awayName]) {
        if (!name) continue
        const t = await getSportsDBTeamImages(name)
        if (stale) return
        const wide = t.fanart || t.banner
        if (wide) { setHeroWide(true); setHeroImg(wide); return }
      }
      if (portrait && !stale) { setHeroWide(false); setHeroImg(portrait) }
    })()
    return () => { stale = true }
  }, [starPlayer?.name, homeName, awayName])

  // Fullscreen
  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  const toggleFs = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await heroRef.current?.requestFullscreen()
    } catch {}
  }, [])

  // Timeline
  const elapsedMin = parseInt(String(game?.time_elapsed ?? ''), 10)
  const progress = status === 'finished' ? 1
    : status === 'live' && !Number.isNaN(elapsedMin) ? Math.min(elapsedMin / 90, 1) : 0
  const centerLabel = status === 'live'
    ? (!Number.isNaN(elapsedMin) ? `${elapsedMin}′` : 'LIVE')
    : status === 'finished' ? 'FT'
    : date?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? '--:--'

  const markers = [
    ...homeScorers.map(s => ({ ...s, home: true })),
    ...awayScorers.map(s => ({ ...s, home: false })),
  ].map(s => ({ ...s, min: parseInt(String(s.minute ?? ''), 10) }))
   .filter(s => !Number.isNaN(s.min))

  const toastMsg = status === 'live'
    ? 'This match is live — open Match Centre to watch the stream.'
    : status === 'finished'
      ? 'Full time. Final score and scorers shown above.'
      : `Kickoff ${date?.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) ?? 'TBD'} · streams appear here when live.`

  if (!game) return null

  return (
    <section ref={heroRef} className={`${styles.hero} ${status === 'live' ? styles.heroLive : ''}`}>

      {/* ══ Background: wide action shot full-bleed, or anchored portrait ══ */}
      <div className={styles.bgLayer} aria-hidden="true">
        <div className={styles.bgAmbient}/>
        {heroImg && (
          <img
            src={heroImg}
            alt=""
            className={`${heroWide ? styles.heroPhoto : styles.heroPortrait} ${thumbLoaded ? styles.heroPhotoLoaded : ''}`}
            onLoad={e => {
              setThumbLoaded(true)
              // Safety net: never stretch a near-square image full-bleed
              const r = e.target.naturalWidth / Math.max(1, e.target.naturalHeight)
              if (r < 1.25 && heroWide) setHeroWide(false)
            }}
          />
        )}
        {/* Dark scene compositing layers */}
        <div className={styles.bgLeft}  />
        <div className={styles.bgRight} />
        <div className={styles.bgTop}   />
        <div className={styles.bgBottom}/>
        <div className={styles.bgCenter}/>
        {status === 'live' && <div className={styles.liveGlow}/>}
      </div>

      {/* ══ Layout ══ */}
      <div className={styles.layout}>

        {/* Title row */}
        <div className={styles.titleRow}>
          <button className={styles.backBtn} aria-label="Back" onClick={() => window.history.back()}>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M16 10H4M4 10l5-5M4 10l5 5" stroke="currentColor" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>Match Hub</h1>
            {status === 'live'
              ? <span className="live-badge"><span className="live-dot"/>Live</span>
              : <span className={styles.statusPill}>{status === 'finished' ? 'Full Time' : 'Upcoming'}</span>}
          </div>
          <button className={styles.fsBtn} onClick={toggleFs}
            aria-label={isFs ? 'Exit fullscreen' : 'Enter fullscreen'}>
            {isFs ? (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"
                  stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
                  stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        </div>

        {/* ══ Right sidebar ══ */}
        <aside className={styles.sidebar}>

          <div className={styles.sbHeader}>
            <span className={styles.sbTitle}>Match</span>
            <span className={styles.sbDate}>
              {date?.toLocaleDateString([], { day: '2-digit', month: 'short' }) ?? 'TBD'}
            </span>
          </div>
          <div className={styles.sbSub}>
            <span>{game.type === 'group'
              ? `First Stage · Group ${game.group}`
              : String(game.type ?? 'Knockout').replace(/-/g, ' ')}</span>
            {stadium && <span className={styles.sbVenue}>{stadium.name_en}, {stadium.city_en}</span>}
          </div>

          {/* Scoreboard */}
          <button className={styles.sbScore} onClick={onClick} aria-label="Open match centre">
            <span className={styles.sbTeamCol}>
              <span className={styles.sbFlagRing}>
                <img src={getFlagUrl(hIso, 80)} alt={homeTeam?.name_en ?? 'Home'}
                  className={styles.sbFlag} onError={e => { e.target.style.visibility = 'hidden' }}/>
              </span>
              <span className={styles.sbCode}>{homeTeam?.fifa_code ?? '—'}</span>
            </span>
            <span className={styles.sbScoreNum}>
              {status !== 'upcoming'
                ? <>{game?.home_score ?? 0}<i className={styles.sbDash}>–</i>{game?.away_score ?? 0}</>
                : <span className={styles.sbVs}>VS</span>}
            </span>
            <span className={styles.sbTeamCol}>
              <span className={styles.sbFlagRing}>
                <img src={getFlagUrl(aIso, 80)} alt={awayTeam?.name_en ?? 'Away'}
                  className={styles.sbFlag} onError={e => { e.target.style.visibility = 'hidden' }}/>
              </span>
              <span className={styles.sbCode}>{awayTeam?.fifa_code ?? '—'}</span>
            </span>
          </button>

          {/* Scorers */}
          {(homeScorers.length > 0 || awayScorers.length > 0) && (
            <div className={styles.sbScorers}>
              <ul className={styles.scorerCol}>
                {homeScorers.map((s, i) => (
                  <li key={i}>{s.name}{s.minute ? ` ${s.minute}′` : ''}</li>
                ))}
              </ul>
              <ul className={`${styles.scorerCol} ${styles.scorerColAway}`}>
                {awayScorers.map((s, i) => (
                  <li key={i}>{s.name}{s.minute ? ` ${s.minute}′` : ''}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ══ "Player to Watch" — SQUARE card with CUTOUT image + big number ══ */}
          {starPlayer && (
            <div className={styles.perfCard}>
              {/* Giant jersey number watermark behind the player */}
              {starPlayer.num !== '' && (
                <span className={styles.perfNum} aria-hidden="true">{starPlayer.num}</span>
              )}

              {/* Cutout PNG — transparent full body, stands tall in the card */}
              {cutoutImg ? (
                <img
                  src={cutoutImg}
                  alt={starPlayer.name}
                  className={styles.perfCutout}
                  onError={e => { e.target.style.display = 'none' }}
                />
              ) : (
                <div className={styles.perfCutoutFallback}>
                  <span>{starPlayer.name[0]}</span>
                </div>
              )}

              {/* Info overlay at bottom */}
              <div className={styles.perfOverlay}>
                <div className={styles.perfInfo}>
                  <span className={styles.perfLabel}>Player to Watch</span>
                  <span className={styles.perfName}>{starPlayer.name}</span>
                  <span className={styles.perfTeam}>
                    <img src={getFlagUrl(starTeam?.iso2, 40)} alt="" className={styles.perfCrest}/>
                    {starTeam?.fifa_code}
                  </span>
                </div>
                <div className={styles.perfStats}>
                  {starGoals > 0 && <span className={styles.perfStat}>Goals <b>×{starGoals}</b></span>}
                  {starPlayer.num !== '' && (
                    <span className={styles.perfStat}>Shirt <b>#{starPlayer.num}</b></span>
                  )}
                  <span className={styles.perfStat}>Role <b>{starPlayer.pos}</b></span>
                </div>
              </div>
            </div>
          )}

          {/* Watch CTA */}
          <button className={styles.sbCta} onClick={onClick}>
            {status === 'live' ? 'Watch Live' : status === 'finished' ? 'Match Report' : 'Match Centre'}
          </button>

          {/* Timeline */}
          <div className={styles.timeline} aria-label="Match timeline">
            <div className={styles.tlTrack}>
              <div className={styles.tlTicks} aria-hidden="true">
                {[...Array(19)].map((_, i) => (
                  <span key={i} className={`${styles.tlTick} ${i % 3 === 0 ? styles.tlTickMajor : ''}`}/>
                ))}
              </div>
              <div className={styles.tlFill} style={{ width: `${progress * 100}%` }}/>
              {markers.map((m, i) => (
                <span key={i}
                  className={`${styles.tlMarker} ${m.home ? styles.tlMarkerHome : styles.tlMarkerAway}`}
                  style={{ left: `${Math.min(m.min / 90, 1) * 100}%` }}
                  title={`${m.name} ${m.min}′`}/>
              ))}
            </div>
            <div className={styles.tlLabels}>
              <span>0′</span>
              <span className={styles.tlCenter}>{centerLabel}</span>
              <span>90′</span>
            </div>
          </div>

          {/* Toast */}
          {toastOpen && (
            <div className={styles.toast} role="status">
              <span className={styles.toastDot} aria-hidden="true"/>
              <span className={styles.toastMsg}>{toastMsg}</span>
              <button className={styles.toastClose} aria-label="Dismiss" onClick={() => setToastOpen(false)}>
                <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          )}
        </aside>

        {/* ══ Bottom dashboard ══ */}
        <div className={styles.bottomGrid}>

          {/* Statistics */}
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>Statistics</span>
              <span className={styles.legendDots}>
                <span><i className={styles.dotHome} aria-hidden="true"/>{homeTeam?.fifa_code ?? 'Home'}</span>
                <span><i className={styles.dotAway} aria-hidden="true"/>{awayTeam?.fifa_code ?? 'Away'}</span>
              </span>
              <button className={styles.panelExpand} aria-label="Expand" onClick={onClick}><ExpandIcon/></button>
            </div>
            {FORM_ROWS.map(({ label, key }) => {
              const hv = Number(homeForm?.[key] ?? 0)
              const av = Number(awayForm?.[key] ?? 0)
              const total = hv + av
              const hp = total === 0 ? 50 : Math.round((hv / total) * 100)
              return (
                <div key={label} className={styles.statRow}>
                  <span className={styles.statValH}>{hv}</span>
                  <div className={styles.statMid}>
                    <span className={styles.statLabel}>{label}</span>
                    <div className={styles.statBar}>
                      <div className={styles.statBarH} style={{ width: `${hp}%` }}/>
                      <div className={styles.statBarA} style={{ width: `${100 - hp}%` }}/>
                    </div>
                  </div>
                  <span className={styles.statValA}>{av}</span>
                </div>
              )
            })}
          </div>

          {/* Key Players */}
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>Key Players</span>
              <span className={styles.miniTabs} role="tablist">
                {['home', 'away'].map(side => (
                  <button key={side} role="tab"
                    aria-selected={rosterTab === side}
                    className={`${styles.miniTab} ${rosterTab === side ? styles.miniTabOn : ''}`}
                    onClick={() => setRosterTab(side)}>
                    {(side === 'home' ? homeTeam : awayTeam)?.fifa_code ?? side}
                  </button>
                ))}
              </span>
              <button className={styles.panelExpand} aria-label="Expand" onClick={onClick}><ExpandIcon/></button>
            </div>
            <div className={styles.rosterRow}>
              {roster.length === 0 && <span className={styles.rosterEmpty}>Squad coming soon</span>}
              {roster.map((p, i) => (
                <RosterAvatar key={`${rosterTab}-${i}`} player={p}
                  home={rosterTab === 'home'}
                  goals={playerGoalsFromGames(games, rosterTeam?.id, p.name)}/>
              ))}
            </div>
          </div>

          {/* Heat Map */}
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <div className={styles.panelHeadCol}>
                <span className={styles.panelTitle}>Heat Map</span>
                <span className={styles.panelSub}>Simulated field control</span>
              </div>
              <button className={styles.panelExpand} aria-label="Expand" onClick={onClick}><ExpandIcon/></button>
            </div>
            <HeatMap homeIso={hIso} awayIso={aIso}
              homeLabel={homeTeam?.fifa_code} awayLabel={awayTeam?.fifa_code}
              compact withSplit/>
          </div>

        </div>
      </div>
    </section>
  )
}

// RosterAvatar: uses TheSportsDB thumb (headshot) for circular portrait
function RosterAvatar({ player, goals = 0, home = true }) {
  const [thumb, setThumb] = useState(null)
  useEffect(() => {
    let stale = false
    setThumb(null)
    if (!player?.name) return
    getSportsDBPlayerImages(player.name).then(({ thumb: t }) => {
      if (!stale) setThumb(t || null)
    })
    return () => { stale = true }
  }, [player?.name])

  return (
    <div className={styles.rosterItem}>
      <div className={`${styles.rosterRing} ${home ? styles.ringHome : styles.ringAway}`}>
        {thumb
          ? <img src={`${thumb}/small`} alt={player.name} className={styles.rosterImg}
              onError={e => { e.target.style.display = 'none' }}/>
          : <span className={styles.rosterFallback}>{player.name[0]}</span>}
      </div>
      <span className={styles.rosterName}>{player.name.split(' ').pop()}</span>
      <span className={styles.rosterRole}>
        {POS_LABEL[player.pos] ?? player.pos}{player.num !== '' ? ` · #${player.num}` : ''}{goals > 0 ? ` · ${goals} G` : ''}
      </span>
    </div>
  )
}
