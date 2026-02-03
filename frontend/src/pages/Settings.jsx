import React, { useState, useEffect } from 'react';
import { Sidebar, Button } from '../components';
import { useSettings } from '../contexts/SettingsContext';
import { testConnection, testImage } from '../services/api';

const Settings = () => {
  // 使用全局设置 Context
  const {
    apiKey, setApiKey,
    baseUrl, setBaseUrl,
    textModel, setTextModel,
    imageModel, setImageModel,
    prompts, setPrompts
  } = useSettings();

  // 本地状态
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localBaseUrl, setLocalBaseUrl] = useState(baseUrl);
  const [localTextModel, setLocalTextModel] = useState(textModel);
  const [localImageModel, setLocalImageModel] = useState(imageModel);

  // 从 localStorage 读取设置
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('language') || 'zh';
  });

  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [connectionError, setConnectionError] = useState('');
  const [connectionReply, setConnectionReply] = useState('');
  const [imageTestStatus, setImageTestStatus] = useState('idle');
  const [imageTestError, setImageTestError] = useState('');
  const [testImageBase64, setTestImageBase64] = useState('');

  // Prompt Lab 配置
  const [activePromptSection, setActivePromptSection] = useState('title');

  // 应用主题和语言设置
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-lang', language);
    localStorage.setItem('theme', theme);
    localStorage.setItem('language', language);
  }, [theme, language]);

  // 同步本地状态
  useEffect(() => {
    setLocalApiKey(apiKey);
    setLocalBaseUrl(baseUrl);
    setLocalTextModel(textModel);
    setLocalImageModel(imageModel);
  }, [apiKey, baseUrl, textModel, imageModel]);

  // 翻译文本
  const t = {
    zh: {
      configuration: '设置',
      appearance: '外观',
      theme: '主题',
      light: '浅色',
      dark: '深色',
      language: '语言',
      chinese: '中文',
      english: 'English',
      apiConfig: '🔑 全局 API 配置',
      apiConfigDesc: '这些设置会被所有 AI 功能共享使用',
      defaultApiKey: '默认 API Key:',
      apiKeyHint: '所有 AI 功能默认使用此 Key，各页面可单独覆盖',
      defaultApiBase: '默认 API Base:',
      apiBaseHint: '支持第三方代理，如 https://api.tu-zi.com/v1',
      defaultTextModel: '默认文本模型:',
      defaultImageModel: '默认图像模型:',
      saveSettings: '💾 保存设置',
      testConnection: '🔗 测试连接',
      testImage: '🖼️ 测试图像',
      clearSettings: '🗑️ 清除设置',
      connected: '连接成功',
      testing: '测试中...',
      testImageSuccess: '图像测试成功',
      testImageFailed: '图像测试失败',
      saved: '设置已保存',
      cleared: '设置已清除',
      promptLab: 'Prompt 实验室',
      promptLabDesc: '配置文案生成规则',
      titleGeneration: '标题生成',
      copyGeneration: '文案生成',
      coverArt: '封面图生成',
      resetDefault: '恢复默认',
      savePrompts: '保存 Prompts',
      about: '关于',
      version: '版本',
    },
    en: {
      configuration: 'Settings',
      appearance: 'Appearance',
      theme: 'Theme',
      light: 'Light',
      dark: 'Dark',
      language: 'Language',
      chinese: '中文',
      english: 'English',
      apiConfig: '🔑 Global API Config',
      apiConfigDesc: 'These settings are shared across all AI features',
      defaultApiKey: 'Default API Key:',
      apiKeyHint: 'All AI features use this Key by default, each page can override',
      defaultApiBase: 'Default API Base:',
      apiBaseHint: 'Supports third-party proxies, e.g., https://api.tu-zi.com/v1',
      defaultTextModel: 'Default Text Model:',
      defaultImageModel: 'Default Image Model:',
      saveSettings: '💾 Save Settings',
      testConnection: '🔗 Test Connection',
      testImage: '🖼️ Test Image',
      clearSettings: '🗑️ Clear Settings',
      connected: 'Connected',
      testing: 'Testing...',
      testImageSuccess: 'Image test success',
      testImageFailed: 'Image test failed',
      saved: 'Settings saved',
      cleared: 'Settings cleared',
      promptLab: 'Prompt Lab',
      promptLabDesc: 'Configure generation rules',
      titleGeneration: 'Title Generation',
      copyGeneration: 'Copy Generation',
      coverArt: 'Cover Art',
      resetDefault: 'Reset Default',
      savePrompts: 'Save Prompts',
      about: 'About',
      version: 'Version',
    }
  }[language];

  const handleSaveSettings = () => {
    setApiKey(localApiKey);
    setBaseUrl(localBaseUrl);
    setTextModel(localTextModel);
    setImageModel(localImageModel);
    alert(language === 'zh' ? '设置已保存！' : 'Settings saved!');
  };

  const handleClearSettings = () => {
    setLocalApiKey('');
    setLocalBaseUrl('https://api.openai.com/v1');
    setLocalTextModel('gpt-4o');
    setLocalImageModel('dall-e-3');
    setApiKey('');
    setBaseUrl('https://api.openai.com/v1');
    setTextModel('gpt-4o');
    setImageModel('dall-e-3');
    alert(language === 'zh' ? '设置已清除！' : 'Settings cleared!');
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setConnectionError('');
    setConnectionReply('');
    try {
      const result = await testConnection({
        apiKey: localApiKey,
        apiBase: localBaseUrl,
        model: localTextModel,
      });
      if (result.success) {
        setConnectionStatus('connected');
        setConnectionReply(result.reply || '');
      } else {
        setConnectionStatus('error');
        setConnectionError(result.error || '连接失败');
      }
    } catch (err) {
      setConnectionStatus('error');
      setConnectionError(err.message || '连接失败');
    }
  };

  const handleTestImage = async () => {
    setImageTestStatus('testing');
    setImageTestError('');
    setTestImageBase64('');
    try {
      const result = await testImage({
        apiKey: localApiKey,
        apiBase: localBaseUrl,
        model: localImageModel,
      });
      if (result.success) {
        setImageTestStatus('success');
        setTestImageBase64(result.image_base64 || '');
      } else {
        setImageTestStatus('error');
        setImageTestError(result.error || '图像测试失败');
      }
    } catch (err) {
      setImageTestStatus('error');
      setImageTestError(err.message || '图像测试失败');
    }
  };

  const handleSavePrompts = () => {
    console.log('Saving prompts:', prompts);
    alert(language === 'zh' ? '保存成功！' : 'Saved successfully!');
  };

  const handleResetPrompts = () => {
    setPrompts({
      title: `你是一位资深的课程营销专家。请根据以下课程信息，生成4个不同风格的中文营销标题。

要求：
1. 痛点型：直击目标用户的痛点和焦虑
2. 利益型：强调学完后能获得的具体好处
3. 悬念型：引发好奇心，让人想点进去看
4. 权威型：突出课程的专业性或讲师背景

每个标题控制在15-25个字以内，朗朗上口，适合社交媒体传播。

请严格按以下JSON格式输出，不要添加任何其他内容：
{
  "titles": [
    {"type": "痛点型", "title": "标题内容"},
    {"type": "利益型", "title": "标题内容"},
    {"type": "悬念型", "title": "标题内容"},
    {"type": "权威型", "title": "标题内容"}
  ]
}

课程信息如下：`,
      copy: `你是一位专业的团购文案撰写专家。请根据以下课程信息和选定的标题，撰写一份完整的团购文案。

【重要约束】
- 所有信息必须来自原文，严禁编造任何数据
- 如果原文未提及价格、时长、课时数等信息，请标注"（原文未提及）"
- 保持专业、真实、可信的语气

【输出参考结构】
今天开这门课，来自[讲师背景]的《[课程名称]》。
如果你是[目标人群]，但总觉得[痛点]，这门课绝对是你的解药。
[一句话概括课程核心价值]。

讲师：[讲师详细介绍]

下面我们看一下课程模块
- [模块1]：[内容简介]
- [模块2]：[内容简介]
...

课程原价[价格]，[时长]，除了官方资源，我们额外提供[附加服务]，[团购信息]。

选定的标题：{selected_title}

课程原始信息如下：`,
      coverArt: `为以下课程制作一个16:9横版营销封面图：

【课程标题】
{title}

【课程文案】
{copy}

要求：
- 视觉风格：现代、专业、吸引眼球
- 适合社交媒体传播
- 突出课程主题和价值
- 配色和谐，文字清晰可读`
    });
  };

  // SegmentedControl 组件
  const SegmentedControl = ({ options, value, onChange }) => (
    <div className="segmented-control">
      {options.map(opt => (
        <div
          key={opt.value}
          className="segmented-item"
          style={{ 
            background: value === opt.value ? 'rgba(255,255,255,0.8)' : 'transparent',
            color: value === opt.value ? 'var(--fg-primary)' : 'var(--fg-secondary)',
            boxShadow: value === opt.value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </div>
      ))}
    </div>
  );

  // 渲染掩码的 API Key
  const renderMaskedApiKey = () => {
    if (!localApiKey) return '•••••••••••••••••••••••••••••••••••••••••••••••••••';
    const visible = localApiKey.slice(0, 4);
    const masked = '•'.repeat(Math.max(40, localApiKey.length));
    return visible + masked.slice(4);
  };

  return (
    <>
      <Sidebar />

      <main 
        className="panel panel-main" 
        style={{ 
          gridColumn: '2 / -1',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          height: '100%'
        }}
      >
        <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
          <h2 className="section-header">SET — <span>{t.configuration}</span></h2>

          {/* 外观设置 */}
          <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
            <div className="card-header">
              <h3 style={{ fontSize: '16px' }}>{t.appearance}</h3>
            </div>
            <div className="card-body">
              {/* 主题切换 */}
              <div className="input-group">
                <label className="label">{t.theme}</label>
                <SegmentedControl
                  options={[
                    { value: 'light', label: t.light },
                    { value: 'dark', label: t.dark }
                  ]}
                  value={theme}
                  onChange={setTheme}
                />
              </div>

              {/* 语言切换 */}
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="label">{t.language}</label>
                <SegmentedControl
                  options={[
                    { value: 'zh', label: t.chinese },
                    { value: 'en', label: t.english }
                  ]}
                  value={language}
                  onChange={setLanguage}
                />
              </div>
            </div>
          </div>

          {/* API Configuration - 新设计 */}
          <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
            <div className="card-header">
              <h3 style={{ fontSize: '16px' }}>{t.apiConfig}</h3>
              <p style={{ fontSize: '12px', color: 'var(--fg-secondary)', marginTop: '4px' }}>
                {t.apiConfigDesc}
              </p>
            </div>
            <div className="card-body">
              {/* 默认 API Key */}
              <div className="input-group">
                <label className="label">{t.defaultApiKey}</label>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    color: 'var(--fg-secondary)',
                    letterSpacing: '1px',
                    wordBreak: 'break-all',
                    padding: '8px 0',
                  }}
                >
                  {renderMaskedApiKey()}
                </div>
                <input
                  type="password"
                  className="input-pill"
                  value={localApiKey}
                  onChange={(e) => setLocalApiKey(e.target.value)}
                  placeholder={language === 'zh' ? '输入 API Key...' : 'Enter API Key...'}
                  style={{ marginTop: '4px' }}
                />
                <p style={{ fontSize: '11px', color: 'var(--fg-muted)', marginTop: '4px' }}>
                  {t.apiKeyHint}
                </p>
              </div>

              {/* 默认 API Base */}
              <div className="input-group">
                <label className="label">{t.defaultApiBase}</label>
                <input
                  type="text"
                  className="input-pill"
                  value={localBaseUrl}
                  onChange={(e) => setLocalBaseUrl(e.target.value)}
                  placeholder="https://api.tu-zi.com/v1"
                />
                <p style={{ fontSize: '11px', color: 'var(--fg-muted)', marginTop: '4px' }}>
                  {t.apiBaseHint}
                </p>
              </div>

              {/* 默认文本模型 */}
              <div className="input-group">
                <label className="label">{t.defaultTextModel}</label>
                <input
                  type="text"
                  className="input-pill"
                  value={localTextModel}
                  onChange={(e) => setLocalTextModel(e.target.value)}
                  placeholder="gpt-4o"
                />
              </div>

              {/* 默认图像模型 */}
              <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
                <label className="label">{t.defaultImageModel}</label>
                <input
                  type="text"
                  className="input-pill"
                  value={localImageModel}
                  onChange={(e) => setLocalImageModel(e.target.value)}
                  placeholder="gemini-3-pro-image-preview"
                />
              </div>

              {/* 按钮组 */}
              <div style={{ 
                display: 'flex', 
                gap: 'var(--space-sm)',
                flexWrap: 'wrap',
              }}>
                <Button 
                  variant="primary"
                  onClick={handleSaveSettings}
                  style={{ flex: 1, minWidth: '100px' }}
                >
                  {t.saveSettings}
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={handleTestConnection}
                  disabled={connectionStatus === 'testing'}
                  style={{ flex: 1, minWidth: '100px' }}
                >
                  {connectionStatus === 'testing' ? t.testing : t.testConnection}
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={handleTestImage}
                  disabled={imageTestStatus === 'testing'}
                  style={{ flex: 1, minWidth: '100px' }}
                >
                  {imageTestStatus === 'testing' ? t.testing : t.testImage}
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={handleClearSettings}
                  style={{ 
                    flex: 1, 
                    minWidth: '100px',
                    color: 'var(--error)'
                  }}
                >
                  {t.clearSettings}
                </Button>
              </div>

              {/* 状态提示 */}
              {(connectionStatus !== 'idle' || imageTestStatus !== 'idle') && (
                <div style={{ marginTop: 'var(--space-md)' }}>
                  {connectionStatus === 'connected' && (
                    <div style={{ color: 'var(--success)', fontSize: '13px', marginBottom: '8px' }}>
                      ✓ {t.connected}
                      {connectionReply && (
                        <span style={{ marginLeft: '8px', color: 'var(--fg-secondary)' }}>
                          AI: {connectionReply.slice(0, 50)}...
                        </span>
                      )}
                    </div>
                  )}
                  {connectionStatus === 'error' && (
                    <div style={{ color: 'var(--error)', fontSize: '13px', marginBottom: '8px' }}>
                      ✗ {connectionError}
                    </div>
                  )}
                  {imageTestStatus === 'success' && (
                    <div style={{ color: 'var(--success)', fontSize: '13px', marginBottom: '8px' }}>
                      ✓ {t.testImageSuccess}
                    </div>
                  )}
                  {imageTestStatus === 'error' && (
                    <div style={{ color: 'var(--error)', fontSize: '13px', marginBottom: '8px' }}>
                      ✗ {imageTestError}
                    </div>
                  )}
                  {testImageBase64 && (
                    <div style={{ marginTop: '12px' }}>
                      <img
                        src={`data:image/png;base64,${testImageBase64}`}
                        alt="Test"
                        style={{ maxWidth: '200px', borderRadius: '8px' }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Prompt Lab */}
          <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
            <div className="card-header">
              <h3 style={{ fontSize: '16px' }}>{t.promptLab}</h3>
              <p style={{ fontSize: '12px', color: 'var(--fg-secondary)', marginTop: '4px' }}>
                {t.promptLabDesc}
              </p>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {/* Title Prompt */}
              <details className="details-group" open={activePromptSection === 'title'}>
                <summary 
                  className="details-summary" 
                  onClick={() => setActivePromptSection(activePromptSection === 'title' ? '' : 'title')}
                >
                  <span>{t.titleGeneration}</span>
                  <span style={{ fontWeight: 300, fontSize: '18px' }}>
                    {activePromptSection === 'title' ? '−' : '+'}
                  </span>
                </summary>
                <div className="details-content">
                  <textarea
                    className="input-pill"
                    value={prompts.title}
                    onChange={(e) => setPrompts({...prompts, title: e.target.value})}
                    rows={6}
                    style={{ 
                      fontSize: '13px',
                      width: '100%',
                      border: 'none',
                      borderRadius: 0,
                      resize: 'vertical',
                    }}
                  />
                </div>
              </details>

              {/* Copy Prompt */}
              <details className="details-group" open={activePromptSection === 'copy'}>
                <summary 
                  className="details-summary" 
                  onClick={() => setActivePromptSection(activePromptSection === 'copy' ? '' : 'copy')}
                >
                  <span>{t.copyGeneration}</span>
                  <span style={{ fontWeight: 300, fontSize: '18px' }}>
                    {activePromptSection === 'copy' ? '−' : '+'}
                  </span>
                </summary>
                <div className="details-content">
                  <textarea
                    className="input-pill"
                    value={prompts.copy}
                    onChange={(e) => setPrompts({...prompts, copy: e.target.value})}
                    rows={6}
                    style={{ 
                      fontSize: '13px',
                      width: '100%',
                      border: 'none',
                      borderRadius: 0,
                      resize: 'vertical',
                    }}
                  />
                </div>
              </details>

              {/* Cover Art Prompt */}
              <details className="details-group" open={activePromptSection === 'cover'}>
                <summary 
                  className="details-summary" 
                  onClick={() => setActivePromptSection(activePromptSection === 'cover' ? '' : 'cover')}
                >
                  <span>{t.coverArt}</span>
                  <span style={{ fontWeight: 300, fontSize: '18px' }}>
                    {activePromptSection === 'cover' ? '−' : '+'}
                  </span>
                </summary>
                <div className="details-content">
                  <textarea
                    className="input-pill"
                    value={prompts.coverArt}
                    onChange={(e) => setPrompts({...prompts, coverArt: e.target.value})}
                    rows={6}
                    style={{ 
                      fontSize: '13px',
                      width: '100%',
                      border: 'none',
                      borderRadius: 0,
                      resize: 'vertical',
                    }}
                  />
                </div>
              </details>

              {/* Prompt 操作按钮 */}
              <div style={{ 
                padding: 'var(--space-md) var(--space-lg)', 
                borderTop: '1px solid var(--border-light)',
                display: 'flex',
                gap: 'var(--space-sm)'
              }}>
                <Button 
                  variant="ghost" 
                  onClick={handleResetPrompts}
                  style={{ width: 'auto', flex: 1 }}
                >
                  {t.resetDefault}
                </Button>
                <Button 
                  onClick={handleSavePrompts}
                  style={{ width: 'auto', flex: 1 }}
                >
                  {t.savePrompts}
                </Button>
              </div>
            </div>
          </div>

          {/* About */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: '16px' }}>{t.about}</h3>
            </div>
            <div className="card-body" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
              {/* Logo */}
              <div style={{
                width: 100,
                height: 100,
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--space-md)',
                overflow: 'hidden',
              }}>
                <img
                  src="./images/logo.png"
                  alt="Auto-LTG Logo"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </div>

              <h2 style={{ 
                fontFamily: 'var(--font-display)', 
                fontSize: '24px',
                marginBottom: '4px'
              }}>
                Auto-LTG
              </h2>
              <p style={{ 
                fontSize: '14px', 
                color: 'var(--fg-secondary)',
                marginBottom: '4px'
              }}>
                {t.version} 1.0.0
              </p>
              <p style={{ 
                fontSize: '14px', 
                color: 'var(--fg-secondary)',
                fontStyle: 'italic',
                marginBottom: 'var(--space-md)'
              }}>
                by Link
              </p>
              <p style={{ 
                fontSize: '13px', 
                color: 'var(--fg-muted)'
              }}>
                {language === 'zh' ? '字幕组统一工具平台' : 'Subtitle Team Unified Tool Platform'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default Settings;
