'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import styles from './WatchTogether.module.css'

/* ── API helpers (token travels in a header, never in URLs) ── */
async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`/api/wt${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { 'x-wt-token': token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`)
  return data
}

const EMOJIS = ['⚽','🔥','😂','😍','😱','👏','💪','🤯','🥳','😭','👀','🟨','🟥','🧤','🥅','🐐','🏆','🎉','❤️','🙌']
const REACTIONS = ['⚽','🔥','😂','😱','👏','❤️','🟨','🟥','🧤','🐐']

const SESSION_KEY = 'freefa-wt'
const loadSession = () => {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) ?? null } catch { return null }
}
const saveSession = s => {
  try {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {}
}

// Stable pastel hue per member
const hue = uid => {
  let h = 0
  for (const c of String(uid)) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}
const initials = nick =>
  String(nick).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()

const Avatar = ({ uid, nick, size = 26 }) => (
  <span
    className={styles.avatar}
    style={{
      width: size, height: size, fontSize: size * 0.38,
      background: `linear-gradient(150deg, hsl(${hue(uid)} 70% 45%), hsl(${hue(uid)} 70% 28%))`,
    }}
    title={nick}
  >
    {initials(nick)}
  </span>
)

const WTIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2.5" y="4" width="13" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.7"/>
    <path d="M6 20.5h6.5M9 17v3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    <circle cx="18.5" cy="14.5" r="2.4" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M14.5 21c.4-2 2-3.2 4-3.2s3.6 1.2 4 3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
)

export default function WatchTogether({ matchTitle = '' }) {
  const [open, setOpen]       = useState(false)
  const [mode, setMode]       = useState('menu')   // menu | create | join
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState(null)
  const [session, setSession] = useState(null)     // {token, gid, nick, share}
  const [state, setState]     = useState(null)     // last poll snapshot
  const [text, setText]       = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [reactFor, setReactFor]   = useState(null) // msgId with open reaction bar
  const [memberMenu, setMemberMenu] = useState(null)
  const [copied, setCopied]   = useState(false)
  const listRef  = useRef(null)
  const stickRef = useRef(true)

  // Restore session (per tab)
  useEffect(() => { setSession(loadSession()) }, [])

  /* ── Polling ── */
  const poll = useCallback(async (s) => {
    if (!s) return
    try {
      const data = await api(`/${s.gid}?since=0`, { token: s.token })
      setState(data)
      if (data.group?.closed) endSession(false)
    } catch (e) {
      if (/not authorized|removed|not found|expired/i.test(e.message)) endSession(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!session || !open) return
    poll(session)
    const iv = setInterval(() => poll(session), 2500)
    return () => clearInterval(iv)
  }, [session, open, poll])

  // Stick to bottom on new messages unless the user scrolled up
  useEffect(() => {
    const el = listRef.current
    if (el && stickRef.current) el.scrollTop = el.scrollHeight
  }, [state?.messages?.length])

  const endSession = (callLeave = true) => {
    const s = loadSession()
    if (callLeave && s) {
      api(`/${s.gid}`, { method: 'POST', token: s.token, body: { type: 'leave' } }).catch(() => {})
    }
    saveSession(null)
    setSession(null)
    setState(null)
    setMode('menu')
  }

  /* ── Create / Join ── */
  const handleCreate = async e => {
    e.preventDefault()
    const f = new FormData(e.target)
    setBusy(true); setError(null)
    try {
      const data = await api('', { method: 'POST', body: {
        action: 'create',
        name: f.get('name'), nickname: f.get('nickname'), password: f.get('password'),
      }})
      const s = {
        token: data.token, gid: data.group.id, nick: String(f.get('nickname')),
        share: { id: data.group.id, password: String(f.get('password')) }, // creator keeps it to share
      }
      saveSession(s); setSession(s)
    } catch (err) { setError(err.message) }
    setBusy(false)
  }

  const handleJoin = async e => {
    e.preventDefault()
    const f = new FormData(e.target)
    setBusy(true); setError(null)
    try {
      const data = await api('', { method: 'POST', body: {
        action: 'join',
        groupId: f.get('groupId'), nickname: f.get('nickname'), password: f.get('password'),
      }})
      const s = { token: data.token, gid: data.group.id, nick: String(f.get('nickname')), share: null }
      saveSession(s); setSession(s)
    } catch (err) { setError(err.message) }
    setBusy(false)
  }

  /* ── Chat actions ── */
  const send = async (msgText, goal = false) => {
    const t = msgText.trim()
    if (!t || !session) return
    setText(''); setShowEmoji(false)
    try {
      const data = await api(`/${session.gid}`, {
        method: 'POST', token: session.token,
        body: { type: 'message', text: t, goal, since: 0 },
      })
      setState(data)
    } catch (e) { setError(e.message); setTimeout(() => setError(null), 2500) }
  }

  const react = async (msgId, emoji) => {
    setReactFor(null)
    try {
      const data = await api(`/${session.gid}`, {
        method: 'POST', token: session.token,
        body: { type: 'react', msgId, emoji, since: 0 },
      })
      setState(data)
    } catch {}
  }

  const adminAction = async (action, target) => {
    setMemberMenu(null)
    try {
      const data = await api(`/${session.gid}`, {
        method: 'POST', token: session.token,
        body: { type: 'admin', action, target, since: 0 },
      })
      if (action === 'close') endSession(false)
      else setState(data)
    } catch (e) { setError(e.message); setTimeout(() => setError(null), 2500) }
  }

  const share = async () => {
    const s = session?.share
    const msg = s
      ? `Join my FREEFA watch party "${state?.group?.name ?? ''}"! Group ID: ${s.id} · Password: ${s.password}`
      : `Join my FREEFA watch party! Group ID: ${session?.gid}`
    try {
      if (navigator.share) { await navigator.share({ title: 'FREEFA Watch Together', text: msg }); return }
      throw new Error('no-share')
    } catch {
      try {
        await navigator.clipboard.writeText(msg)
        setCopied(true); setTimeout(() => setCopied(false), 1800)
      } catch {}
    }
  }

  const you = state?.you
  const isAdmin = !!you?.isAdmin
  const members = state?.members ?? []
  const messages = useMemo(() => state?.messages ?? [], [state])

  /* ── Render ── */
  return (
    <>
      <button className={styles.entryBtn} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <WTIcon/>
        Watch Together
        {members.length > 0 && session && <span className={styles.entryCount}>{members.length}</span>}
      </button>

      {open && (
        <div className={styles.panel}>

          {/* ══ Not in a group: menu / forms ══ */}
          {!session && (
            <div className={styles.setup}>
              {mode === 'menu' && (
                <>
                  <div className={styles.setupHead}>
                    <WTIcon/>
                    <h3>Watch Together</h3>
                    <p>Create a private room, share the code, and chat with friends while you watch{matchTitle ? ` ${matchTitle}` : ''}.</p>
                  </div>
                  <div className={styles.menuBtns}>
                    <button className={styles.primaryBtn} onClick={() => { setMode('create'); setError(null) }}>
                      Create a group
                    </button>
                    <button className={styles.ghostBtn} onClick={() => { setMode('join'); setError(null) }}>
                      Join a group
                    </button>
                  </div>
                </>
              )}

              {mode === 'create' && (
                <form className={styles.form} onSubmit={handleCreate}>
                  <h3 className={styles.formTitle}>Create group</h3>
                  <label className={styles.field}>
                    <span>Group name</span>
                    <input name="name" maxLength={32} required placeholder="e.g. Saturday Squad" autoComplete="off"/>
                  </label>
                  <label className={styles.field}>
                    <span>Your nickname</span>
                    <NickInput/>
                  </label>
                  <label className={styles.field}>
                    <span>Group password</span>
                    <input name="password" type="password" minLength={4} maxLength={64} required placeholder="min 4 characters"/>
                  </label>
                  <p className={styles.hint}>A group ID is generated automatically — share it with the password.</p>
                  {error && <p className={styles.error}>{error}</p>}
                  <div className={styles.formBtns}>
                    <button type="button" className={styles.ghostBtn} onClick={() => setMode('menu')}>Back</button>
                    <button type="submit" className={styles.primaryBtn} disabled={busy}>
                      {busy ? 'Creating…' : 'Create'}
                    </button>
                  </div>
                </form>
              )}

              {mode === 'join' && (
                <form className={styles.form} onSubmit={handleJoin}>
                  <h3 className={styles.formTitle}>Join group</h3>
                  <label className={styles.field}>
                    <span>Your nickname</span>
                    <NickInput/>
                  </label>
                  <label className={styles.field}>
                    <span>Group ID</span>
                    <input name="groupId" maxLength={6} required placeholder="6-letter code"
                      style={{ textTransform: 'uppercase', letterSpacing: '0.2em' }} autoComplete="off"/>
                  </label>
                  <label className={styles.field}>
                    <span>Password</span>
                    <input name="password" type="password" maxLength={64} required placeholder="group password"/>
                  </label>
                  {error && <p className={styles.error}>{error}</p>}
                  <div className={styles.formBtns}>
                    <button type="button" className={styles.ghostBtn} onClick={() => setMode('menu')}>Back</button>
                    <button type="submit" className={styles.primaryBtn} disabled={busy}>
                      {busy ? 'Joining…' : 'Join'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ══ Active group: chat ══ */}
          {session && (
            <div className={styles.chat}>

              {/* Header */}
              <div className={styles.chatHead}>
                <div className={styles.chatHeadInfo}>
                  <span className={styles.groupName}>{state?.group?.name ?? '…'}</span>
                  <span className={styles.groupId}>#{session.gid}</span>
                </div>
                <div className={styles.memberStack}>
                  {members.slice(0, 5).map(m => <Avatar key={m.uid} uid={m.uid} nick={m.nick} size={24}/>)}
                  {members.length > 5 && <span className={styles.moreCount}>+{members.length - 5}</span>}
                </div>
                <button className={styles.headBtn} onClick={share} title="Share invite">
                  <svg viewBox="0 0 20 20" fill="none"><path d="M13.5 6.5L10 3 6.5 6.5M10 3v10M4 12v3.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {copied && <em className={styles.copied}>Copied!</em>}
                </button>
                {isAdmin && (
                  <button className={styles.headBtn} onClick={() => adminAction('close')} title="Close group (admin)">
                    <svg viewBox="0 0 20 20" fill="none"><rect x="4" y="9" width="12" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.6"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" strokeWidth="1.6"/></svg>
                  </button>
                )}
                <button className={`${styles.headBtn} ${styles.leaveBtn}`} onClick={() => endSession(true)} title="Leave group">
                  <svg viewBox="0 0 20 20" fill="none"><path d="M12.5 7V4.5H4v11h8.5V13M8 10h9m0 0l-2.5-2.5M17 10l-2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>

              {/* Members row (tap a member for admin menu) */}
              <div className={styles.memberRow}>
                {members.map(m => (
                  <button
                    key={m.uid}
                    className={styles.memberChip}
                    onClick={() => isAdmin && m.uid !== you?.uid
                      ? setMemberMenu(memberMenu === m.uid ? null : m.uid)
                      : null}
                  >
                    <Avatar uid={m.uid} nick={m.nick} size={20}/>
                    <span className={styles.memberNick}>{m.nick}</span>
                    {m.isAdmin && <span className={styles.crown} title="Group admin">★</span>}
                    {m.muted && <span className={styles.mutedTag}>muted</span>}
                    {memberMenu === m.uid && isAdmin && (
                      <span className={styles.memberMenu} onClick={e => e.stopPropagation()}>
                        <button onClick={() => adminAction(m.muted ? 'unmute' : 'mute', m.uid)}>
                          {m.muted ? 'Unmute' : 'Mute'}
                        </button>
                        <button className={styles.danger} onClick={() => adminAction('kick', m.uid)}>Kick</button>
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Messages */}
              <div
                className={styles.msgList}
                ref={listRef}
                onScroll={e => {
                  const el = e.target
                  stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
                }}
              >
                {messages.map(m => m.system ? (
                  <div key={m.id} className={styles.sysMsg}>{m.text}</div>
                ) : (
                  <div key={m.id} className={`${styles.msg} ${m.uid === you?.uid ? styles.msgOwn : ''} ${m.goal ? styles.msgGoal : ''}`}>
                    {m.uid !== you?.uid && <Avatar uid={m.uid} nick={m.nick} size={24}/>}
                    <div className={styles.msgBody}>
                      {m.uid !== you?.uid && <span className={styles.msgNick}>{m.nick}</span>}
                      <div
                        className={`${styles.bubble} ${m.deleted ? styles.bubbleDeleted : ''}`}
                        onDoubleClick={() => !m.deleted && setReactFor(reactFor === m.id ? null : m.id)}
                      >
                        {m.goal && !m.deleted && <span className={styles.goalTag}>GOAL!</span>}
                        {m.text}
                        <span className={styles.bubbleActions}>
                          {!m.deleted && (
                            <button onClick={() => setReactFor(reactFor === m.id ? null : m.id)} aria-label="React">☺+</button>
                          )}
                          {isAdmin && !m.deleted && (
                            <button onClick={() => adminAction('deleteMessage', m.id)} aria-label="Delete message">✕</button>
                          )}
                        </span>
                      </div>
                      {/* Reactions */}
                      {Object.keys(m.reactions ?? {}).length > 0 && (
                        <div className={styles.reactRow}>
                          {Object.entries(m.reactions).map(([emoji, uids]) => (
                            <button
                              key={emoji}
                              className={`${styles.reactPill} ${uids.includes(you?.uid) ? styles.reactMine : ''}`}
                              onClick={() => react(m.id, emoji)}
                            >
                              {emoji} {uids.length}
                            </button>
                          ))}
                        </div>
                      )}
                      {reactFor === m.id && (
                        <div className={styles.reactBar}>
                          {REACTIONS.map(e => (
                            <button key={e} onClick={() => react(m.id, e)}>{e}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div className={styles.emptyChat}>Say hi — the chat is live. ⚽</div>
                )}
              </div>

              {error && <p className={styles.errorFloat}>{error}</p>}

              {/* Composer */}
              <div className={styles.composer}>
                <button className={styles.goalBtn} title="GOAL! blast"
                  onClick={() => send('⚽ GOOOOAL!', true)}>
                  GOAL!
                </button>
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text) } }}
                  placeholder={you?.muted ? 'You are muted' : 'Message…'}
                  disabled={you?.muted}
                  maxLength={300}
                />
                <button className={styles.emojiToggle} onClick={() => setShowEmoji(v => !v)} aria-label="Emojis">☺</button>
                <button className={styles.sendBtn} onClick={() => send(text)} disabled={!text.trim() || you?.muted} aria-label="Send">
                  <svg viewBox="0 0 20 20" fill="none"><path d="M3 10l14-7-4 7 4 7-14-7z" fill="currentColor"/></svg>
                </button>
              </div>
              {showEmoji && (
                <div className={styles.emojiTray}>
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => setText(t => `${t}${e}`)}>{e}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}

// Nickname input with a live initials preview circle
function NickInput() {
  const [v, setV] = useState('')
  return (
    <span className={styles.nickWrap}>
      <span className={styles.nickPfp} aria-hidden="true">{v ? initials(v) : '?'}</span>
      <input name="nickname" maxLength={24} required placeholder="e.g. Alex"
        value={v} onChange={e => setV(e.target.value)} autoComplete="off"/>
    </span>
  )
}
