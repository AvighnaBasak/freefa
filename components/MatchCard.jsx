'use client'
import { useState } from 'react'
import { getFlagUrl, matchStatus, parseMatchDate } from '@/utils/api'
import styles from './MatchCard.module.css'

export default function MatchCard({ game, homeTeam, awayTeam, onClick }) {
  const [errH, setErrH] = useState(false)
  const [errA, setErrA] = useState(false)
  const status = matchStatus(game)
  const date   = parseMatchDate(game?.local_date, game?.stadium_id)
  const hFlag  = getFlagUrl(homeTeam?.iso2, 80)
  const aFlag  = getFlagUrl(awayTeam?.iso2, 80)

  const fmtTime = d => d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'
  const fmtDate = d => d ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''

  return (
    <div
      className={`${styles.card} ${styles[status]}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick?.()}
    >
      {/* Top row */}
      <div className={styles.topRow}>
        {status === 'live' && (
          <span className="live-badge"><div className="live-dot"/>LIVE</span>
        )}
        {status === 'finished' && <span className={`${styles.badge} ${styles.ft}`}>FT</span>}
        {status === 'upcoming' && (
          <span className={`${styles.badge} ${styles.soon}`}>{fmtDate(date)} · {fmtTime(date)}</span>
        )}
        <span className={styles.round}>
          {game?.type === 'group' ? `Group ${game.group}` : (game?.type ?? 'KO')}
        </span>
      </div>

      {/* Matchup */}
      <div className={styles.matchup}>
        <div className={styles.team}>
          <div className={styles.flagWrap}>
            {hFlag && !errH
              ? <img src={hFlag} alt={homeTeam?.name_en} onError={() => setErrH(true)} />
              : <span className={styles.code}>{homeTeam?.fifa_code ?? '?'}</span>}
          </div>
          <span className={styles.name}>{homeTeam?.name_en ?? `—`}</span>
        </div>

        <div className={styles.center}>
          {status !== 'upcoming' ? (
            <div className={styles.scoreRow}>
              <span className={styles.score}>{game?.home_score ?? 0}</span>
              <span className={styles.dash}>—</span>
              <span className={styles.score}>{game?.away_score ?? 0}</span>
            </div>
          ) : (
            <span className={styles.vs}>VS</span>
          )}
          {status === 'live' && game?.time_elapsed && game.time_elapsed !== 'live' && (
            <span className={styles.elapsed}>{game.time_elapsed}′</span>
          )}
        </div>

        <div className={`${styles.team} ${styles.teamAway}`}>
          <div className={styles.flagWrap}>
            {aFlag && !errA
              ? <img src={aFlag} alt={awayTeam?.name_en} onError={() => setErrA(true)} />
              : <span className={styles.code}>{awayTeam?.fifa_code ?? '?'}</span>}
          </div>
          <span className={styles.name}>{awayTeam?.name_en ?? `—`}</span>
        </div>
      </div>

      {/* CTA */}
      <div className={styles.cta}>
        {status === 'live' ? 'Watch Live' : status === 'finished' ? 'Match Stats' : 'Preview'}
      </div>
    </div>
  )
}
