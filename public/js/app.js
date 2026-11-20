const main = document.querySelector('main')
const nav = document.querySelector('.navigation')
const menuButton = document.querySelector('.menu-toggle')
const overlay = document.querySelector('.menu-overlay')
const currentPath = location.pathname.replace(/\/$/, '') || '/'
const [, , routeId] = currentPath.split('/')
const id = routeId || new URLSearchParams(location.search).get('id')
const section = document.body.dataset.page === 'inicio' ? '' : document.body.dataset.page
const activeSection = ['jogadores'].includes(section) ? '/ranking'
  : ['login', 'cadastro', 'esqueci-a-senha'].includes(section) ? '/conta' : '/' + section

function toggleMenu(open) {
  nav.classList.toggle('is-open', open)
  overlay.hidden = !open
  menuButton.setAttribute('aria-expanded', String(open))
  if (open) nav.querySelector('.menu-close').focus()
  else menuButton.focus()
}
menuButton.addEventListener('click', () => toggleMenu(true))
nav.querySelector('.menu-close').addEventListener('click', () => toggleMenu(false))
overlay.addEventListener('click', () => toggleMenu(false))
document.addEventListener('keydown', event => {
  if (!nav.classList.contains('is-open')) return
  if (event.key === 'Escape') toggleMenu(false)
  if (event.key === 'Tab') {
    const links = [...nav.querySelectorAll('button, a')]
    const first = links[0]
    const last = links.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
})
matchMedia('(min-width: 761px)').addEventListener('change', event => {
  if (event.matches && nav.classList.contains('is-open')) toggleMenu(false)
})
document.querySelectorAll('[data-section]').forEach(link => {
  if (link.dataset.section === activeSection) {
    link.classList.add('active')
    link.setAttribute('aria-current', currentPath === activeSection ? 'page' : 'location')
  }
})

const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const empty = label => '<p class="empty">' + label + '</p>'
const button = (label, href, extra = '') => '<a class="button ' + extra + '" href="' + escape(href) + '">' + label + '</a>'
const heading = (title, subtitle = '') => '<header class="page-heading"><p class="breadcrumb"><a href="/">Rivals Arena</a> / ' + escape(title) +
  '</p><h1>' + escape(title) + '</h1>' + (subtitle ? '<p>' + escape(subtitle) + '</p>' : '') + '</header>'
const panel = (title, contents, extra = '') => '<section class="panel ' + extra + '"><h2>' + title + '</h2>' + contents + '</section>'
const grid = (items, fallback) => items.length ? '<div class="cards">' + items.join('') + '</div>' : empty(fallback)
const numberFormat = new Intl.NumberFormat('pt-BR')
const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })
const hourFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const parseDate = value => new Date(String(value).replace(' ', 'T') + (/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d(?::\d\d)?$/.test(value) ? 'Z' : ''))
const dateText = value => value && Number.isFinite(+parseDate(value)) ? dateFormat.format(parseDate(value)) : 'A definir'
const timeText = value => value && Number.isFinite(+parseDate(value)) ? hourFormat.format(parseDate(value)) : ''
const points = value => numberFormat.format(value ?? 0) + ' pts'
const palette = ['#8e4bd4', '#bc386e', '#2f68ce', '#127f77', '#864fba', '#a6451a', '#376e45', '#7243a6']

function renderUserAvatar(nickname) {
  const chars = Array.from(String(nickname || '?').trim())
  const initials = chars.slice(0, 2).join('').toLocaleUpperCase('pt-BR')
  const hash = chars.reduce((n, c) => ((n * 31) + c.toLowerCase().codePointAt(0)) >>> 0, 0)
  return '<span class="avatar" aria-hidden="true" style="--avatar-color:' + palette[hash % palette.length] + '">' + escape(initials) + '</span>'
}
function renderTeamShield(tag) {
  return `<span class="shield" aria-hidden="true"><svg viewBox="0 0 60 66"><path d="M30 2 57 12v24c0 11-10 21-27 28C13 57 3 47 3 36V12Z"/></svg><b>${escape(tag)}</b></span>`
}
function renderChampionshipCover(jogo) {
  if (jogo === 'Não informado') jogo = 'Mata-mata'
  const valorant = String(jogo).toLowerCase().includes('valorant')
  const cs = /counter|cs ?2|cs ?go/i.test(jogo)
  const icon = valorant ? 'M5 8 21 27h10L14 8ZM29 20h10l8-12H37Z' :
    cs ? 'M7 9h25v4h11v6H26l-5 10h-8l3-10H7Z' :
    'M12 7h24v8c0 7-4 10-9 12v4h7v4H14v-4h7v-4c-5-2-9-5-9-12Z'
  return '<div class="cover ' + (valorant ? 'valorant' : cs ? 'cs' : '') +
    '"><svg viewBox="0 0 50 40" aria-hidden="true"><path fill="currentColor" d="' + icon + '"/></svg><span>' + escape(jogo) + '</span></div>'
}
async function api(path, body, method = body === undefined ? 'GET' : 'POST') {
  const options = { method }
  if (body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' }
    options.body = JSON.stringify(body)
  }
  const response = await fetch('/api' + path, options)
  const data = await response.json()
  if (!response.ok) throw new Error(data.erro || 'Não foi possível carregar os dados.')
  return data
}
function show(title, html) {
  document.title = title + ' | Rivals Arena'
  main.innerHTML = html
}
function backToLogin(label = 'Entre na sua conta') {
  return button(label, '/login?voltar=' + encodeURIComponent(currentPath), 'outline')
}
let user = null
const input = (name, label, extra = '') => '<label>' + label + '<input name="' + name + '" ' + extra + ' required></label>'
const form = (fields, label, name) => '<form data-form="' + name + '">' + fields +
  '<p class="feedback" aria-live="polite"></p><button type="submit" class="button">' + label + '</button></form>'
function limitOptions(min, max) {
  return Array.from({ length: max - min + 1 }, (_, i) => '<option>' + (min + i) + '</option>').join('')
}
function limits(minName, maxName, label, lowest, highestMin, highestMax) {
  return '<div class="form-row"><label>Mínimo de ' + label + '<select name="' + minName + '">' +
    limitOptions(lowest, highestMin) + '</select></label><label>Máximo de ' + label + '<select name="' + maxName + '">' +
    limitOptions(lowest, highestMax) + '</select></label></div>'
}
function wireLimits(formName, minName, maxName, max) {
  const fields = main.querySelector('[data-form="' + formName + '"]')?.elements
  if (!fields) return
  const minField = fields[minName]
  const maxField = fields[maxName]
  maxField.value = String(max)
  minField.addEventListener('change', () => {
    const min = Number(minField.value)
    const previous = Math.max(min, Number(maxField.value))
    maxField.innerHTML = limitOptions(min, max)
    maxField.value = String(previous)
  })
}
function onForm(name, submit) {
  const el = main.querySelector('[data-form="' + name + '"]')
  if (!el) return
  el.addEventListener('submit', async event => {
    event.preventDefault()
    const feedback = el.querySelector('.feedback')
    const button = el.querySelector('button[type="submit"]')
    if (button.disabled) return
    button.disabled = true
    feedback.textContent = ''
    try {
      await submit(Object.fromEntries(new FormData(el)), el)
    } catch (error) {
      feedback.textContent = error.message
    } finally {
      button.disabled = false
    }
  })
}
function onAction(name, action) {
  main.querySelectorAll('[data-action="' + name + '"]').forEach(el => el.addEventListener('click', async () => {
    const feedback = el.closest('section')?.querySelector('.action-feedback')
    el.disabled = true
    if (feedback) feedback.textContent = ''
    try {
      await action(el)
    } catch (error) {
      if (feedback) feedback.textContent = error.message
    } finally {
      el.disabled = false
    }
  }))
}
function filter(query, select = '') {
  return '<form class="filter" data-filter role="search"><label class="sr-only" for="filter">Pesquisar nesta página</label>' +
    '<input id="filter" name="query" type="search" placeholder="' + query + '">' + select + '<button class="button" type="submit">Buscar</button></form>'
}
const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
function wireFilter() {
  const el = document.querySelector('[data-filter]')
  if (!el) return
  function apply() {
    const query = normalize(el.elements.query.value.trim())
    const status = el.elements.status?.value
    const cards = [...main.querySelectorAll('[data-search]')]
    for (const item of cards) item.hidden = !normalize(item.dataset.search).includes(query) ||
      Boolean(status && item.dataset.status !== status)
    const notice = main.querySelector('[data-no-results]')
    if (notice) notice.hidden = cards.some(item => !item.hidden)
  }
  el.addEventListener('submit', event => { event.preventDefault(); apply() })
  el.addEventListener('input', apply)
}
const noResults = '<p data-no-results class="empty" hidden>Nenhum resultado para a busca.</p>'
function rankTable(ranking) {
  if (!ranking.length) return empty('Ainda não há jogadores cadastrados.')
  return '<table class="ranking-table"><thead><tr><th scope="col">Posição</th><th scope="col">Jogador</th><th scope="col">Pontuação</th></tr></thead><tbody>' +
    ranking.map(u => `<tr data-search="${escape(u.nickname + ' ' + u.nome)}"><td><span class="place ${u.posicao < 4 ? 'podium-place' : ''}">#${u.posicao}</span></td>
      <td><a class="user-link" href="/jogadores/${u.id_usuario}">${renderUserAvatar(u.nickname)}<b>${escape(u.nickname)}</b></a></td><td>${points(u.pontos_ranking)}</td></tr>`).join('') +
    '</tbody></table>'
}
function tournamentCard(c) {
  return `<article class="panel card" data-search="${escape(c.nome + ' ' + c.jogo)}" data-status="${escape(c.status)}">
    ${renderChampionshipCover(c.jogo)}<div class="card-body"><span class="status">${escape(c.status || 'Sem status')}</span>
    <h3>${escape(c.nome)}</h3><p>${c.inscritos} de ${c.max_times ?? '—'} times · ${dateText(c.data_inicio)}</p>
    ${button(c.status === 'Inscrições Abertas' ? 'Ver inscrições' : 'Ver partidas', '/campeonatos/' + c.id_campeonato)}</div></article>`
}
async function home() {
  const [cups, ranking, config] = await Promise.all([api('/campeonatos'), api('/ranking'), api('/config')])
  main.querySelector('#campeonatos-destaque').innerHTML = grid(cups.slice(0, 3).map(tournamentCard), 'Ainda não há campeonatos.')
  main.querySelector('#ranking-destaque').innerHTML = rankTable(ranking.slice(0, 5))
  main.querySelector('#jogo-parceiro').href = config.jogoParceiro
  main.querySelector('[data-filter]').addEventListener('submit', event => {
    event.preventDefault()
    const value = event.target.querySelector('input').value.trim()
    if (!value) return
    const pages = [['time', '/times'], ['comunidade', '/comunidades'], ['campeonato', '/campeonatos'], ['ranking', '/ranking'], ['sobre', '/sobre']]
    const target = pages.find(([keyword]) => normalize(value).includes(keyword))?.[1]
    location.href = target || '/ranking?q=' + encodeURIComponent(value)
  })
}
async function leaderboard() {
  const rows = await api('/ranking')
  const top = rows.slice(0, 3)
  show('Ranking', heading('Ranking dos jogadores', 'Veja quem está no topo e abra o perfil de qualquer jogador.') +
    '<div class="podium">' + top.map(u => `<a class="podium-card" href="/jogadores/${u.id_usuario}">
      <span class="place podium-place">#${u.posicao}</span>${renderUserAvatar(u.nickname)}<strong>${escape(u.nickname)}</strong><span>${points(u.pontos_ranking)}</span></a>`).join('') +
    '</div>' + filter('Buscar por nickname ou nome') + panel('Classificação geral', rankTable(rows) + noResults))
  wireFilter()
  const q = new URLSearchParams(location.search).get('q')
  if (q) {
    const field = main.querySelector('#filter')
    field.value = q
    field.dispatchEvent(new Event('input', { bubbles: true }))
  }
}
async function profile(playerId, own = false) {
  const data = await api('/usuarios/' + playerId + '/perfil')
  const u = data.usuario
  const header = own ? 'Sua conta' : u.nickname
  const teams = data.times.map(t => `<li><a class="user-link" href="/times/${t.id_time}">${renderTeamShield(t.tag)}${escape(t.nome_time)}</a></li>`).join('')
  const communities = data.comunidades.map(c => `<li><a href="/comunidades/${c.id_comunidade}">${escape(c.nome)}</a></li>`).join('')
  const games = data.partidas.map(p => `<li class="result-row"><div><a href="/campeonatos/${p.id_campeonato}">${escape(p.campeonato)}</a>
    <p>${escape(p.time1)} <b>${p.placar_time1} × ${p.placar_time2}</b> ${escape(p.time2)}</p></div>
    <span class="status ${p.resultado === 'Vitória' ? 'won' : 'lost'}">${p.resultado}</span></li>`).join('')
  show(header, heading(header) + '<div class="split">' +
    panel('Perfil do jogador', `<div class="profile">${renderUserAvatar(u.nickname)}<div><h3>${escape(u.nickname)}</h3><p>${escape(u.nome)}</p>
      <p>Desde ${dateText(u.criado_em)}</p>${own ? '<p>' + escape(user.email) + '</p>' : ''}</div></div>
      <div class="profile-stats"><div><strong>#${u.posicao}</strong><span>Posição no ranking</span></div><div><strong>${points(u.pontos_ranking)}</strong><span>Pontuação</span></div></div>
      ${own ? '<p class="feedback action-feedback" aria-live="polite"></p><button class="button outline" type="button" data-action="logout">Sair da conta</button>' : button('Voltar ao ranking', '/ranking', 'outline')}`) +
    '<div class="stack">' + panel('Times', teams ? '<ul class="clean-list">' + teams + '</ul>' : empty('Este jogador ainda não está em um time.')) +
    panel('Comunidades', communities ? '<ul class="clean-list">' + communities + '</ul>' : empty('Este jogador ainda não participa de comunidades.')) +
    '</div></div>' + panel('Histórico de partidas', games ? '<ul class="clean-list">' + games + '</ul>' : empty('Nenhuma partida concluída encontrada para os times atuais.'), 'section'))
  onAction('logout', async () => { await api('/auth/sair', {}); location.href = '/' })
}
const actionFeedback = '<p class="feedback action-feedback" aria-live="polite"></p>'
async function teamsPage() {
  const teams = await api('/times')
  const items = teams.map(t => `<article class="panel card team-card" data-search="${escape(t.nome_time + ' ' + t.tag + ' ' + t.capitao)}">
    ${renderTeamShield(t.tag)}<h3>${escape(t.nome_time)}</h3><p>${t.membros} de ${t.max_jogadores ?? '—'} jogadores</p>
    <p>Capitão · ${escape(t.capitao)}</p>${button('Ver time', '/times/' + t.id_time)}</article>`)
  const mine = user ? teams.filter(t => t.id_capitao === user.id_usuario) : []
  const owned = mine.map(t => `<li><a href="/times/${t.id_time}">${escape(t.nome_time)}</a></li>`).join('')
  show('Times', heading('Encontre seu próximo time.', 'Monte seu elenco, encontre jogadores e entre na arena.') +
    filter('Buscar pelo nome ou tag') + '<h2 class="section-title">Explore os times</h2>' + grid(items, 'Ainda não há times.') + noResults +
    '<div class="split section">' + panel('Crie seu time', user ? form(input('nome_time', 'Nome do time', 'maxlength="100"') +
    input('tag', 'Tag do time', 'maxlength="10"') + limits('min_jogadores', 'max_jogadores', 'jogadores', 2, 4, 10),
    'Criar time', 'create-team') : backToLogin('Entre para criar um time')) +
    panel('Times que você lidera', owned ? '<ul class="clean-list">' + owned + '</ul>' : empty('Você ainda não lidera um time.')) + '</div>')
  wireFilter()
  wireLimits('create-team', 'min_jogadores', 'max_jogadores', 10)
  onForm('create-team', async data => {
    const team = await api('/times', { ...data, min_jogadores: Number(data.min_jogadores), max_jogadores: Number(data.max_jogadores) })
    location.href = '/times/' + team.id_time
  })
}
async function teamPage() {
  const team = await api('/times/' + id)
  const captain = user?.id_usuario === team.id_capitao
  const members = team.membros.map(m => `<li class="result-row"><a class="user-link" href="/jogadores/${m.id_usuario}">
    ${renderUserAvatar(m.nickname)}${escape(m.nickname)}</a>${m.id_usuario === team.id_capitao ? '<span class="status">Capitão</span>' :
      captain ? '<button class="button outline" type="button" data-action="remove" data-id="' + m.id_usuario + '">Remover</button>' : ''}</li>`).join('')
  show(team.nome_time, heading(team.nome_time) + '<div class="split">' +
    panel('Elenco', `<div class="user-link">${renderTeamShield(team.tag)}<span>${team.membros.length} de ${team.max_jogadores ?? '—'} jogadores</span></div>
    ${actionFeedback}<ul class="clean-list">${members}</ul>`) +
    panel(captain ? 'Gerenciar time' : 'Campeonatos', captain ? form(input('nickname', 'Nickname do jogador', 'maxlength="50"'), 'Adicionar jogador', 'add-member') :
      '<p>Confira os campeonatos da arena e acompanhe as partidas.</p>' + button('Ver campeonatos', '/campeonatos')) + '</div>')
  onForm('add-member', async data => { await api('/times/' + id + '/membros', data); await teamPage() })
  onAction('remove', async el => {
    if (!confirm('Remover este jogador do time?')) return
    await api('/times/' + id + '/membros/' + el.dataset.id, undefined, 'DELETE')
    await teamPage()
  })
}
async function communitiesPage() {
  const communities = await api('/comunidades')
  const items = communities.map(c => `<article class="panel card" data-search="${escape(c.nome + ' ' + c.descricao)}">
    <h3>${escape(c.nome)}</h3><p>${escape(c.descricao)}</p><p>${c.membros} de ${c.max_membros ?? '—'} membros</p>
    ${button('Abrir comunidade', '/comunidades/' + c.id_comunidade)}</article>`)
  show('Comunidades', heading('Sua comunidade. Seu jogo.', 'Converse, combine partidas e jogue com quem está na mesma sintonia.') +
    filter('Buscar comunidade ou assunto') + '<h2 class="section-title">Comunidades</h2>' + grid(items, 'Ainda não há comunidades.') + noResults +
    '<div class="split section">' + panel('Crie sua comunidade', user ? form(input('nome', 'Nome da comunidade', 'maxlength="100"') +
    '<label>Descrição<textarea name="descricao" maxlength="1000" rows="3"></textarea></label>' +
    input('max_membros', 'Limite de membros', 'type="number" min="1" max="10000" value="50"'), 'Criar comunidade', 'create-community') :
    backToLogin('Entre para criar uma comunidade')) +
    panel('Aqui todo mundo joga junto', '<p>Compartilhe estratégias, encontre gente para jogar e respeite quem faz parte da conversa.</p>' +
      button('Ler as diretrizes', '/termos', 'outline')) + '</div>')
  wireFilter()
  onForm('create-community', async data => {
    const community = await api('/comunidades', { ...data, max_membros: Number(data.max_membros) })
    location.href = '/comunidades/' + community.id_comunidade
  })
}
let chatTimer
async function chatPage() {
  clearInterval(chatTimer)
  const [community, communities] = await Promise.all([api('/comunidades/' + id), api('/comunidades')])
  const links = communities.map(c => `<li><a ${String(c.id_comunidade) === id ? 'aria-current="page"' : ''} href="/comunidades/${c.id_comunidade}">
    ${escape(c.nome)}</a></li>`).join('')
  const composer = community.membro ? form('<label>Mensagem<textarea name="conteudo" maxlength="2000" rows="2" required placeholder="Escreva sua mensagem"></textarea></label>',
    'Enviar mensagem', 'chat') : user ? actionFeedback + '<button class="button" type="button" data-action="join">Entrar na comunidade</button>' : backToLogin('Entre para participar')
  show(community.nome, heading(community.nome, community.descricao) + '<div class="chat-layout">' +
    panel('Comunidades', '<ul class="clean-list chat-links">' + links + '</ul>' + button('Ver todas', '/comunidades', 'outline')) +
    panel('# ' + escape(community.nome), '<p>' + community.membros + ' membros</p><p class="feedback" data-chat-error aria-live="polite"></p>' +
      '<div class="messages" role="log" aria-label="Mensagens recentes" tabindex="0"></div>' + composer) + '</div>')
  const feed = main.querySelector('.messages')
  const errorText = main.querySelector('[data-chat-error]')
  let recentIds
  let refreshing = false
  async function refresh() {
    if (refreshing) return
    refreshing = true
    try {
      const messages = await api('/comunidades/' + id + '/mensagens')
      errorText.textContent = ''
      const nextIds = messages.map(m => m.id_mensagem).join(',')
      if (nextIds === recentIds) return
      const scroll = recentIds === undefined || feed.scrollHeight - feed.scrollTop - feed.clientHeight < 65
      const previous = new Set((recentIds || '').split(','))
      const ids = new Set(messages.map(m => String(m.id_mensagem)))
      for (const el of feed.querySelectorAll('[data-message]')) if (!ids.has(el.dataset.message)) el.remove()
      feed.querySelector('.empty')?.remove()
      if (!messages.length) feed.innerHTML = empty('Ainda não há mensagens.')
      for (const m of messages.filter(m => !previous.has(String(m.id_mensagem)))) {
        feed.insertAdjacentHTML('beforeend', `<article data-message="${m.id_mensagem}" class="message ${m.id_usuario === user?.id_usuario ? 'mine' : ''}">
          ${renderUserAvatar(m.nickname)}<div><a href="/jogadores/${m.id_usuario}">${escape(m.nickname)}</a>
          <time>${dateText(m.enviado_em)} ${timeText(m.enviado_em)}</time><p>${escape(m.conteudo)}</p></div></article>`)
      }
      if (scroll) feed.scrollTop = feed.scrollHeight
      recentIds = nextIds
    } catch (error) {
      errorText.textContent = 'Falha ao carregar as mensagens. Tentando novamente…'
    } finally {
      refreshing = false
    }
  }
  onAction('join', async () => { await api('/comunidades/' + id + '/entrar', {}); await chatPage() })
  onForm('chat', async (data, el) => {
    await api('/comunidades/' + id + '/mensagens', data)
    el.reset()
    await refresh()
  })
  await refresh()
  chatTimer = setInterval(() => { if (!document.hidden) refresh() }, 4000)
}
async function championshipsPage() {
  const items = await api('/campeonatos')
  const statuses = '<label class="sr-only" for="status">Status</label><select id="status" name="status"><option value="">Todos os status</option>' +
    ['Inscrições Abertas', 'Em Andamento', 'Finalizado'].map(s => '<option>' + s + '</option>').join('') + '</select>'
  const create = user ? form(input('nome', 'Nome do campeonato', 'maxlength="100"') +
    limits('min_times', 'max_times', 'times', 8, 14, 16) +
    input('data_inicio', 'Data e horário', 'type="datetime-local"'), 'Criar campeonato', 'create-cup') : backToLogin('Entre para organizar um campeonato')
  show('Campeonatos', heading('A próxima disputa começa aqui.', 'Explore torneios, inscreva seu time ou organize sua competição.') + filter('Buscar campeonato', statuses) +
    '<h2 class="section-title">Explore os campeonatos</h2>' + grid(items.map(tournamentCard), 'Ainda não há campeonatos.') +
    noResults + panel('Organize seu campeonato', create, 'section compact-panel'))
  wireFilter()
  wireLimits('create-cup', 'min_times', 'max_times', 16)
  onForm('create-cup', async data => {
    const c = await api('/campeonatos', { ...data, min_times: Number(data.min_times), max_times: Number(data.max_times),
      data_inicio: new Date(data.data_inicio).toISOString() })
    location.href = '/campeonatos/' + c.id_campeonato
  })
}
function bracket(cup, organizer) {
  const games = cup.partidas
  if (!games.length) return empty('O chaveamento será exibido quando o organizador iniciar o campeonato.')
  const roundNumbers = [...new Set(games.map(m => m.rodada))]
  const activeRound = roundNumbers.at(-1)
  const firstTeams = new Set(games.filter(m => m.rodada === 1).flatMap(m => [m.id_time1, m.id_time2]))
  const byes = cup.inscritos.filter(t => !firstTeams.has(t.id_time))
  function match(m) {
    const display = (id, name, score, tag) => `<div class="bracket-team ${id === m.id_vencedor ? 'winner' : ''}">
      <a href="/times/${id}">${renderTeamShield(tag)}${escape(name)}</a><b>${m.id_vencedor ? score : '—'}</b></div>`
    const score = organizer && m.rodada === activeRound && !m.id_vencedor && cup.status === 'Em Andamento' ?
      form('<div class="form-row">' + input('placar_time1', escape(m.nome_time1), 'type="number" min="0" max="999"') +
        input('placar_time2', escape(m.nome_time2), 'type="number" min="0" max="999"') + '</div>', 'Salvar placar', 'score-' + m.id_partida) : ''
    return `<article class="match">${display(m.id_time1, m.nome_time1, m.placar_time1, m.tag_time1)}
      ${display(m.id_time2, m.nome_time2, m.placar_time2, m.tag_time2)}${score}</article>`
  }
  return '<div class="bracket">' + roundNumbers.map(round => `<section><h3>${cup.status === 'Finalizado' && round === activeRound ? 'Final' : 'Rodada ' + round}</h3>
    ${games.filter(m => m.rodada === round).map(match).join('')}
    ${round === 1 && byes.length ? '<p class="bye"><strong>Avanço direto</strong><br>' + byes.map(t => escape(t.nome_time)).join(', ') + '</p>' : ''}</section>`).join('') + '</div>'
}
async function tournamentPage() {
  const [cup, teams] = await Promise.all([api('/campeonatos/' + id), user ? api('/times') : []])
  const organizer = user?.id_usuario === cup.id_organizador
  const open = cup.status === 'Inscrições Abertas'
  const qualified = teams.filter(t => t.id_capitao === user?.id_usuario && t.membros >= t.min_jogadores && !cup.inscritos.some(i => i.id_time === t.id_time))
  const winner = cup.status === 'Finalizado' && cup.partidas.at(-1)
  const register = open ? !user ? backToLogin('Entre para inscrever seu time') : cup.inscritos.length >= cup.max_times ? empty('As vagas deste campeonato estão preenchidas.') :
    qualified.length ? form('<label>Time<select name="id_time">' +
      qualified.map(t => '<option value="' + t.id_time + '">' + escape(t.nome_time) + '</option>').join('') + '</select></label>', 'Confirmar inscrição', 'register') :
    empty('Você precisa liderar um time elegível e que ainda não esteja inscrito.') + button('Ver times', '/times', 'outline') :
    empty('As inscrições estão encerradas.')
  const start = organizer && open ? actionFeedback + '<button class="button" type="button" data-action="start" ' +
    (cup.inscritos.length < Math.max(2, cup.min_times || 2) ? 'disabled' : '') + '>Iniciar campeonato</button>' : ''
  const enrolled = cup.inscritos.map(t => `<li><a class="user-link" href="/times/${t.id_time}">${renderTeamShield(t.tag)}${escape(t.nome_time)}</a></li>`).join('')
  show(cup.nome, heading(cup.nome, 'Acompanhe o mata-mata e o resultado das partidas.') +
    '<div class="panel cup-summary">' + renderChampionshipCover(cup.jogo) + '<div><span class="status">' + escape(cup.status) +
    '</span><p>' + dateText(cup.data_inicio) + ' · ' + escape(cup.formato) + '</p>' +
    (winner ? '<p><strong>Campeão</strong> · ' + escape(winner.id_vencedor === winner.id_time1 ? winner.nome_time1 : winner.nome_time2) + '</p>' : '') +
    '</div></div>' + panel('Chaveamento mata-mata', bracket(cup, organizer), 'section') + '<div class="split section">' +
    panel('Times inscritos', '<p>' + cup.inscritos.length + ' de ' + (cup.max_times ?? '—') + ' vagas</p>' +
      (enrolled ? '<ul class="clean-list roster">' + enrolled + '</ul>' : empty('Nenhum time inscrito.'))) +
    panel('Entre na disputa', register + start) + '</div>')
  onForm('register', async data => { await api('/campeonatos/' + id + '/inscricoes', { id_time: Number(data.id_time) }); await tournamentPage() })
  onAction('start', async () => {
    if (!confirm('Iniciar o campeonato e encerrar as inscrições?')) return
    await api('/campeonatos/' + id + '/iniciar', {})
    await tournamentPage()
  })
  for (const m of cup.partidas) onForm('score-' + m.id_partida, async data => {
    await api('/partidas/' + m.id_partida + '/placar', { placar_time1: Number(data.placar_time1), placar_time2: Number(data.placar_time2) }, 'PUT')
    await tournamentPage()
  })
}
function authPage(signup) {
  if (user) return location.replace('/conta')
  const title = signup ? 'Crie sua conta' : 'Faça seu login'
  const email = input('email', 'E-mail', 'type="email" maxlength="100" autocomplete="email"')
  const credentials = signup ? input('nome', 'Nome', 'maxlength="100" autocomplete="name"') +
    input('nickname', 'Nickname', 'maxlength="50" autocomplete="username"') : ''
  const password = input('senha', 'Senha', 'type="password" maxlength="128" ' +
    (signup ? 'minlength="8" autocomplete="new-password"' : 'autocomplete="current-password"'))
  const confirmation = signup ? input('confirmar', 'Confirmar senha', 'type="password" minlength="8" maxlength="128" autocomplete="new-password"') : ''
  show(title, '<div class="auth-layout"><div class="auth-panel">' + heading(title) +
    '<p class="auth-symbol"><img src="/assets/iconefacaseulogin.svg" width="96" height="96" alt=""></p>' + form(email + credentials + password + confirmation, signup ? 'Criar conta' : 'Entrar', 'auth') +
    (signup ? '<p>Já tem conta? <a href="/login">Entre aqui</a></p>' :
      '<p><a href="/esqueci-a-senha">Esqueci a senha</a></p><p>Primeiro acesso? <a href="/cadastro">Cadastre-se</a></p>') +
    '</div></div>')
  onForm('auth', async data => {
    if (signup && data.senha !== data.confirmar) throw new Error('As senhas precisam ser iguais.')
    delete data.confirmar
    await api('/auth/' + (signup ? 'cadastro' : 'login'), data)
    const next = new URLSearchParams(location.search).get('voltar')
    location.href = next && /^\/(?:times|comunidades|campeonatos)(?:\/\d+)?$/.test(next) ? next : '/conta'
  })
}
async function init() {
  if (['sobre', 'termos', 'seguranca', 'perguntas-frequentes'].includes(section)) return
  try {
    user = (await api('/auth/sessao')).usuario
    switch (section) {
      case '': return await home()
      case 'ranking': return await leaderboard()
      case 'jogadores': return await profile(id)
      case 'times': return id ? await teamPage() : await teamsPage()
      case 'comunidades': return id ? await chatPage() : await communitiesPage()
      case 'campeonatos': return id ? await tournamentPage() : await championshipsPage()
      case 'conta': return user ? await profile(user.id_usuario, true) : location.replace('/login')
      case 'login': return authPage(false)
      case 'cadastro': return authPage(true)
      case 'esqueci-a-senha':
        return show('Esqueci a senha', heading('Esqueci a senha') + panel('Recuperação de acesso',
          '<p>A recuperação automática está indisponível. As contas anteriores continuam no ranking e nos perfis; o acesso está disponível para novos cadastros.</p>' +
          button('Voltar ao login', '/login', 'outline'), 'compact-panel'))
      default: throw new Error('Página não encontrada.')
    }
  } catch (error) {
    show('Página indisponível', heading('Página indisponível', error.message) + button('Voltar ao início', '/'))
  }
}
init()
