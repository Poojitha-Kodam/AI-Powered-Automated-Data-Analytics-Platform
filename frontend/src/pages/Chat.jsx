import React, { useState, useEffect, useRef } from 'react'
import { Send, Sparkles, Database, ShieldAlert, BarChart3, LineChart, FileText, Bot } from 'lucide-react'
import Plot from 'react-plotly.js'

export default function Chat({ currentProject, activeDataset, apiKey, provider }) {
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activeInspector, setActiveInspector] = useState(null) // { type, data }
  
  const chatEndRef = useRef(null)

  // Scroll to bottom
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Load chat history when project changes
  useEffect(() => {
    if (currentProject) {
      fetchHistory()
    } else {
      setMessages([])
      setActiveInspector(null)
    }
  }, [currentProject])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchHistory = async () => {
    try {
      const res = await fetch(`https://ai-powered-automated-data-analytics.onrender.com/api/v1/chat/history/${currentProject.id}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
        // Find last message with chart to inspect
        const reversed = [...data].reverse()
        const lastChart = reversed.find(m => m.plotly_json)
        if (lastChart) {
          setActiveInspector({ type: 'chart', data: lastChart.plotly_json })
        }
      }
    } catch (e) {
      console.warn("Chat history endpoint error.")
    }
  }

  const handleSendMessage = async (e, customText = null) => {
    if (e) e.preventDefault()
    const text = customText || inputMessage
    if (!text.trim() || !currentProject || isLoading) return

    // Add local user message immediately
    const tempUserMsg = {
      id: Date.now(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempUserMsg])
    setInputMessage('')
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append('project_id', currentProject.id)
      formData.append('message', text)
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
        setMessages(prev => [...prev, {
          id: data.id,
          role: 'assistant',
          content: data.content,
          plotly_json: data.plotly_json,
          recommendations: data.recommendations
        }])
        
        // Auto route inspector based on returned payload
        if (data.plotly_json) {
          setActiveInspector({ type: 'chart', data: data.plotly_json })
        } else if (data.sql_data) {
          setActiveInspector({ type: 'sql', data: data.sql_data })
        } else if (data.ml_data) {
          setActiveInspector({ type: 'ml', data: data.ml_data })
        } else if (data.forecast_data) {
          setActiveInspector({ type: 'forecast', data: data.forecast_data })
        } else if (data.rag_data) {
          setActiveInspector({ type: 'rag', data: data.rag_data })
        } else if (data.report_file) {
          setActiveInspector({ type: 'report', data: data.report_file })
        }
      } else {
        alert("Server failed to respond to query.")
      }
    } catch (err) {
      alert("Network error connecting to AI agent core.")
    } finally {
      setIsLoading(false)
    }
  }

  const promptShortcuts = [
    { label: 'Clean Data', text: 'Clean my dataset and show suggestions' },
    { label: 'Dataset Summary', text: 'Generate statistical profile overview of the dataset' },
    { label: 'Forecast Sales', text: 'Forecast next 12 periods' },
    { label: 'Show correlation', text: 'Show correlation heatmap' }
  ]

  if (!currentProject) {
    return (
      <div className="glass-panel border-indigo-950 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4">
        <Bot size={48} className="text-indigo-400" />
        <h4 className="text-lg font-bold text-white">No Active Project</h4>
        <p className="text-sm text-slate-400">Select or create a project on Home first to start analyzing data.</p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-100px)] flex gap-6 overflow-hidden animate-fadeIn">
      {/* Left Pane: Chat Interface */}
      <div className="flex-1 flex flex-col bg-slate-900/10 border border-slate-850 rounded-2xl overflow-hidden glass-panel">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-slate-850 bg-slate-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-650/15 text-indigo-400 rounded-lg">
              <Bot size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white font-outfit text-sm">Multi-Agent Planner Core</h3>
              <div className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">
                {activeDataset ? `Dataset: ${activeDataset.name}` : 'No active dataset'}
              </div>
            </div>
          </div>
          {/* Badge */}
          <span className="text-[9px] font-bold bg-indigo-950 border border-indigo-900 text-indigo-300 px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
            <Sparkles size={8} /> Active Memory
          </span>
        </div>

        {/* API Key warning banner */}
        {!apiKey && (
          <div className="bg-amber-950/20 border-b border-amber-900/30 px-6 py-2.5 flex items-center justify-between text-xs text-amber-500 font-medium">
            <div className="flex items-center gap-2">
              <ShieldAlert size={14} />
              <span>Running in local rule fallback mode. Add your API Key in settings to enable GPT/Gemini agents!</span>
            </div>
          </div>
        )}

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-4">
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-850 text-indigo-400">
                <Bot size={36} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-200">Start the conversation</h4>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  I can clean data, profile variables, execute SQL, create interactive charts, build segments, or run forecasts. Try clicking one of the shortcuts below.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === 'user'
            return (
              <div 
                key={msg.id} 
                className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                <div className={`p-2 rounded-lg text-white self-start ${isUser ? 'bg-indigo-600' : 'bg-slate-900 border border-slate-850'}`}>
                  <Bot size={14} className={isUser ? 'text-indigo-200' : 'text-slate-400'} />
                </div>
                <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  isUser 
                    ? 'bg-indigo-650/15 border border-indigo-900/60 text-slate-100' 
                    : 'bg-slate-900/30 border border-slate-850 text-slate-300'
                }`}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* Attachment indicators inside chat log */}
                  {msg.plotly_json && (
                    <button 
                      onClick={() => setActiveInspector({ type: 'chart', data: msg.plotly_json })}
                      className="mt-3 text-xs bg-indigo-950/50 hover:bg-indigo-900/50 border border-indigo-900 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-indigo-400 font-semibold transition-colors"
                    >
                      <LineChart size={12} />
                      <span>Inspect Chart Visualizer</span>
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {isLoading && (
            <div className="flex gap-3 mr-auto items-center">
              <div className="p-2 bg-slate-900 border border-slate-850 rounded-lg text-slate-400">
                <Bot size={14} className="animate-pulse" />
              </div>
              <div className="text-xs text-slate-500 italic">Planner agent coordinating sub-agents...</div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Prompt shortcuts */}
        {messages.length === 0 && (
          <div className="px-6 py-2.5 grid grid-cols-2 gap-2">
            {promptShortcuts.map((short, idx) => (
              <button
                key={idx}
                onClick={(e) => handleSendMessage(e, short.text)}
                className="text-left bg-slate-900/40 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-400 hover:text-slate-200 transition-all truncate"
              >
                {short.label}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-850 bg-slate-900/25 flex gap-2.5">
          <input
            type="text"
            placeholder="Ask a question about the dataset (e.g. 'Show regional sales summary')..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isLoading}
            className="flex-1 glass-input text-sm rounded-xl px-4 py-3"
          />
          <button
            type="submit"
            disabled={isLoading || !inputMessage.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl transition-all disabled:opacity-55 disabled:cursor-not-allowed shadow-md shadow-indigo-600/10"
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* Right Pane: Context Inspector Panel */}
      <div className="w-[450px] bg-slate-900/10 border border-slate-850 rounded-2xl overflow-hidden glass-panel flex flex-col">
        {/* Inspector Header */}
        <div className="px-6 py-4 border-b border-slate-850 bg-slate-900/40">
          <h3 className="font-bold text-white font-outfit text-sm">Context Inspector</h3>
          <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Interactive outputs previewer</span>
        </div>

        {/* Inspector content area */}
        <div className="flex-1 overflow-y-auto p-6">
          {!activeInspector ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-550 space-y-3">
              <BarChart3 size={32} className="text-slate-700" />
              <div className="text-xs">No active visual asset. Ask AI to visualize charts, forecast, or write SQL queries to see output here.</div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Chart Renderer */}
              {activeInspector.type === 'chart' && activeInspector.data && (
                <div className="space-y-4">
                  <div className="bg-slate-950/40 rounded-xl p-3.5 border border-slate-850 overflow-hidden flex justify-center">
                    <Plot
                      data={activeInspector.data.data}
                      layout={{
                        ...activeInspector.data.layout,
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        plot_bgcolor: 'rgba(0,0,0,0)',
                        width: 380,
                        height: 300,
                        margin: { l: 40, r: 20, t: 40, b: 40 },
                        font: { color: '#cbd5e1', size: 9 },
                        xaxis: { ...activeInspector.data.layout.xaxis, gridcolor: '#1e293b' },
                        yaxis: { ...activeInspector.data.layout.yaxis, gridcolor: '#1e293b' }
                      }}
                      config={{ displayModeBar: false }}
                    />
                  </div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Plot Config</h4>
                  <div className="text-[10px] bg-slate-950 rounded-xl p-3 border border-slate-850 font-mono text-indigo-400 truncate">
                    Type: {activeInspector.data.data?.[0]?.type || 'scatter'}
                  </div>
                </div>
              )}

              {/* SQL Result Table */}
              {activeInspector.type === 'sql' && activeInspector.data && (
                <div className="space-y-4">
                  <div className="p-3 bg-indigo-950/15 border border-indigo-900/60 rounded-xl">
                    <div className="text-[10px] text-indigo-400 uppercase tracking-wider font-semibold">Generated Query</div>
                    <pre className="text-xs text-indigo-300 font-mono mt-1 whitespace-pre-wrap">{activeInspector.data.query}</pre>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/20">
                    <table className="min-w-full text-[10px] text-left text-slate-350">
                      <thead className="bg-slate-950 border-b border-slate-850 font-semibold text-slate-400">
                        <tr>
                          {activeInspector.data.columns?.map((col) => (
                            <th key={col} className="px-3 py-2">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {activeInspector.data.rows?.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/30">
                            {Object.values(row).map((val, cellIdx) => (
                              <td key={cellIdx} className="px-3 py-2 truncate max-w-[100px]">{val !== null ? String(val) : 'null'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Forecast/ML Results */}
              {activeInspector.type === 'forecast' && activeInspector.data && (
                <div className="space-y-4">
                  <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-850">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Business Recommendation</h4>
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">{activeInspector.data.recommendation}</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Future Predictions Table</h4>
                    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/20">
                      <table className="min-w-full text-[10px] text-left text-slate-350">
                        <thead className="bg-slate-950 border-b border-slate-850 font-semibold text-slate-400">
                          <tr>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Forecast</th>
                            <th className="px-3 py-2">Interval</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {activeInspector.data.forecast_dates?.slice(0, 10).map((d, idx) => (
                            <tr key={idx} className="hover:bg-slate-900/30">
                              <td className="px-3 py-2">{d}</td>
                              <td className="px-3 py-2 font-semibold text-indigo-400">{activeInspector.data.forecast_values[idx]?.toFixed(2)}</td>
                              <td className="px-3 py-2 text-slate-500">
                                [{activeInspector.data.lower_bound[idx]?.toFixed(1)}, {activeInspector.data.upper_bound[idx]?.toFixed(1)}]
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ML model metrics */}
              {activeInspector.type === 'ml' && activeInspector.data && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-850 space-y-2.5">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Model Class</div>
                    <div className="text-sm font-bold text-white">{activeInspector.data.model_type}</div>
                    
                    {activeInspector.data.r2 !== undefined && (
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">R-Squared Accuracy</div>
                        <div className="text-xl font-bold text-emerald-400 mt-0.5">{(activeInspector.data.r2 * 100).toFixed(1)}%</div>
                      </div>
                    )}
                    {activeInspector.data.accuracy !== undefined && (
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Classification Accuracy</div>
                        <div className="text-xl font-bold text-emerald-400 mt-0.5">{(activeInspector.data.accuracy * 100).toFixed(1)}%</div>
                      </div>
                    )}
                    {activeInspector.data.silhouette_score !== undefined && (
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Silhouette Segmentation Score</div>
                        <div className="text-xl font-bold text-indigo-400 mt-0.5">{activeInspector.data.silhouette_score.toFixed(3)}</div>
                      </div>
                    )}
                    {activeInspector.data.anomaly_count !== undefined && (
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Anomalies Flagged</div>
                        <div className="text-xl font-bold text-rose-500 mt-0.5">{activeInspector.data.anomaly_count} ({activeInspector.data.anomaly_percent?.toFixed(1)}%)</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Report compile link */}
              {activeInspector.type === 'report' && activeInspector.data && (
                <div className="bg-slate-900/20 p-6 rounded-2xl border border-slate-850 text-center space-y-4">
                  <FileText size={48} className="text-indigo-400 mx-auto" />
                  <div>
                    <h4 className="text-sm font-bold text-white">Executive PDF Report Compiled</h4>
                    <p className="text-[11px] text-slate-500 mt-1">Contains data statistics summaries, cleaning logs, visual charts, and forecasting charts.</p>
                  </div>
                  <a 
                    href={`https://ai-powered-automated-data-analytics.onrender.com${activeInspector.data}`} 
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full bg-indigo-650 hover:bg-indigo-600 text-xs font-semibold py-2.5 rounded-xl transition-colors"
                  >
                    Download PDF Document
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
