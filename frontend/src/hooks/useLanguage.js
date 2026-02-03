import { useState, useEffect } from 'react';

export const useLanguage = () => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('language') || 'zh';
  });

  useEffect(() => {
    const handleStorage = () => {
      setLanguage(localStorage.getItem('language') || 'zh');
    };
    
    window.addEventListener('storage', handleStorage);
    
    // 自定义事件监听
    const handleLangChange = () => {
      setLanguage(localStorage.getItem('language') || 'zh');
    };
    window.addEventListener('languageChange', handleLangChange);
    
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('languageChange', handleLangChange);
    };
  }, []);

  return language;
};
