import React, { useState } from 'react'
import { 
  Home, Database, Brush, BarChart3, MessageSquare, 
  LineChart, LayoutDashboard, Key, Terminal, BrainCircuit,
  Settings, Sun, Moon, Sparkles, FolderClosed, FileSpreadsheet
} from 'lucide-react'

export default function Sidebar({
  currentPage,
  setCurrentPage,
  currentProject,
  activeDataset,
  theme,
  setTheme,
  apiKey,
  setApiKey,
  provider,
  setProvider
}) {
  const [showSettings, setShowSettings] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const navItems = [
    { id: 'home', label: 'Home & Upload', icon: Home },
    { id: 'chat', label: 'AI Chat Core', icon: MessageSquare, badge: 'Agent' },
    { id: 'cleaning', label: 'Data Cleaning', icon: Brush },
    { id: 'profiling', label: 'Data Profiling', icon: BarChart3 },
    { id: 'visualize', label: 'Custom Chart Maker', icon: LineChart },
    { id: 'dashboard', label: 'Dashboard Builder', icon: LayoutDashboard },
    { id: 'ml', label: 'ML Playground', icon: BrainCircuit },
    { id: 'sql', label: 'SQL Terminal', icon: Terminal },
  ]

  return (
    <div className={`glass-panel border-r border-slate-800 flex flex-col transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-72'} min-h-screen`}>
      {/* Header / Logo */}
      <div className="p-6 border-b border-slate-800 flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white font-bold">AG</div>
            <div>
              <h1 className="font-semibold text-lg leading-tight tracking-wider bg-gradient-to-r from-indigo-400 to-pink-500 bg-clip-text text-transparent">Antigravity</h1>
              <span className="text-xs text-slate-400">Automated Analytics</span>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="p-2 bg-indigo-600 rounded-lg text-white font-bold mx-auto">AG</div>
        )}
      </div>

      {/* Active Project & Dataset Badge */}
      {!isCollapsed && currentProject && (
        <div className="mx-4 mt-4 p-3 rounded-lg bg-slate-900/50 border border-slate-800 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
            <FolderClosed size={12} />
            <span>Active Project</span>
          </div>
          <div className="text-sm font-bold text-slate-200 truncate">{currentProject.name}</div>
          
          {activeDataset ? (
            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center gap-2 text-xs text-emerald-400">
              <FileSpreadsheet size={12} />
              <span className="truncate">{activeDataset.name}</span>
            </div>
          ) : (
            <div className="mt-1 text-xs text-amber-500 italic">No dataset uploaded</div>
          )}
        </div>
      )}

      {/* Navigation list */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.id
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-indigo-600 text-white font-medium shadow-md shadow-indigo-600/20' 
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-white' : 'text-slate-400'} />
              {!isCollapsed && <span className="text-sm">{item.label}</span>}
              {!isCollapsed && item.badge && (
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-900 text-indigo-300 uppercase tracking-widest flex items-center gap-1">
                  <Sparkles size={8} /> {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Settings / API Key section */}
      {!isCollapsed && (
        <div className="p-4 border-t border-slate-800 bg-slate-900/20 space-y-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-1"
          >
            <div className="flex items-center gap-2">
              <Settings size={14} />
              <span>Platform Config</span>
            </div>
            <span>{showSettings ? '▲' : '▼'}</span>
          </button>

          {showSettings && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">LLM Selection</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="gemini">Gemini API</option>
                  <option value="openai">OpenAI (GPT)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1 flex items-center justify-between">
                  <span>API Key</span>
                  <Key size={10} />
                </label>
                <input
                  type="password"
                  placeholder="Enter secret key..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Theme Toggler & Collapser Footer */}
      <div className="p-4 border-t border-slate-800 flex items-center justify-between">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-800/80 hover:text-slate-100 transition-colors"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {!isCollapsed && (
          <button
            onClick={() => setIsCollapsed(true)}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Collapse ◀
          </button>
        )}
        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(false)}
            className="text-xs text-slate-500 hover:text-slate-300 mx-auto"
          >
            ▶
          </button>
        )}
      </div>
    </div>
  )
}
