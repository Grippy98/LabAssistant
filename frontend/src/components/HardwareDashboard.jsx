import React, { useState } from 'react';
import axios from 'axios';
import SerialTerminal from './SerialTerminal';
import { Power, Cpu, RefreshCw, HardDrive, Terminal, X, Plus } from 'lucide-react';

const API_BASE = 'http://localhost:8000/api';

export default function HardwareDashboard({ setupId }) {
  const [flashImage, setFlashImage] = useState('');
  const [flashDevice, setFlashDevice] = useState('');
  const [flashing, setFlashing] = useState(false);
  const [setupDetails, setSetupDetails] = useState(null);
  const [images, setImages] = useState([]);
  const [devices, setDevices] = useState([]);
  const [muxStatus, setMuxStatus] = useState(null);
  const [muxSide, setMuxSide] = useState(null); // 'pc' or 'sbc'
  const [haSensors, setHaSensors] = useState([]);
  const [visiblePanels, setVisiblePanels] = useState({
    mux: true, kvm: true, ha: true, sensors: true, flasher: true, console: true, video: true
  });
  const [customFolder, setCustomFolder] = useState('');
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [browserData, setBrowserData] = useState({ current_path: '/', directories: [] });
  const [showAllDevices, setShowAllDevices] = useState(false);

  const togglePanel = (id) => setVisiblePanels(prev => ({ ...prev, [id]: !prev[id] }));

  const [haLoading, setHaLoading] = useState(false);
  const [jetkvmLoading, setJetkvmLoading] = useState(false);

  const fetchImages = async (folder = '') => {
    try {
      const res = await axios.get(`${API_BASE}/system/images${folder ? `?folder=${encodeURIComponent(folder)}` : ''}`);
      setImages(res.data.images);
    } catch (e) {
      console.error("Failed to fetch images", e);
    }
  };

  const fetchStatus = async () => {
    if (!setupId) return;
    try {
      const res = await axios.get(`${API_BASE}/setups/${setupId}/ha/sensors`);
      setHaSensors(res.data.sensors);
    } catch (e) {
      console.error("Failed to fetch sensors", e);
    }
  };

  const checkMux = async (address) => {
    if (!address) return;
    try {
      const resStatus = await axios.get(`${API_BASE}/system/check_mux/${address}`);
      setMuxStatus(resStatus.data.connected);
      const resSide = await axios.get(`${API_BASE}/system/mux_side/${address}`);
      setMuxSide(resSide.data.side);
    } catch (e) {
      setMuxStatus(false);
    }
  };

  const browseFolder = async (path) => {
    try {
      const res = await axios.get(`${API_BASE}/system/browse?path=${encodeURIComponent(path)}`);
      setBrowserData(res.data);
    } catch (e) {
      console.error("Failed to browse folder", e);
    }
  };

  const handleFlash = async () => {
    if (!flashImage || !flashDevice) return;
    const targetDevice = devices.find(d => d.path === flashDevice);
    if (targetDevice && !targetDevice.is_removable && !confirm("WARNING: This device is NOT marked as removable. Are you sure you want to flash to a SYSTEM or INTERNAL drive?")) {
      return;
    }
    setFlashing(true);
    try {
      await axios.post(`${API_BASE}/setups/${setupId}/flash`, {
        image_path: flashImage,
        block_device: flashDevice
      });
      alert('Flash successful!');
    } catch (e) {
      alert(`Flash failed: ${e.response?.data?.detail || e.message}`);
    } finally {
      setFlashing(false);
    }
  };

  const filteredDevices = showAllDevices ? devices : devices.filter(d => d.is_removable);

  React.useEffect(() => {
    if (setupId) {
      axios.get(`${API_BASE}/setups/${setupId}`)
           .then(res => {
             setSetupDetails(res.data);
             checkMux(res.data.sd_swap_address);
           })
           .catch(console.error);
      fetchImages();
      axios.get(`${API_BASE}/system/block_devices`).then(res => setDevices(res.data.devices)).catch(console.error);
      fetchStatus();
    }
  }, [setupId]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      fetchStatus();
      if (setupDetails?.sd_swap_address) checkMux(setupDetails.sd_swap_address);
    }, 10000);
    return () => clearInterval(interval);
  }, [setupId, setupDetails]);

  if (!setupId) return <div>No setup selected</div>;

  const action = async (endpoint) => {
    const isHA = endpoint.startsWith('ha/');
    const isJetKVM = endpoint.startsWith('jetkvm/');

    if (isHA) setHaLoading(true);
    if (isJetKVM) setJetkvmLoading(true);

    try {
      await axios.post(`${API_BASE}/setups/${setupId}/${endpoint}`);
      if (endpoint.includes('sd_swap')) {
         if (setupDetails?.sd_swap_address) checkMux(setupDetails.sd_swap_address);
      }
    } catch (e) {
      alert(`Action failed: ${e.response?.data?.detail || e.message}`);
    } finally {
      if (isHA) setHaLoading(false);
      if (isJetKVM) setJetkvmLoading(false);
    }
  };

  const hiddenCount = Object.values(visiblePanels).filter(v => !v).length;

  return (
    <div>
      {hiddenCount > 0 && (
        <div style={{marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
          <span style={{fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center'}}>Restore:</span>
          {Object.entries(visiblePanels).map(([id, visible]) => !visible && (
            <button key={id} className="btn" style={{padding: '2px 8px', fontSize: '0.7rem'}} onClick={() => togglePanel(id)}>
              <Plus size={12} /> {id.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      <div className="dashboard-grid">
        
        {/* JetKVM Card */}
        {visiblePanels.kvm && (
          <div className="glass-panel">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem'}}>
              <h3 style={{display:'flex', alignItems:'center', gap:'0.5rem', margin:0}}>
                <Cpu size={20} color="var(--accent)"/> JetKVM Control
              </h3>
              <X size={16} style={{cursor:'pointer', opacity:0.5}} onClick={() => togglePanel('kvm')} />
            </div>
            <p style={{color:'var(--text-muted)', marginBottom:'1rem', fontSize:'0.9rem'}}>
              Control ATX power state of the target machine via JetKVM.
            </p>
            <div style={{display:'flex', gap:'0.5rem'}}>
              <button className="btn" onClick={() => action('jetkvm/power/on')} disabled={jetkvmLoading}>
                <Power size={16} color="var(--success)"/> {jetkvmLoading ? 'Waiting...' : 'Power On'}
              </button>
              <button className="btn btn-danger" onClick={() => action('jetkvm/power/off')} disabled={jetkvmLoading}>
                <Power size={16} /> {jetkvmLoading ? 'Waiting...' : 'Power Off'}
              </button>
            </div>
          </div>
        )}

        {/* Home Assistant Card */}
        {visiblePanels.ha && (
          <div className="glass-panel">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem'}}>
              <h3 style={{display:'flex', alignItems:'center', gap:'0.5rem', margin:0}}>
                <Power size={20} color="var(--accent)"/> Home Assistant
              </h3>
              <X size={16} style={{cursor:'pointer', opacity:0.5}} onClick={() => togglePanel('ha')} />
            </div>
            <p style={{color:'var(--text-muted)', marginBottom:'1rem', fontSize:'0.9rem'}}>
              Toggle the external smart plug/switch for the target.
            </p>
            <div style={{display:'flex', gap:'0.5rem'}}>
              <button className="btn" onClick={() => action('ha/on')} disabled={haLoading}>
                {haLoading ? 'Switching...' : 'Switch On'}
              </button>
              <button className="btn btn-danger" onClick={() => action('ha/off')} disabled={haLoading}>
                {haLoading ? 'Switching...' : 'Switch Off'}
              </button>
            </div>
          </div>
        )}

        {/* SD Swap Card */}
        {visiblePanels.mux && (
          <div className="glass-panel">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
              <h3 style={{display:'flex', alignItems:'center', gap:'0.5rem', margin:0}}>
                <RefreshCw size={20} color="var(--accent)"/> SD Mux Switch
              </h3>
              <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
                {muxStatus !== null && (
                  <span style={{
                    fontSize: '0.7rem', 
                    padding: '2px 8px', 
                    borderRadius: '12px', 
                    background: muxStatus ? 'rgba(46, 204, 113, 0.2)' : 'rgba(231, 76, 60, 0.2)',
                    color: muxStatus ? '#2ecc71' : '#e74c3c',
                    border: `1px solid ${muxStatus ? '#2ecc71' : '#e74c3c'}`
                  }}>
                    {muxStatus ? 'CONNECTED' : 'NOT FOUND'}
                  </span>
                )}
                <X size={16} style={{cursor:'pointer', opacity:0.5}} onClick={() => togglePanel('mux')} />
              </div>
            </div>
            <p style={{color:'var(--text-muted)', marginBottom:'1rem', fontSize:'0.9rem'}}>
              Physically switch the SD card connection. {setupDetails?.sd_swap_address ? `(${setupDetails.sd_swap_address})` : ''}
            </p>
            <div style={{display:'flex', gap:'0.5rem', flexWrap:'wrap'}}>
              <button 
                className={`btn ${muxSide === 'pc' ? 'btn-success' : ''}`} 
                onClick={() => action('sd_swap/pc')}
              >
                Connect to PC
              </button>
              <button 
                className={`btn ${muxSide === 'sbc' ? 'btn-primary' : ''}`} 
                onClick={() => action('sd_swap/sbc')}
              >
                Connect to Target
              </button>
              <button 
                className="btn btn-danger" 
                onClick={() => action('sd_swap/reset')}
                title="Force hardware reset cycle"
              >
                Reset Mux
              </button>
            </div>
          </div>
        )}

        {/* HA Sensors Card */}
        {visiblePanels.sensors && (
          <div className="glass-panel">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem'}}>
              <h3 style={{display:'flex', alignItems:'center', gap:'0.5rem', margin:0}}>
                <Cpu size={20} color="var(--accent)"/> Environment & Power
              </h3>
              <X size={16} style={{cursor:'pointer', opacity:0.5}} onClick={() => togglePanel('sensors')} />
            </div>
            {haSensors.length === 0 ? (
              <p style={{color:'var(--text-muted)', fontSize:'0.9rem'}}>No sensors configured.</p>
            ) : (
              <div style={{display:'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                {haSensors.map(s => (
                  <div key={s.entity_id} style={{background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)'}}>
                    <div style={{fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase'}}>{s.friendly_name}</div>
                    <div style={{fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent)'}}>
                      {s.state} <span style={{fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-muted)'}}>{s.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Flasher Card */}
        {visiblePanels.flasher && (
          <div className="glass-panel">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
              <h3 style={{display:'flex', alignItems:'center', gap:'0.5rem', margin:0}}>
                <HardDrive size={20} color="var(--accent)"/> Image Flasher
              </h3>
              <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
                <button 
                  className="btn" 
                  style={{padding:'4px 8px'}} 
                  onClick={() => fetchImages(customFolder)}
                  title="Rescan images"
                >
                  <RefreshCw size={14} />
                </button>
                <X size={16} style={{cursor:'pointer', opacity:0.5}} onClick={() => togglePanel('flasher')} />
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Scan Folder</label>
              <div style={{display:'flex', gap:'0.5rem'}}>
                <input 
                  className="form-input" 
                  placeholder="/default/scan/paths" 
                  value={customFolder} 
                  onChange={e => setCustomFolder(e.target.value)}
                />
                <button className="btn" onClick={() => { setShowFolderPicker(true); browseFolder(customFolder || '~'); }}>
                  Browse...
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Image File</label>
              <select className="form-input" value={flashImage} onChange={e => setFlashImage(e.target.value)}>
                <option value="">-- Select Image --</option>
                {images.map(img => <option key={img} value={img}>{img.split('/').pop()}</option>)}
              </select>
            </div>
            
            <div className="form-group">
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <label className="form-label">Target Device</label>
                <label style={{display:'flex', alignItems:'center', gap:'0.25rem', fontSize:'0.75rem', cursor:'pointer', color: 'var(--text-muted)'}}>
                  <input type="checkbox" checked={showAllDevices} onChange={e => setShowAllDevices(e.target.checked)} />
                  Show All
                </label>
              </div>
              <select className="form-input" value={flashDevice} onChange={e => setFlashDevice(e.target.value)}>
                <option value="">-- Select Device --</option>
                {filteredDevices.map(d => (
                  <option key={d.path} value={d.path}>
                    {d.label} {!d.is_removable ? '⚠️' : ''}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" onClick={handleFlash} disabled={flashing}>
              {flashing ? 'Flashing...' : 'Flash Image'}
            </button>
          </div>
        )}

      </div>

      {showFolderPicker && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
        }}>
          <div className="glass-panel" style={{width: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column'}}>
            <h3 style={{marginBottom: '1rem'}}>Select Scan Folder</h3>
            <p style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem'}}>
              Current: {browserData.current_path}
            </p>
            <div style={{flex: 1, overflowY: 'auto', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.5rem', marginBottom: '1rem', border: '1px solid var(--border)'}}>
              {browserData.directories.map(d => (
                <div 
                  key={d.path} 
                  className="browse-item" 
                  onClick={() => browseFolder(d.path)}
                  style={{padding: '0.5rem', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.5rem'}}
                >
                  📁 {d.name}
                </div>
              ))}
            </div>
            <div style={{display:'flex', gap:'1rem', justifyContent:'flex-end'}}>
              <button className="btn" onClick={() => setShowFolderPicker(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => {
                setCustomFolder(browserData.current_path);
                setShowFolderPicker(false);
                fetchImages(browserData.current_path);
              }}>Select Folder</button>
            </div>
          </div>
        </div>
      )}

      {visiblePanels.video && setupDetails?.jetkvm_ip && (
        <div className="glass-panel" style={{marginTop: '1.5rem'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
            <h3 style={{display:'flex', alignItems:'center', gap:'0.5rem', margin:0}}>
              <Cpu size={20} color="var(--accent)"/> JetKVM Video & Control
            </h3>
            <X size={16} style={{cursor:'pointer', opacity:0.5}} onClick={() => togglePanel('video')} />
          </div>
          <div style={{width: '100%', height: '600px', background: '#000', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)'}}>
            <iframe 
              src={setupDetails.jetkvm_ip.startsWith('http') ? setupDetails.jetkvm_ip : `http://${setupDetails.jetkvm_ip}`} 
              style={{width: '100%', height: '100%', border: 'none'}}
              title="JetKVM Console"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {visiblePanels.console && (
        <div className="glass-panel" style={{marginTop: '1.5rem'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
            <h3 style={{display:'flex', alignItems:'center', gap:'0.5rem', margin:0}}>
              <Terminal size={20} color="var(--accent)"/> Serial Monitor
            </h3>
            <X size={16} style={{cursor:'pointer', opacity:0.5}} onClick={() => togglePanel('console')} />
          </div>
          <div className="terminal-container">
            <SerialTerminal setupId={setupId} />
          </div>
        </div>
      )}
    </div>
  );
}
