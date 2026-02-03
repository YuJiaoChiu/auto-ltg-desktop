import React, { useState, useRef, useEffect } from 'react';
import {
  Sidebar, SelectionCard, Progress
} from '../components';
import { useLanguage } from '../hooks/useLanguage';
import { useSettings } from '../contexts/SettingsContext';
import { usePageState } from '../contexts/PageStateContext';
import { useTaskManager } from '../contexts/TaskContext';
import {
  copywriterScrape,
  copywriterSetContent,
  copywriterGenerateTitles,
  copywriterGenerateCopy,
  copywriterGenerateImage,
  copywriterUploadImage,
} from '../services/api';

const CourseCopy = () => {
  const language = useLanguage();
  const { apiKey, baseUrl, textModel, imageModel, prompts } = useSettings();
  const { getPageState, updatePageState } = usePageState();
  const { registerTask, getTask, tasks } = useTaskManager();

  // 从 PageState 恢复状态
  const savedState = getPageState('courseCopy', {});

  const t = {
    zh: {
      title: '课程文案',
      courseInfo: '课程信息',
      infoCollection: '信息采集',
      scrapedContentPlaceholder: '从网站抓取的内容将显示在这里，或直接粘贴课程内容...',
      fetch: '爬取',
      fetching: '爬取中...',
      dataCollected: '数据已采集',
      chars: '字符',
      creativeStrategy: '创意策划',
      generateTitles: '生成标题',
      generating: '生成中...',
      painPoint: '痛点型',
      benefit: '利益型',
      curiosity: '悬念型',
      authority: '权威型',
      selected: '已选择',
      copyStandardization: '内容重构',
      generateCopy: '生成文案',
      download: '下载文案',
      bold: '粗体',
      italic: '斜体',
      link: '链接',
      visualSynthesis: '视觉合成',
      uploadCover: '上传封面图',
      aiCover: 'AI 生成封面',
      generateCover: '生成封面图',
      regenerate: '重新生成',
      upload: '上传',
      uploadText: '上传文本',
      preview: '预览区',
      generatingPreview: '生成预览中...',
      clearAll: '清空全部',
      noApiKey: '请先在设置中配置 API Key',
      noContent: '请先输入或爬取内容',
      noTitle: '请先选择标题',
      error: '错误',
      addCustomTitle: '添加自定义标题',
      customTitlePlaceholder: '输入自定义标题...',
      addTitle: '添加',
      custom: '自定义',
      downloadCover: '下载封面',
    },
    en: {
      title: 'Course Copy',
      courseInfo: 'Course Information',
      infoCollection: 'Information Collection',
      scrapedContentPlaceholder: 'Scraped content will appear here, or paste course content directly...',
      fetch: 'Fetch',
      fetching: 'Fetching...',
      dataCollected: 'Data collected',
      chars: 'chars',
      creativeStrategy: 'Creative Strategy',
      generateTitles: 'Generate Titles',
      generating: 'Generating...',
      painPoint: 'Pain Point',
      benefit: 'Benefit',
      curiosity: 'Curiosity',
      authority: 'Authority',
      selected: 'Selected',
      copyStandardization: 'Copy Standardization',
      generateCopy: 'Generate Copy',
      download: 'Download',
      bold: 'Bold',
      italic: 'Italic',
      link: 'Link',
      visualSynthesis: 'Visual Synthesis',
      uploadCover: 'Upload Cover',
      aiCover: 'AI Generate Cover',
      generateCover: 'Generate Cover',
      regenerate: 'Regenerate',
      upload: 'Upload',
      uploadText: 'Upload Text',
      preview: 'Preview',
      generatingPreview: 'Generating preview...',
      clearAll: 'Clear All',
      noApiKey: 'Please configure API Key in Settings first',
      noContent: 'Please enter or fetch content first',
      noTitle: 'Please select a title first',
      error: 'Error',
      addCustomTitle: 'Add custom title',
      customTitlePlaceholder: 'Enter custom title...',
      addTitle: 'Add',
      custom: 'Custom',
      downloadCover: 'Download Cover',
    }
  }[language];

  const titleTypes = [t.painPoint, t.benefit, t.curiosity, t.authority];

  // State - 从 savedState 恢复
  const [courseUrl, setCourseUrl] = useState(savedState.courseUrl || '');
  const [scrapedContent, setScrapedContent] = useState(savedState.scrapedContent || '');
  const [dataFetched, setDataFetched] = useState(savedState.dataFetched || false);
  const [isFetching, setIsFetching] = useState(false);
  const [taskId, setTaskId] = useState(savedState.taskId || null);

  const [titles, setTitles] = useState(savedState.titles || []);
  const [selectedCard, setSelectedCard] = useState(savedState.selectedCard ?? null);
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false);
  const [customTitle, setCustomTitle] = useState('');

  const [copyContent, setCopyContent] = useState(savedState.copyContent || '');
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);

  const [uploadedImage, setUploadedImage] = useState(savedState.uploadedImage || null);
  const [uploadedImagePath, setUploadedImagePath] = useState(savedState.uploadedImagePath || null);
  const [generatedImage, setGeneratedImage] = useState(savedState.generatedImage || null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [coverTaskId, setCoverTaskId] = useState(null);

  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const fileInputRef = useRef(null);
  const textFileInputRef = useRef(null);

  // 保存状态到 PageState
  useEffect(() => {
    updatePageState('courseCopy', {
      courseUrl,
      scrapedContent,
      dataFetched,
      taskId,
      titles,
      selectedCard,
      copyContent,
      uploadedImage,
      uploadedImagePath,
      generatedImage,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseUrl, scrapedContent, dataFetched, taskId, titles, selectedCard, copyContent, uploadedImage, uploadedImagePath, generatedImage, updatePageState]);

  const charCount = scrapedContent.length;

  // Fetch content from URL
  const handleFetch = async () => {
    if (!courseUrl) return;

    setIsFetching(true);
    setProgress(30);
    setErrorMessage('');

    try {
      const result = await copywriterScrape({ url: courseUrl });

      if (result.success) {
        setScrapedContent(result.content || '');
        setTaskId(result.task_id);
        setDataFetched(true);
        setProgress(100);
      } else {
        setErrorMessage(result.error || 'Fetch failed');
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsFetching(false);
    }
  };

  // Set content manually (when user types/pastes)
  const handleContentChange = async (e) => {
    const content = e.target.value;
    setScrapedContent(content);

    if (content.length > 100 && !taskId) {
      // Auto-create task when content is substantial
      try {
        const result = await copywriterSetContent({ content });
        if (result.success) {
          setTaskId(result.task_id);
          setDataFetched(true);
        }
      } catch (err) {
        console.error('Set content error:', err);
      }
    }
  };

  // Generate titles
  const handleGenerateTitles = async () => {
    if (!apiKey) {
      setErrorMessage(t.noApiKey);
      return;
    }

    if (!scrapedContent && !taskId) {
      setErrorMessage(t.noContent);
      return;
    }

    // Create task if not exists
    if (!taskId) {
      try {
        const result = await copywriterSetContent({ content: scrapedContent });
        if (result.success) {
          setTaskId(result.task_id);
        } else {
          setErrorMessage(result.error || 'Failed to set content');
          return;
        }
      } catch (err) {
        setErrorMessage(err.message);
        return;
      }
    }

    setIsGeneratingTitles(true);
    setProgress(50);
    setErrorMessage('');

    try {
      const currentTaskId = taskId || (await copywriterSetContent({ content: scrapedContent })).task_id;

      const result = await copywriterGenerateTitles({
        taskId: currentTaskId,
        apiKey,
        apiBase: baseUrl,
        model: textModel,
        promptTemplate: prompts?.title,
      });

      if (result.success && result.titles) {
        // Backend returns [{type: "痛点型", title: "标题内容"}, ...]
        setTitles(result.titles.map((item) => ({
          type: item.type || titleTypes[0],
          title: item.title || item,  // handle both object and string format
        })));
        setProgress(100);
      } else {
        setErrorMessage(result.error || 'Failed to generate titles');
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsGeneratingTitles(false);
    }
  };

  // Generate copy
  const handleGenerateCopy = async () => {
    if (!apiKey) {
      setErrorMessage(t.noApiKey);
      return;
    }

    if (selectedCard === null || !titles[selectedCard]) {
      setErrorMessage(t.noTitle);
      return;
    }

    setIsGeneratingCopy(true);
    setProgress(60);
    setErrorMessage('');

    try {
      const result = await copywriterGenerateCopy({
        taskId,
        selectedTitle: titles[selectedCard].title,
        apiKey,
        apiBase: baseUrl,
        model: textModel,
        promptTemplate: prompts?.copy,
      });

      if (result.success) {
        setCopyContent(result.copy || '');
        setProgress(100);
      } else {
        setErrorMessage(result.error || 'Failed to generate copy');
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  // Download copy
  const handleDownload = () => {
    if (!copyContent) return;
    const blob = new Blob([copyContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'course-copy.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Upload image
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await copywriterUploadImage(file);
      if (result.success) {
        setUploadedImage(`data:image/png;base64,${result.image_base64}`);
        setUploadedImagePath(result.filepath);
      } else {
        setErrorMessage(result.error || 'Upload failed');
      }
    } catch (err) {
      // Fallback to local preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Add custom title
  const handleAddCustomTitle = () => {
    if (!customTitle.trim()) return;
    setTitles(prev => [...prev, { type: t.custom, title: customTitle.trim() }]);
    setCustomTitle('');
    // Auto-select the newly added title
    setSelectedCard(titles.length);
  };

  // Upload text file for copy content
  const handleTextFileUpload = () => {
    textFileInputRef.current?.click();
  };

  const handleTextFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCopyContent(event.target.result);
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // Generate cover image
  const handleGenerateCover = async () => {
    if (!apiKey) {
      setErrorMessage(t.noApiKey);
      return;
    }

    if (!copyContent) {
      setErrorMessage(language === 'zh' ? '请先生成文案' : 'Please generate copy first');
      return;
    }

    setIsGeneratingImage(true);
    setProgress(70);
    setErrorMessage('');

    try {
      // Ensure we have a taskId
      let currentTaskId = taskId;
      if (!currentTaskId) {
        const setContentResult = await copywriterSetContent({ content: copyContent });
        if (setContentResult.success) {
          currentTaskId = setContentResult.task_id;
          setTaskId(currentTaskId);
        } else {
          setErrorMessage(setContentResult.error || 'Failed to create task');
          setIsGeneratingImage(false);
          return;
        }
      }

      // 获取选中的标题
      const selectedTitle = selectedCard !== null && titles[selectedCard]
        ? titles[selectedCard].title
        : '';

      // 注册全局任务
      const newCoverTaskId = `cover-${Date.now()}`;
      setCoverTaskId(newCoverTaskId);
      registerTask(newCoverTaskId, {
        type: 'cover-generation',
        title: selectedTitle || 'Cover Generation',
        page: 'course',
      });

      const result = await copywriterGenerateImage({
        taskId: currentTaskId,
        apiKey,
        apiBase: baseUrl,
        model: imageModel,
        refImagePath: uploadedImagePath,
        copyText: copyContent,
        title: selectedTitle,
        promptTemplate: prompts?.coverArt,
      });

      if (result.success && result.image_base64) {
        setGeneratedImage(`data:image/png;base64,${result.image_base64}`);
        setProgress(100);
      } else {
        setErrorMessage(result.error || 'Failed to generate image');
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // 从全局任务状态恢复封面生成进度
  useEffect(() => {
    if (coverTaskId) {
      const task = getTask(coverTaskId);
      if (task) {
        if (task.status === 'running') {
          setIsGeneratingImage(true);
          setProgress(task.progress || 70);
        } else if (task.status === 'completed' && task.result?.image_base64) {
          setIsGeneratingImage(false);
          setGeneratedImage(`data:image/png;base64,${task.result.image_base64}`);
          setProgress(100);
          setCoverTaskId(null);
        } else if (task.status === 'error') {
          setIsGeneratingImage(false);
          setErrorMessage(task.error || 'Failed to generate image');
          setCoverTaskId(null);
        }
      }
    }
  }, [coverTaskId, getTask, tasks]);

  // Download cover image
  const handleDownloadCover = () => {
    if (!generatedImage) return;

    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `cover_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Clear all
  const handleClearAll = () => {
    setCourseUrl('');
    setScrapedContent('');
    setDataFetched(false);
    setTaskId(null);
    setTitles([]);
    setSelectedCard(null);
    setCopyContent('');
    setUploadedImage(null);
    setGeneratedImage(null);
    setProgress(0);
    setErrorMessage('');
  };

  // Render title cards
  const renderTitleCards = () => {
    if (titles.length === 0) {
      const placeholders = [
        { type: t.painPoint, title: '...' },
        { type: t.benefit, title: '...' },
        { type: t.curiosity, title: '...' },
        { type: t.authority, title: '...' }
      ];
      return placeholders.map((card, index) => (
        <SelectionCard
          key={index}
          tag={card.type}
          title={card.title}
          selected={false}
          onClick={() => {}}
        />
      ));
    }

    return titles.map((card, index) => (
      <SelectionCard
        key={index}
        tag={card.type}
        title={card.title}
        selected={selectedCard === index}
        onClick={() => setSelectedCard(index)}
      />
    ));
  };

  // 检查是否有正在后台运行的封面生成任务
  const hasBackgroundCoverTask = coverTaskId && getTask(coverTaskId)?.status === 'running';
  const isProcessing = isFetching || isGeneratingTitles || isGeneratingCopy || isGeneratingImage || hasBackgroundCoverTask;

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        style={{ display: 'none' }}
      />
      <input
        type="file"
        ref={textFileInputRef}
        onChange={handleTextFileChange}
        accept=".txt,.md,.markdown"
        style={{ display: 'none' }}
      />

      <Sidebar />

      <main className="panel panel-main" style={{ gridColumn: '2 / -1' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', width: '100%' }}>
          <h2 className="section-header">06 — {t.title}</h2>

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

          {/* 01 Information Collection */}
          <div className="input-group">
            <label className="label">01 / {t.infoCollection}</label>
            <div style={{
              display: 'flex',
              gap: 'var(--space-sm)',
            }}>
              <input
                type="text"
                className="input-pill"
                value={courseUrl}
                onChange={(e) => setCourseUrl(e.target.value)}
                placeholder="https://course.url/detail"
                style={{ flex: 1 }}
              />
              <button
                className="btn-icon"
                onClick={handleFetch}
                disabled={isFetching || !courseUrl}
                style={{ opacity: isFetching || !courseUrl ? 0.5 : 1 }}
              >
                →
              </button>
            </div>

            {dataFetched && (
              <div style={{
                marginTop: '8px',
                fontSize: '12px',
                color: 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span>✓</span> {t.dataCollected} ({charCount.toLocaleString()} {t.chars})
              </div>
            )}

            <div className="card" style={{ marginTop: 'var(--space-md)' }}>
              <textarea
                className="input-pill"
                value={scrapedContent}
                onChange={handleContentChange}
                placeholder={t.scrapedContentPlaceholder}
                rows={4}
                style={{
                  border: 'none',
                  borderRadius: 0,
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          {/* 02 Creative Strategy */}
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-md)',
            }}>
              <label className="label">02 / {t.creativeStrategy}</label>
              <button
                className="btn-ghost"
                onClick={handleGenerateTitles}
                disabled={isGeneratingTitles || !scrapedContent}
                style={{ opacity: isGeneratingTitles || !scrapedContent ? 0.5 : 1 }}
              >
                {isGeneratingTitles ? t.generating : `${t.generateTitles} →`}
              </button>
            </div>

            <div className="selection-grid">
              {renderTitleCards()}
            </div>

            {/* Custom title input */}
            <div style={{
              display: 'flex',
              gap: '8px',
              marginTop: 'var(--space-md)',
            }}>
              <input
                type="text"
                className="input-pill"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={t.customTitlePlaceholder}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTitle()}
                style={{ flex: 1 }}
              />
              <button
                className="btn-ghost"
                onClick={handleAddCustomTitle}
                disabled={!customTitle.trim()}
                style={{ opacity: !customTitle.trim() ? 0.5 : 1 }}
              >
                {t.addTitle}
              </button>
            </div>

            {selectedCard !== null && titles[selectedCard] && (
              <p style={{ fontSize: '13px', color: 'var(--success)', marginTop: '12px' }}>
                ✓ {t.selected} ({titles[selectedCard].type}): {titles[selectedCard].title}
              </p>
            )}
          </div>

          {/* 03 Copy Standardization */}
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-md)',
            }}>
              <label className="label">03 / {t.copyStandardization}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn-ghost"
                  onClick={handleTextFileUpload}
                >
                  {t.uploadText}
                </button>
                <button
                  className="btn-ghost"
                  onClick={handleGenerateCopy}
                  disabled={isGeneratingCopy || selectedCard === null}
                  style={{ opacity: isGeneratingCopy || selectedCard === null ? 0.5 : 1 }}
                >
                  {isGeneratingCopy ? t.generating : t.generateCopy}
                </button>
                <button
                  className="btn-ghost"
                  onClick={handleDownload}
                  disabled={!copyContent}
                  style={{ opacity: !copyContent ? 0.5 : 1 }}
                >
                  {t.download}
                </button>
              </div>
            </div>

            <div className="card">
              <div className="toolbar">
                <button className="toolbar-btn">{t.bold}</button>
                <button className="toolbar-btn">{t.italic}</button>
                <button className="toolbar-btn">{t.link}</button>
              </div>
              <textarea
                className="input-pill"
                value={copyContent}
                onChange={(e) => setCopyContent(e.target.value)}
                placeholder={language === 'zh' ? '生成的文案将显示在这里...' : 'Generated copy will appear here...'}
                rows={6}
                style={{
                  border: 'none',
                  borderRadius: 0,
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          {/* 04 Visual Synthesis */}
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="label">04 / {t.visualSynthesis}</label>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-md)',
              marginBottom: 'var(--space-md)'
            }}>
              {/* Upload area - 16:9 aspect ratio */}
              <div
                onClick={handleUploadClick}
                style={{
                  border: '2px dashed var(--border-color)',
                  background: 'rgba(255,255,255,0.4)',
                  borderRadius: 'var(--radius-lg)',
                  aspectRatio: '16 / 9',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  overflow: 'hidden'
                }}
              >
                {uploadedImage ? (
                  <img src={uploadedImage} alt="Uploaded" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <>
                    <div style={{ fontSize: '32px', opacity: 0.4 }}>↑</div>
                    <div style={{ fontSize: '13px', color: 'var(--fg-secondary)' }}>
                      {t.uploadCover}
                    </div>
                  </>
                )}
              </div>

              {/* AI Generated Preview - 16:9 aspect ratio */}
              <div style={{
                background: 'rgba(0,0,0,0.03)',
                borderRadius: 'var(--radius-lg)',
                aspectRatio: '16 / 9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {generatedImage ? (
                  <img src={generatedImage} alt="Generated" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '20px',
                      color: 'var(--fg-secondary)',
                      marginBottom: '8px'
                    }}>Auto-LTG</div>
                    <div style={{
                      fontSize: '13px',
                      color: 'var(--fg-muted)'
                    }}>{isGeneratingImage ? t.generatingPreview : t.preview}</div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                className="btn-ghost"
                onClick={handleClearAll}
                style={{ color: 'var(--error)' }}
              >
                {t.clearAll}
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn-ghost"
                  onClick={handleDownloadCover}
                  disabled={!generatedImage}
                  style={{ opacity: !generatedImage ? 0.5 : 1 }}
                >
                  {t.downloadCover}
                </button>
                <button
                  className="btn-ghost"
                  onClick={handleGenerateCover}
                  disabled={isGeneratingImage || !copyContent}
                  style={{ opacity: isGeneratingImage || !copyContent ? 0.5 : 1 }}
                >
                  {isGeneratingImage ? t.generating : `${t.generateCover} →`}
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-xl)' }}>
            <Progress value={progress} label={isProcessing ? t.generating : ''} />
          </div>
        </div>
      </main>
    </>
  );
};

export default CourseCopy;
