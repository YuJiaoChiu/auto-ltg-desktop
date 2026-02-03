/**
 * 后台任务管理器 Hook
 * 
 * 这个 Hook 常驻在 App 组件中，负责监控所有后台任务的进度。
 * 即使用户切换页面，这个 Hook 也会继续运行，确保任务不被打断。
 */

import { useEffect, useCallback } from 'react';
import { useTaskManager } from '../contexts/TaskContext';
import { getTaskStatus, compressGetTasks } from '../services/api';

export const useBackgroundTaskManager = () => {
  const { tasks, updateTaskProgress, completeTask, failTask } = useTaskManager();

  // 轮询单个任务状态
  const pollTaskStatus = useCallback(async (taskId) => {
    try {
      const result = await getTaskStatus(taskId);
      if (result.success) {
        const task = result.task;
        
        if (task.status === 'completed') {
          completeTask(taskId, task.result);
        } else if (task.status === 'error') {
          failTask(taskId, task.error || 'Task failed');
        } else {
          updateTaskProgress(taskId, Math.round((task.progress || 0) * 100), task.message || '');
        }
      }
    } catch (err) {
      console.error(`Poll task ${taskId} error:`, err);
    }
  }, [updateTaskProgress, completeTask, failTask]);

  // 轮询压缩任务状态
  const pollCompressionTasks = useCallback(async (taskIds, registeredTaskId) => {
    try {
      const result = await compressGetTasks();
      if (result.success) {
        const allTasks = result.tasks || [];
        const activeTasks = allTasks.filter(t => taskIds.includes(t.id));

        if (activeTasks.length > 0) {
          // 计算总体进度
          const totalProgress = activeTasks.reduce((sum, t) => sum + (t.progress || 0), 0);
          const avgProgress = totalProgress / activeTasks.length;

          // 找出正在处理的任务
          const processing = activeTasks.find(t => t.status === 'running' || t.status === 'processing');
          const message = processing
            ? `Processing: ${processing.input_path?.split('/').pop() || '...'}`
            : 'Compressing...';

          // 检查是否全部完成
          const allDone = activeTasks.every(t =>
            t.status === 'completed' || t.status === 'failed' || t.status === 'error'
          );

          // 使用注册的任务 ID 来更新状态
          if (allDone) {
            const successCount = activeTasks.filter(t => t.status === 'completed').length;
            completeTask(registeredTaskId, {
              success: successCount,
              total: activeTasks.length,
              tasks: activeTasks
            });
          } else {
            updateTaskProgress(registeredTaskId, Math.round(avgProgress), message);
          }
        }
      }
    } catch (err) {
      console.error('Poll compression tasks error:', err);
    }
  }, [updateTaskProgress, completeTask]);

  // 全局轮询管理
  useEffect(() => {
    const runningTasks = Object.values(tasks).filter(t => t.status === 'running');

    if (runningTasks.length === 0) return;

    // 为每个运行中的任务创建轮询
    const intervals = runningTasks.map(task => {
      // 压缩任务可能有多个 taskIds
      if (task.taskIds && Array.isArray(task.taskIds)) {
        // 立即执行一次，传入任务的注册 ID
        pollCompressionTasks(task.taskIds, task.id);
        // 设置轮询
        return setInterval(() => pollCompressionTasks(task.taskIds, task.id), 1000);
      } else {
        // 单个任务轮询
        pollTaskStatus(task.id);
        return setInterval(() => pollTaskStatus(task.id), 1000);
      }
    });

    // 清理函数
    return () => {
      intervals.forEach(interval => clearInterval(interval));
    };
  }, [tasks, pollTaskStatus, pollCompressionTasks]);

  return null;
};

export default useBackgroundTaskManager;
