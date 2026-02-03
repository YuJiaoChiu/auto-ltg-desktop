/**
 * API 服务层 - 封装所有后端 API 调用
 */

// 检测是否在 Electron 环境中（通过 file:// 协议加载）
const isElectronProd = typeof window !== 'undefined' && window.location.protocol === 'file:';

// 在 Electron 生产模式下使用完整的后端地址
export const API_BASE_URL = isElectronProd ? 'http://127.0.0.1:5001/api' : '/api';
const API_BASE = API_BASE_URL;

// 通用请求函数
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

// ==================== 连接测试 API ====================

export async function testConnection({ apiKey, apiBase, model }) {
  return request('/test-connection', {
    method: 'POST',
    body: { api_key: apiKey, api_base: apiBase, model },
  });
}

export async function testImage({ apiKey, apiBase, model }) {
  return request('/test-image', {
    method: 'POST',
    body: { api_key: apiKey, api_base: apiBase, model },
  });
}

// ==================== AI 重命名 API ====================

export async function renameScan({ folder, scanVideos, scanAudio, scanPdf, scanFolders }) {
  return request('/rename/scan', {
    method: 'POST',
    body: {
      folder,
      scan_videos: scanVideos,
      scan_audio: scanAudio,
      scan_pdf: scanPdf,
      scan_folders: scanFolders,
    },
  });
}

export async function renameGenerate({ taskId, apiKey, apiBase, modelName, courseContext, promptTemplate }) {
  return request('/rename/generate', {
    method: 'POST',
    body: {
      task_id: taskId,
      api_key: apiKey,
      api_base: apiBase,
      model_name: modelName,
      course_context: courseContext,
      prompt_template: promptTemplate,
    },
  });
}

export async function renameExecute({ taskId }) {
  return request('/rename/execute', {
    method: 'POST',
    body: { task_id: taskId },
  });
}

export async function renameUpdate({ taskId, itemId, newName }) {
  return request('/rename/update', {
    method: 'POST',
    body: { task_id: taskId, item_id: itemId, new_name: newName },
  });
}

// ==================== 字幕整理 API ====================

export async function subtitleOrganize({ folder, videosrtMode }) {
  return request('/subtitle/organize', {
    method: 'POST',
    body: { folder, videosrt_mode: videosrtMode },
  });
}

// ==================== 视频分割 API ====================

export async function splitterAnalyze({ videoPath }) {
  return request('/splitter/analyze', {
    method: 'POST',
    body: { video_path: videoPath },
  });
}

export async function splitterSplit({ videoPaths, targetDuration, searchRange, silenceThreshold, minSilence, longSilenceThreshold, overwrite }) {
  return request('/splitter/split', {
    method: 'POST',
    body: {
      video_paths: videoPaths,
      target_duration: targetDuration,
      search_range: searchRange,
      silence_threshold: silenceThreshold,
      min_silence: minSilence,
      long_silence_threshold: longSilenceThreshold,
      overwrite,
    },
  });
}

// ==================== 片头添加 API ====================

export async function introAnalyze({ introPath, videoDir }) {
  return request('/intro/analyze', {
    method: 'POST',
    body: { intro_path: introPath, video_dir: videoDir },
  });
}

export async function introProcess({ introPath, videoDir, outputDir, overwriteSource }) {
  return request('/intro/process', {
    method: 'POST',
    body: {
      intro_path: introPath,
      video_dir: videoDir,
      output_dir: outputDir,
      overwrite_source: overwriteSource,
    },
  });
}

// ==================== 文案生成 API ====================

export async function copywriterScrape({ url }) {
  return request('/copywriter/scrape', {
    method: 'POST',
    body: { url },
  });
}

export async function copywriterSetContent({ content }) {
  return request('/copywriter/set-content', {
    method: 'POST',
    body: { content },
  });
}

export async function copywriterGenerateTitles({ taskId, apiKey, apiBase, model, promptTemplate }) {
  return request('/copywriter/generate-titles', {
    method: 'POST',
    body: { task_id: taskId, api_key: apiKey, api_base: apiBase, model, prompt_template: promptTemplate },
  });
}

export async function copywriterGenerateCopy({ taskId, selectedTitle, apiKey, apiBase, model, promptTemplate }) {
  return request('/copywriter/generate-copy', {
    method: 'POST',
    body: {
      task_id: taskId,
      selected_title: selectedTitle,
      api_key: apiKey,
      api_base: apiBase,
      model,
      prompt_template: promptTemplate,
    },
  });
}

export async function copywriterGenerateImage({ taskId, apiKey, apiBase, model, refImagePath, copyText, title, promptTemplate }) {
  return request('/copywriter/generate-image', {
    method: 'POST',
    body: {
      task_id: taskId,
      api_key: apiKey,
      api_base: apiBase,
      model,
      ref_image_path: refImagePath,
      copy_text: copyText,
      title,
      prompt_template: promptTemplate,
    },
  });
}

export async function copywriterUploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(`${API_BASE}/copywriter/upload-image`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

// ==================== 视频压缩 API ====================

export async function compressScan({ folder, recursive }) {
  return request('/compress/scan', {
    method: 'POST',
    body: { folder, recursive },
  });
}

export async function compressCreateTasks({ videos, settings }) {
  return request('/compress/create-tasks', {
    method: 'POST',
    body: { videos, settings },
  });
}

export async function compressStart({ taskIds }) {
  return request('/compress/start', {
    method: 'POST',
    body: { task_ids: taskIds },
  });
}

export async function compressGetTasks() {
  return request('/compress/tasks', { method: 'GET' });
}

export async function compressCancel(taskId) {
  return request(`/compress/cancel/${taskId}`, { method: 'POST' });
}

export async function compressClear() {
  return request('/compress/clear', { method: 'POST' });
}

export async function compressDeleteVideoOut(dirs) {
  return request('/compress/delete-video-out', {
    method: 'POST',
    body: { dirs }
  });
}

// ==================== 任务状态 API ====================

export async function getTaskStatus(taskId) {
  return request(`/task/${taskId}`, { method: 'GET' });
}

export async function stopTask(taskId) {
  return request(`/task/${taskId}/stop`, { method: 'POST' });
}

export async function listTasks() {
  return request('/tasks', { method: 'GET' });
}

// ==================== 文件浏览 API ====================

export async function browseFolder(path) {
  return request('/browse', {
    method: 'POST',
    body: { path },
  });
}

// ==================== 轮询任务状态 ====================

export function pollTaskStatus(taskId, onProgress, onComplete, onError, interval = 1000) {
  let stopped = false;

  const poll = async () => {
    if (stopped) return;

    try {
      const data = await getTaskStatus(taskId);
      if (!data.success) {
        onError(data.error || '获取任务状态失败');
        return;
      }

      const task = data.task;
      onProgress(task);

      if (task.status === 'completed') {
        onComplete(task.result);
      } else if (task.status === 'error') {
        onError(task.error || '任务执行失败');
      } else if (!stopped) {
        setTimeout(poll, interval);
      }
    } catch (err) {
      onError(err.message);
    }
  };

  poll();

  return () => {
    stopped = true;
  };
}
