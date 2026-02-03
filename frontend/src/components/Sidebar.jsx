import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const NavItem = ({ icon, label, isActive, onClick }) => {
  const [lang, setLang] = useState(localStorage.getItem('language') || 'zh');
  
  useEffect(() => {
    const handleStorage = () => setLang(localStorage.getItem('language') || 'zh');
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const labels = {
    'AI Rename': { zh: 'AI 重命名', en: 'AI Rename' },
    'Video Split': { zh: '视频分割', en: 'Video Split' },
    'Add Intro': { zh: '添加片头', en: 'Add Intro' },
    'Subtitles': { zh: '字幕整理', en: 'Subtitles' },
    'Compress': { zh: '视频压缩', en: 'Compress' },
    'Course': { zh: '课程文案', en: 'Course' },
    'Statistics': { zh: '数据统计', en: 'Statistics' },
    'Settings': { zh: '设置', en: 'Settings' },
  };

  const displayLabel = labels[label]?.[lang] || label;

  return (
    <div 
      className={`nav-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <span className="icon">{icon}</span>
      {displayLabel}
    </div>
  );
};

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { path: '/ai-rename', icon: '○', label: 'AI Rename' },
    { path: '/video-split', icon: '○', label: 'Video Split' },
    { path: '/add-intro', icon: '○', label: 'Add Intro' },
    { path: '/subtitles', icon: '○', label: 'Subtitles' },
    { path: '/compress', icon: '○', label: 'Compress' },
    { path: '/course', icon: '○', label: 'Course' },
    { path: '/statistics', icon: '○', label: 'Statistics' },
  ];

  return (
    <aside className="panel panel-sidebar">
      <div className="brand-logo">
        Auto-LTG <sup>®</sup>
      </div>

      <nav className="nav-menu">
        {navItems.map(item => (
          <NavItem
            key={item.path}
            icon={currentPath === item.path ? '●' : '○'}
            label={item.label}
            isActive={currentPath === item.path}
            onClick={() => navigate(item.path)}
          />
        ))}
      </nav>

      <div className="sidebar-footer">
        <NavItem
          icon="⚙"
          label="Settings"
          isActive={currentPath === '/settings'}
          onClick={() => navigate('/settings')}
        />
      </div>
    </aside>
  );
};

export default Sidebar;
