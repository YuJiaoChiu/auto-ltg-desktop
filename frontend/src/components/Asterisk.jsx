import React from 'react';

const Asterisk = ({ size = 120, style = {} }) => (
  <div 
    className="shape-asterisk"
    style={{ width: size, height: size, ...style }}
  >
    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="50" y1="0" x2="50" y2="100" />
      <line x1="0" y1="50" x2="100" y2="50" />
      <line x1="15" y1="15" x2="85" y2="85" />
      <line x1="85" y1="15" x2="15" y2="85" />
    </svg>
  </div>
);

export default Asterisk;
