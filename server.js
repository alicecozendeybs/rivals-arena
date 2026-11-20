const http = require('node:http')
const path = require('node:path')
const fs = require('node:fs')
const { createApi, RequestError } = require('./api')
const { openDatabase, databaseError } = require('./database')

const publicDir = path.join(__dirname, 'public')
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' }
const pages = new Map([
  ['/', 'index'], ['/times', 'times'], ['/comunidades', 'comunidades'], ['/ranking', 'ranking'],
  ['/campeonatos', 'campeonatos'], ['/sobre', 'sobre'], ['/termos', 'termos'], ['/seguranca', 'seguranca'],
  ['/perguntas-frequentes', 'perguntas-frequentes'], ['/conta', 'conta'], ['/login', 'login'],
  ['/cadastro', 'cadastro'], ['/esqueci-a-senha', 'esqueci-a-senha']
])
const detailPages = new Map([
  ['times', 'time'], ['comunidades', 'chat'], ['jogadores', 'jogador'], ['campeonatos', 'campeonato']
])
const htmlFiles = new Set([...pages.values(), ...detailPages.values()].map(page => '/' + page + '.html'))

function pageFile(pathname) {
  const clean = pathname.replace(/\/$/, '') || '/'
  const detail = /^\/([a-z]+)\/\d+$/.exec(clean)
  const page = detail ? detailPages.get(detail[1]) : pages.get(clean)
  return page ? '/' + page + '.html' : pathname
}

async function readBody(req) {
  if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    throw new RequestError(415, 'Envie os dados no formato JSON.')
  }
  let size = 0
  const chunks = []
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length
    if (size > 16_384) {
      req.resume()
      throw new RequestError(413, 'O formulário ultrapassa o tamanho permitido.')
    }
    chunks.push(chunk)
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error()
    return data
  } catch {
    throw new RequestError(400, 'Dados do formulário inválidos.')
  }
}

function createHandler(db, options = {}) {
  const api = createApi(db, options)
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
    try {
      const url = new URL(req.url, 'http://localhost')
      if (url.pathname.startsWith('/api/')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        const payload = await api(req, res, url.pathname, readBody)
        res.end(JSON.stringify(payload))
        return
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw new RequestError(405, 'Método não permitido.')
      const filename = pageFile(url.pathname)
      const extension = path.extname(filename)
      if ((!htmlFiles.has(filename) && !/^\/(?:styles\.css|(?:js|assets)\/[a-z0-9_-]+\.[a-z]+)$/i.test(filename)) ||
          !types[extension]) throw new RequestError(404, 'Página não encontrada.')
      const file = path.join(publicDir, filename.slice(1))
      if (!fs.existsSync(file)) throw new RequestError(404, 'Arquivo não encontrado.')
      res.setHeader('Content-Type', types[extension])
      res.setHeader('Cache-Control', 'no-cache')
      if (req.method === 'HEAD') res.end()
      else res.end(await fs.promises.readFile(file))
    } catch (error) {
      res.statusCode = error instanceof RequestError ? error.status : 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      if (res.statusCode === 500) console.error(error)
      res.end(JSON.stringify({ erro: res.statusCode === 500 ? 'O servidor não conseguiu concluir a operação.' : error.message }))
    }
  }
}

async function start() {
  const express = require('express')
  const app = express()
  app.disable('x-powered-by')
  let partner
  if (process.env.PARTNER_URL) {
    const url = new URL(process.env.PARTNER_URL)
    if (url.protocol !== 'https:' || !(url.hostname === 'itch.io' || url.hostname.endsWith('.itch.io')) || url.username || url.password) {
      throw new Error('PARTNER_URL deve ser um endereço HTTPS do itch.io.')
    }
    partner = url.href
  }
  const db = await openDatabase()
  app.use(createHandler(db, { secure: process.env.COOKIE_SECURE === 'true', origin: process.env.APP_ORIGIN, partner }))
  const port = Number(process.env.PORT || 3000)
  const host = process.env.HOST || '127.0.0.1'
  const server = http.createServer(app)
  server.once('error', async error => {
    await db.close()
    console.error(error.code === 'EADDRINUSE' ? 'A porta ' + port + ' está ocupada. Ajuste PORT no .env.' : error.message)
    process.exitCode = 1
  })
  server.listen(port, host, () => console.log('Rivals Arena disponível em http://' + host + ':' + server.address().port))
}

if (require.main === module) {
  start().catch(error => {
    console.error(error.code === 'MODULE_NOT_FOUND' ? 'Instale as dependências com npm install.' : databaseError(error))
    process.exitCode = 1
  })
}
module.exports = { createHandler }
