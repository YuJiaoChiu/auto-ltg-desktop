import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Asterisk } from './components';
import {
  SplashScreen,
  AIRename,
  VideoSplit,
  AddIntro,
  Subtitles,
  Compression,
  CourseCopy,
  Statistics,
  Settings,
} from './pages';
import { SettingsProvider } from './contexts/SettingsContext';
import { PageStateProvider } from './contexts/PageStateContext';
import { TaskProvider } from './contexts/TaskContext';
import { useBackgroundTaskManager } from './hooks/useBackgroundTaskManager';
import './styles/global.css';

// 后台任务管理器组件 - 常驻在 App 中，不受页面切换影响
const BackgroundTaskManager = () => {
  useBackgroundTaskManager();
  return null;
};

const AppContent = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // 加载保存的主题和语言设置
    const savedTheme = localStorage.getItem('theme') || 'light';
    const savedLang = localStorage.getItem('language') || 'zh';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.documentElement.setAttribute('data-lang', savedLang);

    // 2秒后隐藏启动页
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {/* 后台任务管理器 - 常驻运行 */}
      <BackgroundTaskManager />

      {/* 可拖动标题栏 */}
      <div className="drag-bar" />

      <div className="app-container">
        <Asterisk />

        {showSplash ? (
          <SplashScreen />
        ) : (
          <Routes>
            <Route path="/ai-rename" element={<AIRename />} />
            <Route path="/video-split" element={<VideoSplit />} />
            <Route path="/add-intro" element={<AddIntro />} />
            <Route path="/subtitles" element={<Subtitles />} />
            <Route path="/compress" element={<Compression />} />
            <Route path="/course" element={<CourseCopy />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/" element={<Navigate to="/ai-rename" replace />} />
          </Routes>
        )}
      </div>
    </>
  );
};

const App = () => {
  return (
    <SettingsProvider>
      <PageStateProvider>
        <TaskProvider>
          <Router>
            <AppContent />
          </Router>
        </TaskProvider>
      </PageStateProvider>
    </SettingsProvider>
  );
};

export default App;
