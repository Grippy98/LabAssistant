import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

export default function Onboarding({ onComplete, onCancel, initialData }) {
  const [globalConfig, setGlobalConfig] = useState({ ha_url: '', ha_token: '' });
  const [setupConfig, setSetupConfig] = useState(initialData || {
    id: `setup_${Math.floor(Math.random() * 1000)}`,
    name: '',
    jetkvm_ip: '',
    sd_swap_address: '',
    serial_port: '',
    ssh_user: 'root',
    ssh_host: '',
    ha_entity_id: '',
    ha_sensor_ids: []
  });

  const [serialPorts, setSerialPorts] = useState([]);
  const [haEntities, setHaEntities] = useState([]);

  useEffect(() => {
    axios.get(`${API_BASE}/config`).then(res => {
      setGlobalConfig({
        ha_url: res.data.ha_url || '',
        ha_token: res.data.ha_token || ''
      });
    });
    axios.get(`${API_BASE}/serial/ports`).then(res => setSerialPorts(res.data)).catch(console.error);
    axios.get(`${API_BASE}/system/ha_entities`).then(res => setHaEntities(res.data.entities)).catch(console.error);
  }, []);

  const discoverSDMux = async () => {
    try {
      const res = await axios.get(`${API_BASE}/system/discover_mux`);
      if (res.data.address) {
        setSetupConfig({...setupConfig, sd_swap_address: res.data.address});
      } else {
        alert("SD Mux not found. Please ensure it's connected.");
      }
    } catch (e) {
      console.error(e);
      alert("Autodiscovery failed.");
    }
  };

  const handleSaveGlobal = async (e) => {
    if (e) e.preventDefault();
    try {
      await axios.post(`${API_BASE}/config`, globalConfig);
      if (!setupConfig.name) {
        alert("Global configuration saved.");
        onComplete();
      }
    } catch (err) {
      alert("Failed to save global config");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/config`, globalConfig);
      if (setupConfig.name) {
        await axios.post(`${API_BASE}/setups/${setupConfig.id}`, setupConfig);
      }
      onComplete();
    } catch (err) {
      alert("Failed to save config");
      console.error(err);
    }
  };

  return (
    <div className="glass-panel" style={{maxWidth: '600px', margin: '0 auto'}}>
      <h2 style={{marginBottom: '1rem'}}>{initialData ? 'Edit Setup' : 'Global & Setup Configuration'}</h2>
      <form onSubmit={handleSave}>
        
        <div style={{marginBottom: '2rem'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem'}}>
            <h3 style={{margin:0, color: 'var(--accent)'}}>Home Assistant (Global)</h3>
            <button type="button" className="btn" onClick={handleSaveGlobal} style={{fontSize:'0.8rem', padding:'4px 8px'}}>
              Save Global Only
            </button>
          </div>
          <div className="form-group">
            <label className="form-label">HA Server URL</label>
            <input className="form-input" value={globalConfig.ha_url} onChange={e => setGlobalConfig({...globalConfig, ha_url: e.target.value})} placeholder="http://homeassistant.local:8123" />
          </div>
          <div className="form-group">
            <label className="form-label">Long-Lived Access Token</label>
            <input type="password" className="form-input" value={globalConfig.ha_token} onChange={e => setGlobalConfig({...globalConfig, ha_token: e.target.value})} />
          </div>
        </div>

        <div style={{marginBottom: '2rem'}}>
          <h3 style={{marginBottom: '0.5rem', color: 'var(--accent)'}}>{initialData ? 'Setup Details' : 'New Test Setup'}</h3>
          <div className="form-group">
            <label className="form-label">Setup Name</label>
            <input className="form-input" value={setupConfig.name} onChange={e => setSetupConfig({...setupConfig, name: e.target.value})} placeholder="e.g. Raspberry Pi 4 Lab" />
          </div>
          <div className="form-group">
            <label className="form-label">JetKVM IP</label>
            <input className="form-input" value={setupConfig.jetkvm_ip} onChange={e => setSetupConfig({...setupConfig, jetkvm_ip: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">SD_Swap USB Bus Address</label>
            <div style={{display:'flex', gap:'0.5rem'}}>
              <input className="form-input" value={setupConfig.sd_swap_address} onChange={e => setSetupConfig({...setupConfig, sd_swap_address: e.target.value})} placeholder="e.g. 1-4" />
              <button type="button" className="btn" onClick={discoverSDMux}>Auto-detect</button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Serial Port (/dev/tty*)</label>
            <select className="form-input" value={setupConfig.serial_port} onChange={e => setSetupConfig({...setupConfig, serial_port: e.target.value})}>
              <option value="">-- Select Serial Port --</option>
              {serialPorts.map(p => (
                <option key={p.device} value={p.device}>{p.device} ({p.description})</option>
              ))}
              {setupConfig.serial_port && !serialPorts.find(p => p.device === setupConfig.serial_port) && (
                <option value={setupConfig.serial_port}>{setupConfig.serial_port} (Custom)</option>
              )}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">HA Power Control Entity</label>
            <select className="form-input" value={setupConfig.ha_entity_id} onChange={e => setSetupConfig({...setupConfig, ha_entity_id: e.target.value})}>
              <option value="">-- Select Entity --</option>
              {haEntities.filter(e => !e.id.startsWith('sensor')).map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.id})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">HA Sensor Entities (Environment & Power)</label>
            <div style={{display: 'flex', gap: '0.5rem', marginBottom: '0.5rem'}}>
              <select 
                className="form-input" 
                value=""
                onChange={e => {
                  if (e.target.value && !(setupConfig.ha_sensor_ids || []).includes(e.target.value)) {
                    setSetupConfig({
                      ...setupConfig, 
                      ha_sensor_ids: [...(setupConfig.ha_sensor_ids || []), e.target.value]
                    });
                  }
                  e.target.value = '';
                }}
              >
                <option value="">-- Add Sensor --</option>
                {haEntities.filter(e => e.id.startsWith('sensor') || e.id.startsWith('binary_sensor')).map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.id})</option>
                ))}
              </select>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:'0.5rem'}}>
              {(setupConfig.ha_sensor_ids || []).map((sid, idx) => (
                <div key={idx} className="glass-panel" style={{padding:'6px 10px', display:'flex', alignItems:'center', gap:'0.5rem', background:'rgba(255,255,255,0.05)', borderRadius: '4px'}}>
                  <span style={{fontSize:'0.85rem', flex: 1}}>{sid}</span>
                  <div style={{display:'flex', gap:'2px'}}>
                    <button 
                      type="button" 
                      className="btn" 
                      style={{padding:'0 6px', minWidth: '24px', fontSize:'0.8rem', border:'none', background:'rgba(255,255,255,0.1)'}} 
                      disabled={idx === 0}
                      onClick={() => {
                        const newIds = [...setupConfig.ha_sensor_ids];
                        [newIds[idx-1], newIds[idx]] = [newIds[idx], newIds[idx-1]];
                        setSetupConfig({...setupConfig, ha_sensor_ids: newIds});
                      }}
                    >
                      ↑
                    </button>
                    <button 
                      type="button" 
                      className="btn" 
                      style={{padding:'0 6px', minWidth: '24px', fontSize:'0.8rem', border:'none', background:'rgba(255,255,255,0.1)'}} 
                      disabled={idx === setupConfig.ha_sensor_ids.length - 1}
                      onClick={() => {
                        const newIds = [...setupConfig.ha_sensor_ids];
                        [newIds[idx+1], newIds[idx]] = [newIds[idx], newIds[idx+1]];
                        setSetupConfig({...setupConfig, ha_sensor_ids: newIds});
                      }}
                    >
                      ↓
                    </button>
                    <button 
                      type="button" 
                      className="btn" 
                      style={{padding:'0 6px', minWidth: '24px', fontSize:'0.8rem', border:'none', background:'rgba(255,100,100,0.2)', color:'var(--error)'}} 
                      onClick={() => {
                        const newIds = [...setupConfig.ha_sensor_ids];
                        newIds.splice(idx, 1);
                        setSetupConfig({...setupConfig, ha_sensor_ids: newIds});
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:'flex', gap:'1rem'}}>
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">SSH User</label>
              <input className="form-input" value={setupConfig.ssh_user} onChange={e => setSetupConfig({...setupConfig, ssh_user: e.target.value})} />
            </div>
            <div className="form-group" style={{flex:1}}>
              <label className="form-label">SSH Host (Target IP)</label>
              <input className="form-input" value={setupConfig.ssh_host} onChange={e => setSetupConfig({...setupConfig, ssh_host: e.target.value})} />
            </div>
          </div>
        </div>

        <div style={{display: 'flex', gap: '1rem', justifyContent: 'flex-end'}}>
          {onCancel && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}
          <button type="submit" className="btn btn-primary">{initialData ? 'Update Setup' : 'Save Configuration'}</button>
        </div>
      </form>
    </div>
  );
}
