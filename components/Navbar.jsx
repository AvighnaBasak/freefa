'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import styles from './Navbar.module.css'

const TABS = [
  {
    href: '/',
    label: 'Match Hub',
    icon: (
      <svg viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M10 5l1.5 3.5H15l-2.8 2.2 1.1 3.3L10 12l-3.3 2.5 1.1-3.3L5 8.5h3.5L10 5z" fill="currentColor"/>
      </svg>
    ),
  },
  {
    href: '/schedule',
    label: 'Schedule',
    icon: (
      <svg viewBox="0 0 20 20" fill="none">
        <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 2v4M13 2v4M3 8h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <rect x="6" y="11" width="2" height="2" rx=".5" fill="currentColor"/>
        <rect x="9" y="11" width="2" height="2" rx=".5" fill="currentColor"/>
        <rect x="12" y="11" width="2" height="2" rx=".5" fill="currentColor"/>
      </svg>
    ),
  },
  {
    href: '/groups',
    label: 'Groups',
    icon: (
      <svg viewBox="0 0 20 20" fill="none">
        <rect x="3" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="11" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="3" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: '/stats',
    label: 'Stats',
    icon: (
      <svg viewBox="0 0 20 20" fill="none">
        <path d="M3 14l4-5 4 3 4-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="16" cy="5" r="1.5" fill="currentColor"/>
      </svg>
    ),
  },
]

export default function Navbar() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', fn, { passive: true })
    fn()
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}>
      <div className={styles.bar}>

        {/* ── Brand ── */}
        <Link href="/" className={styles.brand} aria-label="Home">
          <div className={styles.logoMark}>
            <img src="/wc26-logo.png" alt="FIFA World Cup 2026" className={styles.logoImg}/>
          </div>
          <div className={styles.logoText}>
            <span className={styles.logoTop}>FREEFA</span>
          </div>
        </Link>

        {/* ── Center nav tabs ── */}
        <ul className={styles.tabs}>
          {TABS.map(({ href, label, icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={active ? styles.tabActive : styles.tabCircle}
                  title={label}
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className={styles.tabIcon}>{icon}</span>
                  {active && <span className={styles.tabLabel}>{label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* ── Right spacer to keep tabs centered ── */}
        <div className={styles.right} aria-hidden="true"/>

      </div>
    </nav>
  )
}
