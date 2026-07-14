import React, { useState } from 'react'
import { Terminal, Play, Sparkles, Database, Clock, BarChart3 } from 'lucide-react'
import Plot from 'react-plotly.js'

export default function SQLPlayground({ currentProject, activeDataset, apiKey, provider }) {
  const [nlQuery, setNlQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sqlResult, setSqlResult] = useState(null)

  const handleRunQuery = async (e) => {
    e.preventDefault()
    if (!nlQuery.trim() || !activeDataset || isLoading) return
    setIsLoading(true)
    setSqlResult(null)

    // Form parameter payloads
    // Include SQL prompt trigger inside message to prompt planner agent
    const message = `Write a SQL query to do this: ${nlQuery}`

    try {
      const formData = new FormData()
      formData.append('project_id', currentProject.id)
      formData.append('message', message)
      formData.append('provider', provider)
      if (apiKey) {
        formData.append('api_key', apiKey)
      }

      const res = await fetch('https://ai-powered-automated-data-analytics.onrender.com/api/v1/chat/send', {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        const data = await res.json()
        if (data.sql_data) {
          setSqlResult({
            query: data.sql_data.query,
            execution_time: data.sql_data.execution_time,
            columns: data.sql_data.columns,
            rows: data.sql_data.rows,
            plotly_json: data.plotly_json
          })
        } else {
          alert("SQL Agent was unable to parse that request into a SQL query. Make sure it specifies tabular parameters.")
        }
      }
    } catch (err) {
      alert("Error sending SQL query request to ")
    } finally {
      setIsLoading(false)
    }
  }

  if (!activeDataset) {
    return (
      <div className="glass-panel border-indigo-950 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4">
        <Terminal size={48} className="text-indigo-400" />
        <h4 className="text-lg font-bold text-white">No Dataset Loaded</h4>
        <p className="text-sm text-slate-400">Please go to Home & Upload to import a data source first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-bold font-outfit text-white">NL-to-SQL Playground</h2>
        <p className="text-xs text-slate-400 mt-1">Convert natural language questions into optimized SQLite queries instantly.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: NL terminal input */}
        <div className="lg:col-span-1 glass-card rounded-2xl p-6 space-y-6">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Terminal size={16} className="text-indigo-400" />
            <span>SQL Prompt Terminal</span>
          </h3>

          <form onSubmit={handleRunQuery} className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Ask your question</label>
              <textarea
                rows="4"
                placeholder="Show top 10 rows by sales..."
                value={nlQuery}
                onChange={(e) => setNlQuery(e.target.value)}
                className="w-full glass-input text-xs rounded-xl p-3"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !nlQuery.trim()}
              className="w-full bg-indigo-650 hover:bg-indigo-600 font-semibold py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 text-sm disabled:opacity-55"
            >
              <Play size={14} />
              <span>{isLoading ? 'Querying Agent...' : 'Generate & Execute'}</span>
            </button>
          </form>

          {/* Quick shortcuts */}
          <div className="space-y-2 pt-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Quick Prompt Suggestions</span>
            <div className="space-y-1.5">
              <button
                onClick={() => setNlQuery("SELECT * FROM dataset LIMIT 10")}
                className="w-full text-left bg-slate-950/20 border border-slate-900 hover:border-slate-800 rounded px-2.5 py-1.5 font-mono text-[10px] text-indigo-400 truncate"
              >
                SELECT * FROM dataset LIMIT 10
              </button>
              <button
                onClick={() => setNlQuery("Show columns count and sum of numeric columns")}
                className="w-full text-left bg-slate-950/20 border border-slate-900 hover:border-slate-800 rounded px-2.5 py-1.5 font-mono text-[10px] text-indigo-400 truncate"
              >
                Show columns count & sums
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Results & Visualizer */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6 min-h-[400px]">
          {isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-slate-450 gap-2">
              <span className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
              <span className="text-xs">SQL Agent generating statement...</span>
            </div>
          )}

          {!sqlResult && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-slate-550 gap-2">
              <Database size={36} className="text-slate-700" />
              <p className="text-xs">Enter a query parameter on the left and run.</p>
            </div>
          )}

          {sqlResult && !isLoading && (
            <div className="space-y-6">
              {/* Query info row */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="bg-indigo-950/20 px-3 py-1.5 rounded-lg border border-indigo-900/60 font-mono text-xs text-indigo-300 select-all truncate max-w-[80%]">
                  {sqlResult.query}
                </div>
                <div className="text-right flex items-center gap-1 text-slate-400 text-xs font-semibold">
                  <Clock size={12} className="text-indigo-400 animate-pulse" />
                  <span>{sqlResult.execution_time?.toFixed(1)}ms</span>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/20 max-h-[220px]">
                <table className="min-w-full text-xs text-left text-slate-350">
                  <thead className="bg-slate-950 border-b border-slate-850 font-semibold text-slate-400">
                    <tr>
                      {sqlResult.columns?.map((col) => (
                        <th key={col} className="px-3 py-2">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {sqlResult.rows?.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/30">
                        {Object.values(row).map((val, cellIdx) => (
                          <td key={cellIdx} className="px-3 py-2 truncate max-w-[120px]">{val !== null ? String(val) : 'null'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Automatic Plotly visualization of SQL query */}
              {sqlResult.plotly_json && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <BarChart3 size={12} className="text-indigo-400" />
                    <span>Auto Result Visualizer</span>
                  </h4>
                  <div className="bg-slate-950/20 p-2.5 rounded-xl border border-slate-850/50 flex justify-center">
                    <Plot
                      data={sqlResult.plotly_json.data}
                      layout={{
                        ...sqlResult.plotly_json.layout,
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        plot_bgcolor: 'rgba(0,0,0,0)',
                        width: 500,
                        height: 250,
                        margin: { l: 40, r: 20, t: 40, b: 40 },
                        font: { color: '#cbd5e1', size: 9 },
                        xaxis: { gridcolor: '#1e293b' },
                        yaxis: { gridcolor: '#1e293b' }
                      }}
                      config={{ displayModeBar: false }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
