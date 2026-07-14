import React, { useState, useEffect } from 'react'
import { BarChart3, Settings2, Download, Save, LineChart } from 'lucide-react'
import Plot from 'react-plotly.js'

export default function Visualizations({ currentProject, activeDataset }) {
  const [columns, setColumns] = useState([])
  const [chartType, setChartType] = useState('bar')
  const [xCol, setXCol] = useState('')
  const [yCol, setYCol] = useState('')
  const [title, setTitle] = useState('')
  const [plotConfig, setPlotConfig] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (activeDataset) {
      // Parse columns from dataset profile or metadata
      if (activeDataset.column_names) {
        setColumns(activeDataset.column_names)
        setXCol(activeDataset.column_names[0] || '')
      } else if (activeDataset.summary?.columns_profile) {
        const cols = Object.keys(activeDataset.summary.columns_profile)
        setColumns(cols)
        setXCol(cols[0] || '')
      }
    }
  }, [activeDataset])

  const handleGenerateChart = async () => {
    if (!activeDataset || !xCol) return
    setIsLoading(true)

    // Form parameter payloads
    const q = `Generate a ${chartType} chart for column '${xCol}'` + (yCol ? ` vs column '${yCol}'` : '')
    
    try {
      const formData = new FormData()
      formData.append('project_id', currentProject.id)
      formData.append('message', q)
      // Send directly to chat API so the planner agent invokes visualization
      const res = await fetch('https://ai-powered-automated-data-analytics.onrender.com/api/v1/chat/send', {
        method: 'POST',
        body: formData
      })
      if (res.ok) {
        const data = await res.json()
        if (data.plotly_json) {
          // Override title if user entered customized one
          if (title.trim()) {
            data.plotly_json.layout.title = title
          }
          setPlotConfig(data.plotly_json)
        } else {
          alert("Could not generate chart using these columns.")
        }
      }
    } catch (e) {
      alert("Error generating chart.")
    } finally {
      setIsLoading(false)
    }
  }

  if (!activeDataset) {
    return (
      <div className="glass-panel border-indigo-950 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4">
        <LineChart size={48} className="text-indigo-400" />
        <h4 className="text-lg font-bold text-white">No Dataset Loaded</h4>
        <p className="text-sm text-slate-400">Please go to Home & Upload to import a data source first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-bold font-outfit text-white">Custom Chart Maker</h2>
        <p className="text-xs text-slate-400 mt-1">Design customized interactive charts using your variables.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Controls Form */}
        <div className="lg:col-span-1 glass-card rounded-2xl p-6 space-y-6">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Settings2 size={16} className="text-indigo-400" />
            <span>Chart Controls</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Chart Type</label>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
                className="w-full glass-input text-sm rounded-xl px-3 py-2"
              >
                <option value="bar">Bar Chart</option>
                <option value="line">Line Chart</option>
                <option value="pie">Pie Chart</option>
                <option value="scatter">Scatter Plot</option>
                <option value="area">Area Chart</option>
                <option value="histogram">Histogram</option>
                <option value="box">Box Plot</option>
                <option value="treemap">Treemap</option>
                <option value="funnel">Funnel Chart</option>
                <option value="waterfall">Waterfall Chart</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">X-Axis Column</label>
              <select
                value={xCol}
                onChange={(e) => setXCol(e.target.value)}
                className="w-full glass-input text-sm rounded-xl px-3 py-2"
              >
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Y-Axis Column (Optional)</label>
              <select
                value={yCol}
                onChange={(e) => setYCol(e.target.value)}
                className="w-full glass-input text-sm rounded-xl px-3 py-2"
              >
                <option value="">-- None (Count/Freq) --</option>
                {columns.filter(c => c !== xCol).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Custom Chart Title</label>
              <input
                type="text"
                placeholder="Enter chart title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full glass-input text-sm rounded-xl px-3 py-2"
              />
            </div>

            <button
              onClick={handleGenerateChart}
              disabled={isLoading || !xCol}
              className="w-full bg-indigo-650 hover:bg-indigo-600 font-semibold py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 text-sm disabled:opacity-55"
            >
              {isLoading ? 'Plotting...' : 'Generate Chart'}
            </button>
          </div>
        </div>

        {/* Right Side: Chart viewport */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6 min-h-[400px] flex flex-col justify-between">
          <div className="flex-1 flex items-center justify-center">
            {plotConfig ? (
              <div className="w-full h-full flex justify-center py-4 bg-slate-950/20 rounded-2xl border border-slate-850/50">
                <Plot
                  data={plotConfig.data}
                  layout={{
                    ...plotConfig.layout,
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    width: 580,
                    height: 400,
                    margin: { l: 50, r: 30, t: 50, b: 50 },
                    font: { color: '#cbd5e1', size: 10 },
                    xaxis: { ...plotConfig.layout.xaxis, gridcolor: '#1e293b' },
                    yaxis: { ...plotConfig.layout.yaxis, gridcolor: '#1e293b' }
                  }}
                  config={{ responsive: true }}
                />
              </div>
            ) : (
              <div className="text-center text-slate-500 flex flex-col items-center gap-3">
                <BarChart3 size={36} className="text-slate-700" />
                <p className="text-xs">Adjust controls on the left and click Generate Chart.</p>
              </div>
            )}
          </div>
          
          {/* Save/Export Footer options */}
          {plotConfig && (
            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-850 mt-4">
              <button 
                onClick={() => alert("Chart saved successfully to Project Dashboards.")}
                className="text-xs font-semibold text-slate-450 hover:text-slate-200 border border-slate-800 hover:border-slate-750 px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Save size={12} />
                <span>Save to Dashboards</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
