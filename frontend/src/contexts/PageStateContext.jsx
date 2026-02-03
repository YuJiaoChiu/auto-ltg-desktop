import React, { createContext, useContext, useState } from 'react';

const PageStateContext = createContext();

export const usePageState = () => {
  const context = useContext(PageStateContext);
  if (!context) {
    throw new Error('usePageState must be used within a PageStateProvider');
  }
  return context;
};

export const PageStateProvider = ({ children }) => {
  // 各页面的状态存储
  const [pageStates, setPageStates] = useState({});

  // 获取指定页面的状态
  const getPageState = (pageName, defaultState = {}) => {
    return pageStates[pageName] || defaultState;
  };

  // 设置指定页面的状态
  const setPageState = (pageName, state) => {
    setPageStates(prev => ({
      ...prev,
      [pageName]: typeof state === 'function' ? state(prev[pageName] || {}) : state
    }));
  };

  // 更新指定页面的部分状态
  const updatePageState = (pageName, updates) => {
    setPageStates(prev => ({
      ...prev,
      [pageName]: {
        ...(prev[pageName] || {}),
        ...updates
      }
    }));
  };

  // 清除指定页面的状态
  const clearPageState = (pageName) => {
    setPageStates(prev => {
      const newStates = { ...prev };
      delete newStates[pageName];
      return newStates;
    });
  };

  const value = {
    getPageState,
    setPageState,
    updatePageState,
    clearPageState
  };

  return (
    <PageStateContext.Provider value={value}>
      {children}
    </PageStateContext.Provider>
  );
};

export default PageStateContext;
