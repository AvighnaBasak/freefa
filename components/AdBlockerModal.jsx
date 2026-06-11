'use client'
import styles from './AdBlockerModal.module.css'

export default function AdBlockerModal({ onProceed, onClose }) {
  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.icon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: 32, height: 32, color: 'var(--gold)'}}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className={styles.title}>Ad Blocker Recommended</h2>
        <p className={styles.desc}>
          For the best experience, we recommend using an ad blocker while watching. Streams may contain
          auto-play ads. <strong>uBlock Origin</strong> is free and works great.
        </p>
        <div className={styles.actions}>
          <a
            href="https://ublockorigin.com"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.btnSecondary}
          >
            Get uBlock Origin ↗
          </a>
          <button className={styles.btnPrimary} onClick={onProceed}>
            Watch Anyway
          </button>
        </div>
        <button className={styles.close} onClick={onClose} aria-label="Close">✕</button>
      </div>
    </div>
  )
}
