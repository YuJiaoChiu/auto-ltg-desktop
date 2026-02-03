import React, { useState, useEffect } from 'react';
import {
  Sidebar, Button, FileItem, Progress, LogArea,
  Checkbox, InputWithButton
} from '../components';
import { useLanguage } from '../hooks/useLanguage';
import { usePageState } from '../contexts/PageStateContext';
import { useTaskManager } from '../contexts/TaskContext';
import { subtitleOrganize } from '../services/api';

const Subtitles = () => {
  const language = useLanguage();
  const { getPageState, updatePageState } = usePageState();
  const { registerTask, getTask, tasks } = useTaskManager();

  const t = {
    zh: {
      title: '字幕整理',
      settings: '设置',
      dropFolder: '拖拽文件夹到此处',
      orClick: '或点击浏览本地目录',
      folderPath: '文件夹路径',
      currentDir: '当前工作目录',
      videoSRTMode: '启用 VideoSRT 处理模式',
      videoSRTDesc: '"VideoSRT 模式"自动将 .srt 文件映射到子目录中匹配的视频文件名。',
      syncFinished: '同步完成',
      files: '个文件',
      organize: '整理字幕',
      openFolder: '打开目标文件夹',
      waiting: '等待操作...',
      systemLog: '运行日志',
      organizing: '整理中...',
      noFolder: '请先输入文件夹路径',
      completed: '完成',
      error: '错误',
    },
    en: {
      title: 'Subtitle Structure',
      settings: 'Settings',
      dropFolder: 'Drag & Drop Workspace Folder',
      orClick: 'or click to browse',
      folderPath: 'Folder Path',
      currentDir: 'Current Working Directory',
      videoSRTMode: 'Enable VideoSRT processing mode',
      videoSRTDesc: '"VideoSRT mode" automatically maps .srt files to matching video filenames within subdirectories.',
      syncFinished: 'Sync Finished',
      files: 'Files',
      organize: 'Organize Subtitles',
      openFolder: 'Open Target Folder',
      waiting: 'Waiting for operation...',
      systemLog: 'Live Console',
      organizing: 'Organizing...',
      noFolder: 'Please enter folder path first',
      completed: 'Completed',
      error: 'Error',
    }
  }[language];

  // 从 PageState 恢复状态
  const savedState = getPageState('subtitles', {});

  const [folderPath, setFolderPath] = useState(savedState.folderPath || '');
  const [isVideoSRTMode, setIsVideoSRTMode] = useState(true);  // 默认勾选
  const [progress, setProgress] = useState(savedState.progress || 0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [taskId, setTaskId] = useState(savedState.taskId || null);
  const [backgroundTaskId, setBackgroundTaskId] = useState(null);

  const [files, setFiles] = useState(savedState.files || []);
  const [logEntries, setLogEntries] = useState(savedState.logEntries || []);

  const addLog = (message, highlight = false) => {
    const time = new Date().toLocaleTimeString();
    setLogEntries(prev => [...prev, { time, message, highlight }]);
  };

  // 保存状态到 PageState
  useEffect(() => {
    updatePageState('subtitles', {
      folderPath,
      isVideoSRTMode,
      progress,
      taskId,
      files,
      logEntries,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderPath, isVideoSRTMode, progress, taskId, files, logEntries, updatePageState]);

  // 从全局任务状态恢复整理进度
  useEffect(() => {
    if (backgroundTaskId) {
      const task = getTask(backgroundTaskId);
      if (task) {
        if (task.status === 'running') {
          setIsProcessing(true);
          setProgress(task.progress || 0);
          if (task.message) {
            addLog(task.message, false);
          }
        } else if (task.status === 'completed') {
          setIsProcessing(false);
          setProgress(100);
          const res = task.result || {};
          addLog(`${t.completed}: ${res.success_count || 0}/${res.total || 0} ${t.files}`, true);
          if (res.logs) {
            res.logs.forEach(log => addLog(log, false));
          }
          setFiles(prev => prev.map(f => ({ ...f, status: 'complete' })));
          setBackgroundTaskId(null);
        } else if (task.status === 'error') {
          setIsProcessing(false);
          addLog(`${t.error}: ${task.error}`, true);
          setBackgroundTaskId(null);
        }
      }
    }
  }, [backgroundTaskId, getTask, tasks, t.completed, t.error, t.files]);

  const handleOrganize = async () => {
    if (!folderPath) {
      addLog(t.noFolder, true);
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setFiles([]);
    setLogEntries([]);
    addLog(t.organizing, true);

    try {
      const result = await subtitleOrganize({
        folder: folderPath,
        videosrtMode: isVideoSRTMode,
      });

      if (result.success) {
        setTaskId(result.task_id);
        // 注册全局任务 - 使用后端返回的 task_id
        setBackgroundTaskId(result.task_id);
        registerTask(result.task_id, {
          id: result.task_id,
          type: 'subtitle-organize',
          title: `Organize subtitles in ${folderPath}`,
          page: 'subtitles',
        });
        // Set placeholder files
        setFiles([
          { icon: '📄', name: 'Scanning...', label: '', status: 'pending' },
        ]);
      } else {
        setIsProcessing(false);
        addLog(`${t.error}: ${result.error}`, true);
      }
    } catch (err) {
      setIsProcessing(false);
      addLog(`${t.error}: ${err.message}`, true);
    }
  };

  const handleOpenFolder = () => {
    if (folderPath) {
      if (window.electronAPI) {
        window.electronAPI.openFolder(folderPath);
      } else {
        addLog(`Folder: ${folderPath}`, false);
      }
    }
  };

  return (
    <>
      <Sidebar />

      <main className="panel panel-main">
        <h2 className="section-header">04 — {t.title}</h2>

        <div className="input-group">
          <label className="label">{t.folderPath}</label>
          <InputWithButton
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            browseMode="folder"
            placeholder={language === 'zh' ? '输入字幕文件夹路径...' : 'Enter subtitle folder path...'}
          />
        </div>

        <div style={{ marginTop: 'var(--space-lg)' }}>
          <Checkbox
            label={t.videoSRTMode}
            checked={isVideoSRTMode}
            onChange={() => setIsVideoSRTMode(!isVideoSRTMode)}
          />
        </div>

        <div style={{
          marginTop: 'var(--space-md)',
          padding: '20px',
          border: '1px dashed var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          textAlign: 'center',
          opacity: 0.6
        }}>
          <p style={{ fontSize: '13px', fontStyle: 'italic' }}>
            {t.videoSRTDesc}
          </p>
        </div>

        <div style={{ marginTop: 'auto' }}>
          <Progress
            value={progress}
            label={progress === 100 ? t.syncFinished : (isProcessing ? t.organizing : '')}
          />
          <p style={{ fontSize: '12px', color: 'var(--fg-secondary)', textAlign: 'right', marginTop: '4px' }}>
            {progress === 100 ? `${files.length} ${t.files}` : ''}
          </p>
        </div>
      </main>

      <aside className="panel panel-files">
        <div className="file-list-header">
          <h3>SRT <span>Organization</span></h3>
          <span className="label">{files.length} {t.files}</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          {files.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--fg-muted)',
              fontSize: '13px'
            }}>
              {t.waiting}
            </div>
          ) : (
            files.map((file, index) => (
              <FileItem
                key={index}
                icon={file.icon}
                name={file.name}
                status={file.status}
                statusLabel="Sync"
                subLabel={file.label}
              />
            ))
          )}
        </div>

        <LogArea entries={logEntries} title={t.systemLog} />

        <div style={{ marginTop: 'var(--space-md)' }}>
          <Button onClick={handleOrganize} disabled={isProcessing}>
            <span>{isProcessing ? t.organizing : t.organize}</span>
            <span>→</span>
          </Button>
          <Button
            variant="ghost"
            onClick={handleOpenFolder}
            style={{ marginTop: '10px', width: '100%' }}
          >
            <span>📂 {t.openFolder}</span>
          </Button>
        </div>
      </aside>
    </>
  );
};

export default Subtitles;
