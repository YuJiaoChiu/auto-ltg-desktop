# -*- coding: utf-8 -*-
"""
视频压缩模块
移植自 video-compressor/app.py
功能：批量视频压缩、文件夹穿透、实时进度
"""
import os
import re
import json
import uuid
import shutil
import subprocess
import threading
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Tuple, Callable
from dataclasses import dataclass, field


# 支持的视频格式
VIDEO_EXTENSIONS = {'.mp4', '.mov', '.mkv', '.webm', '.avi', '.flv', '.wmv', '.m4v', '.3gp', '.ts'}

# 导入统计模块
try:
    from app.modules.statistics import record_usage
except ImportError:
    def record_usage(*args, **kwargs):
        pass


def get_subprocess_flags():
    """获取 subprocess 的平台特定参数"""
    import sys
    if sys.platform == "win32":
        return {"creationflags": subprocess.CREATE_NO_WINDOW}
    return {}


@dataclass
class CompressTask:
    """压缩任务"""
    id: str
    input_path: str
    output_path: str
    status: str = "pending"  # pending, running, completed, failed, cancelled
    progress: float = 0.0
    message: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    input_size: int = 0
    output_size: int = 0
    settings: Dict = field(default_factory=dict)
    error: str = ""
    reorg: Optional[Dict] = None  # 整理模式信息: {target_folder, category, delete_original}


class VideoCompressor:
    """视频压缩器"""

    # FFmpeg 预设选项 (速度 vs 压缩率)
    PRESETS = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast',
               'medium', 'slow', 'slower', 'veryslow']

    # 质量预设映射 (前端选项 -> CRF值和编码速度)
    # CRF: 0-51, 值越低质量越高，18-28 是常用范围
    QUALITY_PRESETS = {
        'high': {'crf': 20, 'preset': 'slow'},      # 高质量，文件较大
        'medium': {'crf': 26, 'preset': 'medium'},  # 均衡
        'low': {'crf': 32, 'preset': 'fast'},       # 低质量，文件最小
    }
    
    def __init__(self, output_folder: str = "output"):
        self.output_folder = output_folder
        self.tasks: Dict[str, CompressTask] = {}
        self.lock = threading.Lock()
        self.stop_events: Dict[str, threading.Event] = {}
        
        os.makedirs(output_folder, exist_ok=True)
    
    def _get_ffmpeg_path(self) -> str:
        """获取 FFmpeg 路径"""
        ffmpeg_path = shutil.which('ffmpeg')
        if ffmpeg_path:
            return ffmpeg_path
        
        # 常见安装路径 (macOS)
        common_paths = [
            '/opt/homebrew/bin/ffmpeg',
            '/usr/local/bin/ffmpeg',
            '/usr/bin/ffmpeg',
        ]
        for path in common_paths:
            if os.path.exists(path):
                return path
        
        return 'ffmpeg'
    
    def scan_videos(self, folder_path: str, recursive: bool = True) -> List[str]:
        """扫描文件夹中的视频"""
        videos = []
        folder = Path(folder_path)

        if not folder.exists() or not folder.is_dir():
            return videos

        pattern = '**/*' if recursive else '*'

        for file_path in folder.glob(pattern):
            if file_path.is_file() and file_path.suffix.lower() in VIDEO_EXTENSIONS:
                videos.append(str(file_path.absolute()))

        return sorted(videos)

    def _find_video_out_dirs(self, folder: Path) -> List[Path]:
        """递归查找所有包含 _video_out 的目录"""
        result = []
        for dirpath in folder.rglob('_video_out'):
            if dirpath.is_dir():
                result.append(dirpath.parent)
        return result

    def scan_videos_with_reorg(self, folder_path: str, recursive: bool = True) -> Tuple[List[Dict], bool]:
        """
        扫描文件夹，递归检测所有视频，如果包含 _video_out 则启用整理模式

        返回:
            (videos_list, reorg_mode)
            - videos_list: 包含 path, name, info, reorg 的字典列表
            - reorg_mode: 是否启用整理模式
        """
        folder = Path(folder_path)
        if not folder.exists() or not folder.is_dir():
            return [], False

        # 递归查找所有包含 _video_out 的目录
        reorg_parents = self._find_video_out_dirs(folder) if recursive else []
        has_video_out = len(reorg_parents) > 0
        print(f"[DEBUG] folder={folder}, recursive={recursive}, has_video_out={has_video_out}")

        videos = []
        processed_paths = set()

        # 无论是否有 _video_out，都先递归扫描所有视频
        if recursive:
            all_videos = list(folder.rglob('*'))
        else:
            all_videos = list(folder.glob('*'))

        print(f"[DEBUG] Found {len(all_videos)} files total")

        for file_path in all_videos:
            if not file_path.is_file():
                continue
            if file_path.suffix.lower() not in VIDEO_EXTENSIONS:
                continue

            abs_path = str(file_path.absolute())
            if abs_path in processed_paths:
                continue
            processed_paths.add(abs_path)

            # 判断这个视频是否在 _video_out 结构中
            reorg_info = None
            if has_video_out:
                for parent_dir in reorg_parents:
                    video_out_dir = parent_dir / '_video_out'

                    # 检查是否在 _video_out 内
                    try:
                        file_path.relative_to(video_out_dir)
                        # 在 _video_out 内 -> 中文朗读
                        reorg_info = {
                            'target_folder': str(parent_dir / '中文朗读'),
                            'category': '中文朗读',
                            'delete_original': True
                        }
                        break
                    except ValueError:
                        pass

                    # 检查是否与 _video_out 同级
                    if file_path.parent == parent_dir:
                        reorg_info = {
                            'target_folder': str(parent_dir / '原声视频'),
                            'category': '原声视频',
                            'delete_original': True
                        }
                        break

            videos.append({
                'path': abs_path,
                'name': file_path.name,
                'info': self.get_video_info(abs_path),
                'reorg': reorg_info
            })

        print(f"[DEBUG] Total videos found: {len(videos)}")
        return sorted(videos, key=lambda x: x['path']), has_video_out

    def create_reorg_task(self, input_path: str, reorg_info: Dict, settings: Dict = None) -> str:
        """创建带整理信息的压缩任务（先压缩到临时位置）"""
        task_id = str(uuid.uuid4())[:8]
        settings = settings.copy() if settings else {}

        # 获取视频时长用于进度计算
        if 'duration' not in settings:
            video_info = self.get_video_info(input_path)
            if video_info:
                settings['duration'] = video_info.get('duration', 0)

        input_file = Path(input_path)
        output_format = settings.get('format', input_file.suffix.lstrip('.') or 'mp4')

        # 临时输出到 output_folder
        temp_filename = f"{input_file.stem}_temp_{task_id}.{output_format}"
        temp_output_path = os.path.join(self.output_folder, temp_filename)

        os.makedirs(self.output_folder, exist_ok=True)

        task = CompressTask(
            id=task_id,
            input_path=input_path,
            output_path=temp_output_path,
            input_size=os.path.getsize(input_path) if os.path.exists(input_path) else 0,
            settings=settings,
            reorg=reorg_info
        )

        with self.lock:
            self.tasks[task_id] = task
            self.stop_events[task_id] = threading.Event()

        return task_id
    
    def get_video_info(self, video_path: str) -> Optional[Dict]:
        """获取视频信息"""
        try:
            ffprobe = self._get_ffmpeg_path().replace('ffmpeg', 'ffprobe')
            
            cmd = [
                ffprobe,
                '-v', 'error',
                '-select_streams', 'v:0',
                '-show_entries', 'stream=width,height,r_frame_rate,codec_name,duration',
                '-show_entries', 'format=size,duration',
                '-of', 'json',
                video_path
            ]
            
            result = subprocess.run(
                cmd, capture_output=True, text=True, check=True,
                **get_subprocess_flags()
            )
            
            data = json.loads(result.stdout)
            stream = data.get('streams', [{}])[0]
            format_info = data.get('format', {})
            
            # 解析帧率
            fps_str = stream.get('r_frame_rate', '30/1')
            if '/' in fps_str:
                num, den = map(int, fps_str.split('/'))
                fps = num / den if den != 0 else 30.0
            else:
                fps = float(fps_str)
            
            duration = float(stream.get('duration') or format_info.get('duration') or 0)
            size = int(format_info.get('size', 0))
            
            return {
                'width': stream.get('width', 0),
                'height': stream.get('height', 0),
                'fps': round(fps, 2),
                'codec': stream.get('codec_name', 'unknown'),
                'duration': duration,
                'duration_str': self._format_duration(duration),
                'size': size,
                'size_str': self._format_size(size)
            }
            
        except Exception as e:
            print(f"获取视频信息失败: {e}")
            return None
    
    def _format_duration(self, seconds: float) -> str:
        """格式化时长"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        
        if hours > 0:
            return f"{hours}:{minutes:02d}:{secs:02d}"
        return f"{minutes}:{secs:02d}"
    
    def _format_size(self, size_bytes: int) -> str:
        """格式化文件大小"""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} PB"
    
    def create_task(self, input_path: str, settings: Dict = None) -> str:
        """创建压缩任务"""
        task_id = str(uuid.uuid4())[:8]
        settings = settings.copy() if settings else {}

        # 获取视频时长用于进度计算
        if 'duration' not in settings:
            video_info = self.get_video_info(input_path)
            if video_info:
                settings['duration'] = video_info.get('duration', 0)

        # 生成输出路径
        input_file = Path(input_path)
        output_format = settings.get('format', input_file.suffix.lstrip('.') or 'mp4')

        if settings.get('overwrite', False):
            # 覆盖模式：先压缩到临时位置，完成后替换原文件
            temp_filename = f"{input_file.stem}_temp_{task_id}.{output_format}"
            output_path = os.path.join(self.output_folder, temp_filename)
            settings['_overwrite_original'] = input_path
        else:
            # 子文件夹模式：输出到原文件旁的 [compressed] 文件夹
            compressed_dir = input_file.parent / '[compressed]'
            output_filename = f"{input_file.stem}.{output_format}"
            output_path = str(compressed_dir / output_filename)

        # 确保输出目录存在
        os.makedirs(os.path.dirname(output_path) or self.output_folder, exist_ok=True)

        task = CompressTask(
            id=task_id,
            input_path=input_path,
            output_path=output_path,
            input_size=os.path.getsize(input_path) if os.path.exists(input_path) else 0,
            settings=settings
        )

        with self.lock:
            self.tasks[task_id] = task
            self.stop_events[task_id] = threading.Event()

        return task_id
    
    def compress(self, task_id: str, progress_callback: Callable = None) -> bool:
        """执行压缩"""
        with self.lock:
            if task_id not in self.tasks:
                return False
            task = self.tasks[task_id]
            stop_event = self.stop_events.get(task_id)
        
        task.status = "running"
        task.started_at = datetime.now()

        try:
            settings = task.settings

            # 只整理不压缩模式
            if settings.get('organize_only', False) and task.reorg:
                task.message = "正在整理文件..."
                try:
                    self._handle_organize_only(task)
                    task.progress = 100.0
                    task.status = "completed"
                    task.completed_at = datetime.now()
                    task.output_size = task.input_size
                    task.message = "整理完成！"
                    if progress_callback:
                        progress_callback(task_id, 100.0, task.message)
                    return True
                except Exception as e:
                    task.status = "failed"
                    task.message = f"整理失败: {str(e)}"
                    task.error = str(e)
                    return False

            task.message = "开始压缩..."

            # 构建 FFmpeg 命令
            cmd = [self._get_ffmpeg_path(), '-y', '-i', task.input_path]
            
            # 像素格式
            cmd.extend(['-pix_fmt', 'yuv420p'])

            # 视频编码器
            video_codec = settings.get('video_codec', 'libx264')
            cmd.extend(['-c:v', video_codec])

            # 纯 CRF 模式：-b:v 0 确保完全由 CRF 控制质量
            cmd.extend(['-b:v', '0'])

            # 获取质量预设 (high/medium/low) 或直接使用 CRF 值
            quality_preset = settings.get('preset', 'medium')
            if quality_preset in self.QUALITY_PRESETS:
                # 使用预定义的质量预设
                preset_config = self.QUALITY_PRESETS[quality_preset]
                crf = settings.get('crf', preset_config['crf'])
                ffmpeg_preset = preset_config['preset']
            else:
                # 直接使用 FFmpeg preset 或默认值
                crf = settings.get('crf', 26)
                ffmpeg_preset = quality_preset if quality_preset in self.PRESETS else 'medium'

            cmd.extend(['-crf', str(crf)])

            # 预设速度
            if ffmpeg_preset in self.PRESETS:
                cmd.extend(['-preset', ffmpeg_preset])

            # 量化参数
            cmd.extend(['-qp', '0'])

            # 快速启动（优化网络播放）
            cmd.extend(['-movflags', '+faststart'])

            # 分辨率
            resolution = settings.get('resolution', 'original')
            if resolution != 'original':
                cmd.extend(['-vf', f'scale={resolution}'])

            # 帧率
            fps = settings.get('fps', 'original')
            if fps != 'original':
                cmd.extend(['-r', str(fps)])

            # 音频处理
            if settings.get('remove_audio', False):
                cmd.extend(['-an'])  # 移除音频
            else:
                audio_codec = settings.get('audio_codec', 'aac')
                cmd.extend(['-c:a', audio_codec])
                cmd.extend(['-b:a', '128k'])
            
            # 输出文件
            cmd.append(task.output_path)
            
            # 执行压缩
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True,
                **get_subprocess_flags()
            )
            
            # 解析进度
            duration = task.settings.get('duration', 0)
            
            while True:
                if stop_event and stop_event.is_set():
                    process.terminate()
                    task.status = "cancelled"
                    task.message = "已取消"
                    return False
                
                line = process.stderr.readline()
                if not line:
                    break
                
                # 解析进度
                if 'time=' in line:
                    match = re.search(r'time=(\d+):(\d+):(\d+\.\d+)', line)
                    if match and duration > 0:
                        hours, minutes, seconds = map(float, match.groups())
                        current_time = hours * 3600 + minutes * 60 + seconds
                        progress = min(100, (current_time / duration) * 100)
                        task.progress = progress
                        task.message = f"压缩中... {progress:.1f}%"
                        
                        if progress_callback:
                            progress_callback(task_id, progress, task.message)
            
            process.wait()
            
            if process.returncode == 0:
                task.progress = 100.0
                task.completed_at = datetime.now()

                # 获取输出文件大小
                if os.path.exists(task.output_path):
                    task.output_size = os.path.getsize(task.output_path)
                    reduction = (1 - task.output_size / task.input_size) * 100 if task.input_size > 0 else 0

                    # 整理模式后处理
                    if task.reorg:
                        try:
                            self._handle_reorg_post_process(task)
                            task.message = f"压缩并整理完成！体积减小 {reduction:.1f}%"
                        except Exception as e:
                            task.status = "failed"
                            task.message = f"整理失败: {str(e)}"
                            task.error = str(e)
                            return False
                    elif settings.get('_overwrite_original'):
                        # 覆盖模式：用压缩文件替换原文件
                        try:
                            original_path = settings['_overwrite_original']
                            shutil.move(task.output_path, original_path)
                            task.output_path = original_path
                            task.message = f"压缩完成（已覆盖原文件）！体积减小 {reduction:.1f}%"
                        except Exception as e:
                            task.status = "failed"
                            task.message = f"覆盖原文件失败: {str(e)}"
                            task.error = str(e)
                            return False
                    else:
                        task.message = f"压缩完成！体积减小 {reduction:.1f}%"
                else:
                    task.message = "压缩完成"

                task.status = "completed"
                
                # 记录统计
                try:
                    record_usage('compress', 1)
                except:
                    pass
                
                return True
            else:
                task.status = "failed"
                task.message = f"FFmpeg 错误 (代码: {process.returncode})"
                return False
                
        except Exception as e:
            task.status = "failed"
            task.message = f"压缩失败: {str(e)}"
            task.error = str(e)
            return False
    
    def start_compress_task(self, task_id: str, progress_callback: Callable = None):
        """在后台线程启动压缩任务"""
        thread = threading.Thread(
            target=self.compress,
            args=(task_id, progress_callback),
            daemon=True
        )
        thread.start()
        return thread
    
    def cancel_task(self, task_id: str) -> bool:
        """取消任务"""
        with self.lock:
            if task_id in self.stop_events:
                self.stop_events[task_id].set()
                return True
            return False
    
    def get_task(self, task_id: str) -> Optional[CompressTask]:
        """获取任务状态"""
        return self.tasks.get(task_id)
    
    def get_all_tasks(self) -> List[CompressTask]:
        """获取所有任务"""
        return list(self.tasks.values())
    
    def clear_completed(self) -> int:
        """清理已完成的任务"""
        with self.lock:
            to_remove = [
                tid for tid, task in self.tasks.items()
                if task.status in ['completed', 'failed', 'cancelled']
            ]
            for tid in to_remove:
                del self.tasks[tid]
                if tid in self.stop_events:
                    del self.stop_events[tid]
            return len(to_remove)
    
    def _handle_organize_only(self, task: CompressTask):
        """只整理不压缩：直接移动文件到目标文件夹"""
        if not task.reorg:
            return

        reorg = task.reorg
        target_folder = Path(reorg['target_folder'])
        input_file = Path(task.input_path)

        # 创建目标文件夹
        os.makedirs(target_folder, exist_ok=True)

        # 移动到目标文件夹
        final_output = target_folder / input_file.name
        shutil.move(str(input_file), str(final_output))

        # 更新任务输出路径
        task.output_path = str(final_output)

    def _handle_reorg_post_process(self, task: CompressTask):
        """处理整理模式的后处理：移动压缩文件，删除原文件"""
        if not task.reorg:
            return

        reorg = task.reorg
        target_folder = Path(reorg['target_folder'])
        input_file = Path(task.input_path)
        temp_output = Path(task.output_path)

        # 创建目标文件夹
        os.makedirs(target_folder, exist_ok=True)

        # 最终输出路径：保持原文件名
        final_output = target_folder / input_file.name

        # 如果扩展名变了，使用新扩展名
        if temp_output.suffix.lower() != input_file.suffix.lower():
            final_output = target_folder / (input_file.stem + temp_output.suffix)

        # 移动压缩后的文件到目标文件夹
        shutil.move(str(temp_output), str(final_output))

        # 更新任务的输出路径
        task.output_path = str(final_output)

        # 删除原文件
        if reorg.get('delete_original', False):
            try:
                os.remove(task.input_path)
            except OSError as e:
                print(f"删除原文件失败: {e}")

    def get_compression_stats(self, task_id: str) -> Dict:
        """获取压缩统计"""
        task = self.get_task(task_id)
        if not task:
            return {}

        stats = {
            'input_size': task.input_size,
            'input_size_str': self._format_size(task.input_size),
            'output_size': task.output_size,
            'output_size_str': self._format_size(task.output_size),
        }

        if task.input_size > 0 and task.output_size > 0:
            stats['reduction'] = (1 - task.output_size / task.input_size) * 100
            stats['reduction_str'] = f"{stats['reduction']:.1f}%"

        return stats
