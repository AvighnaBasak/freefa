'use client'
import { useState, useEffect, useMemo } from 'react'
import { useWC } from './Providers'
import { getWCGroups, getFlagUrl } from '@/utils/api'
import styles from './GroupsPage.module.css'

export default function GroupsPage() {
  const { teams } = useWC()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = () => getWCGroups().then(data => {
      setGroups(data)
      setLoading(false)
    }).catch(() => setLoading(false))
    load()
    const iv = setInterval(load, 30000) // live standings refresh
    return () => clearInterval(iv)
  }, [])

  const teamById = useMemo(() => {
    const m = {}
    teams.forEach(t => { m[t.id] = t })
    return m
  }, [teams])

  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => a.name?.localeCompare(b.name))
  }, [groups])

  if (loading) return (
    <div className={`${styles.page} page`}>
      <div className={styles.pageHero}>
        <div className={styles.pageHeroBg} aria-hidden="true"/>
      </div>
      <div className={styles.loading}><div className={styles.spinner}/><span>Loading groups…</span></div>
    </div>
  )

  return (
    <div className={`${styles.page} page`}>

      {/* ── Page hero ── */}
      <div className={styles.pageHero}>
        <div className={styles.pageHeroBg} aria-hidden="true"/>
        <div className={styles.pageHeroInner}>
          <span className="page-kicker">FIFA World Cup 2026™</span>
          <h1 className="page-title">Groups &amp; <em>Standings</em></h1>
          <p className="page-sub">12 groups · 48 teams · the road to the Round of 32</p>

          {/* Qualification legend */}
          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <i className={`${styles.legendDot} ${styles.dotAdvance}`}/>Top 2 advance
            </span>
            <span className={styles.legendItem}>
              <i className={`${styles.legendDot} ${styles.dotThird}`}/>8 best third-placed teams advance
            </span>
          </div>
        </div>
      </div>

      <div className={styles.inner}>
        <div className={styles.groupsGrid}>
          {sortedGroups.map(group => (
            <GroupTable key={group._id ?? group.name} group={group} teamById={teamById} />
          ))}
        </div>
      </div>
    </div>
  )
}

function GroupTable({ group, teamById }) {
  const sortedTeams = useMemo(() => {
    return [...(group.teams ?? [])].sort((a, b) => {
      const pd = Number(b.pts) - Number(a.pts)
      if (pd !== 0) return pd
      const gdd = Number(b.gd) - Number(a.gd)
      if (gdd !== 0) return gdd
      return Number(b.gf) - Number(a.gf)
    })
  }, [group.teams])

  return (
    <div className={styles.groupCard}>
      {/* Giant watermark letter */}
      <span className={styles.watermark} aria-hidden="true">{group.name}</span>

      <div className={styles.groupHeader}>
        <span className={styles.groupChip}>{group.name}</span>
        <span className={styles.groupTitle}>Group {group.name}</span>
        <span className={styles.groupSub}>{sortedTeams.length} teams</span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thPos} aria-label="Position">#</th>
              <th className={styles.thTeam}>Team</th>
              <th>MP</th><th>W</th><th>D</th><th>L</th>
              <th>GF</th><th>GA</th><th>GD</th><th className={styles.thPts}>Pts</th>
            </tr>
          </thead>
          <tbody>
            {sortedTeams.map((row, i) => {
              const t = teamById[row.team_id]
              const zone = i < 2 ? styles.zoneAdvance : i === 2 ? styles.zoneThird : ''
              return (
                <tr key={row.team_id} className={`${styles.tRow} ${zone}`}>
                  <td className={styles.tdPos}>
                    <span className={styles.posNum}>{i + 1}</span>
                  </td>
                  <td className={styles.tdTeam}>
                    {t?.iso2 && (
                      <img
                        src={getFlagUrl(t.iso2, 40)}
                        alt={t.name_en}
                        className={styles.rowFlag}
                        onError={e => { e.target.style.display = 'none' }}
                      />
                    )}
                    <span className={styles.teamName}>{t?.name_en ?? `Team ${row.team_id}`}</span>
                  </td>
                  <td>{row.mp ?? 0}</td>
                  <td>{row.w ?? 0}</td>
                  <td>{row.d ?? 0}</td>
                  <td>{row.l ?? 0}</td>
                  <td>{row.gf ?? 0}</td>
                  <td>{row.ga ?? 0}</td>
                  <td className={Number(row.gd) > 0 ? styles.pos : Number(row.gd) < 0 ? styles.neg : ''}>
                    {Number(row.gd) > 0 ? `+${row.gd}` : row.gd ?? 0}
                  </td>
                  <td className={styles.tdPts}>{row.pts ?? 0}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
