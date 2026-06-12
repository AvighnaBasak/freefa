'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { findCeremonyMatch, CEREMONY_THUMB, CEREMONY_THUMB_DIRECT, CEREMONY_FALLBACK_SOURCES, parseMatchDate } from '@/utils/api'
import { useWC } from './Providers'
import StreamPlayer from './StreamPlayer'
import AdBlockerModal from './AdBlockerModal'
import WatchTogether from './WatchTogether'
import styles from './Ceremony.module.css'

const TITLE = 'Opening Ceremony'

// Proxy thumb first; if the proxy can't reach streamed.pk, load it straight
// from the browser (which gets through), and only then give up and hide.
const thumbFallback = e => {
  if (!e.target.dataset.direct) {
    e.target.dataset.direct = '1'
    e.target.src = CEREMONY_THUMB_DIRECT
  } else {
    e.target.style.display = 'none'
  }
}

export default function CeremonyCard() {
  const { games, stadiumsMap } = useWC()
  const [event, setEvent]       = useState(null)   // streamed.pk event (live flag + sources)
  const [showAd, setShowAd]     = useState(false)
  const [open, setOpen]         = useState(false)
  const [visible, setVisible]   = useState(false)
  const overlayRef = useRef(null)

  // Track the real event on streamed.pk — live badge + sources, refreshed every 60s
  useEffect(() => {
    let stale = false
    const load = () => findCeremonyMatch().then(m => { if (!stale && m) setEvent(m) }).catch(() => {})
    load()
    const iv = setInterval(load, 60000)
    return () => { stale = true; clearInterval(iv) }
  }, [])

  // The ceremony opens the tournament — derive date + venue from the first scheduled match
  const opener = useMemo(() => {
    let first = null, firstDate = null
    for (const g of games) {
      const d = parseMatchDate(g.local_date, g.stadium_id)
      if (d && (!firstDate || d < firstDate)) { firstDate = d; first = g }
    }
    return { date: firstDate, stadium: first ? stadiumsMap?.[first.stadium_id] : null }
  }, [games, stadiumsMap])

  // Overlay open/close with the same fade pattern as MatchDetail
  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    const onKey = e => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleClose = () => {
    setVisible(false)
    setTimeout(() => setOpen(false), 300)
  }

  const sources = event?.sources?.length ? event.sources : CEREMONY_FALLBACK_SOURCES
  const isLive  = !!event?.live

  return (
    <>
      <article className={styles.banner} onClick={() => setShowAd(true)}>
        <img src={CEREMONY_THUMB} alt="" className={styles.bg} aria-hidden="true"
          onError={thumbFallback}/>
        <div className={styles.shade} aria-hidden="true"/>
        <div className={styles.inner}>
          <div className={styles.kicker}>
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10 1l2.4 5.3L18 7l-4.2 3.9 1.2 5.6L10 13.6l-5 2.9 1.2-5.6L2 7l5.6-.7L10 1z"/>
            </svg>
            Special Event · Mexico
            {isLive && <span className="live-badge"><span className="live-dot"/>LIVE</span>}
          </div>
          <h2 className={styles.title}>{TITLE}</h2>
          <p className={styles.sub}>
            FIFA World Cup 26™ kicks off
            {opener.stadium ? ` at ${opener.stadium.name_en}, ${opener.stadium.city_en}` : ''}
            {opener.date ? ` · ${opener.date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}` : ''}
          </p>
          <button className={styles.watchBtn} onClick={e => { e.stopPropagation(); setShowAd(true) }}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z"/>
            </svg>
            {isLive ? 'Watch Live' : 'Watch Now'}
          </button>
        </div>
      </article>

      {/* Portal to <body>: the page wrapper keeps a transform from its entry
          animation, which would break position:fixed for anything inside it */}
      {showAd && createPortal(
        <AdBlockerModal
          onProceed={() => { setShowAd(false); setOpen(true) }}
          onClose={() => setShowAd(false)}
        />, document.body
      )}

      {open && createPortal(
        <div
          className={`${styles.overlay} ${visible ? styles.overlayVisible : ''}`}
          ref={overlayRef}
          onClick={e => e.target === overlayRef.current && handleClose()}
        >
          <div className={`${styles.panel} ${visible ? styles.panelVisible : ''}`}>
            <div className={styles.panelBg} aria-hidden="true">
              <img src={CEREMONY_THUMB} alt="" className={styles.panelBgImg}
                onError={thumbFallback}/>
              <div className={styles.panelBgShade}/>
            </div>

            <div className={styles.header}>
              <button className={styles.backBtn} onClick={handleClose}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M5 12l7-7M5 12l7 7"/>
                </svg>
                Back
              </button>
              <div className={styles.headerMeta}>
                {isLive
                  ? <span className="live-badge"><span className="live-dot"/>LIVE</span>
                  : <span className={styles.eventBadge}>Special Event</span>}
                <span className={styles.headerTitle}>{TITLE} · Mexico</span>
              </div>
            </div>

            <div className={styles.playerSection}>
              <StreamPlayer sources={sources} matchTitle={`FIFA World Cup 26 ${TITLE}`}/>
              <div className={styles.playerTools}>
                <WatchTogether matchTitle={`World Cup 26 ${TITLE}`}/>
              </div>
            </div>
          </div>
        </div>, document.body
      )}
    </>
  )
}
