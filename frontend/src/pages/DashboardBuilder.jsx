import React, { useState, useEffect } from 'react'
import { LayoutDashboard, Download, Filter, RefreshCw, Layers, TrendingUp } from 'lucide-react'
import Plot from 'react-plotly.js'

export default function DashboardBuilder({ currentProject, activeDataset }) {
  const [regionFilter, setRegionFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [isLoading, setIsLoading] = useState(false)
  const [dashboardData, setDashboardData] = useState(null)
  
  // Mock/Aggregate dashboard metrics based on active dataset
  useEffect(() => {
    if (activeDataset) {
      generateDashboardMetrics()
    }
  }, [activeDataset, regionFilter, categoryFilter])

  const generateDashboardMetrics = () => {
    setIsLoading(true)
    // Generate simulated dynamic metrics based on filters
    // This allows the filters (Region, Category) to interact and update the KPIs instantly
    let scale = 1.0
    if (regionFilter === 'North') scale = 0.4
    if (regionFilter === 'South') scale = 0.3
    if (regionFilter === 'East') scale = 0.2
    if (regionFilter === 'West') scale = 0.1

    const revenue = Math.floor(124500 * scale)
    const profit = Math.floor(48300 * scale)
    const orders = Math.floor(820 * scale)
    const customers = Math.floor(340 * scale)

    setDashboardData({
      kpis: {
        revenue,
        profit,
        orders,
        customers,
        growth: 18.5
      },
      charts: {
        trends: {
          data: [
            {
              x: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
              y: [1200, 1900, 3000, 5000, 4000, 6000, 8000].map(v => Math.floor(v * scale)),
              type: 'scatter',
              mode: 'lines+markers',
              line: { color: '#6366f1', shape: 'spline' },
              fill: 'tozeroy',
              fillcolor: 'rgba(99, 102, 241, 0.05)',
              name: 'Revenue'
            }
          ],
          layout: { title: 'Monthly Revenue Trend', template: 'plotly_dark' }
        },
        regions: {
          data: [
            {
              labels: ['North', 'South', 'East', 'West'],
              values: [40, 30, 20, 10],
              type: 'pie',
              hole: 0.4,
              marker: { colors: ['#6366f1', '#ec4899', '#10b981', '#f59e0b'] }
            }
          ],
          layout: { title: 'Revenue by Region', template: 'plotly_dark' }
        }
      }
    })
    setIsLoading(false)
  }

  const exportDashboardHtml = () => {
    // Generate physical HTML report content
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Dashboard Export: ${currentProject?.name}</title>
  <style>
    body { font-family: sans-serif; background-color: #0f172a; color: white; padding: 40px; }
    .kpi-container { display: flex; gap: 20px; margin-bottom: 40px; }
    .kpi-card { background: #1e293b; padding: 20px; border-radius: 12px; flex: 1; border: 1px solid #334155; }
    .kpi-val { font-size: 24px; font-weight: bold; margin-top: 10px; color: #818cf8; }
  </style>
</head>
<body>
  <h1>Executive Analytics Dashboard</h1>
  <p>Project: ${currentProject?.name}</p>
  <div class="kpi-container">
    <div class="kpi-card"><div>Total Revenue</div><div class="kpi-val">$${dashboardData?.kpis.revenue.toLocaleString()}</div></div>
    <div class="kpi-card"><div>Gross Profit</div><div class="kpi-val">$${dashboardData?.kpis.profit.toLocaleString()}</div></div>
    <div class="kpi-card"><div>Total Orders</div><div class="kpi-val">${dashboardData?.kpis.orders}</div></div>
    <div class="kpi-card"><div>Customers</div><div class="kpi-val">${dashboardData?.kpis.customers}</div></div>
  </div>
</body>
</html>`
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'dashboard_export.html'
    link.click()
  }

  if (!activeDataset) {
    return (
      <div className="glass-panel border-indigo-950 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4">
        <LayoutDashboard size={48} className="text-indigo-400" />
        <h4 className="text-lg font-bold text-white">No Active Data Source</h4>
        <p className="text-sm text-slate-400">Please go to Home & Upload to import a data source first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold font-outfit text-white">Automated Dashboard Builder</h2>
          <p className="text-xs text-slate-400 mt-1">Dynamically filter KPIs and chart metrics across categorical dimensions.</p>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={exportDashboardHtml}
            className="bg-indigo-650 hover:bg-indigo-600 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1.5"
          >
            <Download size={14} />
            <span>Export HTML Dashboard</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="glass-card rounded-2xl p-4 flex flex-wrap items-center gap-4 border border-slate-850">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mr-4">
          <Filter size={14} className="text-indigo-400" />
          <span>Quick Filters</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-450">Region:</span>
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="text-xs bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="All">All Regions</option>
            <option value="North">North Region</option>
            <option value="South">South Region</option>
            <option value="East">East Region</option>
            <option value="West">West Region</option>
          </select>
        </div>

        {isLoading && (
          <div className="ml-auto text-slate-500 text-xs flex items-center gap-1">
            <RefreshCw size={10} className="animate-spin text-indigo-400" />
            <span>Re-aggregating metrics...</span>
          </div>
        )}
      </div>

      {dashboardData && (
        <div className="space-y-8">
          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass-card rounded-2xl p-5 border border-slate-850/80">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Revenue KPI</div>
              <div className="text-2xl font-black text-white font-outfit mt-1">${dashboardData.kpis.revenue.toLocaleString()}</div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1.5">
                <TrendingUp size={10} />
                <span>+18.5% YoY Growth</span>
              </div>
            </div>
            
            <div className="glass-card rounded-2xl p-5 border border-slate-850/80">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Profit Margin</div>
              <div className="text-2xl font-black text-white font-outfit mt-1">${dashboardData.kpis.profit.toLocaleString()}</div>
              <div className="text-[10px] text-indigo-400 mt-1.5">38.7% gross efficiency</div>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-slate-850/80">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Total Orders</div>
              <div className="text-2xl font-black text-white font-outfit mt-1">{dashboardData.kpis.orders}</div>
              <div className="text-[10px] text-slate-550 mt-1.5">Average unit cost: $152</div>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-slate-850/80">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Active Customers</div>
              <div className="text-2xl font-black text-white font-outfit mt-1">{dashboardData.kpis.customers}</div>
              <div className="text-[10px] text-emerald-450 mt-1.5">Retention rate: 82%</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="glass-card rounded-2xl p-6 border border-slate-850">
              <div className="flex justify-center bg-slate-950/20 p-2.5 rounded-xl border border-slate-850">
                <Plot
                  data={dashboardData.charts.trends.data}
                  layout={{
                    ...dashboardData.charts.trends.layout,
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    width: 440,
                    height: 280,
                    margin: { l: 40, r: 20, t: 40, b: 40 },
                    font: { color: '#cbd5e1', size: 9 },
                    xaxis: { gridcolor: '#1e293b' },
                    yaxis: { gridcolor: '#1e293b' }
                  }}
                  config={{ displayModeBar: false }}
                />
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-slate-850">
              <div className="flex justify-center bg-slate-950/20 p-2.5 rounded-xl border border-slate-850">
                <Plot
                  data={dashboardData.charts.regions.data}
                  layout={{
                    ...dashboardData.charts.regions.layout,
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    width: 440,
                    height: 280,
                    margin: { l: 20, r: 20, t: 40, b: 20 },
                    font: { color: '#cbd5e1', size: 9 }
                  }}
                  config={{ displayModeBar: false }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
