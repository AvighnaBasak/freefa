// Watch Together: create / join groups.
// POST /api/wt  { action: 'create' | 'join', ... }

import {
  getStore, LIMITS, hashPassword, newSalt, newToken, newUid, newGroupId,
  sanitizeText, isExpired, addSystemMessage, publicGroup, publicMember,
  rateLimit, clientIp, json,
} from '@/lib/wt-store'

export async function POST(req) {
  const ip = clientIp(req)

  let body
  try { body = await req.json() } catch { return json({ error: 'Bad request' }, 400) }

  const action = body?.action
  if (action === 'create') return createGroup(body, ip)
  if (action === 'join')   return joinGroup(body, ip)
  return json({ error: 'Unknown action' }, 400)
}

async function createGroup(body, ip) {
  if (!rateLimit(`create:${ip}`, { capacity: 5, refillPerSec: 5 / 600 })) {
    return json({ error: 'Too many groups created — try again later.' }, 429)
  }

  const name     = sanitizeText(body.name, LIMITS.MAX_GROUP_NAME)
  const nick     = sanitizeText(body.nickname, LIMITS.MAX_NICK)
  const password = String(body.password ?? '')

  if (!name)                 return json({ error: 'Group name is required.' }, 422)
  if (!nick)                 return json({ error: 'Nickname is required.' }, 422)
  if (password.length < 4)   return json({ error: 'Password must be at least 4 characters.' }, 422)
  if (password.length > 64)  return json({ error: 'Password is too long.' }, 422)

  const store = getStore()
  const now   = Date.now()
  const id    = newGroupId()
  const salt  = newSalt()
  const uid   = newUid()
  const token = newToken()

  const group = {
    id, name, salt,
    passHash: hashPassword(password, salt),
    createdAt: now,
    lastActivity: now,
    creatorUid: uid,
    closed: false,
    members: { [uid]: { nick, joinedAt: now, muted: false, lastSeen: now } },
    messages: [],
  }
  addSystemMessage(group, `${nick} created the group`)

  await store.setGroup(id, group)
  await store.setToken(token, { gid: id, uid })

  return json({
    token, uid,
    group: publicGroup(group),
    members: [publicMember(uid, group.members[uid], uid)],
  })
}

async function joinGroup(body, ip) {
  if (!rateLimit(`join:${ip}`, { capacity: 10, refillPerSec: 10 / 600 })) {
    return json({ error: 'Too many join attempts — try again later.' }, 429)
  }

  const gid      = String(body.groupId ?? '').trim().toUpperCase()
  const nick     = sanitizeText(body.nickname, LIMITS.MAX_NICK)
  const password = String(body.password ?? '')

  if (!/^[A-Z2-9]{6}$/.test(gid)) return json({ error: 'Invalid group ID.' }, 422)
  if (!nick)                      return json({ error: 'Nickname is required.' }, 422)

  const store = getStore()
  const group = await store.getGroup(gid)

  if (!group || isExpired(group)) return json({ error: 'Group not found or expired.' }, 404)
  if (hashPassword(password, group.salt) !== group.passHash) {
    return json({ error: 'Wrong password.' }, 403)
  }
  if (Object.keys(group.members).length >= LIMITS.MAX_MEMBERS) {
    return json({ error: 'Group is full.' }, 409)
  }
  const nickTaken = Object.values(group.members).some(
    m => m.nick.toLowerCase() === nick.toLowerCase()
  )
  if (nickTaken) return json({ error: 'That nickname is taken in this group.' }, 409)

  const now   = Date.now()
  const uid   = newUid()
  const token = newToken()

  group.members[uid] = { nick, joinedAt: now, muted: false, lastSeen: now }
  group.lastActivity = now
  addSystemMessage(group, `${nick} joined`)

  await store.setGroup(gid, group)
  await store.setToken(token, { gid, uid })

  return json({
    token, uid,
    group: publicGroup(group),
    members: Object.entries(group.members).map(([id2, m]) =>
      publicMember(id2, m, group.creatorUid)
    ),
  })
}
