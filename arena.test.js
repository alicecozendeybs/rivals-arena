const assert = require('node:assert/strict')
const { createHash, randomBytes } = require('node:crypto')
const { once } = require('node:events')
const { readFileSync } = require('node:fs')
const { createServer } = require('node:http')
const mysql = require('mysql2/promise')
const { DatabaseSync } = require('node:sqlite')
const { test } = require('node:test')
const { openDatabase, settings } = require('./database')
const { init, seed, sourcePath } = require('./scripts/db')
const { createHandler } = require('./server')

test('Integração com MySQL em um esquema temporário', { skip: process.env.TEST_MYSQL !== '1' }, async t => {
  const config = { ...settings(), database: 'rivals_anexo_test_' + randomBytes(8).toString('hex') }
  const { database, ...adminConfig } = config
  const admin = await mysql.createConnection(adminConfig)
  let db, server
  t.after(async () => {
    try {
      if (server?.listening) {
        server.closeAllConnections()
        await new Promise(resolve => server.close(resolve))
      }
      if (db) await db.close()
    } finally {
      try { await admin.query('DROP DATABASE IF EXISTS ??', [database]) }
      finally { await admin.end() }
    }
  })
  await init(config)
  await init(config)
  const official = sourcePath(process.env.SQLITE_PATH)
  assert.ok(official, 'Defina SQLITE_PATH para testar a importação do banco original.')
  const digest = () => createHash('sha256').update(readFileSync(official)).digest('hex')
  const original = digest()
  const counts = await seed(config, official)
  await assert.rejects(seed(config, official), /já contém dados/)
  db = await openDatabase(config)
  const source = new DatabaseSync(official, { readOnly: true })
  try {
    for (const [table, expectedCount] of Object.entries(counts)) {
      const expected = source.prepare('SELECT * FROM "' + table + '"').all()
      const actual = await db.all('SELECT * FROM ' + admin.escapeId(table))
      const canonical = rows => rows.map(row => JSON.stringify(row)).sort()
      assert.equal(actual.length, expectedCount, table)
      assert.ok(JSON.stringify(canonical(actual)) === JSON.stringify(canonical(expected)), table + ' diverge do SQLite')
    }
  } finally {
    source.close()
  }
  const app = require('express')()
  app.use(createHandler(db))
  server = createServer(app)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = 'http://127.0.0.1:' + server.address().port

  async function call(route, { body, cookie, method, expect = 200 } = {}) {
    const headers = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (cookie) headers.Cookie = cookie
    const response = await fetch(base + '/api' + route, {
      method: method || (body === undefined ? 'GET' : 'POST'), headers, body: body === undefined ? undefined : JSON.stringify(body)
    })
    const data = await response.json()
    assert.equal(response.status, expect, route + ' ' + JSON.stringify(data))
    return { data, cookie: response.headers.get('set-cookie')?.split(';')[0] }
  }
  for (const page of ['/', '/times', '/comunidades/1', '/chat.html', '/ranking', '/campeonatos', '/js/app.js']) {
    assert.equal((await fetch(base + page)).status, 200, page)
  }
  const first = (await call('/ranking')).data
  assert.ok(first.length > 0)
  assert.equal(first[0].posicao, 1)
  assert.ok(first.every((u, i) => i === 0 || Number(first[i - 1].pontos_ranking) >= Number(u.pontos_ranking)))
  assert.ok(first.every(u => !('email' in u) && !('senha_hash' in u)))
  const profile = (await call('/usuarios/' + first[0].id_usuario + '/perfil')).data
  assert.ok(Array.isArray(profile.partidas) && Array.isArray(profile.times))

  const originalAccount = await db.get("SELECT email,senha_hash FROM usuario WHERE senha_hash NOT LIKE 'scrypt$%' LIMIT 1")
  if (originalAccount) await call('/auth/login', { body: { email: originalAccount.email, senha: originalAccount.senha_hash }, expect: 401 })
  const prefix = 'QA-' + Date.now()
  const account = { nome: 'Teste Arena', nickname: prefix, email: prefix + '@example.test', senha: 'arena-teste-942!' }
  const user = await call('/auth/cadastro', { body: account, expect: 201 })
  assert.ok(user.cookie)
  const uid = user.data.usuario.id_usuario
  const hashed = (await db.get('SELECT senha_hash FROM usuario WHERE id_usuario=?', uid)).senha_hash
  assert.match(hashed, /^scrypt\$/)
  assert.equal((await call('/auth/sessao', { cookie: user.cookie })).data.usuario.id_usuario, uid)
  await call('/auth/cadastro', { body: account, expect: 409 })
  await call('/auth/login', { body: { email: account.email, senha: 'incorrect' }, expect: 401 })
  const { cookie } = await call('/auth/login', { body: account })
  const newUser = await call('/auth/cadastro', { body: { ...account, nickname: prefix + '-2', email: 'dois-' + account.email }, expect: 201 })
  const visitor = newUser.cookie

  const teamIds = []
  for (let i = 0; i < 9; i++) {
    const { data } = await call('/times', { body: { nome_time: prefix + ' Squad ' + i, tag: 'T' + prefix.slice(-6) + i, min_jogadores: 2, max_jogadores: 10 }, cookie, expect: 201 })
    teamIds.push(data.id_time)
  }
  await call('/times', { body: { nome_time: prefix, tag: 'INV', min_jogadores: 4, max_jogadores: 3 }, cookie, expect: 400 })
  const team = teamIds[0]
  assert.equal((await call('/times/' + team)).data.membros.length, 1)
  await call('/times/' + team + '/membros', { body: { nickname: newUser.data.usuario.nickname }, cookie: visitor, expect: 403 })
  await call('/times/' + team + '/membros', { body: { nickname: newUser.data.usuario.nickname }, cookie })
  await call('/times/' + team + '/membros/' + newUser.data.usuario.id_usuario, { method: 'DELETE', cookie })
  assert.equal((await call('/times/' + team)).data.membros.length, 1)

  const { data: community } = await call('/comunidades', { body: { nome: prefix, descricao: 'Chat de teste', max_membros: 2 }, cookie, expect: 201 })
  const chat = '/comunidades/' + community.id_comunidade
  await call(chat + '/mensagens', { body: { conteudo: 'Olá' }, cookie: visitor, expect: 403 })
  await call(chat + '/entrar', { body: {}, cookie: visitor })
  await call(chat + '/entrar', { body: {}, cookie: visitor })
  await call(chat + '/mensagens', { body: { conteudo: 'Olá' }, cookie: visitor, expect: 201 })
  assert.equal((await call(chat + '/mensagens')).data[0].conteudo, 'Olá')

  for (const id of teamIds) await call('/times/' + id + '/membros', { body: { nickname: newUser.data.usuario.nickname }, cookie })
  await call('/campeonatos', { body: { nome: prefix, min_times: 14, max_times: 13, data_inicio: '2027-01-01T20:00:00Z' }, cookie, expect: 400 })
  const { data: tournament } = await call('/campeonatos', { body: {
    nome: prefix, min_times: 8, max_times: 9, data_inicio: '2027-01-01T20:00:00Z'
  }, cookie, expect: 201 })
  assert.equal(tournament.jogo, 'Não informado')
  const cup = '/campeonatos/' + tournament.id_campeonato
  await call(cup + '/iniciar', { body: {}, cookie, expect: 409 })
  await call(cup + '/inscricoes', { body: { id_time: team }, cookie: visitor, expect: 403 })
  for (const id of teamIds) await call(cup + '/inscricoes', { body: { id_time: id }, cookie })
  await call(cup + '/iniciar', { body: {}, cookie })
  assert.equal((await call(cup)).data.partidas.length, 1)
  const score = { placar_time1: 13, placar_time2: 8 }
  for (const [round, gamesExpected] of [[1, 1], [2, 4], [3, 2], [4, 1]]) {
    const games = (await call(cup)).data.partidas.filter(m => m.rodada === round)
    assert.equal(games.length, gamesExpected)
    await Promise.all(games.map(async game => {
      const route = '/partidas/' + game.id_partida + '/placar'
      await call(route, { method: 'PUT', body: score, cookie: visitor, expect: 403 })
      await call(route, { method: 'PUT', body: { placar_time1: 8, placar_time2: 8 }, cookie, expect: 400 })
      await call(route, { method: 'PUT', body: score, cookie })
      await call(route, { method: 'PUT', body: score, cookie, expect: 409 })
    }))
  }
  assert.equal((await call(cup)).data.status, 'Finalizado')
  const finish = (await call('/usuarios/' + uid + '/perfil')).data
  assert.equal(finish.usuario.pontos_ranking, 300)
  assert.equal(finish.partidas.length, 8)
  await call('/auth/sair', { body: {}, cookie })
  assert.equal((await call('/auth/sessao', { cookie })).data.usuario, null)
  assert.equal(digest(), original)
})
