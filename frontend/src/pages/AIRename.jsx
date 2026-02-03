import React, { useState, useEffect } from 'react';
import {
  Sidebar, Button, FileItem, Progress, LogArea,
  InputWithButton, Checkbox, TextArea
} from '../components';
import { useLanguage } from '../hooks/useLanguage';
import { useSettings } from '../contexts/SettingsContext';
import { usePageState } from '../contexts/PageStateContext';
import { renameScan, renameGenerate, renameExecute } from '../services/api';

const DEFAULT_PROMPT_TEMPLATE = `你是一位资深内容归档专家，擅长优化各类文件和文件夹的标题，确保标题专业、清晰、有条理，且风格统一。

## 核心任务
根据提供的【文件名列表】和【内容大背景】，批量优化为统一风格的中文标题。

## 重要：保持系列一致性
- **同一系列的文件必须使用相同的命名风格**，只改变序号
- 例如：ctrlPaint_perspectiveSketching_1, ctrlPaint_perspectiveSketching_2 应该命名为：
  - 透视素描 1
  - 透视素描 2
- 识别系列的方法：文件名前缀相同、只有序号不同的属于同一系列

## 序号识别与处理规则
1. **标准数字序号**：如 "1"、"2.1"、"10-2" → 保留原序号格式
2. **英文前缀序号**：如 "demo1"、"lesson4.2" → 保留英文前缀+数字
3. **混合序号**：如 "01_intro"、"02-basic" → 保留原始序号格式
4. **删除垃圾数字**：6位以上的长数字通常是无意义的，应删除

## 输出格式要求
- 用词风格统一、克制、专业
- 每行一个文件名，格式：序号|新标题
- 序号从1开始，与输入列表一一对应
- 只输出新标题，不要包含文件扩展名

## 输出示例
1|透视素描 1
2|透视素描 2
3|色彩理论基础
4|光影表现技法

## 输入信息
**内容大背景**：{course_context}

**文件名列表**：
{file_list}

请根据上述要求，为每个文件生成统一风格的中文标题。`;

const AIRename = () => {
  const language = useLanguage();
  const { apiKey, baseUrl, textModel } = useSettings();
  const { getPageState, updatePageState } = usePageState();

  // 从 PageState 恢复状态
  const savedState = getPageState('aiRename', {});

  const t = {
    zh: {
      title: 'AI 重命名',
      settings: '设置',
      folderPath: '文件夹路径',
      includeTypes: '包含类型',
      videos: '视频',
      audio: '音频',
      pdf: 'PDF 文档',
      subfolders: '子文件夹',
      scanFolder: '扫描文件夹',
      contextHints: '上下文提示',
      promptTemplate: 'Prompt 模板',
      filesQueue: '文件队列',
      items: '个项目',
      executeRename: '执行重命名',
      clearList: '清空列表',
      generating: '生成中...',
      generateNames: 'AI 生成名称',
      systemLog: '系统日志',
      scanning: '扫描中...',
      scanComplete: '扫描完成',
      noApiKey: '请先在设置中配置 API Key',
      generatingNames: '正在生成名称...',
      generateComplete: '名称生成完成',
      renaming: '正在重命名...',
      renameComplete: '重命名完成',
      noFiles: '没有找到文件',
      confirmRename: '确认重命名',
      clickToEdit: '点击新名称可编辑',
    },
    en: {
      title: 'AI Renaming',
      settings: 'Settings',
      folderPath: 'Folder Path',
      includeTypes: 'Include Types',
      videos: 'Videos',
      audio: 'Audio',
      pdf: 'PDF Documents',
      subfolders: 'Sub-folders',
      scanFolder: 'Scan Folder',
      contextHints: 'Context & Hints',
      promptTemplate: 'Prompt Template',
      filesQueue: 'Files Queue',
      items: 'Items',
      executeRename: 'Execute Rename',
      clearList: 'Clear List',
      generating: 'Generating...',
      generateNames: 'AI Generate Names',
      systemLog: 'System Log',
      scanning: 'Scanning...',
      scanComplete: 'Scan complete',
      noApiKey: 'Please configure API Key in Settings first',
      generatingNames: 'Generating names...',
      generateComplete: 'Names generated',
      renaming: 'Renaming...',
      renameComplete: 'Rename complete',
      noFiles: 'No files found',
      confirmRename: 'Confirm Rename',
      clickToEdit: 'Click new name to edit',
    }
  }[language];

  // State - 从 savedState 恢复
  const [folderPath, setFolderPath] = useState(savedState.folderPath || '');
  const [checkboxes, setCheckboxes] = useState(savedState.checkboxes || {
    videos: true,
    audio: true,
    pdf: true,
    subfolders: true,
  });
  const [contextText, setContextText] = useState(savedState.contextText || '');
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptTemplate, setPromptTemplate] = useState(savedState.promptTemplate || DEFAULT_PROMPT_TEMPLATE);
  const [progress, setProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  const [taskId, setTaskId] = useState(savedState.taskId || null);
  const [files, setFiles] = useState(savedState.files || []);
  const [logEntries, setLogEntries] = useState(savedState.logEntries || []);

  // 保存状态到 PageState
  useEffect(() => {
    updatePageState('aiRename', {
      folderPath,
      checkboxes,
      contextText,
      promptTemplate,
      taskId,
      files,
      logEntries,
    });
  }, [folderPath, checkboxes, contextText, promptTemplate, taskId, files, logEntries]);

  const addLog = (message, highlight = false) => {
    const time = new Date().toLocaleTimeString();
    setLogEntries(prev => [...prev, { time, message, highlight }]);
  };

  const handleCheckboxChange = (key) => {
    setCheckboxes(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleScanFolder = async () => {
    if (!folderPath) {
      addLog(language === 'zh' ? '请输入文件夹路径' : 'Please enter folder path', true);
      return;
    }

    setIsScanning(true);
    setProgress(0);
    setFiles([]);
    addLog(t.scanning, true);

    try {
      const result = await renameScan({
        folder: folderPath,
        scanVideos: checkboxes.videos,
        scanAudio: checkboxes.audio,
        scanPdf: checkboxes.pdf,
        scanFolders: checkboxes.subfolders,
      });

      if (result.success) {
        setTaskId(result.task_id);
        setFiles(result.items.map(item => ({
          id: item.id,
          icon: item.old_name.includes('.') ? '📄' : '📁',
          oldName: item.old_name,
          newName: item.new_name || '...',
          path: item.path,
          status: item.status,
        })));
        setProgress(100);
        addLog(`${t.scanComplete}: ${result.total} ${t.items}`, true);
      } else {
        addLog(`Error: ${result.error}`, true);
      }
    } catch (err) {
      addLog(`Error: ${err.message}`, true);
    } finally {
      setIsScanning(false);
    }
  };

  const handleGenerateNames = async () => {
    if (!taskId) {
      const msg = language === 'zh' ? '请先扫描文件夹' : 'Please scan folder first';
      addLog(msg, true);
      alert(msg);
      return;
    }

    if (!apiKey) {
      addLog(t.noApiKey, true);
      alert(t.noApiKey);
      return;
    }

    setIsGenerating(true);
    setProgress(50);
    addLog(t.generatingNames, true);

    try {
      const result = await renameGenerate({
        taskId,
        apiKey,
        apiBase: baseUrl,
        modelName: textModel,
        courseContext: contextText,
        promptTemplate,
      });

      if (result.success) {
        setFiles(prev => prev.map(file => {
          const updated = result.items.find(item => item.id === file.id);
          return updated ? { ...file, newName: updated.new_name || '...', status: updated.status } : file;
        }));
        setProgress(100);
        addLog(t.generateComplete, true);
      } else {
        addLog(`Error: ${result.error}`, true);
        alert(`Error: ${result.error}`);
      }
    } catch (err) {
      addLog(`Error: ${err.message}`, true);
      alert(`Error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExecuteRename = async () => {
    if (!taskId) {
      addLog(language === 'zh' ? '请先扫描并生成名称' : 'Please scan and generate names first', true);
      return;
    }

    setIsRenaming(true);
    setProgress(0);
    addLog(t.renaming, true);

    try {
      const result = await renameExecute({ taskId });

      if (result.success) {
        setProgress(100);
        const successCount = result.results.filter(r => r.success).length;
        addLog(`${t.renameComplete}: ${successCount}/${result.results.length}`, true);

        // Update file statuses
        setFiles(prev => prev.map(file => {
          const res = result.results.find(r => r.id === file.id);
          return res ? { ...file, status: res.success ? 'complete' : 'error' } : file;
        }));
      } else {
        addLog(`Error: ${result.error}`, true);
      }
    } catch (err) {
      addLog(`Error: ${err.message}`, true);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleClearList = () => {
    setFiles([]);
    setTaskId(null);
    setProgress(0);
    setLogEntries([{
      time: new Date().toLocaleTimeString(),
      message: language === 'zh' ? '列表已清空' : 'List cleared',
      highlight: false
    }]);
  };

  const handleNameChange = (fileId, newName) => {
    setFiles(prev => prev.map(file =>
      file.id === fileId ? { ...file, newName } : file
    ));
    addLog(language === 'zh' ? `已修改: ${newName}` : `Modified: ${newName}`);
  };

  const isProcessing = isScanning || isGenerating || isRenaming;
  const progressLabel = isScanning ? t.scanning : isGenerating ? t.generating : isRenaming ? t.renaming : '';

  return (
    <>
      <Sidebar />

      <main className="panel panel-main" style={{ gridColumn: '2 / 3' }}>
        <h2 className="section-header">01 — {t.title}</h2>

        <div className="input-group">
          <label className="label">{t.folderPath}</label>
          <InputWithButton
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            browseMode="folder"
            placeholder={language === 'zh' ? '输入文件夹路径...' : 'Enter folder path...'}
          />
        </div>

        <label className="label">{t.includeTypes}</label>
        <div className="checkbox-grid">
          <Checkbox
            label={t.videos}
            checked={checkboxes.videos}
            onChange={() => handleCheckboxChange('videos')}
          />
          <Checkbox
            label={t.audio}
            checked={checkboxes.audio}
            onChange={() => handleCheckboxChange('audio')}
          />
          <Checkbox
            label={t.pdf}
            checked={checkboxes.pdf}
            onChange={() => handleCheckboxChange('pdf')}
          />
          <Checkbox
            label={t.subfolders}
            checked={checkboxes.subfolders}
            onChange={() => handleCheckboxChange('subfolders')}
          />
        </div>

        <Button
          style={{ marginBottom: 'var(--space-lg)', justifyContent: 'center' }}
          onClick={handleScanFolder}
          disabled={isProcessing}
        >
          {isScanning ? t.scanning : t.scanFolder}
        </Button>

        <div className="input-group">
          <label className="label">{t.contextHints}</label>
          <TextArea
            value={contextText}
            onChange={(e) => setContextText(e.target.value)}
            placeholder={language === 'zh' ? '描述内容结构，帮助 AI 更好地命名...' : 'Describe the content structure to help AI name better...'}
            rows={3}
          />
        </div>

        <div className="input-group">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              opacity: 0.8
            }}
            onClick={() => setShowPrompt(!showPrompt)}
          >
            <span style={{ fontSize: '12px' }}>{showPrompt ? '▾' : '▸'}</span>
            <span style={{ fontSize: '12px', textDecoration: 'underline' }}>
              {t.promptTemplate}
            </span>
          </div>
          {showPrompt && (
            <div style={{ marginTop: '12px' }}>
              <TextArea
                value={promptTemplate}
                onChange={(e) => setPromptTemplate(e.target.value)}
                rows={8}
                style={{
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  background: 'rgba(0,0,0,0.03)'
                }}
              />
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          style={{ marginBottom: 'var(--space-md)', justifyContent: 'center' }}
          onClick={handleGenerateNames}
          disabled={isProcessing || !taskId}
        >
          {isGenerating ? t.generating : t.generateNames}
        </Button>

        <div style={{ marginTop: 'auto' }}>
          <Progress value={progress} label={progressLabel} />
        </div>
      </main>

      <aside className="panel panel-files" style={{ gridColumn: '3 / 4', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="file-list-header" style={{ flexShrink: 0 }}>
          <h3>{t.filesQueue}</h3>
          <span className="label">{files.length} {t.items}</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', minHeight: 0 }}>
          {files.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--fg-muted)',
              fontSize: '13px'
            }}>
              {t.noFiles}
            </div>
          ) : (
            files.map((file) => (
              <FileItem
                key={file.id}
                icon={file.icon}
                oldName={file.oldName}
                newName={file.newName}
                status={file.status}
                editable={file.newName && file.newName !== '...' && file.status !== 'complete'}
                onNameChange={(newName) => handleNameChange(file.id, newName)}
              />
            ))
          )}
        </div>

        <div style={{ flexShrink: 0 }}>
          <LogArea entries={logEntries} title={t.systemLog} />
        </div>

        {/* Hint for editing */}
        {files.some(f => f.newName && f.newName !== '...' && f.status !== 'complete') && (
          <div style={{
            fontSize: '12px',
            color: 'var(--fg-muted)',
            textAlign: 'center',
            padding: '8px 0',
            borderTop: '1px solid var(--border-light)',
            flexShrink: 0,
          }}>
            {t.clickToEdit}
          </div>
        )}

        <div style={{ marginTop: 'var(--space-md)', flexShrink: 0 }}>
          <Button
            onClick={handleExecuteRename}
            disabled={isProcessing || !files.some(f => f.newName && f.newName !== '...' && f.status !== 'complete')}
          >
            <span>{t.confirmRename}</span>
            <span>→</span>
          </Button>
          <Button variant="secondary" onClick={handleClearList} disabled={isProcessing}>
            {t.clearList}
          </Button>
        </div>
      </aside>
    </>
  );
};

export default AIRename;
