import React, { useState } from 'react'
import { Upload, Database, LayoutGrid, CheckCircle2, ChevronRight, AlertTriangle, Play } from 'lucide-react'

export default function Home({
  currentProject,
  setCurrentProject,
  activeDataset,
  setActiveDataset,
  projectsList,
  onSelectProject,
  loadProjects,
  setCurrentPage
}) {
  const [newProjectName, setNewProjectName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [dbConfig, setDbConfig] = useState({
    db_type: 'sqlite',
    host: 'localhost',
    port: '5432',
    database: '',
    username: '',
    password: ''
  })
  const [dbFile, setDbFile] = useState(null)
  const [showDbForm, setShowDbForm] = useState(false)
  const [uploadMessage, setUploadMessage] = useState(null)

  const handleCreateProject = async (e) => {
    e.preventDefault()
    if (!newProjectName.trim()) return

    try {
      const formData = new FormData()
      formData.append('name', newProjectName)
      
      const res = await fetch('https://ai-powered-automated-data-analytics.onrender.com/api/v1/projects', {
        method: 'POST',
        body: formData
      })
      if (res.ok) {
        const data = await res.json()
        setNewProjectName('')
        await loadProjects()
        setCurrentProject({ id: data.id, name: data.name })
        setActiveDataset(null)
      }
    } catch (err) {
      alert("Failed to connect to backend server. Make sure FastAPI is running.")
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !currentProject) return

    setIsUploading(true)
    setUploadMessage(null)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('project_id', currentProject.id)

    try {
      const res = await fetch('https://ai-powered-automated-data-analytics.onrender.com/api/v1/data/upload', {
        method: 'POST',
        body: formData
      })
      if (res.ok) {
        const data = await res.json()
        setActiveDataset({
          id: data.id,
          name: data.name,
          rows: data.rows,
          columns: data.columns,
          file_size: data.file_size,
          summary: data.summary,
          preview: data.preview,
          recommendations: data.recommendations,
          data_types: data.data_types
        })
        setUploadMessage({ type: 'success', text: `Dataset '${data.name}' successfully loaded and profiled!` })
        loadProjects()
      } else {
        const err = await res.json()
        setUploadMessage({ type: 'error', text: err.detail || 'Upload failed' })
      }
    } catch (err) {
      setUploadMessage({ type: 'error', text: 'Network connection error' })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDbConnect = async (e) => {
    e.preventDefault()
    if (!currentProject) return
    
    setIsUploading(true)
    setUploadMessage(null)
    const formData = new FormData()
    formData.append('project_id', currentProject.id)
    formData.append('db_type', dbConfig.db_type)
    formData.append('host', dbConfig.host)
    formData.append('port', dbConfig.port)
    formData.append('database', dbConfig.database)
    formData.append('username', dbConfig.username)
    formData.append('password', dbConfig.password)
    
    if (dbConfig.db_type === 'sqlite' && dbFile) {
      formData.append('sqlite_file', dbFile)
    }

    try {
      const res = await fetch('https://ai-powered-automated-data-analytics.onrender.com/api/v1/data/connect-db', {
        method: 'POST',
        body: formData
      })
      if (res.ok) {
        const data = await res.json()
        setUploadMessage({ type: 'success', text: data.message })
        loadProjects()
        // Trigger profile refresh
        if (data.dataset_id) {
          const detailRes = await fetch(`https://ai-powered-automated-data-analytics.onrender.com/api/v1/data/${data.dataset_id}/preview`)
          if (detailRes.ok) {
            const previewData = await detailRes.json()
            setActiveDataset({
              id: data.dataset_id,
              name: data.tables[0],
              rows: previewData.total_rows,
              columns: previewData.columns.length,
              preview: previewData.rows
            })
          }
        }
      } else {
        const err = await res.json()
        setUploadMessage({ type: 'error', text: err.detail || 'Connection failed' })
      }
    } catch (err) {
      setUploadMessage({ type: 'error', text: 'Database driver failure' })
    } finally {
      setIsUploading(false)
      setShowDbForm(false)
    }
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome Banner */}
      <div className="relative rounded-3xl overflow-hidden p-8 md:p-12 glass-panel border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -z-10"></div>
        <div className="max-w-2xl space-y-4">
          <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest bg-indigo-950/60 px-3.5 py-1.5 rounded-full border border-indigo-900/50">Next Gen Analytics</span>
          <h2 className="text-4xl md:text-5xl font-bold font-outfit text-white tracking-tight">AI-Powered Automated Data Analytics</h2>
          <p className="text-slate-400 leading-relaxed text-sm md:text-base">
            Upload datasets or connect databases. Our Multi-Agent coordinator automatically profiles metadata, cleans inconsistencies, creates Plotly visuals, and answers complex queries in plain English.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Project Management */}
        <div className="space-y-6 lg:col-span-1">
          <div className="glass-card rounded-2xl p-6 space-y-6">
            <h3 className="text-lg font-bold font-outfit text-white flex items-center gap-2">
              <LayoutGrid size={18} className="text-indigo-400" />
              <span>Workspace Projects</span>
            </h3>

            {/* Create Project Form */}
            <form onSubmit={handleCreateProject} className="flex gap-2">
              <input
                type="text"
                placeholder="New project name..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="flex-1 glass-input text-sm rounded-xl px-4 py-2.5"
              />
              <button 
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 font-semibold px-4 py-2 text-sm rounded-xl transition-all duration-200"
              >
                Create
              </button>
            </form>

            {/* Projects List */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {projectsList.map((proj) => {
                const isSelected = currentProject?.id === proj.id
                return (
                  <button
                    key={proj.id}
                    onClick={() => onSelectProject(proj)}
                    className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between group transition-all duration-200 ${
                      isSelected 
                        ? 'bg-indigo-950/60 border border-indigo-900 text-slate-100 font-medium' 
                        : 'bg-slate-900/30 border border-slate-900 text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                    }`}
                  >
                    <div className="truncate">
                      <div className="text-sm font-semibold truncate">{proj.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {proj.dataset ? `${proj.dataset.rows} rows • ${proj.dataset.columns} cols` : 'No data source'}
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-300 transition-colors" />
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Upload Data Module */}
        <div className="space-y-6 lg:col-span-2">
          {!currentProject ? (
            <div className="glass-panel border-amber-500/20 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4">
              <AlertTriangle size={48} className="text-amber-500" />
              <div>
                <h4 className="text-lg font-bold font-outfit text-white">Select or Create a Project</h4>
                <p className="text-sm text-slate-400 mt-1">You must have an active workspace project to upload datasets or connect databases.</p>
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold font-outfit text-white flex items-center gap-2">
                  <Upload size={18} className="text-indigo-400" />
                  <span>Dataset Upload Module</span>
                </h3>
                <button
                  onClick={() => setShowDbForm(!showDbForm)}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-950/30 border border-indigo-900 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                >
                  <Database size={12} />
                  <span>{showDbForm ? 'Upload File instead' : 'Connect DB'}</span>
                </button>
              </div>

              {uploadMessage && (
                <div className={`p-4 rounded-xl flex items-center gap-3 text-sm ${
                  uploadMessage.type === 'success' 
                    ? 'bg-emerald-950/40 border border-emerald-900/50 text-emerald-400' 
                    : 'bg-rose-950/40 border border-rose-900/50 text-rose-400'
                }`}>
                  <CheckCircle2 size={16} />
                  <span>{uploadMessage.text}</span>
                </div>
              )}

              {/* standard drag drop file upload */}
              {!showDbForm && (
                <div className="relative border-2 border-dashed border-slate-800 hover:border-indigo-500/60 rounded-2xl p-10 text-center transition-colors">
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    accept=".csv, .xlsx, .xls, .json, .parquet, .sqlite, .db"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isUploading}
                  />
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 bg-indigo-650/10 text-indigo-400 rounded-full">
                      <Upload size={32} />
                    </div>
                    <div>
                      <p className="text-slate-200 font-medium">Drag & drop files here or click to browse</p>
                      <p className="text-xs text-slate-500 mt-1">Supports CSV, Excel (XLSX), JSON, Parquet, and SQLite databases</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Database Connection Form */}
              {showDbForm && (
                <form onSubmit={handleDbConnect} className="space-y-4 bg-slate-900/20 p-4 rounded-2xl border border-slate-800">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Database Type</label>
                      <select
                        value={dbConfig.db_type}
                        onChange={(e) => setDbConfig({ ...dbConfig, db_type: e.target.value })}
                        className="w-full glass-input text-sm rounded-lg px-3 py-2"
                      >
                        <option value="sqlite">SQLite (.db)</option>
                        <option value="postgresql">PostgreSQL</option>
                        <option value="mysql">MySQL</option>
                        <option value="sqlserver">SQL Server</option>
                        <option value="snowflake">Snowflake</option>
                      </select>
                    </div>

                    {dbConfig.db_type === 'sqlite' ? (
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Select SQLite File</label>
                        <input
                          type="file"
                          accept=".db, .sqlite"
                          onChange={(e) => setDbFile(e.target.files[0])}
                          className="w-full text-xs text-slate-400 file:bg-indigo-900 file:border-none file:text-indigo-200 file:px-3 file:py-1 file:rounded file:mr-2"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Database Name</label>
                        <input
                          type="text"
                          value={dbConfig.database}
                          onChange={(e) => setDbConfig({ ...dbConfig, database: e.target.value })}
                          className="w-full glass-input text-sm rounded-lg px-3 py-2"
                        />
                      </div>
                    )}
                  </div>

                  {dbConfig.db_type !== 'sqlite' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Host</label>
                        <input
                          type="text"
                          value={dbConfig.host}
                          onChange={(e) => setDbConfig({ ...dbConfig, host: e.target.value })}
                          className="w-full glass-input text-sm rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Port</label>
                        <input
                          type="text"
                          value={dbConfig.port}
                          onChange={(e) => setDbConfig({ ...dbConfig, port: e.target.value })}
                          className="w-full glass-input text-sm rounded-lg px-3 py-2"
                        />
                      </div>
                    </div>
                  )}

                  {dbConfig.db_type !== 'sqlite' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Username</label>
                        <input
                          type="text"
                          value={dbConfig.username}
                          onChange={(e) => setDbConfig({ ...dbConfig, username: e.target.value })}
                          className="w-full glass-input text-sm rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Password</label>
                        <input
                          type="password"
                          value={dbConfig.password}
                          onChange={(e) => setDbConfig({ ...dbConfig, password: e.target.value })}
                          className="w-full glass-input text-sm rounded-lg px-3 py-2"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 font-semibold py-2 rounded-lg transition-colors"
                  >
                    Connect Database
                  </button>
                </form>
              )}

              {/* Uploading progress indicator */}
              {isUploading && (
                <div className="text-center py-6 text-slate-400 flex items-center justify-center gap-2 text-sm font-medium">
                  <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
                  <span>Profiling dataset...</span>
                </div>
              )}

              {/* Dataset Details display */}
              {activeDataset && !isUploading && (
                <div className="pt-6 border-t border-slate-800 space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">Dataset Profile Summary</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-slate-900/30 p-3.5 rounded-xl border border-slate-850">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide">Dataset Name</div>
                        <div className="text-sm font-bold text-slate-200 truncate mt-0.5">{activeDataset.name}</div>
                      </div>
                      <div className="bg-slate-900/30 p-3.5 rounded-xl border border-slate-850">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide">Total Rows</div>
                        <div className="text-sm font-bold text-slate-200 mt-0.5">{activeDataset.rows}</div>
                      </div>
                      <div className="bg-slate-900/30 p-3.5 rounded-xl border border-slate-850">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide">Columns</div>
                        <div className="text-sm font-bold text-slate-200 mt-0.5">{activeDataset.columns}</div>
                      </div>
                      <div className="bg-slate-900/30 p-3.5 rounded-xl border border-slate-850">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide">Memory Used</div>
                        <div className="text-sm font-bold text-slate-200 mt-0.5">{activeDataset.file_size ? `${(activeDataset.file_size/1024).toFixed(1)} KB` : 'N/A'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Actions shortcut cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button 
                      onClick={() => setCurrentPage('cleaning')}
                      className="text-left bg-gradient-to-r from-violet-950/20 to-indigo-950/20 hover:from-violet-950/30 hover:to-indigo-950/30 p-4 rounded-xl border border-indigo-900/40 hover:border-indigo-500 transition-all flex justify-between items-center group"
                    >
                      <div>
                        <div className="font-bold text-slate-200 flex items-center gap-1.5">
                          <span>Data Cleaning</span>
                          <span className="text-[9px] bg-indigo-800 text-indigo-200 px-1 rounded-sm uppercase tracking-wide">Agent</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Review missing value suggestions and duplicate removals.</p>
                      </div>
                      <ChevronRight size={16} className="text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                    
                    <button 
                      onClick={() => setCurrentPage('chat')}
                      className="text-left bg-gradient-to-r from-pink-950/20 to-rose-950/20 hover:from-pink-950/30 hover:to-rose-950/30 p-4 rounded-xl border border-rose-900/40 hover:border-rose-500 transition-all flex justify-between items-center group"
                    >
                      <div>
                        <div className="font-bold text-slate-200 flex items-center gap-1.5">
                          <span>AI Chat Core</span>
                          <span className="text-[9px] bg-rose-800 text-rose-250 px-1 rounded-sm uppercase tracking-wide">LLM</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Ask questions like "Show regional sales trend" or "Forecast inventory".</p>
                      </div>
                      <ChevronRight size={16} className="text-rose-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>

                  {/* Preview Table */}
                  {activeDataset.preview && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Preview (Top 5 rows)</h4>
                      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/10">
                        <table className="min-w-full text-xs text-left text-slate-350">
                          <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold">
                            <tr>
                              {Object.keys(activeDataset.preview[0] || {}).map((col) => (
                                <th key={col} className="px-4 py-3">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850">
                            {activeDataset.preview.slice(0, 5).map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-900/30">
                                {Object.values(row).map((val, cellIdx) => (
                                  <td key={cellIdx} className="px-4 py-2.5 truncate max-w-[150px]">{val !== null ? String(val) : 'NaN'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
