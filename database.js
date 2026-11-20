const mysql = require('mysql2/promise')
const { createHash } = require('node:crypto')

const tables = ['usuario', 'time', 'comunidade', 'campeonato', 'membro_time',
  'membro_comunidade', 'mensagem_chat', 'inscricao', 'partida']

function settings(env = process.env) {
  const tls = env.DB_TLS === 'true'
  return {
    host: env.DB_HOST ?? 'localhost',
    port: Number(env.DB_PORT ?? 3306),
    user: env.DB_USER ?? 'root',
    password: env.DB_PASSWORD ?? '',
    database: env.DB_NAME ?? 'rivals_arena',
    charset: 'utf8mb4',
    dateStrings: true,
    timezone: 'Z',
    connectTimeout: tls ? 15_000 : 5000,
    ssl: tls ? { minVersion: 'TLSv1.2', rejectUnauthorized: true, verifyIdentity: true } : undefined
  }
}

function queries(connection) {
  async function all(sql, ...args) {
    const [rows] = await connection.execute(sql, args)
    return rows
  }

  return {
    all,
    get: async (sql, ...args) => (await all(sql, ...args))[0],
    run: all
  }
}

async function withWriteLock(connection, database, operation) {
  // Preserva a exclusão mútua que BEGIN IMMEDIATE dava às operações no SQLite.
  const lock = 'rivals:' + createHash('sha256').update(database).digest('hex').slice(0, 48)
  const [[{ acquired }]] = await connection.execute('SELECT GET_LOCK(?, 5) AS acquired', [lock])
  if (acquired !== 1) {
    const error = new Error('O banco está ocupado. Tente novamente.')
    error.code = 'RIVALS_DB_BUSY'
    throw error
  }

  try {
    await connection.beginTransaction()
    try {
      const result = await operation(queries(connection))
      await connection.commit()
      return result
    } catch (error) {
      await connection.rollback().catch(() => connection.destroy())
      throw error
    }
  } finally {
    try {
      const [[{ released }]] = await connection.execute('SELECT RELEASE_LOCK(?) AS released', [lock])
      if (released !== 1) connection.destroy()
    } catch {
      connection.destroy()
    }
  }
}

async function openDatabase(config = settings()) {
  const pool = mysql.createPool({ ...config, connectionLimit: 10, maxIdle: 5, idleTimeout: 60_000, queueLimit: 100 })
  const query = queries(pool)
  try {
    for (const table of tables) await query.get('SELECT 1 FROM `' + table + '` LIMIT 1')
  } catch (error) {
    await pool.end()
    throw error
  }
  return {
    ...query,
    async transaction(operation) {
      const connection = await pool.getConnection()
      try {
        return await withWriteLock(connection, config.database, operation)
      } finally {
        connection.release()
      }
    },
    close: () => pool.end()
  }
}

function databaseError(error) {
  if (['ER_BAD_DB_ERROR', 'ER_NO_SUCH_TABLE'].includes(error.code)) return 'Execute npm run db:init para preparar o MySQL.'
  if (['ER_ACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR'].includes(error.code)) return 'Acesso ao MySQL recusado. Confira DB_USER e DB_PASSWORD.'
  if (['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'].includes(error.code)) return 'Confira o serviço MySQL e os valores de DB_HOST e DB_PORT.'
  return error.message
}

module.exports = { openDatabase, settings, tables, databaseError, withWriteLock }
