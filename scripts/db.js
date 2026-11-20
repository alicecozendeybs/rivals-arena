const { existsSync, readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { homedir } = require('node:os')
const { parseEnv } = require('node:util')
const mysql = require('mysql2/promise')
const { settings, tables, databaseError, withWriteLock } = require('../database')

function sourcePath(explicit) {
  if (explicit) return resolve(explicit)
  return [
    resolve(__dirname, '../bancodedados/rivals_arena.db'),
    resolve(homedir(), 'Documents/RivalsArenabase/bancodedados/rivals_arena.db')
  ].find(existsSync)
}

async function init(config) {
  const { database, ...connectionConfig } = config
  const connection = await mysql.createConnection(connectionConfig)
  try {
    await connection.query('CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin', [database])
    await connection.query('USE ??', [database])
    const [[{ version }]] = await connection.query('SELECT VERSION() AS version')
    const isTiDB = /tidb/i.test(version)
    const schema = readFileSync(resolve(__dirname, '../sql/schema.sql'), 'utf8')
    for (const statement of schema.split(';').map(sql => sql.trim()).filter(Boolean)) {
      let ddl = statement
      if (isTiDB) {
        ddl = ddl.replaceAll('DEFAULT (UTC_TIMESTAMP())', 'DEFAULT CURRENT_TIMESTAMP')
        if (ddl.includes('AUTO_INCREMENT')) ddl += ' AUTO_ID_CACHE=1'
      }
      await connection.query(ddl)
    }
  } finally {
    await connection.end()
  }
}

async function copyRows(connection, database, readRows, verify = false) {
  return withWriteLock(connection, database, async tx => {
    for (const table of tables) {
      if (await tx.get('SELECT 1 FROM ' + connection.escapeId(table) + ' LIMIT 1')) {
        throw new Error('O banco de destino já contém dados. A importação exige as nove tabelas vazias.')
      }
    }

    const counts = {}
    for (const table of tables) {
      const quoted = connection.escapeId(table)
      const rows = await readRows(table)
      counts[table] = rows.length
      if (!rows.length) continue

      const columns = Object.keys(rows[0])
      const identifiers = columns.map(column => connection.escapeId(column)).join(', ')
      const placeholders = '(' + columns.map(() => '?').join(', ') + ')'
      const previousMatchColumn = table === 'partida' ? columns.indexOf('fk_partida_id_partida') : -1
      for (let start = 0; start < rows.length; start += 100) {
        const batch = rows.slice(start, start + 100)
        const values = batch.map(() => placeholders).join(', ')
        const parameters = batch.flatMap(row => columns.map((column, index) =>
          index === previousMatchColumn ? null : row[column]))
        await tx.run('INSERT INTO ' + quoted + ' (' + identifiers + ') VALUES ' + values, ...parameters)
      }

      if (table === 'partida') {
        for (const row of rows.filter(row => row.fk_partida_id_partida != null)) {
          await tx.run('UPDATE partida SET fk_partida_id_partida = ? WHERE id_partida = ?', row.fk_partida_id_partida, row.id_partida)
        }
      }
      if (verify) {
        const copied = await tx.all('SELECT ' + identifiers + ' FROM ' + quoted)
        const sortedValues = rows => rows.map(row => JSON.stringify(columns.map(column => row[column]))).sort()
        if (JSON.stringify(sortedValues(rows)) !== JSON.stringify(sortedValues(copied))) {
          throw new Error('Os dados copiados divergiram na tabela ' + table + '. A importação foi revertida.')
        }
      }
    }
    return counts
  })
}

async function seed(config, filename) {
  if (!filename || !existsSync(filename)) {
    throw new Error('SQLite de origem não encontrado. Use npm run db:seed -- "caminho/do/arquivo.db".')
  }
  const { DatabaseSync } = require('node:sqlite')
  const source = new DatabaseSync(filename, { readOnly: true })
  let connection
  try {
    connection = await mysql.createConnection(config)
    source.exec('BEGIN')
    return await copyRows(connection, config.database, table => source.prepare('SELECT * FROM "' + table + '"').all())
  } finally {
    source.close()
    if (connection) await connection.end()
  }
}

async function migrate(sourceConfig, targetConfig) {
  if (sourceConfig.host === targetConfig.host && sourceConfig.port === targetConfig.port && sourceConfig.database === targetConfig.database) {
    throw new Error('Escolha um banco de destino diferente do banco de origem.')
  }

  const source = await mysql.createConnection(sourceConfig)
  let target
  try {
    await source.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
    await source.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY')
    await init(targetConfig)
    target = await mysql.createConnection(targetConfig)
    await target.query('SET SESSION foreign_key_checks = 1')
    return await copyRows(target, targetConfig.database, async table => {
      const [rows] = await source.execute('SELECT * FROM ' + source.escapeId(table))
      return rows
    }, true)
  } finally {
    await Promise.all([source.end(), target?.end()])
  }
}

async function main() {
  const [, , action, filename] = process.argv
  const config = settings()
  if (action === 'init') {
    await init(config)
    console.log('Esquema MySQL pronto em ' + config.database + '.')
  } else if (action === 'seed' || action === 'migrate') {
    let counts
    if (action === 'seed') {
      counts = await seed(config, sourcePath(filename ?? process.env.SQLITE_PATH))
    } else {
      const targetFile = resolve(filename ?? '.env.render')
      if (!existsSync(targetFile)) throw new Error('Crie .env.render com os dados da conexão ao TiDB Cloud.')
      const env = parseEnv(readFileSync(targetFile, 'utf8'))
      if (!env.DB_HOST || !env.DB_PORT || !env.DB_USER || !env.DB_PASSWORD || !env.DB_NAME || env.DB_TLS !== 'true') {
        throw new Error('Preencha DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME e DB_TLS=true no arquivo de destino.')
      }
      counts = await migrate(config, settings(env))
    }
    for (const [table, total] of Object.entries(counts)) console.log(table + ': ' + total)
  } else {
    throw new Error('Use npm run db:init, npm run db:seed ou npm run db:migrate.')
  }
}

if (require.main === module) {
  main().catch(error => {
    let message = error.message
    if (error.code?.startsWith('ERR_SQLITE')) {
      message = 'O arquivo de origem não pôde ser lido como SQLite do Rivals Arena.'
    } else if (error.code) {
      const detail = databaseError(error)
      message = (process.argv[2] === 'migrate' && detail === error.message ? 'Falha ao migrar o banco' : detail) +
        ' (' + error.code + ').'
    }
    console.error(message)
    process.exitCode = 1
  })
}

module.exports = { init, seed, sourcePath, migrate }
