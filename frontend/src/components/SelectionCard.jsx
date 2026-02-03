import React, { useState } from 'react';

const SelectionCard = ({ 
  tag, 
  title, 
  selected, 
  onClick,
  className = '',
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`selection-card ${selected ? 'selected' : ''} ${className}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: selected ? '#EDF7EF' : isHovered ? '#F9FDF9' : 'var(--bg-white)'
      }}
    >
      {selected && (
        <span className="selection-card-check">✓</span>
      )}
      <span className="selection-card-tag">{tag}</span>
      <div className="selection-card-title">{title}</div>
    </div>
  );
};

export default SelectionCard;
