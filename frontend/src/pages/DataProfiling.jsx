import React, { useState, useEffect } from 'react'
import { BarChart3, HelpCircle, Sigma, Tags, Calendar, ArrowUpRight } from 'lucide-react'

export default function DataProfiling({ currentProject, activeDataset }) {
  const [profile, setProfile] = useState(null)
  const [selectedColumn, setSelectedColumn] = useState(null)
  
  useEffect(() => {
    if (activeDataset?.summary) {
      setProfile(activeDataset.summary)
      // Select first column by default
      const colNames = Object.keys(activeDataset.summary.columns_profile || {})
      if (colNames.length > 0) {
        setSelectedColumn(colNames[0])
      }
    }
  }, [activeDataset])

  if (!activeDataset || !profile) {
    return (
      <div className="glass-panel border-indigo-950 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4">
        <BarChart3 size={48} className="text-indigo-400" />
        <h4 className="text-lg font-bold text-white">No Profile Available</h4>
        <p className="text-sm text-slate-400">Please go to Home & Upload to import a data source first.</p>
      </div>
    )
  }

  const columnsProfile = profile.columns_profile || {}
  const colNames = Object.keys(columnsProfile)

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-bold font-outfit text-white">Automated Data Profiling</h2>
        <p className="text-xs text-slate-400 mt-1">Full statistical summary and semantic classifications for all variables.</p>
      </div>

      {/* Dataset Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-card rounded-2xl p-5 border border-slate-850">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Rows</div>
          <div className="text-2xl font-bold text-white mt-1">{profile.rows}</div>
        </div>
        <div className="glass-card rounded-2xl p-5 border border-slate-850">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Variables</div>
          <div className="text-2xl font-bold text-white mt-1">{profile.columns}</div>
        </div>
        <div className="glass-card rounded-2xl p-5 border border-slate-850">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
            <Sigma size={12} className="text-indigo-400" />
            <span>Numerical</span>
          </div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{profile.numerical_columns?.length || 0}</div>
        </div>
        <div className="glass-card rounded-2xl p-5 border border-slate-850">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
            <Tags size={12} className="text-pink-400" />
            <span>Categorical</span>
          </div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{profile.categorical_columns?.length || 0}</div>
        </div>
        <div className="glass-card rounded-2xl p-5 border border-slate-850">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Duplicate Rows</div>
          <div className="text-2xl font-bold text-amber-500 mt-1">{profile.duplicate_rows || 0}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Columns List */}
        <div className="lg:col-span-1 glass-card rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Select Column</h3>
          <div className="space-y-1.5 max-h-[450px] overflow-y-auto pr-1">
            {colNames.map((col) => {
              const colStats = columnsProfile[col]
              const isSelected = selectedColumn === col
              
              let TypeIcon = HelpCircle
              let iconColor = 'text-slate-450'
              if (colStats.type === 'numerical') {
                TypeIcon = Sigma
                iconColor = 'text-indigo-400'
              } else if (colStats.type === 'categorical') {
                TypeIcon = Tags
                iconColor = 'text-pink-400'
              } else if (colStats.type === 'datetime') {
                TypeIcon = Calendar
                iconColor = 'text-emerald-450'
              }

              return (
                <button
                  key={col}
                  onClick={() => setSelectedColumn(col)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${
                    isSelected 
                      ? 'bg-slate-900 border-indigo-500 text-slate-100' 
                      : 'bg-slate-900/20 border-slate-900 text-slate-400 hover:bg-slate-900/40 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <TypeIcon size={16} className={iconColor} />
                    <span className="text-sm font-semibold truncate">{col}</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-slate-600">{colStats.type}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Side: Detailed Column Statistics */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6 space-y-6">
          {selectedColumn && columnsProfile[selectedColumn] ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-white font-outfit">{selectedColumn}</h3>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Data type: <span className="font-mono text-indigo-400">{columnsProfile[selectedColumn].dtype}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Missing values</div>
                  <div className="text-sm font-bold text-slate-300">
                    {columnsProfile[selectedColumn].missing_count} ({columnsProfile[selectedColumn].missing_percent?.toFixed(1)}%)
                  </div>
                </div>
              </div>

              {/* Statistics Grid */}
              {columnsProfile[selectedColumn].type === 'numerical' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-850">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Mean</div>
                    <div className="text-md font-bold text-slate-200 mt-1">{columnsProfile[selectedColumn].mean?.toFixed(4)}</div>
                  </div>
                  <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-850">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Median</div>
                    <div className="text-md font-bold text-slate-200 mt-1">{columnsProfile[selectedColumn].median?.toFixed(4)}</div>
                  </div>
                  <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-850">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Mode</div>
                    <div className="text-md font-bold text-slate-200 mt-1">{columnsProfile[selectedColumn].mode !== null ? columnsProfile[selectedColumn].mode : 'N/A'}</div>
                  </div>
                  <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-850">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Minimum</div>
                    <div className="text-md font-bold text-slate-200 mt-1">{columnsProfile[selectedColumn].min}</div>
                  </div>
                  <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-850">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Maximum</div>
                    <div className="text-md font-bold text-slate-200 mt-1">{columnsProfile[selectedColumn].max}</div>
                  </div>
                  <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-850">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Std Deviation</div>
                    <div className="text-md font-bold text-slate-200 mt-1">{columnsProfile[selectedColumn].std?.toFixed(4)}</div>
                  </div>
                  <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-850">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Skewness</div>
                    <div className="text-md font-bold text-slate-200 mt-1">{columnsProfile[selectedColumn].skewness?.toFixed(4)}</div>
                  </div>
                  <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-850">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Kurtosis</div>
                    <div className="text-md font-bold text-slate-200 mt-1">{columnsProfile[selectedColumn].kurtosis?.toFixed(4)}</div>
                  </div>
                  <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-850">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold text-amber-500">Outliers (IQR)</div>
                    <div className="text-md font-bold text-amber-500 mt-1">{columnsProfile[selectedColumn].outliers_count}</div>
                  </div>
                </div>
              )}

              {/* Categorical Distribution */}
              {columnsProfile[selectedColumn].type === 'categorical' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-850">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Unique Items</div>
                      <div className="text-md font-bold text-slate-200 mt-1">{columnsProfile[selectedColumn].unique_count}</div>
                    </div>
                    <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-850">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Most Common Value</div>
                      <div className="text-md font-bold text-slate-200 mt-1 truncate" title={columnsProfile[selectedColumn].most_common_value}>
                        '{columnsProfile[selectedColumn].most_common_value}'
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Top Frequency Table</div>
                    <div className="space-y-2.5">
                      {columnsProfile[selectedColumn].top_values?.map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs text-slate-350">
                            <span className="font-semibold truncate">'{item.value}'</span>
                            <span>{item.count} ({item.percent?.toFixed(1)}%)</span>
                          </div>
                          <div className="w-full bg-slate-950 rounded-full h-1.5">
                            <div className="bg-pink-500 h-1.5 rounded-full" style={{ width: `${item.percent}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Datetime stats */}
              {columnsProfile[selectedColumn].type === 'datetime' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-850">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Start Period</div>
                    <div className="text-sm font-bold text-slate-200 mt-1">{columnsProfile[selectedColumn].min_date ? columnsProfile[selectedColumn].min_date.split('T')[0] : 'N/A'}</div>
                  </div>
                  <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-850">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">End Period</div>
                    <div className="text-sm font-bold text-slate-200 mt-1">{columnsProfile[selectedColumn].max_date ? columnsProfile[selectedColumn].max_date.split('T')[0] : 'N/A'}</div>
                  </div>
                  <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-850">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Span (days)</div>
                    <div className="text-sm font-bold text-slate-200 mt-1">{columnsProfile[selectedColumn].span_days} days</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20 text-slate-500">Select a variable from the left list to see metrics.</div>
          )}
        </div>
      </div>
    </div>
  )
}
