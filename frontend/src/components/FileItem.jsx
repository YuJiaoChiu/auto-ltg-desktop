import React, { useState } from 'react';

const FileItem = ({
  icon = '📄',
  name,
  oldName,
  newName,
  size,
  duration,
  status = 'pending',
  statusLabel,
  label,
  subLabel,
  opacity = 1,
  onClick,
  selected = false,
  onSelect,
  editable = false,
  onNameChange,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(newName || '');

  const getStatusClass = () => {
    switch (status) {
      case 'done':
      case 'complete':
        return 'status-complete';
      case 'processing':
        return 'status-processing';
      case 'failed':
      case 'error':
        return 'status-failed';
      case 'pending':
      default:
        return 'status-pending';
    }
  };

  const getDefaultStatusLabel = () => {
    switch (status) {
      case 'done':
      case 'complete':
        return 'Done';
      case 'processing':
        return 'Processing';
      case 'failed':
      case 'error':
        return 'Failed';
      case 'pending':
      default:
        return 'Pending';
    }
  };

  const displayName = oldName || name;
  const tooltipText = newName ? `${oldName} → ${newName}` : displayName;

  return (
    <div 
      className="file-item"
      style={{ 
        opacity,
        cursor: onClick ? 'pointer' : 'default',
        background: selected ? 'rgba(255, 255, 255, 0.7)' : undefined,
        position: 'relative',
      }}
      onClick={onClick}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {onSelect && (
        <input 
          type="checkbox" 
          checked={selected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          style={{ marginRight: '4px' }}
        />
      )}
      <span className="file-icon">{icon}</span>
      <div className="file-details" style={{ overflow: 'hidden' }}>
        {oldName && newName ? (
          <>
            <span
              className="file-old-name"
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
                maxWidth: '100%'
              }}
              title={oldName}
            >
              {oldName}
            </span>
            {editable && isEditing ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => {
                  setIsEditing(false);
                  if (onNameChange && editValue !== newName) {
                    onNameChange(editValue);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsEditing(false);
                    if (onNameChange && editValue !== newName) {
                      onNameChange(editValue);
                    }
                  } else if (e.key === 'Escape') {
                    setIsEditing(false);
                    setEditValue(newName);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                style={{
                  width: '100%',
                  padding: '4px 8px',
                  fontSize: '12px',
                  border: '1px solid var(--accent)',
                  borderRadius: '4px',
                  outline: 'none',
                  fontFamily: 'var(--font-mono)',
                }}
              />
            ) : (
              <span
                className="file-new-name"
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                  maxWidth: '100%',
                  cursor: editable ? 'text' : 'default',
                }}
                title={editable ? '点击编辑' : newName}
                onClick={(e) => {
                  if (editable) {
                    e.stopPropagation();
                    setEditValue(newName);
                    setIsEditing(true);
                  }
                }}
              >
                {newName}
              </span>
            )}
          </>
        ) : (
          <>
            <span 
              className="file-name"
              style={{ 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                display: 'block',
                maxWidth: '100%'
              }}
              title={name}
            >
              {name}
            </span>
            {(label || subLabel) && (
              <span className="label" style={{ fontSize: '9px', margin: 0 }}>
                {label || subLabel}
              </span>
            )}
            {(size || duration) && (
              <span className="file-meta">
                {size}{size && duration && ' • '}{duration}
              </span>
            )}
          </>
        )}
      </div>
      <span className={`status-badge ${getStatusClass()}`}>
        {statusLabel || getDefaultStatusLabel()}
      </span>

      {/* Tooltip */}
      {showTooltip && displayName && displayName.length > 25 && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.85)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            zIndex: 100,
            marginBottom: '8px',
            maxWidth: '300px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {tooltipText}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              border: '6px solid transparent',
              borderTopColor: 'rgba(0, 0, 0, 0.85)',
            }}
          />
        </div>
      )}
    </div>
  );
};

export default FileItem;
