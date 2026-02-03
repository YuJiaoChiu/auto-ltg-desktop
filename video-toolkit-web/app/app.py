# -*- coding: utf-8 -*-
"""
视频工具箱 Web 版 - 主应用 (6合1整合版)
整合功能：
1. AI 批量重命名
2. 视频字幕整理
3. 视频智能分割
4. 视频片头添加
5. 课程文案生成
6. 视频压缩
"""
import os
import sys
import json
import time
import queue
import base64
import io
import threading
import requests as http_requests
from flask import Flask, render_template, request, jsonify, Response, send_file
from flask_socketio import SocketIO, emit

# 导入功能模块
from app.modules.ai_renamer import AIRenamer, DEFAULT_PROMPT_TEMPLATE
from app.modules.subtitle_organizer import SubtitleOrganizer
from app.modules.video_splitter import VideoSplitter
from app.modules.intro_adder import IntroAdder, get_video_info as get_intro_video_info
from app.modules.copywriter import Copywriter
from app.modules.video_compressor import VideoCompressor
from app.modules.statistics import stats_manager, record_usage

app = Flask(__name__, template_folder='templates', static_folder='static')
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['OUTPUT_FOLDER'] = 'outputs'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 * 1024  # 16GB max file size
app.config['SECRET_KEY'] = 'video-toolkit-secret-key'

# SocketIO for real-time progress
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# 确保目录存在
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)

# 全局状态存储
tasks = {}
task_lock = threading.Lock()

# 视频压缩器实例
compressor = VideoCompressor(output_folder=app.config['OUTPUT_FOLDER'])

# SocketIO 事件处理
@socketio.on('connect')
def handle_connect():
    """客户端连接"""
    print('客户端已连接')
    emit('connected', {'message': '连接成功'})

@socketio.on('disconnect')
def handle_disconnect():
    """客户端断开连接"""
    print('客户端已断开')

def get_openai_client(api_key, api_base=None):
    """创建 OpenAI 客户端（兼容 OpenAI / Google Gemini / 第三方代理）"""
    try:
        import openai
        import httpx
        client = openai.OpenAI(
            api_key=api_key,
            base_url=api_base or None,
            timeout=httpx.Timeout(120.0, connect=10.0),
        )
        return client
    except Exception as e:
        raise Exception(f"创建 OpenAI 客户端失败: {e}")


@app.route('/')
def index():
    """API 服务状态"""
    return jsonify({
        "status": "ok",
        "service": "Auto-LTG API",
        "version": "1.0.0",
        "endpoints": "/api/*"
    })


# ==================== API 测试 ====================

@app.route('/api/test-connection', methods=['POST'])
def test_connection():
    """测试 API 连接：用 requests 直接调用，兼容兔子 API 等非标准格式"""
    data = request.json
    api_key = data.get('api_key', '')
    api_base = data.get('api_base', '').rstrip('/')
    model = data.get('model', 'gpt-4o')

    if not api_key:
        return jsonify({"success": False, "error": "API Key 不能为空"})

    try:
        url = f"{api_base}/chat/completions" if api_base else "https://api.openai.com/v1/chat/completions"
        resp = http_requests.post(url, json={
            "model": model,
            "messages": [{"role": "user", "content": "hi"}],
            "max_tokens": 50,
            "stream": False
        }, headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }, timeout=25, proxies={"http": None, "https": None})

        result = resp.json()

        # 提取 AI 回复，兼容多种格式
        reply = extract_reply(result)

        if reply:
            return jsonify({"success": True, "reply": reply, "model": model})
        else:
            return jsonify({"success": False, "error": f"无法解析响应: {json.dumps(result, ensure_ascii=False)[:500]}"})
    except http_requests.exceptions.Timeout:
        return jsonify({"success": False, "error": "连接超时（25秒），请检查 API Base URL"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


def extract_reply(result):
    """从 API 响应中提取回复文本，兼容标准 OpenAI 和兔子 API 等包装格式"""
    if not isinstance(result, dict):
        return str(result) if result else None

    # 兔子 API 格式: {"code": 0, "data": {"choices": [...]}}
    inner = result.get('data', result)

    # 标准格式: {"choices": [{"message": {"content": "..."}}]}
    choices = inner.get('choices', [])
    if choices:
        msg = choices[0].get('message', {})
        if isinstance(msg, dict):
            return msg.get('content', '')

    # 错误信息
    error = result.get('error', {})
    if error:
        if isinstance(error, dict):
            return None  # 让调用方处理
        return None

    return None


@app.route('/api/test-image', methods=['POST'])
def test_image():
    """测试图像生成 API"""
    data = request.json
    api_key = data.get('api_key', '')
    api_base = data.get('api_base', '').rstrip('/')
    model = data.get('model', 'dall-e-3')

    if not api_key:
        return jsonify({"success": False, "error": "API Key 不能为空"})

    try:
        # 使用 Copywriter 模块的图像生成功能
        from .modules.copywriter import Copywriter

        cw = Copywriter()
        cw.set_api_config(api_key, api_base)
        cw.image_prompt = "{copy}"  # 简化 prompt

        success, img, error = cw.generate_cover_image(model=model, copy_text="一个红色的苹果，简洁风格，白色背景")

        if success and img:
            buf = io.BytesIO()
            img.save(buf, format='PNG')
            img_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
            return jsonify({"success": True, "image_base64": img_base64})
        else:
            return jsonify({"success": False, "error": error or "图像生成失败"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


# ==================== AI 重命名 API ====================

@app.route('/api/rename/scan', methods=['POST'])
def rename_scan():
    """扫描文件夹"""
    data = request.json
    folder = data.get('folder', '')
    
    if not folder or not os.path.isdir(folder):
        return jsonify({"success": False, "error": "无效的文件夹路径"})
    
    try:
        renamer = AIRenamer()
        items, counts = renamer.scan_files(
            folder,
            scan_videos=data.get('scan_videos', True),
            scan_audio=data.get('scan_audio', True),
            scan_pdf=data.get('scan_pdf', True),
            scan_folders=data.get('scan_folders', True)
        )
        
        task_id = f"rename_{int(time.time())}"
        with task_lock:
            tasks[task_id] = {
                "type": "rename",
                "renamer": renamer,
                "folder": folder
            }
        
        return jsonify({
            "success": True,
            "task_id": task_id,
            "items": [
                {
                    "id": item.item_id,
                    "old_name": item.original_name + item.ext,
                    "new_name": item.new_name,
                    "path": item.old_path,
                    "status": item.status
                }
                for item in items
            ],
            "counts": counts,
            "total": len(items)
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route('/api/rename/generate', methods=['POST'])
def rename_generate():
    """AI 生成新名称"""
    data = request.json
    task_id = data.get('task_id', '')
    api_key = data.get('api_key', '')
    api_base = data.get('api_base', '')
    model_name = data.get('model_name', 'gpt-4o')
    course_context = data.get('course_context', '')
    prompt_template = data.get('prompt_template', DEFAULT_PROMPT_TEMPLATE)
    
    if not task_id or task_id not in tasks:
        return jsonify({"success": False, "error": "无效的任务 ID"})
    
    if not api_key:
        return jsonify({"success": False, "error": "API Key 不能为空"})
    
    try:
        task = tasks[task_id]
        renamer = task["renamer"]
        
        client = get_openai_client(api_key, api_base)
        renamer.set_client(client)
        
        success = renamer.generate_names(
            course_context=course_context,
            prompt_template=prompt_template,
            model_name=model_name
        )

        items = list(renamer.items.values())
        error_items = [item for item in items if item.status == "error"]
        completed_items = [item for item in items if item.status == "completed"]

        response = {
            "success": success,
            "items": [
                {
                    "id": item.item_id,
                    "old_name": item.original_name + item.ext,
                    "new_name": item.new_name,
                    "status": item.status
                }
                for item in items
            ]
        }
        if not success:
            if len(error_items) > 0:
                response["error"] = f"AI 生成失败 ({len(error_items)}/{len(items)} 个文件)，请检查 API Key 和模型配置"
            else:
                response["error"] = "AI 生成名称失败，请检查 API 配置或重试"
        return jsonify(response)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route('/api/rename/execute', methods=['POST'])
def rename_execute():
    """执行重命名"""
    data = request.json
    task_id = data.get('task_id', '')

    if not task_id or task_id not in tasks:
        return jsonify({"success": False, "error": "无效的任务 ID"})

    try:
        task = tasks[task_id]
        renamer = task["renamer"]

        raw_results = renamer.execute_rename()

        # 转换结果格式为前端期望的数组格式
        results_list = []
        for item in raw_results.get("success", []):
            # 找到对应的文件 ID
            for item_id, renamer_item in renamer.items.items():
                if renamer_item.new_name == item["new"]:
                    results_list.append({
                        "id": item_id,
                        "success": True,
                        "old": item["old"],
                        "new": item["new"]
                    })
                    break
        for item in raw_results.get("failed", []):
            for item_id, renamer_item in renamer.items.items():
                if renamer_item.original_name == item["old"]:
                    results_list.append({
                        "id": item_id,
                        "success": False,
                        "old": item["old"],
                        "error": item.get("error", "未知错误")
                    })
                    break

        # 记录统计
        success_count = len(raw_results.get("success", []))
        if success_count > 0:
            record_usage('ai_rename', success_count)
            broadcast_statistics_update()

        return jsonify({"success": True, "results": results_list})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route('/api/rename/update', methods=['POST'])
def rename_update():
    """手动更新名称"""
    data = request.json
    task_id = data.get('task_id', '')
    item_id = data.get('item_id', '')
    new_name = data.get('new_name', '')
    
    if not task_id or task_id not in tasks:
        return jsonify({"success": False, "error": "无效的任务 ID"})
    
    try:
        task = tasks[task_id]
        renamer = task["renamer"]
        
        success = renamer.update_item_name(item_id, new_name)
        
        return jsonify({"success": success})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


# ==================== 字幕整理 API ====================

@app.route('/api/subtitle/organize', methods=['POST'])
def subtitle_organize():
    """整理字幕"""
    data = request.json
    folder = data.get('folder', '')
    videosrt_mode = data.get('videosrt_mode', False)
    
    if not folder or not os.path.isdir(folder):
        return jsonify({"success": False, "error": "无效的文件夹路径"})
    
    task_id = f"subtitle_{int(time.time())}"

    with task_lock:
        tasks[task_id] = {
            "type": "subtitle",
            "status": "running",
            "progress": 0,
            "message": "准备开始...",
            "thread": None
        }

    def run_organize():
        try:
            log_lines = []

            # 初始进度更新
            with task_lock:
                if task_id in tasks:
                    tasks[task_id]["progress"] = 0.01
                    tasks[task_id]["message"] = "开始扫描文件..."

            def log_callback(message):
                log_lines.append(message)
                with task_lock:
                    if task_id in tasks:
                        tasks[task_id]["message"] = message

            def progress_callback(message, percent):
                with task_lock:
                    if task_id in tasks:
                        tasks[task_id]["progress"] = max(0.01, percent / 100)  # 转换为 0-1
                        tasks[task_id]["message"] = message

            organizer = SubtitleOrganizer(callback=log_callback, videosrt_mode=videosrt_mode)
            success_count, total = organizer.process_root(folder, progress_callback=progress_callback)

            # 记录统计
            if success_count > 0:
                record_usage('subtitles', success_count)
                broadcast_statistics_update()

            with task_lock:
                if task_id in tasks:
                    tasks[task_id]["status"] = "completed"
                    tasks[task_id]["progress"] = 100
                    tasks[task_id]["message"] = f"完成！成功 {success_count}/{total}"
                    tasks[task_id]["result"] = {
                        "success_count": success_count,
                        "total": total,
                        "logs": log_lines
                    }
        except Exception as e:
            with task_lock:
                if task_id in tasks:
                    tasks[task_id]["status"] = "error"
                    tasks[task_id]["error"] = str(e)

    thread = threading.Thread(target=run_organize)
    thread.daemon = True
    tasks[task_id]["thread"] = thread
    thread.start()

    return jsonify({"success": True, "task_id": task_id})


# ==================== 视频分割 API ====================

VIDEO_EXTENSIONS = {'.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.ts', '.mts', '.mpg', '.mpeg'}


def scan_video_files(folder_path):
    """递归扫描文件夹中的所有视频文件"""
    videos = []
    for root, dirs, files in os.walk(folder_path):
        dirs.sort()
        for f in sorted(files):
            if os.path.splitext(f)[1].lower() in VIDEO_EXTENSIONS:
                videos.append(os.path.join(root, f))
    return videos


@app.route('/api/splitter/analyze', methods=['POST'])
def splitter_analyze():
    """分析文件夹中的视频"""
    data = request.json
    folder_path = data.get('video_path', '')

    # 兼容：如果传入的是单个视频文件，取其所在目录
    if folder_path and os.path.isfile(folder_path):
        folder_path = os.path.dirname(folder_path)

    if not folder_path or not os.path.isdir(folder_path):
        return jsonify({"success": False, "error": "无效的文件夹路径"})

    try:
        video_files = scan_video_files(folder_path)
        if not video_files:
            return jsonify({"success": False, "error": "文件夹中未找到视频文件"})

        splitter = VideoSplitter()
        videos_info = []
        total_needs_split = 0

        for vpath in video_files:
            try:
                video_info = splitter.get_video_info(vpath)
                needs_split = splitter.needs_splitting(video_info)
                num_segments = splitter.calculate_segments(video_info) if needs_split else 1
                if needs_split:
                    total_needs_split += 1
                videos_info.append({
                    "path": vpath,
                    "filename": video_info.filename,
                    "duration": video_info.duration,
                    "duration_str": video_info.duration_str,
                    "width": video_info.width,
                    "height": video_info.height,
                    "fps": round(video_info.fps, 2),
                    "codec": video_info.codec,
                    "needs_split": needs_split,
                    "num_segments": num_segments
                })
            except Exception:
                continue

        if not videos_info:
            return jsonify({"success": False, "error": "未能解析任何视频文件"})

        return jsonify({
            "success": True,
            "folder": folder_path,
            "total_videos": len(videos_info),
            "needs_split_count": total_needs_split,
            "videos": videos_info
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route('/api/splitter/split', methods=['POST'])
def splitter_split():
    """分割视频（就地生成，保持文件夹结构）"""
    data = request.json
    video_paths = data.get('video_paths', [])
    overwrite = data.get('overwrite', False)

    if not video_paths:
        return jsonify({"success": False, "error": "没有选择要分割的视频"})

    for vp in video_paths:
        if not os.path.isfile(vp):
            return jsonify({"success": False, "error": f"无效的视频文件: {os.path.basename(vp)}"})

    task_id = f"splitter_{int(time.time())}"

    # 创建 splitter 实例并保存到任务中
    splitter = VideoSplitter(
        target_duration_seconds=data.get('target_duration', 1800),
        search_range_seconds=data.get('search_range', 60),
        silence_threshold_db=data.get('silence_threshold', -40),
        min_silence_duration=data.get('min_silence', 0.5),
        long_silence_threshold=data.get('long_silence_threshold', 300)
    )

    def run_split():
        try:
            all_output_files = []
            total = len(video_paths)

            # 初始进度更新
            with task_lock:
                if task_id in tasks:
                    tasks[task_id]["progress"] = 0.01
                    tasks[task_id]["message"] = f"开始处理 {total} 个视频..."

            for idx, video_path in enumerate(video_paths):
                # 检查是否已停止
                if splitter.is_stopped():
                    with task_lock:
                        if task_id in tasks:
                            tasks[task_id]["status"] = "stopped"
                            tasks[task_id]["message"] = "任务已停止"
                    return

                video_name = os.path.basename(video_path)
                # 输出目录就是源文件所在目录
                output_dir = os.path.dirname(video_path)

                cur_idx = idx  # 闭包捕获

                def progress_callback(message, percent, _idx=cur_idx, _name=video_name):
                    # percent 是 0-1 的值，表示当前视频的进度
                    overall = (_idx + percent) / total
                    with task_lock:
                        if task_id in tasks:
                            tasks[task_id]["progress"] = max(0.01, overall)  # 至少保持 1%
                            tasks[task_id]["message"] = f"[{_idx+1}/{total}] {_name}: {message}"

                # 更新开始处理当前视频
                with task_lock:
                    if task_id in tasks:
                        tasks[task_id]["progress"] = idx / total
                        tasks[task_id]["message"] = f"[{idx+1}/{total}] {video_name}: 正在分析..."

                try:
                    output_files = splitter.split_video(video_path, output_dir, progress_callback)
                    all_output_files.extend(output_files)
                except RuntimeError as e:
                    if "已停止" in str(e):
                        with task_lock:
                            if task_id in tasks:
                                tasks[task_id]["status"] = "stopped"
                                tasks[task_id]["message"] = "任务已停止"
                        return
                    raise

                # 覆盖模式：分割成功后删除源文件
                if overwrite and len(output_files) > 1:
                    try:
                        os.remove(video_path)
                    except OSError:
                        pass

            # 记录统计
            if all_output_files:
                record_usage('video_split', len(all_output_files))
                broadcast_statistics_update()

            with task_lock:
                if task_id in tasks:
                    tasks[task_id]["status"] = "completed"
                    tasks[task_id]["result"] = {
                        "output_files": all_output_files,
                        "total_videos": total,
                        "overwrite": overwrite
                    }
        except Exception as e:
            with task_lock:
                if task_id in tasks:
                    tasks[task_id]["status"] = "error"
                    tasks[task_id]["error"] = str(e)

    thread = threading.Thread(target=run_split)
    thread.daemon = True
    thread.start()

    with task_lock:
        tasks[task_id] = {
            "type": "splitter",
            "status": "running",
            "progress": 0,
            "message": "初始化...",
            "splitter": splitter,
            "thread": thread,
        }

    return jsonify({"success": True, "task_id": task_id})


# ==================== 片头添加 API ====================

@app.route('/api/intro/analyze', methods=['POST'])
def intro_analyze():
    """分析片头和视频"""
    data = request.json
    intro_path = data.get('intro_path', '')
    video_dir = data.get('video_dir', '')
    
    if not intro_path or not os.path.isfile(intro_path):
        return jsonify({"success": False, "error": "无效的片头文件"})
    
    if not video_dir or not os.path.isdir(video_dir):
        return jsonify({"success": False, "error": "无效的视频目录"})
    
    try:
        adder = IntroAdder()
        intro_info = get_intro_video_info(intro_path)
        video_files = adder.get_video_files_recursive(video_dir, intro_path)
        
        return jsonify({
            "success": True,
            "intro_info": intro_info,
            "video_count": len(video_files),
            "videos": video_files
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route('/api/intro/process', methods=['POST'])
def intro_process():
    """处理片头添加"""
    data = request.json
    intro_path = data.get('intro_path', '')
    video_dir = data.get('video_dir', '')
    output_dir = data.get('output_dir', '')
    overwrite_source = data.get('overwrite_source', False)
    
    if not intro_path or not os.path.isfile(intro_path):
        return jsonify({"success": False, "error": "无效的片头文件"})
    
    if not video_dir or not os.path.isdir(video_dir):
        return jsonify({"success": False, "error": "无效的视频目录"})
    
    task_id = f"intro_{int(time.time())}"

    def run_process():
        try:
            adder = IntroAdder()

            # 初始进度更新
            with task_lock:
                if task_id in tasks:
                    tasks[task_id]["progress"] = 0.01
                    tasks[task_id]["message"] = "开始处理..."

            def progress_callback(progress_data):
                current = progress_data.get("current", 0)
                total = progress_data.get("total", 1)
                step_percent = progress_data.get("percent", 0) / 100  # 当前文件的进度 (0-1)

                # 计算整体进度: (已完成文件数 + 当前文件进度) / 总文件数
                overall_progress = ((current - 1) + step_percent) / total if total > 0 else 0

                with task_lock:
                    if task_id in tasks:
                        tasks[task_id]["progress"] = max(0.01, min(0.99, overall_progress))
                        tasks[task_id]["message"] = progress_data.get("message", "")
                        tasks[task_id]["current"] = current
                        tasks[task_id]["total"] = total
            
            result = adder.process_videos(
                intro_path, video_dir, output_dir,
                overwrite_source, progress_callback
            )
            
            # 记录统计
            if result.get('success_count'):
                record_usage('add_intro', result.get('success_count', 0))
                broadcast_statistics_update()

            with task_lock:
                if task_id in tasks:
                    tasks[task_id]["status"] = "completed"
                    tasks[task_id]["result"] = result
        except Exception as e:
            with task_lock:
                if task_id in tasks:
                    tasks[task_id]["status"] = "error"
                    tasks[task_id]["error"] = str(e)
    
    thread = threading.Thread(target=run_process)
    thread.daemon = True
    thread.start()
    
    with task_lock:
        tasks[task_id] = {
            "type": "intro",
            "status": "running",
            "thread": thread,
            "progress": 0,
            "message": "准备开始...",
            "current": 0,
            "total": 0
        }
    
    return jsonify({"success": True, "task_id": task_id})


# ==================== 文案生成 API ====================

@app.route('/api/copywriter/scrape', methods=['POST'])
def copywriter_scrape():
    """抓取网页内容"""
    data = request.json
    url = data.get('url', '')
    
    if not url:
        return jsonify({"success": False, "error": "URL 不能为空"})
    
    try:
        copywriter = Copywriter()
        success, content = copywriter.scrape_url(url)
        
        if success:
            task_id = f"copywriter_{int(time.time())}"
            with task_lock:
                tasks[task_id] = {
                    "type": "copywriter",
                    "copywriter": copywriter,
                    "status": "ready"
                }
            
            return jsonify({
                "success": True,
                "task_id": task_id,
                "content": content
            })
        else:
            return jsonify({"success": False, "error": content})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route('/api/copywriter/set-content', methods=['POST'])
def copywriter_set_content():
    """手动设置内容"""
    data = request.json
    content = data.get('content', '')
    
    if not content:
        return jsonify({"success": False, "error": "内容不能为空"})
    
    try:
        copywriter = Copywriter()
        copywriter.set_content(content)
        
        task_id = f"copywriter_{int(time.time())}"
        with task_lock:
            tasks[task_id] = {
                "type": "copywriter",
                "copywriter": copywriter,
                "status": "ready"
            }
        
        return jsonify({"success": True, "task_id": task_id})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route('/api/copywriter/generate-titles', methods=['POST'])
def copywriter_generate_titles():
    """生成标题"""
    data = request.json
    task_id = data.get('task_id', '')
    api_key = data.get('api_key', '')
    api_base = data.get('api_base', '')
    model = data.get('model', 'gpt-4o')
    prompt_template = data.get('prompt_template')
    
    if not task_id or task_id not in tasks:
        return jsonify({"success": False, "error": "无效的任务 ID"})
    
    if not api_key:
        return jsonify({"success": False, "error": "API Key 不能为空"})
    
    try:
        task = tasks[task_id]
        copywriter = task["copywriter"]

        copywriter.set_api_config(api_key, api_base)

        success, titles, error = copywriter.generate_titles(model=model, prompt_template=prompt_template)

        if success:
            return jsonify({"success": True, "titles": titles})
        else:
            return jsonify({"success": False, "error": error})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route('/api/copywriter/generate-copy', methods=['POST'])
def copywriter_generate_copy():
    """生成文案"""
    data = request.json
    task_id = data.get('task_id', '')
    selected_title = data.get('selected_title', '')
    api_key = data.get('api_key', '')
    api_base = data.get('api_base', '')
    model = data.get('model', 'gpt-4o')
    prompt_template = data.get('prompt_template')
    
    if not task_id or task_id not in tasks:
        return jsonify({"success": False, "error": "无效的任务 ID"})
    
    if not selected_title:
        return jsonify({"success": False, "error": "请选择标题"})
    
    try:
        task = tasks[task_id]
        copywriter = task["copywriter"]

        copywriter.set_api_config(api_key, api_base)

        success, copy_text = copywriter.generate_copy(selected_title, model=model, prompt_template=prompt_template)
        
        if success:
            # 记录统计
            record_usage('course', 1)
            broadcast_statistics_update()
            return jsonify({"success": True, "copy": copy_text})
        else:
            return jsonify({"success": False, "error": copy_text})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route('/api/copywriter/generate-image', methods=['POST'])
def copywriter_generate_image():
    """生成封面图"""
    data = request.json
    task_id = data.get('task_id', '')
    api_key = data.get('api_key', '')
    api_base = data.get('api_base', '')
    model = data.get('model', 'dall-e-3')
    ref_image_path = data.get('ref_image_path', '')
    copy_text = data.get('copy_text', '')  # 可选的文案内容
    title = data.get('title', '')  # 可选的标题
    prompt_template = data.get('prompt_template')

    if not task_id or task_id not in tasks:
        return jsonify({"success": False, "error": "无效的任务 ID"})

    if not api_key:
        return jsonify({"success": False, "error": "API Key 不能为空"})

    try:
        task = tasks[task_id]
        copywriter = task["copywriter"]

        copywriter.set_api_config(api_key, api_base)

        success, img, error = copywriter.generate_cover_image(model=model, ref_image_path=ref_image_path, copy_text=copy_text, title=title, prompt_template=prompt_template)

        if success and img:
            # Convert PIL Image to base64
            buf = io.BytesIO()
            img.save(buf, format='PNG')
            img_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')

            # 记录统计 - 封面生成
            record_usage('cover', 1)
            broadcast_statistics_update()

            return jsonify({"success": True, "image_base64": img_base64})
        else:
            return jsonify({"success": False, "error": error})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route('/api/copywriter/upload-image', methods=['POST'])
def copywriter_upload_image():
    """上传封面图"""
    if 'image' not in request.files:
        return jsonify({"success": False, "error": "没有上传图片"})

    file = request.files['image']
    if file.filename == '':
        return jsonify({"success": False, "error": "没有选择文件"})

    # 检查文件类型
    allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in allowed_extensions:
        return jsonify({"success": False, "error": f"不支持的图片格式: {ext}"})

    try:
        # 读取图片并转为 base64
        img_bytes = file.read()
        img_base64 = base64.b64encode(img_bytes).decode('utf-8')

        # 保存到 uploads 目录
        filename = f"cover_{int(time.time())}.{ext}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        with open(filepath, 'wb') as f:
            f.write(img_bytes)

        return jsonify({
            "success": True,
            "image_base64": img_base64,
            "filename": filename,
            "filepath": filepath
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


# ==================== 视频压缩 API ====================

@app.route('/api/compress/scan', methods=['POST'])
def compress_scan():
    """扫描文件夹中的视频（支持整理模式）"""
    data = request.json
    folder = data.get('folder', '')
    recursive = data.get('recursive', True)

    if not folder or not os.path.isdir(folder):
        return jsonify({"success": False, "error": "无效的文件夹路径"})

    try:
        # 使用新的 scan_videos_with_reorg 方法
        videos, reorg_mode = compressor.scan_videos_with_reorg(folder, recursive=recursive)
        print(f"[DEBUG] Scanned {folder}, found {len(videos)} videos, recursive={recursive}, reorg_mode={reorg_mode}")

        return jsonify({
            "success": True,
            "videos": videos,
            "total": len(videos),
            "reorg_mode": reorg_mode
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route('/api/compress/create-tasks', methods=['POST'])
def compress_create_tasks():
    """创建压缩任务（支持整理模式）"""
    data = request.json
    videos = data.get('videos', [])
    settings = data.get('settings', {})

    if not videos:
        return jsonify({"success": False, "error": "没有选择视频"})

    # 保存 delete_video_out 设置供后续使用
    delete_video_out = settings.get('delete_video_out', False)

    # 收集所有 _video_out 目录（用于后续删除）
    video_out_dirs = set()

    try:
        task_ids = []
        for video in videos:
            # 支持两种格式：
            # 1. 字符串路径（旧格式）
            # 2. 包含 path 和 reorg 的对象（新格式）
            if isinstance(video, str):
                path = video
                reorg_info = None
            else:
                path = video.get('path', '')
                reorg_info = video.get('reorg')

            if path and os.path.exists(path):
                # 收集 _video_out 目录
                if '_video_out' in path:
                    # 找到 _video_out 目录的路径
                    path_parts = path.split(os.sep)
                    for i, part in enumerate(path_parts):
                        if part == '_video_out':
                            video_out_dir = os.sep.join(path_parts[:i+1])
                            video_out_dirs.add(video_out_dir)
                            break

                if reorg_info:
                    # 整理模式
                    task_id = compressor.create_reorg_task(path, reorg_info, settings)
                else:
                    # 普通模式
                    task_id = compressor.create_task(path, settings)
                task_ids.append(task_id)

        # 存储要删除的目录列表（在全部完成后删除）
        if delete_video_out and video_out_dirs:
            with task_lock:
                tasks[f"compress_cleanup_{int(time.time())}"] = {
                    "type": "compress_cleanup",
                    "video_out_dirs": list(video_out_dirs),
                    "task_ids": task_ids,
                }

        return jsonify({
            "success": True,
            "task_ids": task_ids,
            "total": len(task_ids),
            "video_out_dirs": list(video_out_dirs) if delete_video_out else []
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@socketio.on('start_compression')
def handle_start_compression(data):
    """SocketIO: 开始压缩"""
    task_ids = data.get('task_ids', [])

    def progress_callback(task_id, progress, message):
        socketio.emit('progress', {
            'task_id': task_id,
            'progress': progress,
            'message': message
        })

    for task_id in task_ids:
        compressor.start_compress_task(task_id, progress_callback)


@app.route('/api/compress/start', methods=['POST'])
def compress_start():
    """HTTP: 开始压缩任务（用于非 SocketIO 模式）"""
    data = request.json
    task_ids = data.get('task_ids', [])

    if not task_ids:
        return jsonify({"success": False, "error": "没有任务"})

    try:
        for task_id in task_ids:
            # 不带回调启动（使用轮询获取进度）
            compressor.start_compress_task(task_id, None)

        return jsonify({"success": True, "started": len(task_ids)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route('/api/compress/tasks', methods=['GET'])
def compress_tasks():
    """获取所有压缩任务"""
    try:
        all_tasks = compressor.get_all_tasks()

        # 检查是否所有任务都完成了，如果是，执行清理
        task_list = list(all_tasks)
        all_done = all(t.status in ('completed', 'failed', 'error') for t in task_list) if task_list else False

        if all_done and task_list:
            # 检查是否需要删除 _video_out 文件夹
            with task_lock:
                cleanup_keys = [k for k in tasks if k.startswith('compress_cleanup_')]
                for cleanup_key in cleanup_keys:
                    cleanup_task = tasks.get(cleanup_key)
                    if cleanup_task:
                        # 检查这批任务是否都完成
                        cleanup_task_ids = set(cleanup_task.get('task_ids', []))
                        current_task_ids = set(t.id for t in task_list)
                        if cleanup_task_ids.issubset(current_task_ids):
                            # 删除 _video_out 目录
                            video_out_dirs = cleanup_task.get('video_out_dirs', [])
                            for dir_path in video_out_dirs:
                                try:
                                    if os.path.exists(dir_path) and os.path.isdir(dir_path):
                                        import shutil
                                        shutil.rmtree(dir_path)
                                        print(f"[DEBUG] Deleted _video_out folder: {dir_path}")
                                except Exception as e:
                                    print(f"[DEBUG] Failed to delete {dir_path}: {e}")
                            # 移除清理任务
                            del tasks[cleanup_key]

        return jsonify({
            "success": True,
            "tasks": [
                {
                    "id": t.id,
                    "input_path": t.input_path,
                    "output_path": t.output_path,
                    "status": t.status,
                    "progress": t.progress,
                    "message": t.message,
                    "input_size": t.input_size,
                    "output_size": t.output_size,
                    "reorg": t.reorg
                }
                for t in task_list
            ]
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route('/api/compress/cancel/<task_id>', methods=['POST'])
def compress_cancel(task_id):
    """取消压缩任务"""
    try:
        success = compressor.cancel_task(task_id)
        return jsonify({"success": success})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route('/api/compress/clear', methods=['POST'])
def compress_clear():
    """清理已完成的任务"""
    try:
        count = compressor.clear_completed()
        return jsonify({"success": True, "cleared": count})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route('/api/compress/delete-video-out', methods=['POST'])
def compress_delete_video_out():
    """删除 _video_out 文件夹"""
    data = request.json
    dirs = data.get('dirs', [])

    deleted = []
    failed = []

    for dir_path in dirs:
        try:
            if os.path.exists(dir_path) and os.path.isdir(dir_path):
                # 确保是 _video_out 文件夹
                if '_video_out' in dir_path:
                    import shutil
                    shutil.rmtree(dir_path)
                    deleted.append(dir_path)
                    print(f"[DEBUG] Deleted _video_out folder: {dir_path}")
                else:
                    failed.append({"path": dir_path, "error": "Not a _video_out folder"})
            else:
                failed.append({"path": dir_path, "error": "Folder not found"})
        except Exception as e:
            failed.append({"path": dir_path, "error": str(e)})

    return jsonify({
        "success": True,
        "deleted": deleted,
        "failed": failed
    })


@app.route('/api/compress/download/<task_id>')
def compress_download(task_id):
    """下载压缩后的视频"""
    try:
        task = compressor.get_task(task_id)
        if task and task.status == 'completed' and os.path.exists(task.output_path):
            return send_file(task.output_path, as_attachment=True)
        else:
            return jsonify({"success": False, "error": "文件不存在"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


# ==================== 任务状态 API ====================

@app.route('/api/task/<task_id>')
def get_task_status(task_id):
    """获取任务状态"""
    with task_lock:
        if task_id not in tasks:
            return jsonify({"success": False, "error": "任务不存在"})

        task = tasks[task_id].copy()
        task.pop("thread", None)
        task.pop("renamer", None)
        task.pop("copywriter", None)
        task.pop("splitter", None)

        return jsonify({"success": True, "task": task})


@app.route('/api/task/<task_id>/stop', methods=['POST'])
def stop_task(task_id):
    """停止任务"""
    with task_lock:
        if task_id not in tasks:
            return jsonify({"success": False, "error": "任务不存在"})

        task = tasks[task_id]

        # 停止 AI 重命名器
        if "renamer" in task:
            task["renamer"].stop()

        # 停止视频分割器
        if "splitter" in task:
            task["splitter"].stop()

        task["status"] = "stopped"

        return jsonify({"success": True})


@app.route('/api/tasks')
def list_tasks():
    """列出所有任务"""
    with task_lock:
        task_list = []
        for task_id, task in tasks.items():
            task_copy = {
                "id": task_id,
                "type": task.get("type"),
                "status": task.get("status"),
                "progress": task.get("progress", 0),
                "message": task.get("message", "")
            }
            task_list.append(task_copy)
        
        return jsonify({"success": True, "tasks": task_list})


# ==================== 文件浏览 API ====================

@app.route('/api/browse', methods=['POST'])
def browse_folder():
    """浏览文件夹内容"""
    data = request.json
    path = data.get('path', '')
    
    if not path or not os.path.isdir(path):
        path = os.path.expanduser("~")
    
    try:
        items = []
        for item in os.listdir(path):
            item_path = os.path.join(path, item)
            items.append({
                "name": item,
                "path": item_path,
                "is_dir": os.path.isdir(item_path)
            })
        
        items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
        
        return jsonify({
            "success": True,
            "current_path": path,
            "parent_path": os.path.dirname(path) if path != os.path.dirname(path) else None,
            "items": items
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


# ==================== 统计 API ====================

@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    """获取统计数据"""
    try:
        stats = stats_manager.get_statistics(days=30)
        return jsonify({"success": True, "data": stats})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route('/api/statistics/record', methods=['POST'])
def record_statistics():
    """记录使用统计"""
    try:
        data = request.json
        program = data.get('program')
        count = data.get('count', 1)
        details = data.get('details')

        if not program:
            return jsonify({"success": False, "error": "缺少 program 参数"})

        record_usage(program, count, details)
        # 实时推送统计更新
        broadcast_statistics_update()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


def broadcast_statistics_update():
    """广播统计数据更新到所有客户端"""
    try:
        stats = stats_manager.get_statistics(days=30)
        socketio.emit('statistics_update', {'success': True, 'data': stats})
    except Exception as e:
        print(f"广播统计更新失败: {e}")


if __name__ == '__main__':
    print("=" * 60)
    print("视频工具箱 Web 版 (6合1)")
    print("=" * 60)
    print("\n包含功能:")
    print("  1. AI 批量重命名")
    print("  2. 视频字幕整理")
    print("  3. 视频智能分割")
    print("  4. 视频头添加")
    print("  5. 课程文案生成")
    print("  6. 视频压缩")
    print("\n访问地址: http://127.0.0.1:5001")
    print("=" * 60)
    socketio.run(app, host='0.0.0.0', port=5001, debug=False, allow_unsafe_werkzeug=True)
