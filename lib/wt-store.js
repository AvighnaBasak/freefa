// Watch Together server-side store.
//
// Storage: in-memory by default (fine for local + low-traffic Fluid Compute).
// Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN on Vercel to get a
// durable, multi-instance-safe store (free Upstash tier) with zero code change.
//
// Nothing in here is ever sent to the client except through the route
// handlers, which whitelist fields explicitly — password hashes, member
// tokens and IPs never leave the server.

import crypto from 'crypto'

/* ── Limits (anti-abuse) ── */
export const LIMITS = {
  MAX_MEMBERS: 30,
  MAX_MESSAGES: 200,          // ring buffer per group
  MAX_TEXT: 300,
  MAX_NICK: 24,
  MAX_GROUP_NAME: 32,
  GROUP_IDLE_MS: 6 * 3600e3,  // expire after 6h of silence
  GROUP_HARD_MS: 24 * 3600e3, // hard expiry 24h
}

/* ── Helpers ── */
export function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(`${salt}|${password}`).digest('hex')
}
export function newSalt()  { return crypto.randomBytes(8).toString('hex') }
export function newToken() { return crypto.randomBytes(24).toString('hex') }
export function newUid()   { return crypto.randomBytes(6).toString('hex') }
export function newMsgId() { return crypto.randomBytes(6).toString('hex') }

// Group IDs: 6 chars, unambiguous alphabet (no 0/O/1/I)
const ID_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function newGroupId() {
  const bytes = crypto.randomBytes(6)
  let id = ''
  for (let i = 0; i < 6; i++) id += ID_ALPHA[bytes[i] % ID_ALPHA.length]
  return id
}

// Strip control characters; rely on React escaping for the rest.
export function sanitizeText(s, max) {
  let out = ''
  for (const ch of String(s ?? '')) {
    const c = ch.codePointAt(0)
    if (c < 32 || c === 127) continue        // control chars
    if (c >= 0x200b && c <= 0x200f) continue // zero-width chars
    if (c >= 0x202a && c <= 0x202e) continue // bidi overrides
    out += ch
  }
  return out.trim().slice(0, max)
}

/* ── Storage adapters ── */

class MemoryStore {
  constructor() {
    // Survive HMR / route-module reloads within one process
    const g = globalThis
    g.__wtMem ??= { groups: new Map(), tokens: new Map() }
    this.mem = g.__wtMem
  }
  async getGroup(id)        { return this.mem.groups.get(id) ?? null }
  async setGroup(id, group) { this.mem.groups.set(id, group) }
  async delGroup(id)        { this.mem.groups.delete(id) }
  async getToken(token)     { return this.mem.tokens.get(token) ?? null }
  async setToken(token, v)  { this.mem.tokens.set(token, v) }
  async delToken(token)     { this.mem.tokens.delete(token) }
}

class UpstashStore {
  constructor(url, token) {
    this.url = url.replace(/\/$/, '')
    this.token = token
  }
  async cmd(...args) {
    const res = await fetch(`${this.url}/${args.map(encodeURIComponent).join('/')}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`upstash ${res.status}`)
    return (await res.json()).result
  }
  async getGroup(id) {
    const raw = await this.cmd('GET', `wt:g:${id}`)
    return raw ? JSON.parse(raw) : null
  }
  async setGroup(id, group) {
    await this.cmd('SET', `wt:g:${id}`, JSON.stringify(group), 'EX', String(Math.ceil(LIMITS.GROUP_HARD_MS / 1000)))
  }
  async delGroup(id) { await this.cmd('DEL', `wt:g:${id}`) }
  async getToken(token) {
    const raw = await this.cmd('GET', `wt:t:${token}`)
    return raw ? JSON.parse(raw) : null
  }
  async setToken(token, v) {
    await this.cmd('SET', `wt:t:${token}`, JSON.stringify(v), 'EX', String(Math.ceil(LIMITS.GROUP_HARD_MS / 1000)))
  }
  async delToken(token) { await this.cmd('DEL', `wt:t:${token}`) }
}

export function getStore() {
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = process.env
  if (url && token) {
    globalThis.__wtUpstash ??= new UpstashStore(url, token)
    return globalThis.__wtUpstash
  }
  return new MemoryStore()
}

/* ── Group lifecycle ── */

export function isExpired(group, now = Date.now()) {
  if (!group) return true
  if (group.closed) return true
  if (now - group.createdAt > LIMITS.GROUP_HARD_MS) return true
  if (now - (group.lastActivity ?? group.createdAt) > LIMITS.GROUP_IDLE_MS) return true
  return false
}

export function addSystemMessage(group, text) {
  group.messages.push({
    id: newMsgId(), system: true, text, ts: Date.now(), reactions: {},
  })
  if (group.messages.length > LIMITS.MAX_MESSAGES) {
    group.messages = group.messages.slice(-LIMITS.MAX_MESSAGES)
  }
}

/* ── Public projections — the ONLY shapes that reach the browser ── */

export function publicMember(uid, m, creatorUid) {
  return {
    uid,
    nick: m.nick,
    isAdmin: uid === creatorUid,
    muted: !!m.muted,
  }
}

export function publicGroup(group) {
  return {
    id: group.id,
    name: group.name,
    createdAt: group.createdAt,
    closed: !!group.closed,
    memberCount: Object.keys(group.members).length,
  }
}

/* ── Rate limiting (token bucket per key, in-process) ── */
// Per-instance limiting is the pragmatic choice on Fluid Compute: instances
// are reused across requests, and abusive bursts always land on one instance.

const buckets = (globalThis.__wtBuckets ??= new Map())

export function rateLimit(key, { capacity, refillPerSec }) {
  const now = Date.now()
  let b = buckets.get(key)
  if (!b) { b = { tokens: capacity, last: now }; buckets.set(key, b) }
  b.tokens = Math.min(capacity, b.tokens + ((now - b.last) / 1000) * refillPerSec)
  b.last = now
  if (b.tokens < 1) return false
  b.tokens -= 1
  // Opportunistic cleanup so the map can't grow unbounded
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now - v.last > 600e3) buckets.delete(k)
  }
  return true
}

export function clientIp(req) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'local'
  )
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  })
}
