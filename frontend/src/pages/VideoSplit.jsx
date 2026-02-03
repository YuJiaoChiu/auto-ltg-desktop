import React, { useState, useEffect } from 'react';
import {
  Sidebar, Button, FileItem, Progress,
  InputWithButton, Radio, DropZone
} from '../components';
import { useLanguage } from '../hooks/useLanguage';
import { usePageState } from '../contexts/PageStateContext';
import { useTaskManager } from '../contexts/TaskContext';
import { splitterAnalyze, splitterSplit, stopTask } from '../services/api';

const VideoSplit = () => {
  const language = useLanguage();
  const { getPageState, updatePageState } = usePageState();
  const { registerTask, getTask, tasks } = useTaskManager();

  const t = {
    zh: {
      title: '视频分割',
      settings: '设置',
      dropFolder: '拖拽文件夹到此处',
      orClick: '或点击浏览本地文件',
      folderPath: '文件夹路径',
      scanResult: '扫描结果',
      scanSummary: (total, needSplit) => `扫描到 ${total} 个视频，${needSplit} 个需要分割`,
      viewDetails: '查看详情',
      hideDetails: '收起详情',
      fileName: '文件名',
      duration: '时长',
      resolution: '分辨率',
      needSplit: '需要分割',
      segments: '预计段数',
      yes: '是',
      no: '否',
      processingQueue: '处理队列',
      clearList: '清空列表',
      stopProcessing: '停止处理',
      splitParameters: '分割参数',
      outputMode: '输出模式',
      newFolder: '生成到新目录',
      overwrite: '覆盖源文件',
      outputDir: '输出目录',
      targetDuration: '目标片段时长 (分钟)',
      silenceRange: '静音搜索范围 (秒)',
      minSilence: '最小静音时长 (秒)',
      longSilence: '长静音阈值 (秒)',
      saveSettings: '保存设置',
      startProcessing: '开始处理',
      scanFirst: '请先扫描',
      systemLog: '系统日志',
      scanning: '扫描中...',
      scanComplete: '扫描完成',
      processing: '处理中...',
      completed: '处理完成',
      noVideos: '未找到视频文件',
      waitingScan: '等待扫描...',
    },
    en: {
      title: 'Video Splitting',
      settings: 'Settings',
      dropFolder: 'Drop folder here',
      orClick: 'or click to browse',
      folderPath: 'Folder Path',
      scanResult: 'Scan Result',
      scanSummary: (total, needSplit) => `Found ${total} videos, ${needSplit} need splitting`,
      viewDetails: 'View Details',
      hideDetails: 'Hide Details',
      fileName: 'Filename',
      duration: 'Duration',
      resolution: 'Resolution',
      needSplit: 'Split Needed',
      segments: 'Est. Segments',
      yes: 'Yes',
      no: 'No',
      processingQueue: 'Processing Queue',
      clearList: 'Clear List',
      stopProcessing: 'Stop Processing',
      splitParameters: 'Split Parameters',
      outputMode: 'Output Mode',
      newFolder: 'Generate to new directory',
      overwrite: 'Overwrite source files',
      outputDir: 'Output Directory',
      targetDuration: 'Target Duration (min)',
      silenceRange: 'Silence Range (sec)',
      minSilence: 'Min Silence (sec)',
      longSilence: 'Long Silence Threshold (sec)',
      saveSettings: 'Save Settings',
      startProcessing: 'Start Processing',
      scanFirst: 'Please scan first',
      systemLog: 'System Log',
      scanning: 'Scanning...',
      scanComplete: 'Scan complete',
      processing: 'Processing...',
      completed: 'Processing complete',
      noVideos: 'No videos found',
      waitingScan: 'Waiting for scan...',
    }
  }[language];

  // 从 PageState 恢复状态
  const savedState = getPageState('videoSplit', {});

  const [folderPath, setFolderPath] = useState(savedState.folderPath || '');
  const [splitMode, setSplitMode] = useState(savedState.splitMode || 'new-folder');
  const [targetDuration, setTargetDuration] = useState(savedState.targetDuration || 30);
  const [silenceRange, setSilenceRange] = useState(savedState.silenceRange || 60);
  const [minSilence, setMinSilence] = useState(savedState.minSilence || 0.5);
  const [longSilenceThreshold, setLongSilenceThreshold] = useState(savedState.longSilenceThreshold || 300);
  const [showScanDetails, setShowScanDetails] = useState(savedState.showScanDetails || false);
  const [hasScanned, setHasScanned] = useState(savedState.hasScanned || false);
  const [progress, setProgress] = useState(savedState.progress || 0);
  const [progressMessage, setProgressMessage] = useState(savedState.progressMessage || '');

  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [taskId, setTaskId] = useState(savedState.taskId || null);
  const [scanResults, setScanResults] = useState(savedState.scanResults || []);
  const [backgroundTaskId, setBackgroundTaskId] = useState(null);

  // Calculate stats
  const totalVideos = scanResults.filter(f => f.status !== 'failed').length;
  const needSplitCount = scanResults.filter(f => f.needSplit && f.status !== 'failed').length;
  const doneCount = scanResults.filter(f => f.status === 'done').length;

  // 保存状态到 PageState
  useEffect(() => {
    updatePageState('videoSplit', {
      folderPath,
      splitMode,
      targetDuration,
      silenceRange,
      minSilence,
      longSilenceThreshold,
      showScanDetails,
      hasScanned,
      progress,
      progressMessage,
      taskId,
      scanResults,
    });
  }, [folderPath, splitMode, targetDuration, silenceRange, minSilence, longSilenceThreshold, 
      showScanDetails, hasScanned, progress, progressMessage, taskId, scanResults]);

  // 从全局任务状态恢复分割进度
  useEffect(() => {
    if (backgroundTaskId) {
      const task = getTask(backgroundTaskId);
      if (task) {
        if (task.status === 'running') {
          setIsProcessing(true);
          setProgress(task.progress || 0);
          setProgressMessage(task.message || '');
          setScanResults(prev => prev.map(v => v.needSplit ? { ...v, status: 'processing' } : v));
        } else if (task.status === 'completed') {
          setIsProcessing(false);
          setProgress(100);
          setScanResults(prev => prev.map(v => ({ ...v, status: 'done' })));
          setBackgroundTaskId(null);
        } else if (task.status === 'error') {
          setIsProcessing(false);
          setProgressMessage(`Error: ${task.error}`);
          setBackgroundTaskId(null);
        }
      }
    }
  }, [backgroundTaskId, getTask, tasks]);

  const handleScan = async () => {
    if (!folderPath) {
      alert(language === 'zh' ? '请输入文件夹路径' : 'Please enter folder path');
      return;
    }

    setIsScanning(true);
    setProgress(0);
    setScanResults([]);
    setHasScanned(false);

    try {
      const result = await splitterAnalyze({ videoPath: folderPath });

      if (result.success) {
        setScanResults(result.videos.map((v, idx) => ({
          id: idx + 1,
          name: v.filename,
          path: v.path,
          duration: v.duration_str,
          durationMinutes: v.duration / 60,
          resolution: `${v.width}x${v.height}`,
          needSplit: v.needs_split,
          estimatedSegments: v.num_segments,
          status: 'pending',
        })));
        setHasScanned(true);
        setProgress(100);
      } else {
        alert(result.error || 'Scan failed');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleStartProcessing = async () => {
    if (!hasScanned || scanResults.length === 0) {
      alert(t.scanFirst);
      return;
    }

    const videosToSplit = scanResults.filter(v => v.needSplit).map(v => v.path);
    if (videosToSplit.length === 0) {
      alert(language === 'zh' ? '没有需要分割的视频' : 'No videos need splitting');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setScanResults(prev => prev.map(v => v.needSplit ? { ...v, status: 'processing' } : v));

    try {
      const result = await splitterSplit({
        videoPaths: videosToSplit,
        targetDuration: targetDuration * 60, // Convert to seconds
        searchRange: silenceRange,
        silenceThreshold: -40,
        minSilence,
        longSilenceThreshold,
        overwrite: splitMode === 'overwrite',
      });

      if (result.success) {
        setTaskId(result.task_id);
        // 注册全局任务 - 使用后端返回的 task_id 作为唯一标识
        setBackgroundTaskId(result.task_id);
        registerTask(result.task_id, {
          id: result.task_id,
          type: 'video-split',
          title: `Split ${videosToSplit.length} videos`,
          page: 'video-split',
        });
      } else {
        setIsProcessing(false);
        alert(result.error || 'Split failed');
      }
    } catch (err) {
      setIsProcessing(false);
      alert(err.message);
    }
  };

  const handleClearList = () => {
    setScanResults([]);
    setHasScanned(false);
    setProgress(0);
    setTaskId(null);
  };

  const handleStopProcessing = async () => {
    if (taskId) {
      try {
        await stopTask(taskId);
      } catch (err) {
        console.error('Stop task error:', err);
      }
    }
    setIsProcessing(false);
    setBackgroundTaskId(null);
    setScanResults(prev => prev.map(v => v.status === 'processing' ? { ...v, status: 'pending' } : v));
  };

  return (
    <>
      <Sidebar />

      <main className="panel panel-main">
        <h2 className="section-header">02 — {t.title}</h2>

        <div className="input-group">
          <label className="label">{t.folderPath}</label>
          <InputWithButton
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            browseMode="folder"
            placeholder={language === 'zh' ? '输入视频文件夹路径...' : 'Enter video folder path...'}
          />
        </div>

        {/* Scan Result Stats */}
        <div style={{
          marginTop: 'var(--space-lg)',
          padding: '16px 20px',
          background: 'rgba(0, 0, 0, 0.02)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-light)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--fg-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                color: 'var(--bg-surface)',
                fontWeight: 600,
              }}>02</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--fg-primary)' }}>
                  {t.scanResult}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--fg-secondary)', marginTop: '2px' }}>
                  {hasScanned
                    ? t.scanSummary(totalVideos, needSplitCount)
                    : t.waitingScan
                  }
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {hasScanned && (
                <Button
                  variant="ghost"
                  onClick={() => setShowScanDetails(!showScanDetails)}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  {showScanDetails ? t.hideDetails : t.viewDetails}
                  <span style={{ marginLeft: '4px' }}>{showScanDetails ? '▾' : '▸'}</span>
                </Button>
              )}
              <Button
                onClick={handleScan}
                disabled={isScanning || isProcessing}
                style={{ fontSize: '12px', padding: '6px 16px' }}
              >
                {isScanning ? t.scanning : (language === 'zh' ? '扫描分析' : 'Scan')}
              </Button>
            </div>
          </div>

          {/* Scan Details Table */}
          {showScanDetails && hasScanned && (
            <div style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-light)',
            }}>
              <div style={{
                overflowX: 'auto',
                maxHeight: '200px',
                overflowY: 'auto',
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '12px',
                }}>
                  <thead>
                    <tr style={{ color: 'var(--fg-secondary)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 500 }}>{t.fileName}</th>
                      <th style={{ padding: '8px 12px', fontWeight: 500 }}>{t.duration}</th>
                      <th style={{ padding: '8px 12px', fontWeight: 500 }}>{t.resolution}</th>
                      <th style={{ padding: '8px 12px', fontWeight: 500, textAlign: 'center' }}>{t.needSplit}</th>
                      <th style={{ padding: '8px 12px', fontWeight: 500, textAlign: 'center' }}>{t.segments}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanResults.filter(f => f.status !== 'failed').map((file, idx) => (
                      <tr
                        key={file.id}
                        style={{
                          background: idx % 2 === 0 ? 'rgba(255,255,255,0.5)' : 'transparent',
                          borderRadius: '6px',
                        }}
                      >
                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>{file.name}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--fg-secondary)' }}>{file.duration}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{file.resolution}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 500,
                            background: file.needSplit ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                            color: file.needSplit ? '#a16207' : '#15803d',
                          }}>
                            {file.needSplit ? t.yes : t.no}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>
                          {file.estimatedSegments}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Processing Queue */}
        <div style={{ flex: 1, overflowY: 'auto', marginTop: 'var(--space-lg)' }}>
          <label className="label">{t.processingQueue}</label>
          {scanResults.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--fg-muted)',
              fontSize: '13px'
            }}>
              {t.noVideos}
            </div>
          ) : (
            scanResults.map(file => (
              <FileItem
                key={file.id}
                icon="○"
                name={file.name}
                size=""
                duration={file.duration}
                status={file.status}
                label={file.needSplit
                  ? `${file.resolution} • ${file.estimatedSegments} ${language === 'zh' ? '段' : 'segs'}`
                  : file.resolution
                }
              />
            ))
          )}
        </div>

        <div style={{ marginTop: 'var(--space-md)' }}>
          <Progress
            value={progress}
            label={progressMessage || (isProcessing ? `${t.processing} (${doneCount}/${scanResults.length})` : '')}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' }}>
          <Button variant="ghost" onClick={handleClearList} disabled={isProcessing}>
            {t.clearList}
          </Button>
          <Button variant="ghost" onClick={handleStopProcessing} disabled={!isProcessing} style={{ color: 'var(--error)' }}>
            {t.stopProcessing}
          </Button>
        </div>
      </main>

      <aside className="panel panel-files">
        <h3 className="section-header">{t.splitParameters}</h3>

        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <label className="label">{t.outputMode}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Radio
              name="split_mode"
              value="new-folder"
              checked={splitMode === 'new-folder'}
              onChange={(e) => setSplitMode(e.target.value)}
              label={t.newFolder}
            />
            <Radio
              name="split_mode"
              value="overwrite"
              checked={splitMode === 'overwrite'}
              onChange={(e) => setSplitMode(e.target.value)}
              label={t.overwrite}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
          <div className="input-group">
            <label className="label">{t.targetDuration}</label>
            <input
              type="number"
              className="input-pill"
              value={targetDuration}
              onChange={(e) => setTargetDuration(Number(e.target.value))}
            />
          </div>
          <div className="input-group">
            <label className="label">{t.silenceRange}</label>
            <input
              type="number"
              className="input-pill"
              value={silenceRange}
              onChange={(e) => setSilenceRange(Number(e.target.value))}
            />
          </div>
          <div className="input-group">
            <label className="label">{t.minSilence}</label>
            <input
              type="number"
              className="input-pill"
              value={minSilence}
              step="0.1"
              onChange={(e) => setMinSilence(Number(e.target.value))}
            />
          </div>
          <div className="input-group">
            <label className="label">{t.longSilence}</label>
            <input
              type="number"
              className="input-pill"
              value={longSilenceThreshold}
              onChange={(e) => setLongSilenceThreshold(Number(e.target.value))}
            />
          </div>
        </div>

        <div style={{ marginTop: 'auto' }}>
          <Button onClick={handleStartProcessing} disabled={isScanning || isProcessing || !hasScanned}>
            <span>{t.startProcessing}</span>
            <span>→</span>
          </Button>
        </div>
      </aside>
    </>
  );
};

export default VideoSplit;
