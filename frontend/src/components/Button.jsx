import React from 'react';

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '', 
  style = {},
  disabled = false,
  ...props 
}) => {
  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
    border: 'none',
    opacity: disabled ? 0.5 : 1,
  };

  const variantStyles = {
    primary: {
      width: '100%',
      background: 'transparent',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-pill)',
      padding: '16px',
      color: 'var(--fg-primary)',
    },
    secondary: {
      background: 'transparent',
      border: 'none',
      textDecoration: 'underline',
      textUnderlineOffset: '4px',
      fontSize: '12px',
      color: 'var(--fg-secondary)',
      marginTop: '12px',
      width: '100%',
      textAlign: 'center',
    },
    ghost: {
      background: 'transparent',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius-pill)',
      padding: '12px 20px',
      color: 'var(--fg-secondary)',
    },
    icon: {
      width: '46px',
      height: '46px',
      background: 'none',
      border: '1px solid var(--border-color)',
      borderRadius: '50%',
      flexShrink: 0,
    }
  };

  const hoverStyles = {
    primary: !disabled ? { background: 'var(--fg-primary)', color: 'var(--bg-surface)' } : {},
    secondary: !disabled ? { color: 'var(--fg-primary)' } : {},
    ghost: !disabled ? { borderColor: 'var(--border-color)', color: 'var(--fg-primary)' } : {},
    icon: !disabled ? { background: 'var(--fg-primary)', color: 'var(--bg-surface)' } : {},
  };

  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      className={`btn btn-${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...baseStyles,
        ...variantStyles[variant],
        ...(isHovered ? hoverStyles[variant] : {}),
        ...style,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
