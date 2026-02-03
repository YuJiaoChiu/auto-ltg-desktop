import React, { useState, useEffect } from 'react';
import {
  Sidebar, Button, FileItem, Progress, LogArea,
  InputWithButton, Select, Checkbox
} from '../components';
import { useLanguage } from '../hooks/useLanguage';
import { usePageState } from '../contexts/PageStateContext';
import { useTaskManager } from '../contexts/TaskContext';
import { introAnalyze, introProcess, stopTask, getTaskStatus } from '../services/api';

const AddIntro = () => {
  const language = useLanguage();
  const { getPageState, updatePageState } = usePageState();
  const { registerTask, getTask, tasks } = useTaskManager();

  const t = {
    zh: {
      title: '添加片头',
      settings: '设置',
      introVideo: '① 片头视频',
      videoDir: '② 视频目录',
      videosFound: '个视频文件',
      outputDir: '③ 输出目录 (可选)',
      outputPlaceholder: '默认在视频目录下生成 output 文件夹',
      overwriteSource: '覆盖源文件',
      encodingPreset: '编码预设',
      fastMode: '"快速"模式仅在片头和目标视频具有相同分辨率和帧率时有效。',
      videoQueue: '视频队列',
      items: '个项目',
      startBatch: '开始批量添加',
      abort: '中止会话',
      analyze: '分析',
      processing: '处理中',
      completed: '已完成',
      pending: '待处理',
      systemLog: '运行日志',
      analyzing: '分析中...',
      noIntro: '请输入片头视频路径',
      noVideoDir: '请输入视频目录路径',
      analyzeFirst: '请先分析',
      error: '错误',
    },
    en: {
      title: 'Add Intro',
      settings: 'Settings',
      introVideo: '① Intro Video',
      videoDir: '② Video Directory',
      videosFound: 'video files found',
      outputDir: '③ Output Directory (Optional)',
      outputPlaceholder: 'Default: create output folder under video directory',
      overwriteSource: 'Overwrite source files',
      encodingPreset: 'Encoding Preset',
      fastMode: '"Fast" mode only works if intro and targets share identical resolutions and frame rates.',
      videoQueue: 'Video Queue',
      items: 'Items',
      startBatch: 'Start Batch Prepend',
      abort: 'Abort Session',
      analyze: 'Analyze',
      processing: 'Processing',
      completed: 'Completed',
      pending: 'Pending',
      systemLog: 'Live Console',
      analyzing: 'Analyzing...',
      noIntro: 'Please enter intro video path',
      noVideoDir: 'Please enter video directory path',
      analyzeFirst: 'Please analyze first',
      error: 'Error',
    }
  }[language];

  // 从 PageState 恢复状态
  const savedState = getPageState('addIntro', {});

  // 片头路径从 localStorage 读取（持久保存）
  const [introPath, setIntroPath] = useState(() => localStorage.getItem('introPath') || '');
  const [videoFolder, setVideoFolder] = useState(savedState.videoFolder || '');
  const [outputFolder, setOutputFolder] = useState(savedState.outputFolder || '');
  const [overwriteSource, setOverwriteSource] = useState(savedState.overwriteSource || false);
  const [encodingPreset, setEncodingPreset] = useState(savedState.encodingPreset || 'lossless');
  const [progress, setProgress] = useState(savedState.progress || 0);
  const [progressMessage, setProgressMessage] = useState(savedState.progressMessage || '');

  // 片头路径变化时保存到 localStorage
  useEffect(() => {
    if (introPath) {
      localStorage.setItem('introPath', introPath);
    }
  }, [introPath]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(savedState.hasAnalyzed || false);
  const [taskId, setTaskId] = useState(savedState.taskId || null);
  const [backgroundTaskId, setBackgroundTaskId] = useState(null);

  const [introInfo, setIntroInfo] = useState(savedState.introInfo || null);
  const [fileQueue, setFileQueue] = useState(savedState.fileQueue || []);
  const [logEntries, setLogEntries] = useState(savedState.logEntries || []);

  const addLog = (message, highlight = false) => {
    const time = new Date().toLocaleTimeString();
    setLogEntries(prev => [...prev, { time, message, highlight }]);
  };

  // 保存状态到 PageState
  useEffect(() => {
    updatePageState('addIntro', {
      introPath,
      videoFolder,
      outputFolder,
      overwriteSource,
      encodingPreset,
      progress,
      progressMessage,
      hasAnalyzed,
      taskId,
      introInfo,
      fileQueue,
      logEntries,
    });
  }, [introPath, videoFolder, outputFolder, overwriteSource, encodingPreset, 
      progress, progressMessage, hasAnalyzed, taskId, introInfo, fileQueue, logEntries]);

  // 从全局任务状态恢复处理进度 - 通过轮询后端 API
  useEffect(() => {
    if (!backgroundTaskId) return;

    const pollTaskStatus = async () => {
      try {
        const result = await getTaskStatus(backgroundTaskId);
        if (result.success && result.task) {
          const task = result.task;
          const current = task.current || 0;
          const total = task.total || fileQueue.length;
          const progressPercent = Math.round((task.progress || 0) * 100);

          if (task.status === 'running') {
            setIsProcessing(true);
            setProgress(progressPercent);
            setProgressMessage(task.message || '');

            // 根据 current/total 更新文件状态
            setFileQueue(prev => prev.map((f, idx) => {
              if (idx < current - 1) {
                return { ...f, status: 'complete', subLabel: 'Success ✓' };
              } else if (idx === current - 1) {
                return { ...f, status: 'processing', subLabel: task.message || 'Processing...' };
              } else {
                return { ...f, status: 'pending', subLabel: 'Queued' };
              }
            }));
          } else if (task.status === 'completed') {
            setIsProcessing(false);
            setProgress(100);
            const res = task.result || {};
            addLog(`${t.completed}: ${res.processed || res.success || 0}/${res.total || total}`, true);
            setFileQueue(prev => prev.map(f => ({ ...f, status: 'complete', subLabel: 'Success ✓' })));
            setBackgroundTaskId(null);
          } else if (task.status === 'error') {
            setIsProcessing(false);
            addLog(`${t.error}: ${task.error}`, true);
            setBackgroundTaskId(null);
          }
        }
      } catch (err) {
        console.error('Poll task status error:', err);
      }
    };

    // 立即执行一次
    pollTaskStatus();
    // 每秒轮询
    const interval = setInterval(pollTaskStatus, 1000);
    return () => clearInterval(interval);
  }, [backgroundTaskId, t.completed, t.error, fileQueue.length]);

  const handleAnalyze = async () => {
    if (!introPath) {
      addLog(t.noIntro, true);
      return;
    }
    if (!videoFolder) {
      addLog(t.noVideoDir, true);
      return;
    }

    setIsAnalyzing(true);
    setProgress(0);
    setFileQueue([]);
    setHasAnalyzed(false);
    addLog(t.analyzing, true);

    try {
      const result = await introAnalyze({
        introPath,
        videoDir: videoFolder,
      });

      if (result.success) {
        setIntroInfo(result.intro_info);
        setFileQueue(result.videos.map((v, idx) => ({
          id: idx,
          name: typeof v === 'string' ? v.split('/').pop() : v.filename || `video_${idx}`,
          path: typeof v === 'string' ? v : v.path,
          status: 'pending',
          statusLabel: t.pending,
          subLabel: 'Queued',
        })));
        setHasAnalyzed(true);
        setProgress(100);
        addLog(`Found ${result.video_count} videos`, true);
      } else {
        addLog(`${t.error}: ${result.error}`, true);
      }
    } catch (err) {
      addLog(`${t.error}: ${err.message}`, true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartBatch = async () => {
    if (!hasAnalyzed || fileQueue.length === 0) {
      addLog(t.analyzeFirst, true);
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setFileQueue(prev => prev.map(f => ({ ...f, status: 'processing', subLabel: 'Processing...' })));
    addLog('Starting batch process...', true);

    try {
      const result = await introProcess({
        introPath,
        videoDir: videoFolder,
        outputDir: outputFolder,
        overwriteSource,
      });

      if (result.success) {
        setTaskId(result.task_id);
        // 注册全局任务 - 使用后端返回的 task_id
        setBackgroundTaskId(result.task_id);
        registerTask(result.task_id, {
          id: result.task_id,
          type: 'add-intro',
          title: `Add intro to ${fileQueue.length} videos`,
          page: 'add-intro',
        });
      } else {
        setIsProcessing(false);
        addLog(`${t.error}: ${result.error}`, true);
      }
    } catch (err) {
      setIsProcessing(false);
      addLog(`${t.error}: ${err.message}`, true);
    }
  };

  const handleAbort = async () => {
    if (taskId) {
      try {
        await stopTask(taskId);
      } catch (err) {
        console.error('Stop task error:', err);
      }
    }
    setIsProcessing(false);
    setBackgroundTaskId(null);
    setFileQueue(prev => prev.map(f =>
      f.status === 'processing' ? { ...f, status: 'pending', subLabel: 'Queued' } : f
    ));
    addLog('Aborted', true);
  };

  const encodingOptions = [
    { value: 'lossless', label: language === 'zh' ? '无损合并 (快速)' : 'Lossless Concatenation (Fast)' },
    { value: 'h264', label: language === 'zh' ? '重新编码 H.264 High Profile' : 'Re-encode H.264 High Profile' },
    { value: 'hevc', label: language === 'zh' ? '重新编码 HEVC (ProRes 质量)' : 'Re-encode HEVC (ProRes Quality)' },
  ];

  const completedCount = fileQueue.filter(f => f.status === 'complete').length;

  return (
    <>
      <Sidebar />

      <main className="panel panel-main">
        <h2 className="section-header">03 — {t.title}</h2>

        <div className="input-group">
          <label className="label">{t.introVideo}</label>
          <InputWithButton
            value={introPath}
            onChange={(e) => setIntroPath(e.target.value)}
            browseMode="file"
            fileFilters={[{ name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'avi'] }]}
            placeholder={language === 'zh' ? '输入片头视频路径...' : 'Enter intro video path...'}
          />
        </div>

        <div className="input-group">
          <label className="label">{t.videoDir}</label>
          <InputWithButton
            value={videoFolder}
            onChange={(e) => setVideoFolder(e.target.value)}
            browseMode="folder"
            placeholder={language === 'zh' ? '输入视频目录路径...' : 'Enter video directory path...'}
          />
          {hasAnalyzed && (
            <p style={{ fontSize: '12px', color: 'var(--fg-secondary)', marginTop: '4px' }}>
              {language === 'zh' ? `已发现 ${fileQueue.length} 个视频文件` : `Found ${fileQueue.length} video files`}
            </p>
          )}
        </div>

        <Button
          variant="ghost"
          onClick={handleAnalyze}
          disabled={isAnalyzing || isProcessing}
          style={{ marginBottom: 'var(--space-md)' }}
        >
          {isAnalyzing ? t.analyzing : t.analyze}
        </Button>

        <div className="input-group">
          <label className="label">{t.outputDir}</label>
          <InputWithButton
            value={outputFolder}
            onChange={(e) => setOutputFolder(e.target.value)}
            placeholder={t.outputPlaceholder}
            browseMode="folder"
          />
        </div>

        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <Checkbox
            label={t.overwriteSource}
            checked={overwriteSource}
            onChange={() => setOverwriteSource(!overwriteSource)}
          />
        </div>

        <div className="input-group">
          <label className="label">{t.encodingPreset}</label>
          <Select
            value={encodingPreset}
            onChange={(e) => setEncodingPreset(e.target.value)}
            options={encodingOptions}
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
            {t.fastMode}
          </p>
        </div>

        <div style={{ marginTop: 'auto' }}>
          <Progress
            value={progress}
            label={progressMessage || (isProcessing
              ? `${t.processing} ${completedCount}/${fileQueue.length} (${progress}%)`
              : ''
            )}
          />
        </div>
      </main>

      <aside className="panel panel-files">
        <div className="file-list-header">
          <h3>{t.videoQueue}</h3>
          <span className="label">{fileQueue.length} {t.items}</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          {fileQueue.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--fg-muted)',
              fontSize: '13px'
            }}>
              {language === 'zh' ? '请先分析视频目录' : 'Please analyze video directory first'}
            </div>
          ) : (
            fileQueue.map((file) => (
              <FileItem
                key={file.id}
                icon="🎬"
                name={file.name}
                status={file.status}
                statusLabel={file.status === 'complete' ? t.completed : file.status === 'processing' ? t.processing : t.pending}
                subLabel={file.subLabel}
              />
            ))
          )}
        </div>

        <LogArea entries={logEntries} title={t.systemLog} />

        <div style={{ marginTop: 'var(--space-md)' }}>
          <Button onClick={handleStartBatch} disabled={isAnalyzing || isProcessing || !hasAnalyzed}>
            <span>{t.startBatch}</span>
            <span>→</span>
          </Button>
          <Button variant="secondary" onClick={handleAbort} disabled={!isProcessing}>
            {t.abort}
          </Button>
        </div>
      </aside>
    </>
  );
};

export default AddIntro;
