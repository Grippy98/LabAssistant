import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Onboarding from './components/Onboarding';
import HardwareDashboard from './components/HardwareDashboard';
import { Plus, Settings, Cpu, X, Terminal, Sun, Moon, Monitor, RefreshCw } from 'lucide-react';

const API_BASE = 'http://localhost:8000/api';

import TitleBar from './components/TitleBar';

function App() {
  const [setups, setSetups] = useState([]);
  const [activeSetupId, setActiveSetupId] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [editingSetup, setEditingSetup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateProgress, setUpdateProgress] = useState(null);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(localStorage.getItem('autoUpdate') !== 'false');

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onUpdateAvailable((info) => setUpdateInfo(info));
      window.electronAPI.onUpdateNotAvailable(() => console.log("No updates available"));
      window.electronAPI.onUpdateError((msg) => console.error("Update error:", msg));
      window.electronAPI.onUpdateProgress((p) => setUpdateProgress(p));
      window.electronAPI.onUpdateDownloaded(() => setUpdateDownloaded(true));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('autoUpdate', autoUpdateEnabled);
  }, [autoUpdateEnabled]);

  useEffect(() => {
    const applyTheme = () => {
      let activeTheme = theme;
      if (theme === 'system') {
        activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', activeTheme);
      localStorage.setItem('theme', theme);
    };
    applyTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  const fetchSetups = async () => {
    setLoading(true);
    setConnectionError(false);
    try {
      const res = await axios.get(`${API_BASE}/setups`);
      setSetups(res.data.setups);
      if (res.data.setups.length > 0 && !activeSetupId) {
        setActiveSetupId(res.data.setups[0].id);
      }
      setLoading(false);
    } catch (e) {
      console.error("Failed to fetch setups", e);
      setConnectionError(true);
      setLoading(false);
    }
  };

  const deleteSetup = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Delete this setup?")) return;
    try {
      await axios.delete(`${API_BASE}/setups/${id}`);
      if (activeSetupId === id) setActiveSetupId(null);
      fetchSetups();
    } catch (err) {
      alert("Failed to delete setup");
    }
  };

  const exportConfig = async () => {
    try {
      const res = await axios.get(`${API_BASE}/config/export`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'labassistant_config.json';
      a.click();
    } catch (err) {
      alert("Export failed");
    }
  };

  const importConfig = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const config = JSON.parse(event.target.result);
        await axios.post(`${API_BASE}/config/import`, config);
        alert("Import successful!");
        window.location.reload();
      } catch (err) {
        alert("Import failed");
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    fetchSetups();
  }, []);

  const activeSetup = setups.find(s => s.id === activeSetupId);

  if (loading) return <div><TitleBar /><p style={{padding:'2rem'}}>Loading...</p></div>;

  return (
    <>
      <TitleBar />
      {updateInfo && (
        <div className="update-banner">
          <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
            <RefreshCw size={16} className={updateProgress ? 'spin' : ''} />
            <div>
              <span style={{fontWeight:600}}>Update Available: {updateInfo.version}</span>
              {updateProgress && (
                <div style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>
                  Downloading: {Math.round(updateProgress.percent)}%
                </div>
              )}
              {updateDownloaded && <div style={{fontSize:'0.75rem', color:'var(--accent)'}}>Download complete!</div>}
            </div>
          </div>
          <div style={{display:'flex', gap:'8px'}}>
            {!updateProgress && !updateDownloaded && (
              <button className="btn btn-primary" onClick={() => window.electronAPI.downloadUpdate()}>
                Download Now
              </button>
            )}
            {updateDownloaded && (
              <button className="btn btn-success" onClick={() => window.electronAPI.installUpdate()}>
                Restart & Install
              </button>
            )}
            <button className="btn" onClick={() => setUpdateInfo(null)}>Dismiss</button>
          </div>
        </div>
      )}
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            SETUPS
            <Plus size={16} style={{cursor:'pointer'}} onClick={() => setShowConfig(true)} />
          </div>
          <div className="setup-list">
            {setups.map(setup => (
              <div 
                key={setup.id} 
                className={`setup-item ${activeSetupId === setup.id ? 'active' : ''}`}
                onClick={() => setActiveSetupId(setup.id)}
              >
                <div style={{display:'flex', alignItems:'center', gap:'8px', overflow:'hidden'}}>
                  <Cpu size={14} />
                  <span style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{setup.name || setup.id}</span>
                </div>
                <X size={14} className="delete-icon" onClick={(e) => deleteSetup(e, setup.id)} style={{opacity: 0.5}} />
              </div>
            ))}
          </div>
          <div style={{padding:'0.5rem 1rem', borderTop:'1px solid var(--border)', background:'var(--bg-tertiary)'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem'}}>
              <span style={{fontSize:'0.7rem', color:'var(--text-muted)', fontWeight:600}}>THEME</span>
              <div style={{display:'flex', gap:'4px'}}>
                <button 
                  className={`btn ${theme === 'light' ? 'active' : ''}`} 
                  onClick={() => setTheme('light')} 
                  title="Light Mode"
                  style={{padding:'4px', minWidth:'unset'}}
                >
                  <Sun size={14} />
                </button>
                <button 
                  className={`btn ${theme === 'dark' ? 'active' : ''}`} 
                  onClick={() => setTheme('dark')} 
                  title="Dark Mode"
                  style={{padding:'4px', minWidth:'unset'}}
                >
                  <Moon size={14} />
                </button>
                <button 
                  className={`btn ${theme === 'system' ? 'active' : ''}`} 
                  onClick={() => setTheme('system')} 
                  title="Follow System"
                  style={{padding:'4px', minWidth:'unset'}}
                >
                  <Monitor size={14} />
                </button>
              </div>
            </div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem'}}>
              <span style={{fontSize:'0.7rem', color:'var(--text-muted)', fontWeight:600}}>UPDATES</span>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={autoUpdateEnabled} 
                  onChange={(e) => setAutoUpdateEnabled(e.target.checked)} 
                />
                <span className="slider round"></span>
              </label>
            </div>
            <button className="btn" style={{width:'100%', justifyContent:'center'}} onClick={() => setShowConfig(true)}>
              <Settings size={14} /> Global Config
            </button>
          </div>
        </aside>

        <main className="content-area">
          <header className="header">
            <div className="header-title">
              {activeSetup ? (
                <>
                  <Cpu size={18} color="var(--accent)" />
                  {activeSetup.name || activeSetup.id}
                </>
              ) : "Select a Setup"}
            </div>
            <div style={{display:'flex', gap:'0.5rem'}}>
              {activeSetupId && (
                <button className="btn" onClick={() => setEditingSetup(activeSetup)}>
                  <Settings size={16} /> Edit
                </button>
              )}
              <button className="btn" onClick={exportConfig}>Export</button>
              <label className="btn" style={{cursor:'pointer'}}>
                Import
                <input type="file" style={{display:'none'}} onChange={importConfig} accept=".json" />
              </label>
            </div>
          </header>

          <div className="main-content">
            {connectionError ? (
              <div style={{
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', 
                height:'100%', gap:'1rem', textAlign:'center'
              }}>
                <div style={{color:'var(--danger)', background:'rgba(242,63,66,0.1)', padding:'2rem', borderRadius:'12px', border:'1px solid var(--danger)'}}>
                  <RefreshCw size={48} style={{marginBottom:'1rem', opacity:0.8}} />
                  <h2 style={{marginBottom:'0.5rem'}}>Backend Connection Failed</h2>
                  <p style={{color:'var(--text-muted)', fontSize:'0.9rem', maxWidth:'300px'}}>
                    Cannot reach the LabAssistant backend at {API_BASE}. <br/>
                    Please ensure the Python application is running.
                  </p>
                  <button className="btn btn-primary" style={{marginTop:'1.5rem', width:'100%'}} onClick={fetchSetups}>
                    Retry Connection
                  </button>
                </div>
              </div>
            ) : activeSetupId ? (
              <HardwareDashboard setupId={activeSetupId} />
            ) : (
              <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--text-muted)'}}>
                <p>Select a setup from the sidebar to begin.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Onboarding Modal Overlay - Only show if NO connection error and needs setup */}
      {( (!connectionError && (showConfig || (setups.length === 0 && !loading))) || editingSetup) && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{maxHeight: '90vh', overflowY: 'auto', borderRadius: '16px'}}>
            <Onboarding 
              initialData={editingSetup}
              onComplete={() => {
                setShowConfig(false);
                setEditingSetup(null);
                fetchSetups();
              }} 
              onCancel={() => {
                setShowConfig(false);
                setEditingSetup(null);
              }} 
            />
          </div>
        </div>
      )}
    </>
  );
}

export default App;
