import React from 'react';

const Progress = ({ 
  value, 
  label,
  showPercentage = true,
  className = '',
}) => (
  <div className={`progress-container ${className}`}>
    <div className="progress-text">
      <span>{label || 'Progress'}</span>
      {showPercentage && <span>{value}%</span>}
    </div>
    <div className="progress-bar">
      <div 
        className="progress-fill" 
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  </div>
);

export default Progress;
