import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  // API 配置
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('apiKey') || '');
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem('baseUrl') || 'https://api.openai.com/v1');

  // 模型配置
  const [textModel, setTextModel] = useState(() => localStorage.getItem('textModel') || 'gpt-4o');
  const [imageModel, setImageModel] = useState(() => localStorage.getItem('imageModel') || 'dall-e-3');

  // Prompt 配置（默认使用优化后的中文 prompt）
  const [prompts, setPrompts] = useState(() => {
    const saved = localStorage.getItem('prompts');
    return saved ? JSON.parse(saved) : {
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
    };
  });

  // 保存到 localStorage
  useEffect(() => {
    localStorage.setItem('apiKey', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('baseUrl', baseUrl);
  }, [baseUrl]);

  useEffect(() => {
    localStorage.setItem('textModel', textModel);
  }, [textModel]);

  useEffect(() => {
    localStorage.setItem('imageModel', imageModel);
  }, [imageModel]);

  useEffect(() => {
    localStorage.setItem('prompts', JSON.stringify(prompts));
  }, [prompts]);

  const value = {
    apiKey, setApiKey,
    baseUrl, setBaseUrl,
    textModel, setTextModel,
    imageModel, setImageModel,
    prompts, setPrompts
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export default SettingsContext;
