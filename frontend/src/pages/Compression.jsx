import React, { useState, useEffect } from 'react';
import {
  Sidebar, Button, FileItem, Progress,
  Radio, Checkbox, Select, InputWithButton
} from '../components';
import { useLanguage } from '../hooks/useLanguage';
import { usePageState } from '../contexts/PageStateContext';
import { useTaskManager } from '../contexts/TaskContext';
import {
  compressScan,
  compressCreateTasks,
  compressStart,
  compressCancel,
  compressDeleteVideoOut,
} from '../services/api';

const Compression = () => {
  const language = useLanguage();
  const { getPageState, updatePageState } = usePageState();
  const { registerTask, getTask, tasks } = useTaskManager();

  // 从 PageState 恢复状态
  const savedState = getPageState('compression', {});

  const t = {
    zh: {
      title: '视频压缩',
      selectFiles: '选择文件',
      dragFiles: '拖拽视频文件到此处',
      orClick: '或点击选择',
      folderPath: '文件夹路径',
      selectFolder: '选择文件夹进行批量处理',
      scansSubfolders: '扫描所有子文件夹',
      scan: '扫描',
      queue: '队列',
      selected: '个已选择',
      addVideo: '+ 添加视频',
      addFolder: '+ 添加文件夹',
      outputSettings: '输出设置',
      outputMode: '输出模式',
      createSubfolder: '创建子文件夹 [compressed]',
      overwriteOriginal: '覆盖源文件',
      enableCompression: '启用压缩',
      preset: '预设',
      muteAudio: '静音',
      customQuality: '自定义质量',
      customResolution: '自定义分辨率',
      customFPS: '自定义帧率',
      format: '格式',
      startCompress: '开始压缩',
      reset: '重置',
      processing: '处理中',
      completed: '已完成',
      failed: '失败',
      avgReduction: '平均压缩率',
      backToSettings: '返回设置',
      newBatch: '新建批次',
      cancel: '取消',
      scanning: '扫描中...',
      noVideos: '未找到视频',
      error: '错误',
      reorgDetected: '检测到 _video_out 结构，已启用整理+压缩模式',
      organizeOnly: '只整理不压缩',
      organizeOnlyDesc: '仅移动文件到对应文件夹，不进行压缩',
      deleteVideoOut: '删除 _video_out 文件夹',
      deleteVideoOutDesc: '整理完成后删除 _video_out 文件夹',
      cnReading: '中文朗读',
      originalVideo: '原声视频',
    },
    en: {
      title: 'Compression',
      selectFiles: 'Select Files',
      dragFiles: 'Drag video files here',
      orClick: 'or click to select',
      folderPath: 'Folder Path',
      selectFolder: 'Select folder for batch processing',
      scansSubfolders: 'Scans all subfolders',
      scan: 'Scan',
      queue: 'Queue',
      selected: 'selected',
      addVideo: '+ Add Video',
      addFolder: '+ Add Folder',
      outputSettings: 'Output Settings',
      outputMode: 'Output Mode',
      createSubfolder: 'Create subfolder [compressed]',
      overwriteOriginal: 'Overwrite original',
      enableCompression: 'Enable compression',
      preset: 'Preset',
      muteAudio: 'Mute audio',
      customQuality: 'Custom quality',
      customResolution: 'Custom resolution',
      customFPS: 'Custom FPS',
      format: 'Format',
      startCompress: 'Start Compression',
      reset: 'Reset',
      processing: 'Processing',
      completed: 'Completed',
      failed: 'Failed',
      avgReduction: 'Avg. Reduction',
      backToSettings: 'Back to Settings',
      newBatch: 'New Batch',
      cancel: 'Cancel',
      scanning: 'Scanning...',
      noVideos: 'No videos found',
      error: 'Error',
      reorgDetected: 'Detected _video_out structure, organize+compress mode enabled',
      organizeOnly: 'Organize only (no compress)',
      organizeOnlyDesc: 'Only move files to target folders without compressing',
      deleteVideoOut: 'Delete _video_out folder',
      deleteVideoOutDesc: 'Delete _video_out folder after organizing',
      cnReading: 'CN Reading',
      originalVideo: 'Original',
    }
  }[language];

  // State - 从 savedState 恢复
  const [folderPath, setFolderPath] = useState(savedState.folderPath || '');
  const [files, setFiles] = useState(savedState.files || []);
  const [outputMode, setOutputMode] = useState(savedState.outputMode || 'overwrite');  // 默认覆盖源文件
  const [compressionEnabled, setCompressionEnabled] = useState(savedState.compressionEnabled ?? true);
  const [preset, setPreset] = useState(savedState.preset || 'high');
  const [muteAudio, setMuteAudio] = useState(savedState.muteAudio || false);
  const [customQuality, setCustomQuality] = useState(savedState.customQuality || false);
  const [customResolution, setCustomResolution] = useState(savedState.customResolution || false);
  const [customFPS, setCustomFPS] = useState(savedState.customFPS || false);
  const [format, setFormat] = useState(savedState.format || 'mp4');
  const [deleteVideoOut, setDeleteVideoOut] = useState(savedState.deleteVideoOut ?? true);  // 新增：删除 _video_out 文件夹

  const [stage, setStage] = useState(savedState.stage || 'config'); // config, processing, success
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  // eslint-disable-next-line no-unused-vars
  const [currentIndex, setCurrentIndex] = useState(0);

  const [isScanning, setIsScanning] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [isProcessing, setIsProcessing] = useState(false);
  const [taskIds, setTaskIds] = useState([]);
  const [backgroundTaskId, setBackgroundTaskId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [reorgMode, setReorgMode] = useState(savedState.reorgMode || false);
  const [organizeOnly, setOrganizeOnly] = useState(savedState.organizeOnly || false);
  const [videoOutDirs, setVideoOutDirs] = useState([]);  // 保存要删除的 _video_out 目录

  // 保存状态到 PageState
  useEffect(() => {
    updatePageState('compression', {
      folderPath,
      files,
      outputMode,
      compressionEnabled,
      preset,
      muteAudio,
      customQuality,
      customResolution,
      customFPS,
      format,
      stage,
      reorgMode,
      organizeOnly,
      deleteVideoOut,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderPath, files, outputMode, compressionEnabled, preset, muteAudio, customQuality, customResolution, customFPS, format, stage, reorgMode, organizeOnly, deleteVideoOut, updatePageState]);

  const selectedCount = files.filter(f => f.selected).length;
  const selectedFiles = files.filter(f => f.selected);

  // 从全局任务状态恢复压缩进度
  useEffect(() => {
    if (backgroundTaskId) {
      const task = getTask(backgroundTaskId);
      if (task) {
        if (task.status === 'running') {
          setIsProcessing(true);
          setStage('processing');
          setProgress(task.progress || 0);
          if (task.message) {
            // 解析当前处理文件名
            const match = task.message.match(/Processing:\s*(.+)/);
            if (match) {
              setCurrentFile(match[1]);
            }
          }
        } else if (task.status === 'completed') {
          setIsProcessing(false);
          setStage('success');
          setProgress(100);
          const res = task.result || {};
          const activeTasks = res.tasks || [];
          // Update files with results
          setFiles(prev => prev.map(f => {
            const t = activeTasks.find(at => at.input_path === f.path);
            if (t) {
              return {
                ...f,
                originalSize: t.input_size || f.originalSize,
                compressedSize: t.output_size || f.compressedSize,
                status: t.status === 'completed' ? 'complete' : 'error',
              };
            }
            return f;
          }));
          // 删除 _video_out 文件夹
          if (deleteVideoOut && videoOutDirs.length > 0) {
            compressDeleteVideoOut(videoOutDirs).then(result => {
              console.log('[DEBUG] Delete video_out result:', result);
              setVideoOutDirs([]);
            }).catch(err => {
              console.error('[DEBUG] Delete video_out error:', err);
            });
          }
          setBackgroundTaskId(null);
        } else if (task.status === 'error') {
          setIsProcessing(false);
          setStage('config');
          setErrorMessage(task.error || 'Compression failed');
          setBackgroundTaskId(null);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundTaskId, getTask, tasks, deleteVideoOut, videoOutDirs]);

  const handleScan = async () => {
    if (!folderPath) {
      setErrorMessage(language === 'zh' ? '请输入文件夹路径' : 'Please enter folder path');
      return;
    }

    setIsScanning(true);
    setFiles([]);
    setErrorMessage('');

    try {
      const result = await compressScan({ folder: folderPath, recursive: true });

      if (result.success) {
        setReorgMode(result.reorg_mode || false);
        setFiles((result.videos || []).map((v, idx) => {
          const fileSize = typeof v === 'string' ? 0 : (v.info?.size || v.size || 0);
          return {
            id: idx + 1,
            name: typeof v === 'string' ? v.split('/').pop() : (v.name || v.filename),
            path: typeof v === 'string' ? v : v.path,
            size: fileSize ? `${Math.round(fileSize / 1024 / 1024)} MB` : 'Unknown',
            originalSize: fileSize,
            compressedSize: null,
            selected: true,
            reorg: v.reorg,
            category: v.reorg?.category || null,
          };
        }));
      } else {
        setErrorMessage(result.error || 'Scan failed');
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleToggleFile = (id) => {
    setFiles(files.map(f => f.id === id ? { ...f, selected: !f.selected } : f));
  };

  const handleStartCompress = async () => {
    if (selectedCount === 0) {
      setErrorMessage(language === 'zh' ? '请选择要压缩的视频' : 'Please select videos to compress');
      return;
    }

    setIsProcessing(true);
    setStage('processing');
    setProgress(0);
    setErrorMessage('');

    try {
      // Create compression tasks
      const videosToCompress = selectedFiles.map(f => ({
        path: f.path,
        reorg: f.reorg,
      }));

      const settings = {
        preset,
        format,
        mute_audio: muteAudio,
        overwrite: outputMode === 'overwrite',
        organize_only: organizeOnly,
        delete_video_out: deleteVideoOut,
      };

      const createResult = await compressCreateTasks({
        videos: videosToCompress,
        settings,
      });

      if (createResult.success) {
        const newTaskIds = createResult.task_ids || [];
        setTaskIds(newTaskIds);

        // 保存要删除的 _video_out 目录
        if (createResult.video_out_dirs && createResult.video_out_dirs.length > 0) {
          setVideoOutDirs(createResult.video_out_dirs);
        }

        // 注册全局任务
        const newBackgroundTaskId = `compress-${Date.now()}`;
        setBackgroundTaskId(newBackgroundTaskId);
        registerTask(newBackgroundTaskId, {
          type: 'video-compression',
          title: `Compress ${selectedCount} videos`,
          page: 'compress',
          taskIds: newTaskIds, // 存储多个任务ID
        });

        // Start compression
        const startResult = await compressStart({
          taskIds: newTaskIds,
        });

        if (!startResult.success) {
          setIsProcessing(false);
          setStage('config');
          setErrorMessage(startResult.error || 'Failed to start compression');
        }
      } else {
        setIsProcessing(false);
        setStage('config');
        setErrorMessage(createResult.error || 'Failed to create tasks');
      }
    } catch (err) {
      setIsProcessing(false);
      setStage('config');
      setErrorMessage(err.message);
    }
  };

  const handleCancel = async () => {
    // Cancel all running compression tasks
    for (const id of taskIds) {
      try {
        await compressCancel(id);
      } catch (err) {
        console.error('Cancel task error:', err);
      }
    }
    setIsProcessing(false);
    setBackgroundTaskId(null);
    setStage('config');
  };

  const handleNewBatch = () => {
    setStage('config');
    setFiles(files.map(f => ({ ...f, selected: false, compressedSize: null })));
    setTaskIds([]);
    setBackgroundTaskId(null);
  };

  const handleBackToSettings = () => {
    setStage('config');
  };

  const formatOptions = [
    { value: 'mp4', label: 'MP4' },
    { value: 'mov', label: 'MOV' },
    { value: 'mkv', label: 'MKV' },
  ];

  const presetOptions = [
    { value: 'high', label: language === 'zh' ? '高' : 'High' },
    { value: 'medium', label: language === 'zh' ? '中' : 'Medium' },
    { value: 'low', label: language === 'zh' ? '低' : 'Low' },
  ];

  const formatMB = (bytes) => bytes ? (bytes / 1024 / 1024).toFixed(1) : '?';

  const completedFiles = files.filter(f => f.compressedSize !== null && f.compressedSize > 0);
  const avgReduction = completedFiles.length > 0
    ? Math.round(completedFiles.reduce((acc, f) =>
        acc + ((f.originalSize > 0 ? (f.originalSize - f.compressedSize) / f.originalSize : 0)), 0
      ) / completedFiles.length * 100)
    : 0;

  // Processing stage
  if (stage === 'processing') {
    return (
      <>
        <Sidebar />
        <main className="panel panel-main" style={{ gridColumn: '2 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 className="section-header">05 — <span>{t.title}</span></h2>

          <div style={{ textAlign: 'center', marginTop: 'var(--space-2xl)' }}>
            <p style={{ fontSize: '14px', color: 'var(--fg-secondary)', marginBottom: 'var(--space-lg)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {t.processing}
            </p>

            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', marginBottom: '8px' }}>
              {currentFile || '...'}
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--fg-muted)', marginBottom: 'var(--space-xl)' }}>
              {currentIndex} / {selectedCount}
            </p>

            <div style={{ width: 300, margin: '0 auto' }}>
              <Progress value={progress} showPercentage={true} />
            </div>

            <Button
              variant="ghost"
              onClick={handleCancel}
              style={{ marginTop: 'var(--space-xl)' }}
            >
              {t.cancel}
            </Button>
          </div>
        </main>
      </>
    );
  }

  // Success stage
  if (stage === 'success') {
    const successCount = files.filter(f => f.status === 'complete').length;
    const failedCount = files.filter(f => f.status === 'error').length;

    return (
      <>
        <Sidebar />
        <main className="panel panel-main" style={{ gridColumn: '2 / -1' }}>
          <h2 className="section-header">05 — <span>{t.title}</span></h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px' }}>{successCount}</div>
              <div style={{ fontSize: '12px', color: 'var(--fg-secondary)', textTransform: 'uppercase' }}>{t.completed}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px' }}>{failedCount}</div>
              <div style={{ fontSize: '12px', color: 'var(--fg-secondary)', textTransform: 'uppercase' }}>{t.failed}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px' }}>{avgReduction}%</div>
              <div style={{ fontSize: '12px', color: 'var(--fg-secondary)', textTransform: 'uppercase' }}>{t.avgReduction}</div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-lg)' }}>
            {completedFiles.map((file) => (
              <div
                key={file.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: '1px solid var(--border-light)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span>{file.status === 'complete' ? '✓' : '✗'}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px' }}>{file.name}</span>
                </div>
                <span style={{ fontSize: '13px', color: 'var(--fg-secondary)' }}>
                  {formatMB(file.originalSize)} MB → {formatMB(file.compressedSize)} MB
                  {file.compressedSize && file.originalSize > 0 ? ` (-${Math.round((file.originalSize - file.compressedSize) / file.originalSize * 100)}%)` : ''}
                </span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', gap: 'var(--space-md)' }}>
            <Button variant="ghost" onClick={handleBackToSettings} style={{ flex: 1 }}>
              {t.backToSettings}
            </Button>
            <Button onClick={handleNewBatch} style={{ flex: 1 }}>
              <span>{t.newBatch}</span>
              <span>→</span>
            </Button>
          </div>
        </main>
      </>
    );
  }

  // Config stage (default)
  return (
    <>
      <Sidebar />

      <main className="panel panel-main">
        <h2 className="section-header">05 — <span>{t.title}</span></h2>

        {/* Error message */}
        {errorMessage && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--error)',
            fontSize: '13px',
            marginBottom: 'var(--space-md)',
          }}>
            {errorMessage}
          </div>
        )}

        {/* Folder input */}
        <div className="input-group">
          <label className="label">{t.folderPath}</label>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <InputWithButton
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              browseMode="folder"
              placeholder={language === 'zh' ? '输入视频文件夹路径...' : 'Enter video folder path...'}
              disabled={isScanning}
            />
            <Button
              onClick={handleScan}
              disabled={isScanning || !folderPath}
              style={{ whiteSpace: 'nowrap' }}
            >
              {isScanning ? '...' : t.scan}
            </Button>
          </div>
        </div>

        {/* Reorg mode banner */}
        {reorgMode && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            color: 'var(--accent)',
            marginBottom: 'var(--space-sm)',
          }}>
            {t.reorgDetected}
          </div>
        )}

        <div className="file-list-header">
          <h3 style={{ fontSize: '18px' }}>{t.queue} ({files.length})</h3>
          <span className="label">{selectedCount} {t.selected}</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 'var(--space-md)' }}>
          {files.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--fg-muted)',
              fontSize: '13px'
            }}>
              {isScanning ? t.scanning : t.noVideos}
            </div>
          ) : (
            files.map(file => (
              <FileItem
                key={file.id}
                icon="📹"
                name={file.name}
                size={file.size}
                label={file.category === '中文朗读' ? t.cnReading : file.category === '原声视频' ? t.originalVideo : null}
                status={file.selected ? 'pending' : 'pending'}
                selected={file.selected}
                onSelect={() => handleToggleFile(file.id)}
                onClick={() => handleToggleFile(file.id)}
              />
            ))
          )}
        </div>
      </main>

      <aside className="panel panel-files">
        <h3 className="section-header" style={{ fontSize: '20px' }}>{t.outputSettings}</h3>

        {/* Organize only option - always visible */}
        <div style={{
          marginBottom: 'var(--space-lg)',
          padding: '12px',
          background: 'rgba(59, 130, 246, 0.05)',
          borderRadius: 'var(--radius-md)',
        }}>
          <Checkbox
            label={t.organizeOnly}
            checked={organizeOnly}
            onChange={() => setOrganizeOnly(!organizeOnly)}
          />
          <div style={{ fontSize: '11px', color: 'var(--fg-muted)', marginTop: '6px', paddingLeft: '24px' }}>
            {t.organizeOnlyDesc}
          </div>
          <div style={{ marginTop: '12px' }}>
            <Checkbox
              label={t.deleteVideoOut}
              checked={deleteVideoOut}
              onChange={() => setDeleteVideoOut(!deleteVideoOut)}
            />
            <div style={{ fontSize: '11px', color: 'var(--fg-muted)', marginTop: '6px', paddingLeft: '24px' }}>
              {t.deleteVideoOutDesc}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 'var(--space-lg)', opacity: organizeOnly ? 0.4 : 1, pointerEvents: organizeOnly ? 'none' : 'auto' }}>
          <label className="label">{t.outputMode}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Radio
              name="output_mode"
              value="subfolder"
              checked={outputMode === 'subfolder'}
              onChange={(e) => setOutputMode(e.target.value)}
              label={t.createSubfolder}
            />
            <Radio
              name="output_mode"
              value="overwrite"
              checked={outputMode === 'overwrite'}
              onChange={(e) => setOutputMode(e.target.value)}
              label={t.overwriteOriginal}
            />
          </div>
        </div>

        <div style={{ opacity: organizeOnly ? 0.4 : 1, pointerEvents: organizeOnly ? 'none' : 'auto' }}>
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <Checkbox
              label={t.enableCompression}
              checked={compressionEnabled}
              onChange={() => setCompressionEnabled(!compressionEnabled)}
            />
          </div>

          <div className="input-group">
            <label className="label">{t.preset}</label>
            <Select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              options={presetOptions}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: 'var(--space-lg)' }}>
            <Checkbox
              label={t.muteAudio}
              checked={muteAudio}
              onChange={() => setMuteAudio(!muteAudio)}
            />
            <Checkbox
              label={t.customQuality}
              checked={customQuality}
              onChange={() => setCustomQuality(!customQuality)}
            />
            <Checkbox
              label={t.customResolution}
              checked={customResolution}
              onChange={() => setCustomResolution(!customResolution)}
            />
            <Checkbox
              label={t.customFPS}
              checked={customFPS}
              onChange={() => setCustomFPS(!customFPS)}
            />
          </div>

          <div className="input-group">
            <label className="label">{t.format}</label>
            <Select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              options={formatOptions}
            />
          </div>
        </div>

        <div style={{ marginTop: 'auto' }}>
          <Button onClick={handleStartCompress} disabled={isScanning || selectedCount === 0}>
            <span>{t.startCompress} {selectedCount}</span>
            <span>→</span>
          </Button>
          <Button variant="secondary" onClick={() => setFiles([])}>
            {t.reset}
          </Button>
        </div>
      </aside>
    </>
  );
};

export default Compression;
