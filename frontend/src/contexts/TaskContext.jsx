import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const TaskContext = createContext();

export const useTaskManager = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTaskManager must be used within a TaskProvider');
  }
  return context;
};

export const TaskProvider = ({ children }) => {
  // 存储所有进行中的任务
  const [tasks, setTasks] = useState({});
  const taskIntervals = useRef({});

  // 注册任务 - 由各个页面在启动任务时调用
  const registerTask = useCallback((taskId, taskInfo) => {
    setTasks(prev => ({
      ...prev,
      [taskId]: {
        ...taskInfo,
        id: taskId,
        status: 'running',
        progress: 0,
        message: '开始处理...',
        startTime: Date.now(),
        // taskIds 用于压缩等多任务场景
        taskIds: taskInfo.taskIds || null,
      }
    }));
  }, []);

  // 更新任务进度
  const updateTaskProgress = useCallback((taskId, progress, message) => {
    setTasks(prev => {
      if (!prev[taskId]) return prev;
      return {
        ...prev,
        [taskId]: {
          ...prev[taskId],
          progress,
          message,
          lastUpdate: Date.now(),
        }
      };
    });
  }, []);

  // 完成任务
  const completeTask = useCallback((taskId, result) => {
    setTasks(prev => {
      if (!prev[taskId]) return prev;
      return {
        ...prev,
        [taskId]: {
          ...prev[taskId],
          status: 'completed',
          progress: 100,
          result,
          endTime: Date.now(),
        }
      };
    });
    // 清理定时器
    if (taskIntervals.current[taskId]) {
      clearInterval(taskIntervals.current[taskId]);
      delete taskIntervals.current[taskId];
    }
  }, []);

  // 任务失败
  const failTask = useCallback((taskId, error) => {
    setTasks(prev => {
      if (!prev[taskId]) return prev;
      return {
        ...prev,
        [taskId]: {
          ...prev[taskId],
          status: 'error',
          error,
          endTime: Date.now(),
        }
      };
    });
    // 清理定时器
    if (taskIntervals.current[taskId]) {
      clearInterval(taskIntervals.current[taskId]);
      delete taskIntervals.current[taskId];
    }
  }, []);

  // 停止任务
  const stopTaskById = useCallback((taskId) => {
    setTasks(prev => {
      if (!prev[taskId]) return prev;
      return {
        ...prev,
        [taskId]: {
          ...prev[taskId],
          status: 'stopped',
          endTime: Date.now(),
        }
      };
    });
    // 清理定时器
    if (taskIntervals.current[taskId]) {
      clearInterval(taskIntervals.current[taskId]);
      delete taskIntervals.current[taskId];
    }
  }, []);

  // 移除任务（清理已完成/失败的任务）
  const removeTask = useCallback((taskId) => {
    setTasks(prev => {
      const newTasks = { ...prev };
      delete newTasks[taskId];
      return newTasks;
    });
    if (taskIntervals.current[taskId]) {
      clearInterval(taskIntervals.current[taskId]);
      delete taskIntervals.current[taskId];
    }
  }, []);

  // 获取任务状态
  const getTask = useCallback((taskId) => {
    return tasks[taskId];
  }, [tasks]);

  // 注册轮询定时器 - 用于在页面卸载后继续轮询
  const registerPollInterval = useCallback((taskId, intervalFn, interval = 1000) => {
    // 先清除已有的定时器
    if (taskIntervals.current[taskId]) {
      clearInterval(taskIntervals.current[taskId]);
    }
    // 创建新的定时器
    taskIntervals.current[taskId] = setInterval(intervalFn, interval);
    return taskId;
  }, []);

  // 停止轮询
  const stopPolling = useCallback((taskId) => {
    if (taskIntervals.current[taskId]) {
      clearInterval(taskIntervals.current[taskId]);
      delete taskIntervals.current[taskId];
    }
  }, []);

  // 获取所有进行中的任务
  const getRunningTasks = useCallback(() => {
    return Object.values(tasks).filter(task => task.status === 'running');
  }, [tasks]);

  // 获取所有已完成的任务
  const getCompletedTasks = useCallback(() => {
    return Object.values(tasks).filter(task => 
      task.status === 'completed' || task.status === 'error' || task.status === 'stopped'
    );
  }, [tasks]);

  const value = {
    tasks,
    registerTask,
    updateTaskProgress,
    completeTask,
    failTask,
    stopTaskById,
    removeTask,
    getTask,
    registerPollInterval,
    stopPolling,
    getRunningTasks,
    getCompletedTasks,
  };

  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
};

export default TaskContext;
