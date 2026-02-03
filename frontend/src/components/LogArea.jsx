import React from 'react';

const LogArea = ({ 
  entries = [], 
  title = 'System Log',
  maxHeight = 180,
  className = '',
}) => (
  <div 
    className={`log-area ${className}`}
    style={{ maxHeight }}
  >
    <div className="label" style={{ marginBottom: '8px' }}>{title}</div>
    {entries.map((entry, index) => (
      <div 
        key={index} 
        className={`log-entry ${entry.highlight ? 'highlight' : ''}`}
      >
        {entry.time && `${entry.time} `}
        {entry.highlight ? <span>{entry.message}</span> : entry.message}
      </div>
    ))}
  </div>
);

export default LogArea;
