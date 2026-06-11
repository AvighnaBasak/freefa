'use client'
import { useMemo } from 'react'
import styles from './HeatMap.module.css'

// Generate deterministic heat-map dots from team iso codes
function seedRandom(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function generateHeatDots(iso1, iso2, count = 60) {
  const seed = (iso1 + iso2).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const rng  = seedRandom(seed)
  return Array.from({ length: count }, (_, i) => {
    // Home team biased toward away half, away team biased toward home half
    const isHome = i < count / 2
    const xBase  = isHome ? 0.52 : 0.12
    const x = Math.max(0.02, Math.min(0.98, xBase + (rng() - 0.3) * 0.7))
    const y = Math.max(0.04, Math.min(0.96, rng()))
    const heat = rng()
    return { x, y, heat, home: isHome }
  })
}

export default function HeatMap({
  homeIso = 'UN', awayIso = 'UN',
  homeLabel, awayLabel,
  compact = false,
  withSplit = false,
}) {
  const dots = useMemo(() => generateHeatDots(homeIso, awayIso), [homeIso, awayIso])

  // Field-control split derived from the same simulated dots
  const split = useMemo(() => {
    const h = dots.filter(d => d.home).reduce((s, d) => s + d.heat, 0)
    const a = dots.filter(d => !d.home).reduce((s, d) => s + d.heat, 0)
    const hp = Math.round((h / (h + a || 1)) * 100)
    return { home: hp, away: 100 - hp }
  }, [dots])

  const pitch = (
    <div className={`${styles.wrap} ${compact ? styles.compact : ''}`}>
      {/* Pitch */}
      <svg className={styles.pitch} viewBox="0 0 200 130" preserveAspectRatio="none" aria-hidden="true">
        {/* Grass stripes */}
        {[...Array(10)].map((_, i) => (
          <rect key={i} x={i*20} y={0} width={20} height={130}
            fill={i%2===0 ? 'rgba(34,197,94,0.08)' : 'transparent'} />
        ))}
        {/* Outer border */}
        <rect x="2" y="2" width="196" height="126" rx="2" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1"/>
        {/* Centre line */}
        <line x1="100" y1="2" x2="100" y2="128" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8"/>
        {/* Centre circle */}
        <circle cx="100" cy="65" r="18" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8"/>
        <circle cx="100" cy="65" r="1.5" fill="rgba(255,255,255,0.4)"/>
        {/* Left penalty box */}
        <rect x="2" y="32" width="34" height="66" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8"/>
        <rect x="2" y="46" width="14" height="38" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8"/>
        {/* Right penalty box */}
        <rect x="164" y="32" width="34" height="66" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8"/>
        <rect x="184" y="46" width="14" height="38" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8"/>
        {/* Goals */}
        <rect x="0" y="54" width="3" height="22" fill="rgba(255,255,255,0.3)"/>
        <rect x="197" y="54" width="3" height="22" fill="rgba(255,255,255,0.3)"/>
      </svg>

      {/* Heat dots */}
      <div className={styles.dotsLayer}>
        {dots.map((d, i) => (
          <div
            key={i}
            className={styles.dot}
            style={{
              left:    `${d.x * 100}%`,
              top:     `${d.y * 100}%`,
              opacity: 0.2 + d.heat * 0.75,
              width:   `${6 + d.heat * 14}px`,
              height:  `${6 + d.heat * 14}px`,
              background: d.home
                ? `radial-gradient(circle, rgba(230,57,70,${0.7 + d.heat*0.3}) 0%, transparent 70%)`
                : `radial-gradient(circle, rgba(59,130,246,${0.7 + d.heat*0.3}) 0%, transparent 70%)`,
            }}
          />
        ))}
      </div>

      {/* Inline legend (hidden in split mode) */}
      {!withSplit && (
        <div className={styles.legend}>
          <span className={styles.legendHome}>● {homeLabel ?? homeIso}</span>
          <span className={styles.legendNote}>simulated</span>
          <span className={styles.legendAway}>● {awayLabel ?? awayIso}</span>
        </div>
      )}
    </div>
  )

  if (!withSplit) return pitch

  // Split layout: pitch left, field-control legend right (reference design)
  return (
    <div className={styles.splitRow}>
      {pitch}
      <div className={styles.splitLegend}>
        <div className={styles.splitItem}>
          <span className={`${styles.swatch} ${styles.swatchHome}`} aria-hidden="true"/>
          <span className={styles.splitTeam}>{homeLabel ?? homeIso}</span>
          <span className={styles.splitPct}>{split.home}%</span>
        </div>
        <div className={styles.splitItem}>
          <span className={`${styles.swatch} ${styles.swatchAway}`} aria-hidden="true"/>
          <span className={styles.splitTeam}>{awayLabel ?? awayIso}</span>
          <span className={styles.splitPct}>{split.away}%</span>
        </div>
        <span className={styles.splitNote}>simulated</span>
      </div>
    </div>
  )
}
