import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SplashScreen = () => {
  const navigate = useNavigate();
  const [opacity, setOpacity] = useState(1);
  const [show, setShow] = useState(true);

  useEffect(() => {
    // 1.5秒后淡出
    const fadeTimer = setTimeout(() => {
      setOpacity(0);
    }, 1500);

    // 淡出动画结束后跳转
    const navTimer = setTimeout(() => {
      setShow(false);
      navigate('/ai-rename');
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(navTimer);
    };
  }, [navigate]);

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'var(--bg-canvas)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        opacity,
        transition: 'opacity 0.5s ease',
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: 140,
          height: 140,
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          overflow: 'hidden',
        }}
      >
        <img
          src="./images/logo.png"
          alt="Auto-LTG Logo"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </div>

      {/* 品牌名 */}
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '32px',
          fontWeight: 400,
          color: 'var(--fg-primary)',
          marginBottom: 8,
        }}
      >
        Auto-LTG
      </h1>

      {/* 副标题 */}
      <p
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '14px',
          color: 'var(--fg-secondary)',
          fontStyle: 'italic',
        }}
      >
        by Link
      </p>
    </div>
  );
};

export default SplashScreen;
