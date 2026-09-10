import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

const ADMIN_STARTER = `-- Admin: create or prepare the classroom database
SHOW TABLES;`
const STUDENT_STARTER = `-- Explore the classroom data with read-only MySQL queries
SHOW TABLES;`

function displayValue(value) {
  if (value === null) return <span className="sql-null">NULL</span>
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function SqlPage({ profile }) {
  const isAdmin = Boolean(profile?.is_admin)
  const [query, setQuery] = useState(isAdmin ? ADMIN_STARTER : STUDENT_STARTER)
  const [schema, setSchema] = useState([])
  const [expanded, setExpanded] = useState({})
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [schemaLoading, setSchemaLoading] = useState(true)

  async function callSql(body) {
    const { data, error: invokeError } = await supabase.functions.invoke('mysql-console', { body })
    if (invokeError) {
      let message = invokeError.message
      try {
        const context = await invokeError.context?.json()
        if (context?.error) message = context.error
      } catch { /* keep the invocation error */ }
      throw new Error(message)
    }
    if (data?.error) throw new Error(data.error)
    return data
  }

  async function loadSchema() {
    setSchemaLoading(true)
    setError('')
    try {
      const data = await callSql({ action: 'schema' })
      setSchema(data.tables ?? [])
    } catch (err) {
      setError(err.message)
      setSchema([])
    } finally {
      setSchemaLoading(false)
    }
  }

  useEffect(() => { loadSchema() }, [isAdmin])

  async function runQuery() {
    if (!query.trim() || running) return
    setRunning(true)
    setError('')
    setResult(null)
    const started = performance.now()
    try {
      const data = await callSql({ action: 'query', sql: query })
      setResult({ ...data, clientDurationMs: Math.round(performance.now() - started) })
      if (data.schemaChanged) loadSchema()
    } catch (err) {
      setError(err.message)
    } finally {
      setRunning(false)
    }
  }

  function useTable(table) {
    const escaped = `\`${table.replaceAll('`', '``')}\``
    setQuery(`SELECT *\nFROM ${escaped}\nLIMIT 100;`)
  }

  const columns = useMemo(() => {
    if (result?.columns?.length) return result.columns
    return result?.rows?.[0] ? Object.keys(result.rows[0]) : []
  }, [result])

  return (
    <div className="page-content sql-page">
      <div className="page-header sql-page-header">
        <div>
          <h2>SQL Lab</h2>
          <p>MySQL classroom database · {isAdmin ? 'administrator access' : 'read-only student access'}</p>
        </div>
        <span className={`sql-role-badge ${isAdmin ? 'admin' : ''}`}>{isAdmin ? 'ADMIN' : 'READ ONLY'}</span>
      </div>

      <div className="sql-workbench">
        <aside className="sql-schema-panel">
          <div className="sql-panel-title">
            <span>Database</span>
            <button onClick={loadSchema} disabled={schemaLoading} title="Refresh schema">↻</button>
          </div>
          <div className="sql-schema-body">
            {schemaLoading ? <div className="sql-muted">Loading schema…</div> : schema.length === 0 ? (
              <div className="sql-muted">No tables found.</div>
            ) : schema.map(table => (
              <div className="sql-table-node" key={table.name}>
                <button className="sql-table-name" onClick={() => setExpanded(x => ({ ...x, [table.name]: !x[table.name] }))}>
                  <span>{expanded[table.name] ? '▾' : '▸'}</span>
                  <span className="sql-table-icon">▦</span>
                  <span>{table.name}</span>
                  <small>{table.rowCount ?? '—'}</small>
                </button>
                {expanded[table.name] && (
                  <div className="sql-column-list">
                    {(table.columns ?? []).map(col => (
                      <div key={col.name} className="sql-column" title={`${col.type}${col.nullable ? ' NULL' : ' NOT NULL'}`}>
                        <span>{col.key === 'PRI' ? '🔑' : '·'}</span><b>{col.name}</b><small>{col.type}</small>
                      </div>
                    ))}
                    <button className="sql-preview-btn" onClick={() => useTable(table.name)}>Preview rows</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        <section className="sql-main-panel">
          <div className="sql-editor-toolbar">
            <span>Query editor</span>
            <button className="btn btn-primary sql-run-btn" onClick={runQuery} disabled={running || !query.trim()}>
              {running ? 'Running…' : '▶ Run'}
            </button>
          </div>
          <textarea
            className="sql-editor"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runQuery() } }}
            spellCheck="false"
            aria-label="SQL query editor"
          />
          <div className="sql-editor-help">Ctrl + Enter to run · One statement at a time{!isAdmin && ' · SELECT, WITH, SHOW, DESCRIBE, and EXPLAIN only'}</div>

          <div className="sql-results-panel">
            <div className="sql-panel-title">
              <span>Results</span>
              {result && <small>{result.rowCount} row{result.rowCount === 1 ? '' : 's'} · {result.durationMs ?? result.clientDurationMs} ms</small>}
            </div>
            {error ? (
              <div className="sql-error"><strong>Query failed</strong><span>{error}</span></div>
            ) : !result ? (
              <div className="sql-empty">Run a query to see its results.</div>
            ) : result.rows?.length ? (
              <div className="sql-grid-wrap">
                <table className="sql-grid">
                  <thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>{result.rows.map((row, i) => (
                    <tr key={i}>{columns.map(c => <td key={c}>{displayValue(row[c])}</td>)}</tr>
                  ))}</tbody>
                </table>
              </div>
            ) : (
              <div className="sql-success">✓ {result.message || 'Query executed successfully.'}</div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
