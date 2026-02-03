import React from 'react';

export const Input = ({ 
  value, 
  onChange, 
  placeholder, 
  type = 'text',
  className = '',
  style = {},
  readOnly = false,
  ...props 
}) => (
  <input
    type={type}
    className={`input-pill ${className}`}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    readOnly={readOnly}
    style={style}
    {...props}
  />
);

export const TextArea = ({ 
  value, 
  onChange, 
  placeholder,
  rows = 4,
  className = '',
  style = {},
  ...props 
}) => (
  <textarea
    className={`input-pill ${className}`}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    rows={rows}
    style={style}
    {...props}
  />
);

export const InputWithButton = ({
  value,
  onChange,
  placeholder,
  buttonText = '..',
  onButtonClick,
  readOnly = false,
  browseMode = 'folder', // 'folder', 'file', or 'none'
  fileFilters = null,
  disabled = false,
}) => {
  const handleBrowse = async () => {
    // 检查是否在 Electron 环境中
    if (window.electronAPI) {
      let selectedPath = null;
      if (browseMode === 'folder') {
        selectedPath = await window.electronAPI.selectFolder();
      } else if (browseMode === 'file') {
        selectedPath = await window.electronAPI.selectFile(fileFilters);
      }

      if (selectedPath && onChange) {
        // 模拟 input change 事件
        onChange({ target: { value: selectedPath } });
      }
    } else if (onButtonClick) {
      // 非 Electron 环境，使用回调
      onButtonClick();
    }
  };

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
      />
      <button
        className="btn-icon"
        onClick={handleBrowse}
        disabled={disabled}
      >
        {buttonText}
      </button>
    </div>
  );
};

export const Select = ({ 
  value, 
  onChange, 
  options,
  className = '',
  ...props 
}) => (
  <select 
    className={`input-pill ${className}`}
    value={value}
    onChange={onChange}
    {...props}
  >
    {options.map(opt => (
      <option key={opt.value || opt} value={opt.value || opt}>
        {opt.label || opt}
      </option>
    ))}
  </select>
);

export const Checkbox = ({ 
  label, 
  checked, 
  onChange,
  className = '',
}) => (
  <label className={`checkbox-item ${className}`}>
    <input 
      type="checkbox" 
      checked={checked} 
      onChange={onChange} 
    />
    <span className="custom-checkbox"></span>
    {label}
  </label>
);

export const Radio = ({ 
  name, 
  value, 
  checked, 
  onChange, 
  label,
  className = '',
}) => (
  <label className={`radio-item ${className}`}>
    <input 
      type="radio" 
      name={name} 
      value={value}
      checked={checked}
      onChange={onChange}
    />
    <span className="custom-radio"></span>
    {label}
  </label>
);
