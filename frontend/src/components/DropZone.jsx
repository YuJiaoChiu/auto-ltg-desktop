import React, { useState, useCallback } from 'react';

const DropZone = ({ 
  onDrop, 
  onClick,
  title = 'Drag & Drop Folder Here',
  hint = 'or click to browse local files',
  icon = '📂',
  className = '',
  style = {},
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (onDrop) {
      onDrop(e.dataTransfer.files);
    }
  }, [onDrop]);

  return (
    <div
      className={`drop-zone ${isDragOver ? 'drag-over' : ''} ${className}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={onClick}
      style={style}
    >
      <span className="drop-zone-icon">{icon}</span>
      <p className="drop-zone-title">{title}</p>
      <p className="drop-zone-hint">{hint}</p>
    </div>
  );
};

export default DropZone;
