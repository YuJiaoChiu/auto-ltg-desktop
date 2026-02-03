# -*- coding: utf-8 -*-
"""
视频片头添加模块
移植自 video-intro-adder-main/src/ffmpeg-handler.js
"""
import os
import json
import subprocess
import sys
import tempfile
import shutil
from typing import List, Tuple, Optional, Callable
from dataclasses import dataclass


def get_subprocess_flags():
    """获取 subprocess 的平台特定参数"""
    if sys.platform == "win32":
        return {"creationflags": subprocess.CREATE_NO_WINDOW}
    return {}


def run_ffmpeg(args: List[str]) -> Tuple[bool, str]:
    """执行 FFmpeg 命令"""
    try:
        result = subprocess.run(
            ["ffmpeg"] + args,
            capture_output=True, text=True, check=True,
            **get_subprocess_flags()
        )
        return True, ""
    except subprocess.CalledProcessError as e:
        return False, e.stderr


def get_video_info(video_path: str) -> dict:
    """获取视频信息"""
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "stream=width,height,r_frame_rate,codec_name,pix_fmt,sample_rate,channels,codec_type",
        "-show_entries", "format=duration",
        "-of", "json",
        video_path
    ]

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, check=True,
            **get_subprocess_flags()
        )
        data = json.loads(result.stdout)

        streams = data.get("streams", [])
        video_stream = {}
        audio_stream = {}
        for s in streams:
            if s.get("codec_type") == "video" and not video_stream:
                video_stream = s
            elif s.get("codec_type") == "audio" and not audio_stream:
                audio_stream = s

        format_info = data.get("format", {})

        return {
            "width": video_stream.get("width"),
            "height": video_stream.get("height"),
            "fps": video_stream.get("r_frame_rate"),
            "vcodec": video_stream.get("codec_name"),
            "pix_fmt": video_stream.get("pix_fmt"),
            "acodec": audio_stream.get("codec_name"),
            "sample_rate": audio_stream.get("sample_rate"),
            "channels": audio_stream.get("channels"),
            "duration": format_info.get("duration")
        }
    except Exception as e:
        raise RuntimeError(f"无法获取视频信息: {e}")


def get_encoder(codec: str) -> str:
    """获取视频编码器映射"""
    encoder_map = {
        "h264": "libx264",
        "hevc": "libx265",
        "h265": "libx265",
        "vp9": "libvpx-vp9",
        "vp8": "libvpx",
        "av1": "libaom-av1"
    }
    return encoder_map.get(codec, "libx264")


def get_audio_encoder(codec: str) -> str:
    """获取音频编码器映射"""
    encoder_map = {
        "aac": "aac",
        "mp3": "libmp3lame",
        "opus": "libopus",
        "vorbis": "libvorbis",
        "ac3": "ac3",
        "flac": "flac"
    }
    return encoder_map.get(codec, "aac")


def get_video_bsf(codec: str) -> Optional[str]:
    """获取视频比特流滤镜"""
    if codec == "h264":
        return "h264_mp4toannexb"
    if codec in ["hevc", "h265"]:
        return "hevc_mp4toannexb"
    return None


def parse_fps(fps_str: str) -> float:
    """解析帧率"""
    if not fps_str:
        return 30.0
    if "/" in str(fps_str):
        parts = str(fps_str).split("/")
        if len(parts) == 2:
            try:
                return int(parts[0]) / int(parts[1])
            except (ValueError, ZeroDivisionError):
                return 30.0
    try:
        return float(fps_str)
    except ValueError:
        return 30.0


class IntroAdder:
    """片头添加器"""
    
    VIDEO_EXTENSIONS = ('.mp4', '.mkv', '.mov', '.avi', '.wmv', '.flv', '.webm', '.m4v', '.ts')
    
    def __init__(self):
        self.temp_dir = None
        
    def get_video_files_recursive(
        self, directory: str, intro_path: str,
        progress_callback: Optional[Callable] = None
    ) -> List[str]:
        """递归获取视频文件"""
        results = []
        intro_path_abs = os.path.abspath(intro_path)
        
        for root, dirs, files in os.walk(directory):
            # 跳过 output 目录
            if "output" in [d.lower() for d in dirs]:
                dirs.remove("output")
                
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in self.VIDEO_EXTENSIONS:
                    file_path = os.path.join(root, file)
                    if os.path.abspath(file_path) != intro_path_abs:
                        rel_path = os.path.relpath(file_path, directory)
                        results.append(rel_path)
                        
        return results
    
    def transcode_intro_to_ts(
        self, intro_path: str, video_info: dict,
        output_path: str, progress_callback: Optional[Callable] = None
    ):
        """转码片头为 TS 格式"""
        width = video_info.get("width", 1920)
        height = video_info.get("height", 1080)
        fps = parse_fps(video_info.get("fps"))
        vcodec = video_info.get("vcodec", "h264")
        pix_fmt = video_info.get("pix_fmt", "yuv420p")
        acodec = video_info.get("acodec", "aac")
        sample_rate = video_info.get("sample_rate", 48000)
        channels = video_info.get("channels", 2)
        
        fps = round(fps * 100) / 100
        
        video_bsf = get_video_bsf(vcodec)
        
        args = [
            "-y",
            "-i", intro_path,
            "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,fps={fps},format={pix_fmt}",
            "-c:v", get_encoder(vcodec),
            "-preset", "fast",
            "-crf", "18",
            "-c:a", get_audio_encoder(acodec),
            "-ar", str(int(sample_rate) if sample_rate else 48000),
            "-ac", str(int(channels) if channels else 2),
        ]
        
        if video_bsf:
            args.extend(["-bsf:v", video_bsf])
            
        args.extend(["-f", "mpegts", output_path])
        
        success, error = run_ffmpeg(args)
        if not success:
            raise RuntimeError(f"转码片头失败: {error}")
    
    def convert_to_ts(
        self, input_path: str, output_path: str,
        vcodec: str, progress_callback: Optional[Callable] = None
    ):
        """将主视频转换为 TS 格式（不重新编码）"""
        video_bsf = get_video_bsf(vcodec)
        
        args = [
            "-y",
            "-i", input_path,
            "-c", "copy",
        ]
        
        if video_bsf:
            args.extend(["-bsf:v", video_bsf])
            
        args.extend(["-f", "mpegts", output_path])
        
        success, error = run_ffmpeg(args)
        if not success:
            raise RuntimeError(f"转换主视频失败: {error}")
    
    def concat_ts_files(
        self, ts_files: List[str], output_path: str, vcodec: str
    ):
        """拼接 TS 文件 - 使用 concat demuxer 确保时间戳正确"""
        # 创建 concat 文件列表
        concat_list_path = os.path.join(self.temp_dir, "concat_list.txt")
        with open(concat_list_path, 'w', encoding='utf-8') as f:
            for ts_file in ts_files:
                # 使用绝对路径并转义特殊字符
                escaped_path = ts_file.replace("'", "'\\''")
                f.write(f"file '{escaped_path}'\n")

        args = [
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_list_path,
            "-c", "copy",
            "-fflags", "+genpts",  # 重新生成时间戳
        ]

        # 如果输出是 MP4，需要添加音频比特流滤镜
        ext = os.path.splitext(output_path)[1].lower()
        if ext in ['.mp4', '.m4v', '.mov']:
            args.extend(["-bsf:a", "aac_adtstoasc"])

        args.extend(["-movflags", "+faststart", output_path])

        success, error = run_ffmpeg(args)

        # 清理 concat 列表文件
        try:
            os.unlink(concat_list_path)
        except:
            pass

        if not success:
            raise RuntimeError(f"拼接视频失败: {error}")
    
    def process_videos(
        self, intro_path: str, video_dir: str,
        output_dir: str = None, overwrite_source: bool = False,
        progress_callback: Optional[Callable] = None
    ) -> dict:
        """
        处理所有视频
        
        Args:
            intro_path: 片头视频路径
            video_dir: 视频目录
            output_dir: 输出目录（如果不覆盖源文件）
            overwrite_source: 是否覆盖源文件
            progress_callback: 进度回调函数
            
        Returns:
            {"success": bool, "success_count": int, "failed_count": int, "total": int}
        """
        video_files = self.get_video_files_recursive(video_dir, intro_path)
        
        if not video_files:
            return {
                "success": True,
                "success_count": 0,
                "failed_count": 0,
                "total": 0,
                "message": "未找到视频文件"
            }
        
        # 创建临时目录
        self.temp_dir = tempfile.mkdtemp(prefix="video-intro-")
        
        success_count = 0
        failed_count = 0
        
        for i, relative_path in enumerate(video_files):
            video_path = os.path.join(video_dir, relative_path)
            ext = os.path.splitext(relative_path)[1]
            
            if progress_callback:
                progress_callback({
                    "current": i + 1,
                    "total": len(video_files),
                    "filename": relative_path,
                    "status": "processing",
                    "percent": 0,
                    "message": f"正在处理 ({i + 1}/{len(video_files)}): {relative_path}"
                })
            
            try:
                # 步骤 1: 获取主视频信息
                video_info = get_video_info(video_path)
                
                if progress_callback:
                    progress_callback({
                        "current": i + 1,
                        "total": len(video_files),
                        "filename": relative_path,
                        "status": "processing",
                        "percent": 15,
                        "message": f"转码片头中: {relative_path}"
                    })
                
                # 步骤 2: 转码片头为 TS 格式
                intro_ts = os.path.join(self.temp_dir, f"intro_{i}.ts")
                self.transcode_intro_to_ts(intro_path, video_info, intro_ts)
                
                if progress_callback:
                    progress_callback({
                        "current": i + 1,
                        "total": len(video_files),
                        "filename": relative_path,
                        "status": "processing",
                        "percent": 45,
                        "message": f"转换主视频格式: {relative_path}"
                    })
                
                # 步骤 3: 将主视频转换为 TS 格式
                video_ts = os.path.join(self.temp_dir, f"video_{i}.ts")
                self.convert_to_ts(video_path, video_ts, video_info.get("vcodec", "h264"))
                
                if progress_callback:
                    progress_callback({
                        "current": i + 1,
                        "total": len(video_files),
                        "filename": relative_path,
                        "status": "processing",
                        "percent": 70,
                        "message": f"拼接视频中: {relative_path}"
                    })
                
                # 确定输出路径
                if overwrite_source:
                    temp_output_path = os.path.join(self.temp_dir, f"output_{i}{ext}")
                    final_output_path = video_path
                else:
                    if output_dir:
                        base_output_dir = output_dir
                    else:
                        # 默认输出到 video_dir/output/ 目录
                        base_output_dir = os.path.join(video_dir, "output")

                    final_output_path = os.path.join(base_output_dir, relative_path)

                    # 确保输出目录存在
                    output_parent = os.path.dirname(final_output_path)
                    os.makedirs(output_parent, exist_ok=True)
                    temp_output_path = final_output_path

                    # 打印调试信息
                    print(f"[DEBUG] overwrite_source={overwrite_source}, output to: {final_output_path}")
                
                # 步骤 4: 拼接 TS 文件
                self.concat_ts_files([intro_ts, video_ts], temp_output_path, video_info.get("vcodec", "h264"))
                
                # 清理临时文件
                try:
                    os.unlink(intro_ts)
                    os.unlink(video_ts)
                except:
                    pass
                
                # 覆盖模式：替换原文件
                if overwrite_source and temp_output_path != final_output_path:
                    os.unlink(video_path)
                    shutil.move(temp_output_path, final_output_path)
                
                success_count += 1
                
                if progress_callback:
                    progress_callback({
                        "current": i + 1,
                        "total": len(video_files),
                        "filename": relative_path,
                        "status": "completed",
                        "percent": 100,
                        "message": f"完成: {relative_path}"
                    })
                    
            except Exception as e:
                failed_count += 1
                if progress_callback:
                    progress_callback({
                        "current": i + 1,
                        "total": len(video_files),
                        "filename": relative_path,
                        "status": "failed",
                        "percent": 100,
                        "message": f"失败: {relative_path} - {str(e)}"
                    })
        
        # 清理临时目录
        try:
            shutil.rmtree(self.temp_dir)
        except:
            pass
        
        return {
            "success": True,
            "success_count": success_count,
            "failed_count": failed_count,
            "total": len(video_files)
        }
