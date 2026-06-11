'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { getStreams, syntheticStreams } from '@/utils/api'
import styles from './StreamPlayer.module.css'

export default function StreamPlayer({ sources = [], matchTitle = '' }) {
  const [streams, setStreams]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [activeIdx, setActiveIdx]   = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showCast, setShowCast]     = useState(false)
  const [isIOS, setIsIOS]           = useState(false)
  const playerRef = useRef(null)
  const iframeRef = useRef(null)

  // iOS Safari (all iOS browsers) can't run the embeds' MSE-based player —
  // surface a "open directly" hint so viewers can escape the iframe
  useEffect(() => {
    const ua = navigator.userAgent || ''
    const ios = /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) // iPadOS
    setIsIOS(ios)
  }, [])

  // Fetch streams from ALL sources and merge them, so viewers can switch
  // players — some embeds don't play on every browser (e.g. iOS WebKit).
  useEffect(() => {
    if (!sources?.length) { setError('No stream sources available.'); setLoading(false); return }
    setLoading(true); setError(null); setActiveIdx(0)
    let stale = false
    ;(async () => {
      const results = await Promise.allSettled(
        sources.map(s => getStreams(s.source, s.id))
      )
      if (stale) return
      const merged = []
      let blocked = false
      for (const r of results) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) merged.push(...r.value)
        // HTTP 4xx = the API answered (source doesn't exist); anything
        // else means we couldn't reach the API at all
        else if (r.status === 'rejected' && !/HTTP 4\d\d/.test(String(r.reason?.message))) blocked = true
      }
      const seen = new Set()
      const unique = merged.filter(s => s?.embedUrl && !seen.has(s.embedUrl) && seen.add(s.embedUrl))
      if (unique.length) setStreams(unique)
      // API unreachable (not just "no streams yet") — build the embed
      // URLs directly; the embed domain usually loads even on networks
      // that block the streamed.pk API.
      else if (blocked) setStreams(syntheticStreams(sources))
      else setError('No working streams found right now.')
      setLoading(false)
    })()
    return () => { stale = true }
  }, [sources])

  // Fullscreen listener
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    if (!playerRef.current) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await playerRef.current.requestFullscreen()
    } catch (e) { console.warn('Fullscreen error:', e) }
  }, [])

  const handleCast = useCallback(() => {
    // Try native browser cast (Chromecast / presentation API)
    if (typeof window !== 'undefined' && 'presentation' in window.navigator) {
      setShowCast(true)
    } else {
      // Fallback: go fullscreen and advise OS-level casting
      toggleFullscreen()
      setShowCast(true)
    }
  }, [toggleFullscreen])

  const activeStream = streams[activeIdx]
  const multiSource = new Set(streams.map(s => s.source)).size > 1

  return (
    <div className={styles.outer}>
      {/* Video area — only the embed lives here, so our buttons never
          cover the embed player's own controls */}
      <div className={styles.playerWrap} ref={playerRef}>

        {/* Loading */}
        {loading && (
          <div className={styles.state}>
            <div className={styles.spinner}/>
            <span>Loading stream…</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className={styles.state}>
            <div className={styles.errorIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: 32, height: 32, color: 'var(--text3)'}}>
                <path d="M12 2a10 10 0 0 1 10 10M12 6a6 6 0 0 1 6 6M12 10a2 2 0 0 1 2 2" strokeLinecap="round"/>
                <circle cx="12" cy="18" r="1"/>
                <path d="M12 14v3M3 18h18" strokeLinecap="round"/>
              </svg>
            </div>
            <span className={styles.errorMsg}>{error}</span>
            <p className={styles.errorSub}>Check back when the match goes live.</p>
          </div>
        )}

        {/* Player */}
        {!loading && !error && activeStream && (
          <iframe
            ref={iframeRef}
            src={activeStream.embedUrl}
            className={styles.iframe}
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            referrerPolicy="no-referrer"
            frameBorder="0"
            title={matchTitle}
          />
        )}

        {/* iOS players often refuse to run inside the iframe — overlay a
            tap-to-open hint that launches the stream full-tab */}
        {!loading && !error && activeStream && isIOS && (
          <a
            className={styles.iosHint}
            href={activeStream.embedUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M14 4h6m0 0v6m0-6L10 14M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>
            </svg>
            <strong>Not playing on iPhone?</strong>
            <span>Tap to open the stream in Safari, or try another stream below.</span>
          </a>
        )}
      </div>

      {/* Controls — stacked rows so nothing overlaps at any width */}
      {!loading && !error && activeStream && (
        <div className={styles.controls}>

          {/* Row 1: status + action buttons */}
          <div className={styles.controlsTop}>
            <div className={styles.controlsLeft}>
              <div className="live-badge"><div className="live-dot"/>LIVE</div>
              <span className={styles.matchTitle}>{matchTitle}</span>
            </div>

            <div className={styles.controlsRight}>
              {/* Open the stream in a full browser tab — best escape hatch
                  when the embed won't play inside the iframe (esp. iOS) */}
              <a
                className={`${styles.iconBtn} ${styles.iconBtnOpen}`}
                href={activeStream.embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open stream in new tab"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M14 4h6m0 0v6m0-6L10 14M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>
                </svg>
              </a>

              {/* Cast button */}
              <button className={styles.iconBtn} onClick={handleCast} title="Cast to TV">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/>
                  <line x1="2" y1="20" x2="2.01" y2="20"/>
                </svg>
              </button>

              {/* Fullscreen */}
              <button className={styles.iconBtn} onClick={toggleFullscreen} title="Fullscreen">
                {isFullscreen ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Row 2: stream selector (own row, scrolls sideways if long) */}
          {streams.length > 1 && (
            <div className={styles.streamPicker}>
              {streams.map((s, i) => (
                <button
                  key={i}
                  className={`${styles.streamBtn} ${i === activeIdx ? styles.streamBtnActive : ''}`}
                  onClick={() => setActiveIdx(i)}
                >
                  {multiSource && s.source ? `${s.source} · ` : ''}
                  {s.language ?? `Stream ${s.streamNo}`}
                  {s.hd && <span className={styles.hd}>HD</span>}
                </button>
              ))}
            </div>
          )}

          {/* Disclaimer: how to recover from a dead stream */}
          <p className={styles.disclaimer}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Stream not working? Switch streams above, or press the
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={styles.inlineIcon} aria-hidden="true">
              <path d="M14 4h6m0 0v6m0-6L10 14M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>
            </svg>
            button to open it in a new tab.
          </p>
        </div>
      )}

      {/* Cast tooltip */}
      {showCast && (
        <div className={styles.castTip}>
          <strong>Watch on your TV:</strong>
          <br/>• <b>Android:</b> Chrome ⋮ menu → Cast, or swipe down → Smart View / Screen Cast (Miracast)
          <br/>• <b>iPhone / iPad / Mac:</b> Control Centre → Screen Mirroring (AirPlay)
          <br/>• <b>Windows:</b> Win+K → pick your Miracast display
          <br/>Go fullscreen first for the best picture.
          <button className={styles.castClose} onClick={() => setShowCast(false)}>✕</button>
        </div>
      )}
    </div>
  )
}
