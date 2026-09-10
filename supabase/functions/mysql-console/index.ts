import { createClient } from 'npm:@supabase/supabase-js@2'
import mysql, { type Connection, type ResultSetHeader } from 'npm:mysql2@3.11.5/promise'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

function isSingleStatement(sql: string) {
  const stripped = sql.replace(/--[^\n\r]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim()
  return !stripped.slice(0, -1).includes(';')
}

function isReadOnly(sql: string) {
  const clean = sql.replace(/^(?:\s|--[^\n\r]*(?:\r?\n|$)|\/\*[\s\S]*?\*\/)+/g, '').toUpperCase()
  return /^(SELECT|WITH|SHOW|DESCRIBE|DESC|EXPLAIN)\b/.test(clean)
    && !/\b(INTO\s+(?:OUTFILE|DUMPFILE)|FOR\s+UPDATE|LOCK\s+IN\s+SHARE\s+MODE|SLEEP\s*\(|BENCHMARK\s*\(|LOAD_FILE\s*\()/.test(clean)
}

function connectionOptions(connectionUrl: string) {
  const url = new URL(connectionUrl)
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: true },
    multipleStatements: false,
    connectTimeout: 8_000,
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  let connection: Connection | undefined
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'You must be signed in.' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return json({ error: 'Invalid or expired session.' }, 401)

    const { data: profile, error: profileError } = await supabase
      .from('profiles').select('is_admin').eq('id', user.id).single()
    if (profileError) throw new Error('Could not verify database permissions.')
    const isAdmin = Boolean(profile?.is_admin)

    const body = await req.json()
    const action = body?.action
    const connectionUrl = Deno.env.get(isAdmin ? 'MYSQL_ADMIN_URL' : 'MYSQL_STUDENT_URL')
    if (!connectionUrl) {
      throw new Error(`${isAdmin ? 'MYSQL_ADMIN_URL' : 'MYSQL_STUDENT_URL'} is not configured on the server.`)
    }
    connection = await mysql.createConnection(connectionOptions(connectionUrl))

    if (action === 'schema') {
      const [tableRows] = await connection.query(`
        SELECT TABLE_NAME AS name, TABLE_ROWS AS rowCount
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME`)
      const [columnRows] = await connection.query(`
        SELECT TABLE_NAME AS tableName, COLUMN_NAME AS name, COLUMN_TYPE AS type,
               IS_NULLABLE = 'YES' AS nullable, COLUMN_KEY AS \`key\`
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME, ORDINAL_POSITION`)
      const tables = (tableRows as any[]).map(table => ({
        ...table,
        columns: (columnRows as any[]).filter(col => col.tableName === table.name)
          .map(({ tableName: _tableName, nullable, ...col }) => ({ ...col, nullable: Boolean(nullable) })),
      }))
      return json({ tables })
    }

    if (action !== 'query') return json({ error: 'Unknown action.' }, 400)
    const sql = String(body?.sql ?? '').trim()
    if (!sql) return json({ error: 'Enter a SQL statement.' }, 400)
    if (sql.length > 20_000) return json({ error: 'SQL is limited to 20,000 characters.' }, 400)
    if (!isSingleStatement(sql)) return json({ error: 'Run one SQL statement at a time.' }, 400)
    if (!isAdmin && !isReadOnly(sql)) return json({ error: 'Students can only run read-only queries.' }, 403)

    const started = performance.now()
    const [rows, fields] = await connection.query({ sql, timeout: 10_000 })
    const durationMs = Math.round(performance.now() - started)
    if (Array.isArray(rows)) {
      const limitedRows = rows.slice(0, 500)
      return json({
        rows: limitedRows,
        columns: fields?.map(field => field.name) ?? (limitedRows[0] ? Object.keys(limitedRows[0]) : []),
        rowCount: limitedRows.length,
        truncated: rows.length > 500,
        durationMs,
      })
    }
    const packet = rows as ResultSetHeader
    const schemaChanged = /^(CREATE|ALTER|DROP|RENAME|TRUNCATE)\b/i.test(sql.replace(/^\s*(?:--[^\n]*\n\s*)*/, ''))
    return json({ rows: [], columns: [], rowCount: packet.affectedRows ?? 0, durationMs, schemaChanged,
      message: `${packet.affectedRows ?? 0} row(s) affected.` })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return json({ error: message }, 500)
  } finally {
    await connection?.end().catch(() => undefined)
  }
})
