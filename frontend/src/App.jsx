import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import DataCleaning from './pages/DataCleaning'
import DataProfiling from './pages/DataProfiling'
import Chat from './pages/Chat'
import Visualizations from './pages/Visualizations'
import DashboardBuilder from './pages/DashboardBuilder'
import MLPlayground from './pages/MLPlayground'
import SQLPlayground from './pages/SQLPlayground'

export default function App() {
  const [currentPage, setCurrentPage] = useState('home')
  const [currentProject, setCurrentProject] = useState(null) // { id, name }
  const [activeDataset, setActiveDataset] = useState(null) // { id, name, rows, columns, summary }
  
  // Settings & Theme
  const [theme, setTheme] = useState('dark')
  const [apiKey, setApiKey] = useState(localStorage.getItem('api_key') || '')
  const [provider, setProvider] = useState(localStorage.getItem('llm_provider') || 'gemini')
  
  // Projects cache
  const [projectsList, setProjectsList] = useState([])

  // Apply theme to body
  useEffect(() => {
    const bodyClass = document.body.classList
    bodyClass.remove('light-theme')
    if (theme === 'light') {
      bodyClass.add('light-theme')
    }
  }, [theme])

  // Fetch projects on load
  const loadProjects = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/projects')
      if (res.ok) {
        const data = await res.json()
        setProjectsList(data)
        if (data.length > 0 && !currentProject) {
          // Default to latest project
          const latest = data[0]
          setCurrentProject({ id: latest.id, name: latest.name })
          if (latest.dataset) {
            setActiveDataset({
              id: latest.dataset.id,
              name: latest.dataset.name,
              rows: latest.dataset.rows,
              columns: latest.dataset.columns
            })
          }
        }
      }
    } catch (e) {
      console.warn("Backend API not reachable. Projects fallback enabled.")
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  const handleSelectProject = (proj) => {
    setCurrentProject({ id: proj.id, name: proj.name })
    if (proj.dataset) {
      setActiveDataset({
        id: proj.dataset.id,
        name: proj.dataset.name,
        rows: proj.dataset.rows,
        columns: proj.dataset.columns
      })
    } else {
      setActiveDataset(null)
    }
  }

  const handleApiKeyChange = (key) => {
    setApiKey(key)
    localStorage.setItem('api_key', key)
  }

  const handleProviderChange = (prov) => {
    setProvider(prov)
    localStorage.setItem('llm_provider', prov)
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <Home 
            currentProject={currentProject} 
            setCurrentProject={setCurrentProject}
            activeDataset={activeDataset}
            setActiveDataset={setActiveDataset}
            projectsList={projectsList}
            onSelectProject={handleSelectProject}
            loadProjects={loadProjects}
            setCurrentPage={setCurrentPage}
          />
        )
      case 'cleaning':
        return (
          <DataCleaning 
            currentProject={currentProject}
            activeDataset={activeDataset}
            setActiveDataset={setActiveDataset}
          />
        )
      case 'profiling':
        return (
          <DataProfiling 
            currentProject={currentProject}
            activeDataset={activeDataset}
          />
        )
      case 'chat':
        return (
          <Chat 
            currentProject={currentProject}
            activeDataset={activeDataset}
            apiKey={apiKey}
            provider={provider}
          />
        )
      case 'visualize':
        return (
          <Visualizations 
            currentProject={currentProject}
            activeDataset={activeDataset}
          />
        )
      case 'dashboard':
        return (
          <DashboardBuilder 
            currentProject={currentProject}
            activeDataset={activeDataset}
          />
        )
      case 'ml':
        return (
          <MLPlayground 
            currentProject={currentProject}
            activeDataset={activeDataset}
          />
        )
      case 'sql':
        return (
          <SQLPlayground 
            currentProject={currentProject}
            activeDataset={activeDataset}
            apiKey={apiKey}
            provider={provider}
          />
        )
      default:
        return <Home />
    }
  }

  return (
    <div className="flex min-h-screen bg-[#0b0f19] text-slate-100 font-sans">
      <Sidebar 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage}
        currentProject={currentProject}
        activeDataset={activeDataset}
        theme={theme}
        setTheme={setTheme}
        apiKey={apiKey}
        setApiKey={handleApiKeyChange}
        provider={provider}
        setProvider={handleProviderChange}
      />
      
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-h-screen">
        {renderPage()}
      </main>
    </div>
  )
}
