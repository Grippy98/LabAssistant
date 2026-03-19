import React from 'react';
import { X, Minus, Square } from 'lucide-react';

export default function TitleBar() {
  const isElectron = window.electronAPI !== undefined;

  const handleClose = () => isElectron && window.electronAPI.close();
  const handleMinimize = () => isElectron && window.electronAPI.minimize();
  const handleMaximize = () => isElectron && window.electronAPI.maximize();

  return (
    <div className="title-bar">
      <div className="title-bar-label" style={{fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display:'flex', alignItems:'center', gap: '8px'}}>
        <img src="/favicon.svg" alt="" style={{width: 16, height: 16}} />
        LabAssistant Dashboard
      </div>
      <div className="title-bar-btns">
        <button className="window-btn min" onClick={handleMinimize} title="Minimize" />
        <button className="window-btn max" onClick={handleMaximize} title="Maximize" />
        <button className="window-btn close" onClick={handleClose} title="Close" />
      </div>
    </div>
  );
}
