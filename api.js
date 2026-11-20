const { randomInt } = require('node:crypto')
const { createSessions, hashPassword, verifyPassword } = require('./security')

const OPEN = 'Inscrições Abertas'
const RUNNING = 'Em Andamento'
const FINISHED = 'Finalizado'
const asciiLower = value => value.replace(/[A-Z]/g, letter => letter.toLowerCase())
// SQLite NOCASE e lower() ignoram maiúsculas apenas no alfabeto ASCII.
function asciiFold(column) {
  return [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].reduce((sql, letter) =>
    'REPLACE(' + sql + ', ' + "'" + letter + "', '" + letter.toLowerCase() + "')", column)
}

const emailLookup = asciiFold('email') + ' COLLATE utf8mb4_0900_bin = ?'
const nicknameLookup = asciiFold('nickname') + ' COLLATE utf8mb4_0900_bin = ?'
const publicUser = 'id_usuario, nome, nickname, pontos_ranking, criado_em'

class RequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function check(condition, message, status = 400) {
  if (!condition) throw new RequestError(status, message)
}

function str(value, label, max, min = 1) {
  check(typeof value === 'string' && value.trim().length >= min && value.trim().length <= max,
    label + ' deve ter de ' + min + ' a ' + max + ' caracteres.')
  return value.trim()
}

function number(value, label, min, max) {
  check(Number.isSafeInteger(value) && value >= min && value <= max,
    label + ' deve ser um número inteiro entre ' + min + ' e ' + max + '.')
  return value
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

function createApi(db, options = {}) {
  const sessions = createSessions(options)
  const authAttempts = new Map()
  const routes = []
  const { get, all, run } = db
  const route = (method, pattern, action) => routes.push({ method, pattern, action })
  function mustLogin(req) {
    const id = sessions.user(req)
    check(id, 'Entre na sua conta para continuar.', 401)
    return id
  }
  function exists(row, label) {
    check(row, label + ' não encontrado(a).', 404)
    return row
  }
  function authLimit(req) {
    const now = Date.now()
    const ip = req.socket.remoteAddress
    for (const [key, value] of authAttempts) if (value.until <= now) authAttempts.delete(key)
    const attempts = authAttempts.get(ip) || { count: 0, until: now + 60_000 }
    check(attempts.count < 15, 'Aguarde um minuto antes de tentar novamente.', 429)
    attempts.count++
    authAttempts.set(ip, attempts)
  }
  const self = id => get('SELECT ' + publicUser + ', email FROM usuario WHERE id_usuario = ?', id)
  const team = async (id, query = db) => exists(await query.get('SELECT * FROM `time` WHERE id_time = ?', id), 'Time')
  const community = async (id, query = db) => exists(await query.get('SELECT * FROM comunidade WHERE id_comunidade = ?', id), 'Comunidade')
  const championship = async (id, query = db) => exists(await query.get('SELECT * FROM campeonato WHERE id_campeonato = ?', id), 'Campeonato')
  const countTeam = async (id, query = db) => (await query.get('SELECT count(*) AS total FROM membro_time WHERE fk_time_id_time = ?', id)).total
  const countCommunity = async (id, query = db) => (await query.get('SELECT count(*) AS total FROM membro_comunidade WHERE fk_comunidade_id_comunidade = ?', id)).total
  const subscriptions = (id, query = db) => query.all(`SELECT t.id_time, t.nome_time, t.tag FROM inscricao i JOIN \`time\` t ON t.id_time = i.fk_time_id_time
    WHERE i.fk_campeonato_id_campeonato = ? ORDER BY i.data_inscricao, t.id_time`, id)
  const matches = (id, query = db) => query.all(`SELECT p.*, t1.nome_time AS nome_time1, t2.nome_time AS nome_time2, t1.tag AS tag_time1, t2.tag AS tag_time2
    FROM partida p JOIN \`time\` t1 ON t1.id_time = p.id_time1 JOIN \`time\` t2 ON t2.id_time = p.id_time2
    WHERE p.fk_campeonato_id_campeonato = ? ORDER BY p.rodada, p.id_partida`, id)
  const ranking = `SELECT ${publicUser}, ROW_NUMBER() OVER (ORDER BY pontos_ranking DESC, criado_em ASC, id_usuario ASC) AS posicao FROM usuario`
  const activeTeam = (id, query = db) => query.get(`SELECT 1 FROM inscricao i JOIN campeonato c ON c.id_campeonato = i.fk_campeonato_id_campeonato
    WHERE i.fk_time_id_time = ? AND c.status = ?`, id, RUNNING)
  const enrolledMinimum = (id, query = db) => query.get(`SELECT 1 FROM inscricao i JOIN campeonato c ON c.id_campeonato = i.fk_campeonato_id_campeonato
    WHERE i.fk_time_id_time = ? AND c.status = ?`, id, OPEN)

  route('GET', /^\/api\/config$/, async () => ({ jogoParceiro: options.partner || 'https://itch.io/search?q=Nekomancia' }))
  route('GET', /^\/api\/auth\/sessao$/, async req => ({ usuario: await self(sessions.user(req)) || null }))
  route('POST', /^\/api\/auth\/sair$/, async (req, res) => {
    sessions.logout(req, res)
    return { usuario: null }
  })
  route('POST', /^\/api\/auth\/cadastro$/, async (req, res, body) => {
    authLimit(req)
    const nome = str(body.nome, 'Nome', 100)
    const nickname = str(body.nickname, 'Nickname', 50)
    const email = str(body.email, 'E-mail', 100).toLowerCase()
    check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Digite um e-mail válido.')
    check(typeof body.senha === 'string' && body.senha.length >= 8 && body.senha.length <= 128,
      'A senha deve ter entre 8 e 128 caracteres.')
    const hash = await hashPassword(body.senha)
    const id = await db.transaction(async tx => {
      check(!await tx.get('SELECT 1 FROM usuario WHERE ' + emailLookup + ' OR ' + nicknameLookup, email, asciiLower(nickname)),
        'E-mail ou nickname já cadastrado.', 409)
      return (await tx.run('INSERT INTO usuario (nome,nickname,email,senha_hash,pontos_ranking,criado_em) VALUES (?,?,?,?,0,UTC_TIMESTAMP())',
        nome, nickname, email, hash)).insertId
    })
    sessions.login(req, res, id)
    res.statusCode = 201
    return { usuario: await self(id) }
  })
  route('POST', /^\/api\/auth\/login$/, async (req, res, body) => {
    authLimit(req)
    const email = str(body.email, 'E-mail', 100).toLowerCase()
    check(typeof body.senha === 'string' && body.senha.length <= 128, 'E-mail ou senha inválidos.', 401)
    const user = await get('SELECT id_usuario, senha_hash FROM usuario WHERE ' + emailLookup, email)
    check(await verifyPassword(body.senha, user?.senha_hash), 'E-mail ou senha inválidos.', 401)
    sessions.login(req, res, user.id_usuario)
    return { usuario: await self(user.id_usuario) }
  })
  route('GET', /^\/api\/ranking$/, async () => all(ranking + ' ORDER BY posicao'))
  route('GET', /^\/api\/usuarios\/(\d+)\/perfil$/, async (_req, _res, _body, id) => {
    const usuario = exists(await get('SELECT * FROM (' + ranking + ') AS classificados WHERE id_usuario = ?', id), 'Jogador')
    const times = await all(`SELECT t.id_time,t.nome_time,t.tag FROM \`time\` t JOIN membro_time m ON m.fk_time_id_time=t.id_time
      WHERE m.fk_usuario_id_usuario=? ORDER BY t.nome_time`, id)
    const comunidades = await all(`SELECT c.id_comunidade,c.nome FROM comunidade c JOIN membro_comunidade m ON m.fk_comunidade_id_comunidade=c.id_comunidade
      WHERE m.fk_usuario_id_usuario=? ORDER BY c.nome`, id)
    const partidas = await all(`SELECT p.id_partida,p.rodada,p.placar_time1,p.placar_time2,p.id_vencedor,c.id_campeonato,c.nome AS campeonato,
      t1.nome_time AS time1,t2.nome_time AS time2,
      CASE WHEN EXISTS (SELECT 1 FROM membro_time m WHERE m.fk_usuario_id_usuario=? AND m.fk_time_id_time=p.id_vencedor)
        THEN 'Vitória' ELSE 'Derrota' END AS resultado
      FROM partida p JOIN campeonato c ON c.id_campeonato=p.fk_campeonato_id_campeonato
      JOIN \`time\` t1 ON t1.id_time=p.id_time1 JOIN \`time\` t2 ON t2.id_time=p.id_time2
      WHERE p.id_vencedor IS NOT NULL AND EXISTS (SELECT 1 FROM membro_time m WHERE m.fk_usuario_id_usuario=?
        AND m.fk_time_id_time IN (p.id_time1,p.id_time2)) ORDER BY c.data_inicio DESC,p.rodada DESC,p.id_partida DESC`, id, id)
    return { usuario, times, comunidades, partidas }
  })

  route('GET', /^\/api\/times$/, async () => all(`SELECT t.*, u.nickname AS capitao,
    (SELECT count(*) FROM membro_time m WHERE m.fk_time_id_time=t.id_time) AS membros
    FROM \`time\` t JOIN usuario u ON u.id_usuario=t.id_capitao ORDER BY t.nome_time`))
  route('GET', /^\/api\/times\/(\d+)$/, async (_req, _res, _body, id) => ({
    ...await team(id), membros: await all(`SELECT u.id_usuario,u.nickname FROM usuario u JOIN membro_time m
      ON m.fk_usuario_id_usuario=u.id_usuario WHERE m.fk_time_id_time=? ORDER BY u.nickname`, id)
  }))
  route('POST', /^\/api\/times$/, async (req, res, body) => {
    const user = mustLogin(req)
    const nome = str(body.nome_time, 'Nome do time', 100)
    const tag = str(body.tag, 'Tag', 10).toUpperCase()
    const min = number(body.min_jogadores, 'Mínimo de jogadores', 2, 4)
    const max = number(body.max_jogadores, 'Máximo de jogadores', min, 10)
    const id = await db.transaction(async tx => {
      const { insertId: id } = await tx.run('INSERT INTO `time`(nome_time,tag,min_jogadores,max_jogadores,id_capitao,criado_em) VALUES (?,?,?,?,?,UTC_TIMESTAMP())',
        nome, tag, min, max, user)
      await tx.run('INSERT INTO membro_time(fk_time_id_time,fk_usuario_id_usuario,data_ingresso) VALUES (?,?,UTC_TIMESTAMP())', id, user)
      return id
    })
    res.statusCode = 201
    return team(id)
  })
  route('POST', /^\/api\/times\/(\d+)\/membros$/, async (req, _res, body, id) => {
    const user = mustLogin(req)
    const nickname = str(body.nickname, 'Nickname', 50)
    return db.transaction(async tx => {
      const row = await team(id, tx)
      check(row.id_capitao === user, 'Apenas o capitão pode editar o elenco.', 403)
      check(!(await activeTeam(id, tx)), 'O elenco fica bloqueado durante um campeonato em andamento.', 409)
      check((await countTeam(id, tx)) < row.max_jogadores, 'O time atingiu o limite de jogadores.', 409)
      const member = exists(await tx.get('SELECT id_usuario,nickname FROM usuario WHERE ' + nicknameLookup, asciiLower(nickname)), 'Jogador')
      await tx.run('INSERT INTO membro_time(fk_time_id_time,fk_usuario_id_usuario,data_ingresso) VALUES (?,?,UTC_TIMESTAMP())', id, member.id_usuario)
      return member
    })
  })
  route('DELETE', /^\/api\/times\/(\d+)\/membros\/(\d+)$/, async (req, _res, _body, id, member) => {
    const user = mustLogin(req)
    return db.transaction(async tx => {
      const row = await team(id, tx)
      check(row.id_capitao === user, 'Apenas o capitão pode editar o elenco.', 403)
      check(member !== user, 'O capitão precisa permanecer no time.', 409)
      check(!(await activeTeam(id, tx)), 'O elenco fica bloqueado durante um campeonato em andamento.', 409)
      check(!(await enrolledMinimum(id, tx)) || (await countTeam(id, tx)) > row.min_jogadores,
        'A remoção deixaria o time abaixo do mínimo exigido para a inscrição.', 409)
      const removed = await tx.run('DELETE FROM membro_time WHERE fk_time_id_time=? AND fk_usuario_id_usuario=?', id, member)
      check(removed.affectedRows, 'Jogador não encontrado no time.', 404)
      return { removido: true }
    })
  })

  route('GET', /^\/api\/comunidades$/, async () => all(`SELECT c.*,
    (SELECT count(*) FROM membro_comunidade m WHERE m.fk_comunidade_id_comunidade=c.id_comunidade) AS membros
    FROM comunidade c ORDER BY c.nome`))
  const membership = async (id, user, query = db) => Boolean(await query.get('SELECT 1 FROM membro_comunidade WHERE fk_comunidade_id_comunidade=? AND fk_usuario_id_usuario=?', id, user))
  async function joinCommunity(tx, id, user) {
    const row = await community(id, tx)
    if (await membership(id, user, tx)) return { membro: true }
    check(row.max_membros == null || await countCommunity(id, tx) < row.max_membros, 'A comunidade atingiu o limite de membros.', 409)
    await tx.run('INSERT INTO membro_comunidade(fk_comunidade_id_comunidade,fk_usuario_id_usuario,data_ingresso) VALUES (?,?,UTC_TIMESTAMP())', id, user)
    return { membro: true }
  }
  route('GET', /^\/api\/comunidades\/(\d+)$/, async (req, _res, _body, id) => ({
    ...await community(id), membros: await countCommunity(id), membro: await membership(id, sessions.user(req))
  }))
  route('POST', /^\/api\/comunidades$/, async (req, res, body) => {
    const user = mustLogin(req)
    const nome = str(body.nome, 'Nome da comunidade', 100)
    const descricao = typeof body.descricao === 'string' && body.descricao.trim() ? str(body.descricao, 'Descrição', 1000) : null
    const max = number(body.max_membros, 'Limite de membros', 1, 10000)
    const id = await db.transaction(async tx => {
      const { insertId: id } = await tx.run('INSERT INTO comunidade(nome,descricao,min_membros,max_membros,id_criador,criado_em) VALUES (?,?,1,?,?,UTC_TIMESTAMP())',
        nome, descricao, max, user)
      await joinCommunity(tx, id, user)
      return id
    })
    res.statusCode = 201
    return community(id)
  })
  route('POST', /^\/api\/comunidades\/(\d+)\/entrar$/, async (req, _res, _body, id) =>
    db.transaction(tx => joinCommunity(tx, id, mustLogin(req))))
  route('GET', /^\/api\/comunidades\/(\d+)\/mensagens$/, async (_req, _res, _body, id) => {
    await community(id)
    return all(`SELECT * FROM (SELECT m.id_mensagem,m.conteudo,m.enviado_em,u.id_usuario,u.nickname
      FROM mensagem_chat m JOIN usuario u ON u.id_usuario=m.fk_usuario_id_usuario
      WHERE m.fk_comunidade_id_comunidade=? ORDER BY m.id_mensagem DESC LIMIT 100) AS recentes ORDER BY id_mensagem`, id)
  })
  route('POST', /^\/api\/comunidades\/(\d+)\/mensagens$/, async (req, res, body, id) => {
    const user = mustLogin(req)
    const content = str(body.conteudo, 'Mensagem', 2000)
    await community(id)
    check(await membership(id, user), 'Entre na comunidade para enviar mensagens.', 403)
    const inserted = await run('INSERT INTO mensagem_chat(conteudo,fk_usuario_id_usuario,fk_comunidade_id_comunidade,enviado_em) VALUES (?,?,?,UTC_TIMESTAMP())',
      content, user, id)
    res.statusCode = 201
    return { id_mensagem: inserted.insertId }
  })

  route('GET', /^\/api\/campeonatos$/, async () => all(`SELECT c.*,
    (SELECT count(*) FROM inscricao i WHERE i.fk_campeonato_id_campeonato=c.id_campeonato) AS inscritos
    FROM campeonato c ORDER BY c.data_inicio DESC,c.id_campeonato DESC`))
  route('GET', /^\/api\/campeonatos\/(\d+)$/, async (_req, _res, _body, id) => ({
    ...await championship(id), inscritos: await subscriptions(id), partidas: await matches(id)
  }))
  route('POST', /^\/api\/campeonatos$/, async (req, res, body) => {
    const user = mustLogin(req)
    const nome = str(body.nome, 'Nome do campeonato', 100)
    // A coluna jogo é obrigatória no esquema original.
    const jogo = 'Não informado'
    const min = number(body.min_times, 'Mínimo de times', 8, 14)
    const max = number(body.max_times, 'Máximo de times', min, 16)
    check(typeof body.data_inicio === 'string' && Number.isFinite(Date.parse(body.data_inicio)), 'Informe a data de início.')
    const date = new Date(body.data_inicio).toISOString().slice(0, 19).replace('T', ' ')
    const { insertId: id } = await run(`INSERT INTO campeonato(nome,jogo,min_times,max_times,formato,data_inicio,status,id_organizador)
      VALUES (?,?,?,?,?,?,?,?)`, nome, jogo, min, max, 'Mata-Mata (Eliminação Simples)', date, OPEN, user)
    res.statusCode = 201
    return championship(id)
  })
  route('POST', /^\/api\/campeonatos\/(\d+)\/inscricoes$/, async (req, _res, body, id) => {
    const user = mustLogin(req)
    const teamId = number(body.id_time, 'Time', 1, Number.MAX_SAFE_INTEGER)
    return db.transaction(async tx => {
      const row = await championship(id, tx)
      const squad = await team(teamId, tx)
      check(squad.id_capitao === user, 'Apenas o capitão pode inscrever o time.', 403)
      check(row.status === OPEN, 'As inscrições estão encerradas.', 409)
      check((await subscriptions(id, tx)).length < row.max_times, 'O campeonato atingiu o limite de times.', 409)
      check((await countTeam(teamId, tx)) >= squad.min_jogadores, 'O elenco ainda não atingiu o mínimo de jogadores.', 409)
      await tx.run('INSERT INTO inscricao(fk_campeonato_id_campeonato,fk_time_id_time,data_inscricao) VALUES (?,?,UTC_TIMESTAMP())', id, teamId)
      return { inscrito: true }
    })
  })
  function createMatch(tx, championshipId, round, a, b, previous = null) {
    return tx.run(`INSERT INTO partida(rodada,fk_partida_id_partida,fk_campeonato_id_campeonato,id_time1,id_time2)
      VALUES (?,?,?,?,?)`, round, previous, championshipId, a, b)
  }
  route('POST', /^\/api\/campeonatos\/(\d+)\/iniciar$/, async (req, _res, _body, id) => {
    const user = mustLogin(req)
    return db.transaction(async tx => {
      const row = await championship(id, tx)
      check(user === row.id_organizador, 'Apenas o organizador pode iniciar.', 403)
      check(row.status === OPEN && !(await matches(id, tx)).length, 'O campeonato já foi iniciado.', 409)
      const teams = shuffle((await subscriptions(id, tx)).map(t => t.id_time))
      check(teams.length >= Math.max(2, row.min_times || 2), 'Ainda não há times suficientes.', 409)
      // Na primeira rodada somente os jogos necessários para chegar à próxima potência de dois.
      const base = 2 ** Math.floor(Math.log2(teams.length))
      const games = teams.length === base ? base / 2 : teams.length - base
      for (let i = 0; i < games * 2; i += 2) await createMatch(tx, id, 1, teams[i], teams[i + 1])
      await tx.run('UPDATE campeonato SET status=? WHERE id_campeonato=?', RUNNING, id)
      return { status: RUNNING }
    })
  })
  function award(tx, teamId, points) {
    return tx.run(`UPDATE usuario SET pontos_ranking=coalesce(pontos_ranking,0)+?
      WHERE id_usuario IN (SELECT fk_usuario_id_usuario FROM membro_time WHERE fk_time_id_time=?)`, points, teamId)
  }
  route('PUT', /^\/api\/partidas\/(\d+)\/placar$/, async (req, _res, body, id) => {
    const user = mustLogin(req)
    const a = number(body.placar_time1, 'Placar do primeiro time', 0, 999)
    const b = number(body.placar_time2, 'Placar do segundo time', 0, 999)
    check(a !== b, 'O mata-mata exige um vencedor. Informe um placar sem empate.')
    return db.transaction(async tx => {
      const game = exists(await tx.get('SELECT * FROM partida WHERE id_partida=?', id), 'Partida')
      const cupId = game.fk_campeonato_id_campeonato
      const cup = await championship(cupId, tx)
      check(cup.id_organizador === user, 'Apenas o organizador pode registrar placares.', 403)
      check(cup.status === RUNNING && game.id_vencedor == null, 'A partida já tem resultado ou o campeonato está encerrado.', 409)
      check(!await tx.get('SELECT 1 FROM partida WHERE fk_campeonato_id_campeonato=? AND rodada<? AND id_vencedor IS NULL', cupId, game.rodada),
        'Conclua a rodada anterior antes de registrar este placar.', 409)
      const winner = a > b ? game.id_time1 : game.id_time2
      await tx.run('UPDATE partida SET placar_time1=?,placar_time2=?,id_vencedor=? WHERE id_partida=?', a, b, winner, id)
      await award(tx, winner, 25)
      const games = await matches(cupId, tx)
      const round = games.filter(p => p.rodada === game.rodada)
      if (round.every(p => p.id_vencedor != null) && !games.some(p => p.rodada > game.rodada)) {
        const advancing = round.map(p => ({ id: p.id_vencedor, previous: p.id_partida }))
        if (game.rodada === 1) {
          const played = new Set(round.flatMap(p => [p.id_time1, p.id_time2]))
          for (const t of (await subscriptions(cupId, tx))) if (!played.has(t.id_time)) advancing.push({ id: t.id_time, previous: null })
        }
        if (advancing.length === 1) {
          await award(tx, winner, 100)
          await tx.run('UPDATE campeonato SET status=? WHERE id_campeonato=?', FINISHED, cupId)
        } else {
          check(advancing.length % 2 === 0, 'O chaveamento existente tem uma rodada inconsistente.', 409)
          for (let i = 0; i < advancing.length; i += 2) {
            const [first, second] = advancing.slice(i, i + 2)
            await createMatch(tx, cupId, game.rodada + 1, first.id, second.id, first.previous ?? second.previous)
          }
        }
      }
      return { id_vencedor: winner, status: (await championship(cupId, tx)).status }
    })
  })

  return async function api(req, res, path, readBody) {
    const entry = routes.find(r => r.method === req.method && r.pattern.test(path))
    if (!entry) throw new RequestError(404, 'Rota não encontrada.')
    const params = path.match(entry.pattern).slice(1).map(Number)
    check(params.every(n => Number.isSafeInteger(n) && n > 0), 'Identificador inválido.')
    const writes = ['POST', 'PUT', 'DELETE'].includes(req.method)
    if (writes) {
      const origin = req.headers.origin
      const localOrigin = options.origin || (options.secure ? 'https://' : 'http://') + req.headers.host
      check(!origin || origin === localOrigin, 'Origem da requisição inválida.', 403)
      check(req.headers['sec-fetch-site'] !== 'cross-site', 'Origem da requisição inválida.', 403)
    }
    const body = ['POST', 'PUT'].includes(req.method) ? await readBody(req) : {}
    try {
      return await entry.action(req, res, body, ...params)
    } catch (error) {
      if (error.code === 'RIVALS_DB_BUSY') throw new RequestError(503, error.message)
      if (error.code === 'ER_DUP_ENTRY') throw new RequestError(409, 'Este registro já existe.')
      if (['ER_NO_REFERENCED_ROW_2', 'ER_ROW_IS_REFERENCED_2'].includes(error.code)) throw new RequestError(409, 'O registro relacionado não está disponível.')
      throw error
    }
  }
}

module.exports = { createApi, RequestError }
