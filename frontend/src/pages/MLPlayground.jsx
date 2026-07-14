import React, { useState, useEffect } from 'react'
import { BrainCircuit, Play, Settings2, BarChart2, ShieldAlert } from 'lucide-react'
import Plot from 'react-plotly.js'

export default function MLPlayground({ currentProject, activeDataset }) {
  const [columns, setColumns] = useState([])
  const [taskType, setTaskType] = useState('regression')
  const [targetCol, setTargetCol] = useState('')
  const [selectedFeatures, setSelectedFeatures] = useState([])
  const [nClusters, setNClusters] = useState(3)
  const [isLoading, setIsLoading] = useState(false)
  const [mlResult, setMlResult] = useState(null)

  useEffect(() => {
    if (activeDataset) {
      const cols = activeDataset.column_names || (activeDataset.summary?.columns_profile ? Object.keys(activeDataset.summary.columns_profile) : [])
      setColumns(cols)
      if (cols.length > 0) {
        setTargetCol(cols[cols.length - 1])
        // Select first 3 columns as default features
        setSelectedFeatures(cols.slice(0, Math.min(3, cols.length - 1)))
      }
    }
  }, [activeDataset])

  const handleToggleFeature = (col) => {
    setSelectedFeatures(prev => {
      if (prev.includes(col)) {
        return prev.filter(f => f !== col)
      } else {
        return [...prev, col]
      }
    })
  }

  const handleTrainModel = async () => {
    if (!activeDataset || selectedFeatures.length === 0) return
    setIsLoading(true)
    setMlResult(null)

    try {
      const formData = new FormData()
      formData.append('dataset_id', activeDataset.id)
      formData.append('task_type', taskType)
      formData.append('features', JSON.stringify(selectedFeatures))
      formData.append('n_clusters', nClusters)
      if (taskType === 'regression' || taskType === 'classification') {
        formData.append('target_col', targetCol)
      }

      const res = await fetch('https://ai-powered-automated-data-analytics.onrender.com/api/v1/ml/train-model', {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        const data = await res.json()
        setMlResult(data)
      } else {
        const err = await res.json()
        alert(err.detail || 'Training failed.')
      }
    } catch (e) {
      alert('Error running model training pipeline.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!activeDataset) {
    return (
      <div className="glass-panel border-indigo-950 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4">
        <BrainCircuit size={48} className="text-indigo-400" />
        <h4 className="text-lg font-bold text-white">No Dataset Loaded</h4>
        <p className="text-sm text-slate-400">Please go to Home & Upload to import a data source first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-bold font-outfit text-white">Machine Learning Module</h2>
        <p className="text-xs text-slate-400 mt-1">Train regression, classification, clustering, or anomaly detection models on demand.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Controls Column */}
        <div className="lg:col-span-1 glass-card rounded-2xl p-6 space-y-6">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Settings2 size={16} className="text-indigo-400" />
            <span>Model Configuration</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">ML Task Type</label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="w-full glass-input text-sm rounded-xl px-3 py-2"
              >
                <option value="regression">Regression (Continuous values)</option>
                <option value="classification">Classification (Labels/Categories)</option>
                <option value="clustering">Clustering (Segmentation)</option>
                <option value="anomaly">Anomaly Detection (Outliers)</option>
              </select>
            </div>

            {(taskType === 'regression' || taskType === 'classification') && (
              <div>
                <label className="text-xs text-slate-400 block mb-1">Target Predictor (Y)</label>
                <select
                  value={targetCol}
                  onChange={(e) => setTargetCol(e.target.value)}
                  className="w-full glass-input text-sm rounded-xl px-3 py-2"
                >
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            {taskType === 'clustering' && (
              <div>
                <label className="text-xs text-slate-400 block mb-1">Number of Segments (K)</label>
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={nClusters}
                  onChange={(e) => setNClusters(parseInt(e.target.value))}
                  className="w-full glass-input text-sm rounded-xl px-3 py-2"
                />
              </div>
            )}

            <div>
              <label className="text-xs text-slate-400 block mb-2">Features to Include (X)</label>
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {columns.filter(c => c !== targetCol || taskType === 'clustering' || taskType === 'anomaly').map((col) => {
                  const isChecked = selectedFeatures.includes(col)
                  return (
                    <button
                      key={col}
                      onClick={() => handleToggleFeature(col)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left text-xs ${
                        isChecked 
                          ? 'bg-indigo-950/20 border-indigo-900 text-indigo-300' 
                          : 'bg-slate-900/10 border-slate-900 text-slate-500 hover:text-slate-350'
                      }`}
                    >
                      <span>{col}</span>
                      <span>{isChecked ? '✓' : ''}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <button
              onClick={handleTrainModel}
              disabled={isLoading || selectedFeatures.length === 0}
              className="w-full bg-indigo-650 hover:bg-indigo-600 font-semibold py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 text-sm disabled:opacity-55"
            >
              <Play size={14} />
              <span>{isLoading ? 'Training Model...' : 'Train Model'}</span>
            </button>
          </div>
        </div>

        {/* Results Column */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6 min-h-[400px]">
          {isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-slate-450 gap-2">
              <span className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
              <span className="text-xs">Fitting algorithm on data...</span>
            </div>
          )}

          {!mlResult && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
              <BrainCircuit size={36} className="text-slate-700" />
              <p className="text-xs">Adjust configuration and click Train Model.</p>
            </div>
          )}

          {mlResult && !isLoading && (
            <div className="space-y-6">
              {/* Header metrics card */}
              <div className="p-4 bg-slate-950/20 border border-slate-850 rounded-xl grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Algorithm</div>
                  <div className="text-sm font-bold text-white mt-0.5">{mlResult.model_type}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Model accuracy</div>
                  <div className="text-md font-bold text-emerald-400 mt-0.5">
                    {mlResult.r2 !== undefined ? `R²: ${(mlResult.r2 * 100).toFixed(1)}%` : ''}
                    {mlResult.accuracy !== undefined ? `Accuracy: ${(mlResult.accuracy * 100).toFixed(1)}%` : ''}
                    {mlResult.silhouette_score !== undefined ? `Silhouette: ${mlResult.silhouette_score.toFixed(3)}` : ''}
                    {mlResult.anomaly_count !== undefined ? `Anomalies: ${mlResult.anomaly_count}` : ''}
                  </div>
                </div>
              </div>

              {/* Feature Importances bar chart */}
              {mlResult.feature_importance && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <BarChart2 size={12} className="text-indigo-400" />
                    <span>Feature Importance</span>
                  </h4>
                  <div className="bg-slate-950/20 p-2.5 rounded-xl border border-slate-850/50">
                    <Plot
                      data={[
                        {
                          x: mlResult.feature_importance.map(f => f.importance),
                          y: mlResult.feature_importance.map(f => f.feature),
                          type: 'bar',
                          orientation: 'h',
                          marker: { color: '#6366f1' }
                        }
                      ]}
                      layout={{
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        plot_bgcolor: 'rgba(0,0,0,0)',
                        width: 500,
                        height: 200,
                        margin: { l: 120, r: 20, t: 10, b: 30 },
                        font: { color: '#cbd5e1', size: 9 },
                        xaxis: { gridcolor: '#1e293b' },
                        yaxis: { gridcolor: '#1e293b' }
                      }}
                      config={{ displayModeBar: false }}
                    />
                  </div>
                </div>
              )}

              {/* Confusion Matrix (for classification) */}
              {mlResult.confusion_matrix && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <ShieldAlert size={12} className="text-rose-500" />
                    <span>Confusion Matrix Grid</span>
                  </h4>
                  <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/20 max-w-xs">
                    <table className="min-w-full text-center text-xs text-slate-350">
                      <thead className="bg-slate-950 border-b border-slate-850 font-semibold text-slate-400">
                        <tr>
                          <th className="px-3 py-2">Actual / Predicted</th>
                          {mlResult.classes?.map((c, idx) => <th key={idx} className="px-3 py-2">{c}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {mlResult.confusion_matrix.map((row, rIdx) => (
                          <tr key={rIdx}>
                            <td className="px-3 py-2 font-semibold bg-slate-950/30 text-left text-slate-400">{mlResult.classes[rIdx]}</td>
                            {row.map((val, cIdx) => (
                              <td key={cIdx} className={`px-3 py-2 font-mono ${rIdx === cIdx ? 'text-emerald-450 font-bold bg-emerald-500/5' : 'text-slate-550'}`}>{val}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Cluster Projection Scatter plot */}
              {mlResult.plot_data && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">PCA Cluster Projection</h4>
                  <div className="bg-slate-950/20 p-2.5 rounded-xl border border-slate-850/50 flex justify-center">
                    <Plot
                      data={[
                        {
                          x: mlResult.plot_data.map(p => p.x),
                          y: mlResult.plot_data.map(p => p.y),
                          mode: 'markers',
                          type: 'scatter',
                          marker: {
                            color: mlResult.plot_data.map(p => p.cluster !== undefined ? p.cluster : (p.anomaly ? 1 : 0)),
                            colorscale: 'Viridis',
                            size: 6,
                            opacity: 0.8
                          }
                        }
                      ]}
                      layout={{
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        plot_bgcolor: 'rgba(0,0,0,0)',
                        width: 500,
                        height: 250,
                        margin: { l: 30, r: 20, t: 10, b: 30 },
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
