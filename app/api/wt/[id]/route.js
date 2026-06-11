// Watch Together: per-group operations. Every call requires a member token
// (sent via x-wt-token header) which is validated against the server store —
// group passwords and other members' tokens are never exposed.
//
//   GET    /api/wt/:id?since=<ts>           poll messages + members
//   POST   /api/wt/:id  { type: 'message' | 'react' | 'admin' | 'leave', ... }

import {
  getStore, LIMITS, sanitizeText, isExpired, addSystemMessage,
  publicGroup, publicMember, newMsgId, rateLimit, clientIp, json,
} from '@/lib/wt-store'

// Emojis allowed as message reactions
const REACTION_SET = new Set(['⚽', '🔥', '😂', '😱', '👏', '❤️', '🟨', '🟥', '🧤', '🐐'])

async function auth(req, gid) {
  const token = req.headers.get('x-wt-token') ?? ''
  if (!token || token.length > 64) return { error: json({ error: 'Not authorized.' }, 401) }
  const store = getStore()
  const session = await store.getToken(token)
  if (!session || session.gid !== gid) return { error: json({ error: 'Not authorized.' }, 401) }
  const group = await store.getGroup(gid)
  if (!group || isExpired(group)) return { error: json({ error: 'Group not found or expired.' }, 404) }
  const member = group.members[session.uid]
  if (!member) return { error: json({ error: 'You were removed from this group.' }, 403) }
  return { store, group, uid: session.uid, member, token }
}

function snapshot(group, uid, since) {
  return {
    group: publicGroup(group),
    you: {
      uid,
      isAdmin: uid === group.creatorUid,
      muted: !!group.members[uid]?.muted,
    },
    members: Object.entries(group.members).map(([id, m]) =>
      publicMember(id, m, group.creatorUid)
    ),
    messages: group.messages.filter(m => m.ts > since),
    now: Date.now(),
  }
}

export async function GET(req, ctx) {
  const { id } = await ctx.params
  const gid = String(id).toUpperCase()

  if (!rateLimit(`poll:${clientIp(req)}`, { capacity: 30, refillPerSec: 1 })) {
    return json({ error: 'Slow down.' }, 429)
  }

  const a = await auth(req, gid)
  if (a.error) return a.error

  const since = Number(new URL(req.url).searchParams.get('since') ?? 0) || 0
  a.member.lastSeen = Date.now()
  await a.store.setGroup(gid, a.group)

  return json(snapshot(a.group, a.uid, since))
}

export async function POST(req, ctx) {
  const { id } = await ctx.params
  const gid = String(id).toUpperCase()
  const ip = clientIp(req)

  let body
  try { body = await req.json() } catch { return json({ error: 'Bad request' }, 400) }

  const a = await auth(req, gid)
  if (a.error) return a.error
  const { store, group, uid, member } = a
  const now = Date.now()

  switch (body?.type) {

    case 'message': {
      if (!rateLimit(`msg:${a.token}`, { capacity: 5, refillPerSec: 1.2 })) {
        return json({ error: 'You are sending messages too fast.' }, 429)
      }
      if (member.muted) return json({ error: 'You are muted by the group admin.' }, 403)
      const text = sanitizeText(body.text, LIMITS.MAX_TEXT)
      if (!text) return json({ error: 'Empty message.' }, 422)
      group.messages.push({
        id: newMsgId(), uid, nick: member.nick, text, ts: now,
        reactions: {},
        goal: body.goal === true, // "GOAL!" blast styling
      })
      if (group.messages.length > LIMITS.MAX_MESSAGES) {
        group.messages = group.messages.slice(-LIMITS.MAX_MESSAGES)
      }
      break
    }

    case 'react': {
      if (!rateLimit(`react:${a.token}`, { capacity: 10, refillPerSec: 1 })) {
        return json({ error: 'Slow down.' }, 429)
      }
      const emoji = String(body.emoji ?? '')
      if (!REACTION_SET.has(emoji)) return json({ error: 'Unsupported reaction.' }, 422)
      const msg = group.messages.find(m => m.id === body.msgId)
      if (!msg) return json({ error: 'Message not found.' }, 404)
      msg.reactions ??= {}
      const users = new Set(msg.reactions[emoji] ?? [])
      users.has(uid) ? users.delete(uid) : users.add(uid) // toggle
      if (users.size) msg.reactions[emoji] = [...users]
      else delete msg.reactions[emoji]
      break
    }

    case 'admin': {
      if (uid !== group.creatorUid) return json({ error: 'Admin only.' }, 403)
      const target = String(body.target ?? '')
      switch (body.action) {
        case 'kick': {
          const t = group.members[target]
          if (!t || target === uid) return json({ error: 'Invalid target.' }, 422)
          delete group.members[target]
          addSystemMessage(group, `${t.nick} was removed by the admin`)
          break
        }
        case 'mute':
        case 'unmute': {
          const t = group.members[target]
          if (!t || target === uid) return json({ error: 'Invalid target.' }, 422)
          t.muted = body.action === 'mute'
          addSystemMessage(group, `${t.nick} was ${t.muted ? 'muted' : 'unmuted'} by the admin`)
          break
        }
        case 'deleteMessage': {
          const i = group.messages.findIndex(m => m.id === target)
          if (i === -1) return json({ error: 'Message not found.' }, 404)
          group.messages[i] = {
            ...group.messages[i],
            text: '⊘ message removed by admin', deleted: true, reactions: {},
          }
          break
        }
        case 'close': {
          group.closed = true
          addSystemMessage(group, 'The group was closed by the admin')
          break
        }
        default:
          return json({ error: 'Unknown admin action.' }, 400)
      }
      break
    }

    case 'leave': {
      const nick = member.nick
      delete group.members[uid]
      await store.delToken(a.token)
      if (uid === group.creatorUid || Object.keys(group.members).length === 0) {
        group.closed = true
        addSystemMessage(group, `${nick} (admin) left — group closed`)
      } else {
        addSystemMessage(group, `${nick} left`)
      }
      group.lastActivity = now
      await store.setGroup(gid, group)
      return json({ ok: true })
    }

    default:
      return json({ error: 'Unknown type.' }, 400)
  }

  group.lastActivity = now
  member.lastSeen = now
  await store.setGroup(gid, group)
  return json(snapshot(group, uid, Number(body.since ?? 0) || 0))
}
