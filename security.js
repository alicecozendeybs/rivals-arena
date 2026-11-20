const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto')
const { promisify } = require('node:util')
const derive = promisify(scrypt)
const cost = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }

async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const key = await derive(password, salt, 64, cost)
  return 'scrypt$' + salt + '$' + key.toString('hex')
}

async function verifyPassword(password, stored) {
  const match = /^scrypt\$([\da-f]{32})\$([\da-f]{128})$/.exec(stored || '')
  const candidate = await hashPassword(password, match?.[1] || '0'.repeat(32))
  return Boolean(match) && timingSafeEqual(Buffer.from(candidate), Buffer.from(stored))
}

function createSessions({ secure = false } = {}) {
  const sessions = new Map()
  const lifetime = 8 * 60 * 60
  const cookieName = 'rivals_sessao'
  const attrs = '; Path=/; HttpOnly; SameSite=Lax' + (secure ? '; Secure' : '')
  function token(req) {
    return /(?:^|;\s*)rivals_sessao=([a-f\d]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1]
  }
  return {
    user(req) {
      const value = token(req)
      const session = sessions.get(value)
      if (session?.expires > Date.now()) return session.id
      sessions.delete(value)
      return null
    },
    login(req, res, id) {
      sessions.delete(token(req))
      for (const [key, session] of sessions) if (session.expires <= Date.now()) sessions.delete(key)
      const value = randomBytes(32).toString('hex')
      sessions.set(value, { id, expires: Date.now() + lifetime * 1000 })
      res.setHeader('Set-Cookie', cookieName + '=' + value + attrs + '; Max-Age=' + lifetime)
    },
    logout(req, res) {
      sessions.delete(token(req))
      res.setHeader('Set-Cookie', cookieName + '=' + attrs + '; Max-Age=0')
    }
  }
}

module.exports = { createSessions, hashPassword, verifyPassword }
