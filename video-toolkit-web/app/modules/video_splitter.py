# -*- coding: utf-8 -*-
"""
视频分割模块
移植自 video_splitter-main/core/
"""
import os
import sys
import tempfile
import subprocess
import json
import re
from typing import List, Tuple, Optional, Callable
from dataclasses import dataclass


def get_subprocess_flags():
    """获取 subprocess 的平台特定参数"""
    if sys.platform == "win32":
        return {"creationflags": subprocess.CREATE_NO_WINDOW}
    return {}


@dataclass
class SilenceRegion:
    """静音区域"""
    start: float
    end: float
    
    @property
    def duration(self) -> float:
        return self.end - self.start
    
    @property
    def center(self) -> float:
        return (self.start + self.end) / 2


@dataclass
class VideoInfo:
    """视频信息"""
    path: str
    duration: float
    width: int
    height: int
    fps: float
    codec: str
    audio_codec: str
    bitrate: Optional[int] = None
    
    @property
    def duration_str(self) -> str:
        hours = int(self.duration // 3600)
        minutes = int((self.duration % 3600) // 60)
        seconds = int(self.duration % 60)
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    
    @property
    def filename(self) -> str:
        return os.path.basename(self.path)
    
    @property
    def name_without_ext(self) -> str:
        return os.path.splitext(self.filename)[0]
    
    @property
    def extension(self) -> str:
        return os.path.splitext(self.filename)[1]


@dataclass
class SegmentInfo:
    """分割片段信息"""
    start: float
    end: float
    is_blank: bool
    index: int
    
    @property
    def duration(self) -> float:
        return self.end - self.start
    
    @property
    def duration_str(self) -> str:
        hours = int(self.duration // 3600)
        minutes = int((self.duration % 3600) // 60)
        seconds = int(self.duration % 60)
        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
        return f"{minutes:02d}:{seconds:02d}"


class AudioAnalyzer:
    """音频分析器"""
    
    def __init__(self, silence_threshold_db: int = -40, min_silence_duration: float = 0.5):
        self.silence_threshold_db = silence_threshold_db
        self.min_silence_duration = min_silence_duration
        
    def get_video_duration(self, video_path: str) -> float:
        """获取视频时长"""
        cmd = [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            video_path
        ]
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, check=True,
                **get_subprocess_flags()
            )
            return float(result.stdout.strip())
        except (subprocess.CalledProcessError, ValueError) as e:
            raise RuntimeError(f"无法获取视频时长: {e}")
    
    def detect_silence_regions(
        self, video_path: str,
        start_time: Optional[float] = None,
        end_time: Optional[float] = None,
        progress_callback: Optional[Callable[[str, float], None]] = None
    ) -> List[SilenceRegion]:
        """检测视频中的静音区域"""
        # 先获取视频时长用于计算进度
        total_duration = self.get_video_duration(video_path)

        cmd = ["ffmpeg", "-hide_banner", "-progress", "pipe:1"]

        if start_time is not None:
            cmd.extend(["-ss", str(start_time)])

        cmd.extend(["-i", video_path])

        if end_time is not None:
            if start_time is not None:
                duration = end_time - start_time
            else:
                duration = end_time
            cmd.extend(["-t", str(duration)])
            total_duration = duration

        cmd.extend([
            "-af", f"silencedetect=noise={self.silence_threshold_db}dB:d={self.min_silence_duration}",
            "-f", "null",
            "-"
        ])

        try:
            process = subprocess.Popen(
                cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                text=True, **get_subprocess_flags()
            )

            stderr_output = []
            import select
            import sys

            # 在非 Windows 系统上使用 select 进行非阻塞读取
            if sys.platform != "win32":
                import threading

                def read_stderr():
                    for line in process.stderr:
                        stderr_output.append(line)

                stderr_thread = threading.Thread(target=read_stderr)
                stderr_thread.daemon = True
                stderr_thread.start()

                # 读取 stdout 获取进度
                current_time = 0
                for line in process.stdout:
                    if line.startswith("out_time_ms="):
                        try:
                            time_ms = int(line.split("=")[1].strip())
                            current_time = time_ms / 1000000  # 转换为秒
                            if total_duration > 0 and progress_callback:
                                progress = min(current_time / total_duration, 0.99)
                                progress_callback(f"正在扫描静音区域 ({int(progress*100)}%)...", progress)
                        except (ValueError, IndexError):
                            pass

                process.wait(timeout=600)
                stderr_thread.join(timeout=1)
            else:
                # Windows 上使用简单的 communicate
                _, stderr = process.communicate(timeout=600)
                stderr_output = stderr.split('\n') if stderr else []

            output = ''.join(stderr_output) if isinstance(stderr_output, list) else stderr_output

        except subprocess.TimeoutExpired:
            process.kill()
            raise RuntimeError("静音检测超时，视频文件可能过大")
        except Exception as e:
            if process.poll() is None:
                process.kill()
            raise RuntimeError(f"音频分析失败: {e}")
        
        regions = self._parse_silence_output(output)
        
        if start_time is not None and start_time > 0:
            regions = [
                SilenceRegion(r.start + start_time, r.end + start_time)
                for r in regions
            ]
            
        return regions
    
    def _parse_silence_output(self, output: str) -> List[SilenceRegion]:
        """解析 FFmpeg silencedetect 输出"""
        regions = []
        current_start = None
        
        for line in output.split("\n"):
            if "silence_start:" in line:
                try:
                    parts = line.split("silence_start:")
                    current_start = float(parts[1].strip().split()[0])
                except (IndexError, ValueError):
                    continue
            elif "silence_end:" in line and current_start is not None:
                try:
                    parts = line.split("silence_end:")
                    end_part = parts[1].strip().split()[0]
                    end_time = float(end_part)
                    regions.append(SilenceRegion(current_start, end_time))
                    current_start = None
                except (IndexError, ValueError):
                    continue
                    
        return regions
    
    def find_silence_near_target(
        self, video_path: str, target_time: float,
        search_range: float = 60.0,
        progress_callback: Optional[Callable[[float], None]] = None
    ) -> Optional[float]:
        """在目标时间点附近寻找最佳静音分割点"""
        start_time = max(0, target_time - search_range)
        end_time = target_time + search_range
        
        regions = self.detect_silence_regions(
            video_path, start_time=start_time, end_time=end_time,
            progress_callback=progress_callback
        )
        
        if not regions:
            return None
            
        best_region = min(regions, key=lambda r: abs(r.center - target_time))
        return best_region.end
    
    def calculate_split_points_with_long_silence(
        self, video_path: str,
        target_segment_duration: float = 1800,
        search_range: float = 60.0,
        long_silence_threshold: float = 300.0,
        progress_callback: Optional[Callable[[str, float], None]] = None
    ) -> Tuple[List[float], List[Tuple[float, float, bool]]]:
        """计算分割点，同时处理长静音区域"""
        total_duration = self.get_video_duration(video_path)

        if progress_callback:
            progress_callback("正在扫描整个视频的静音区域...", 0.05)

        # 传递进度回调给静音检测
        def silence_progress(msg, p):
            if progress_callback:
                # 静音扫描占总进度的 0.05 到 0.5
                progress_callback(msg, 0.05 + p * 0.45)

        all_silence_regions = self.detect_silence_regions(video_path, progress_callback=silence_progress)

        long_silence_regions = [
            r for r in all_silence_regions
            if r.duration >= long_silence_threshold
        ]

        if progress_callback:
            progress_callback(f"发现 {len(long_silence_regions)} 个长静音区域", 0.55)

        if not long_silence_regions:
            split_points = self._calculate_normal_split_points(
                video_path, total_duration, target_segment_duration,
                search_range, progress_callback
            )
            segments = self._split_points_to_segments(split_points, total_duration)
            return split_points, segments

        # 处理长静音区域
        content_regions = self._get_content_regions(total_duration, long_silence_regions)

        if progress_callback:
            progress_callback("正在计算分割点...", 0.6)
            
        all_segments = []
        current_pos = 0.0
        
        for i, (content_start, content_end) in enumerate(content_regions):
            if content_start > current_pos:
                for silence in long_silence_regions:
                    if silence.start >= current_pos and silence.end <= content_start:
                        all_segments.append((silence.start, silence.end, True))
                        break
                        
            content_duration = content_end - content_start
            
            if content_duration >= target_segment_duration * 1.5:
                num_segments = round(content_duration / target_segment_duration)
                segment_duration = content_duration / num_segments
                
                for j in range(num_segments):
                    seg_start = content_start + j * segment_duration
                    if j < num_segments - 1:
                        target_time = content_start + (j + 1) * segment_duration
                        split_point = self.find_silence_near_target(
                            video_path, target_time, search_range
                        )
                        if split_point is not None and content_start < split_point < content_end:
                            seg_end = split_point
                        else:
                            seg_end = target_time
                    else:
                        seg_end = content_end
                        
                    all_segments.append((seg_start, seg_end, False))

                    if progress_callback:
                        progress = 0.6 + 0.35 * (i / len(content_regions))
                        progress_callback(f"正在分析第 {i+1}/{len(content_regions)} 个内容区域", progress)
            else:
                all_segments.append((content_start, content_end, False))

            current_pos = content_end

        if current_pos < total_duration:
            for silence in long_silence_regions:
                if silence.start >= current_pos:
                    all_segments.append((silence.start, silence.end, True))

        merged_segments = self._merge_short_silence_segments(all_segments, long_silence_threshold)
        split_points = [seg[1] for seg in merged_segments[:-1]]

        if progress_callback:
            progress_callback("分割点计算完成", 0.98)

        return split_points, merged_segments
    
    def _get_content_regions(
        self, total_duration: float,
        long_silence_regions: List[SilenceRegion]
    ) -> List[Tuple[float, float]]:
        """获取内容区域（非长静音区域）"""
        if not long_silence_regions:
            return [(0.0, total_duration)]
            
        sorted_silences = sorted(long_silence_regions, key=lambda r: r.start)
        
        content_regions = []
        current_pos = 0.0
        
        for silence in sorted_silences:
            if silence.start > current_pos:
                content_regions.append((current_pos, silence.start))
            current_pos = silence.end
            
        if current_pos < total_duration:
            content_regions.append((current_pos, total_duration))
            
        return content_regions
    
    def _merge_short_silence_segments(
        self, segments: List[Tuple[float, float, bool]],
        long_silence_threshold: float
    ) -> List[Tuple[float, float, bool]]:
        """合并短静音到上一段"""
        if not segments:
            return segments
            
        merged = [segments[0]]
        
        for i in range(1, len(segments)):
            current = segments[i]
            prev = merged[-1]
            
            if current[2] and (current[1] - current[0]) < long_silence_threshold:
                merged[-1] = (prev[0], current[1], prev[2])
            else:
                merged.append(current)
                
        return merged
    
    def _split_points_to_segments(
        self, split_points: List[float], total_duration: float
    ) -> List[Tuple[float, float, bool]]:
        """将分割点转换为片段列表"""
        segments = []
        start = 0.0
        
        for point in split_points:
            segments.append((start, point, False))
            start = point
            
        segments.append((start, total_duration, False))
        return segments
    
    def _calculate_normal_split_points(
        self, video_path: str, total_duration: float,
        target_segment_duration: float, search_range: float,
        progress_callback: Optional[Callable[[str, float], None]] = None
    ) -> List[float]:
        """计算普通分割点"""
        if total_duration < target_segment_duration * 1.5:
            return []
            
        num_segments = round(total_duration / target_segment_duration)
        if num_segments < 2:
            return []
            
        segment_duration = total_duration / num_segments
        target_times = [segment_duration * (i + 1) for i in range(num_segments - 1)]
        
        split_points = []
        for i, target_time in enumerate(target_times):
            if progress_callback:
                progress = 0.2 + 0.6 * ((i + 1) / len(target_times))
                progress_callback(f"正在分析分割点 {i + 1}/{len(target_times)}", progress)
                
            split_point = self.find_silence_near_target(video_path, target_time, search_range)
            
            if split_point is not None:
                split_points.append(split_point)
            else:
                split_points.append(target_time)
                
        return split_points


class VideoSplitter:
    """视频分割器"""

    def __init__(
        self, target_duration_seconds: int = 1800,
        search_range_seconds: int = 60,
        silence_threshold_db: int = -40,
        min_silence_duration: float = 0.5,
        long_silence_threshold: int = 300
    ):
        self.target_duration = target_duration_seconds
        self.search_range = search_range_seconds
        self.long_silence_threshold = long_silence_threshold
        self.audio_analyzer = AudioAnalyzer(
            silence_threshold_db=silence_threshold_db,
            min_silence_duration=min_silence_duration
        )
        self._stopped = False
        self._current_process = None

    def stop(self):
        """停止分割"""
        self._stopped = True
        if self._current_process:
            try:
                self._current_process.terminate()
            except:
                pass

    def is_stopped(self) -> bool:
        """检查是否已停止"""
        return self._stopped
        
    def get_video_info(self, video_path: str) -> VideoInfo:
        """获取视频详细信息"""
        cmd = [
            "ffprobe",
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height,r_frame_rate,codec_name",
            "-show_entries", "format=duration,bit_rate",
            "-of", "json",
            video_path
        ]
        
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, check=True,
                **get_subprocess_flags()
            )
            data = json.loads(result.stdout)
            
            stream = data.get("streams", [{}])[0]
            format_info = data.get("format", {})
            
            fps_str = stream.get("r_frame_rate", "30/1")
            if "/" in fps_str:
                num, den = map(int, fps_str.split("/"))
                fps = num / den if den != 0 else 30.0
            else:
                fps = float(fps_str)
                
            # 获取音频编码
            audio_cmd = [
                "ffprobe",
                "-v", "error",
                "-select_streams", "a:0",
                "-show_entries", "stream=codec_name",
                "-of", "default=noprint_wrappers=1:nokey=1",
                video_path
            ]
            audio_result = subprocess.run(
                audio_cmd, capture_output=True, text=True,
                **get_subprocess_flags()
            )
            audio_codec = audio_result.stdout.strip() or "aac"
            
            return VideoInfo(
                path=video_path,
                duration=float(format_info.get("duration", 0)),
                width=int(stream.get("width", 0)),
                height=int(stream.get("height", 0)),
                fps=fps,
                codec=stream.get("codec_name", "h264"),
                audio_codec=audio_codec,
                bitrate=int(format_info.get("bit_rate", 0)) if format_info.get("bit_rate") else None
            )
        except (subprocess.CalledProcessError, ValueError, KeyError) as e:
            raise RuntimeError(f"无法获取视频信息: {e}")
    
    def needs_splitting(self, video_info: VideoInfo) -> bool:
        """判断视频是否需要分割"""
        return video_info.duration >= self.target_duration * 1.5
    
    def calculate_segments(self, video_info: VideoInfo) -> int:
        """计算分割段数"""
        if not self.needs_splitting(video_info):
            return 1
        return round(video_info.duration / self.target_duration)
    
    def split_video(
        self, video_path: str, output_dir: str,
        progress_callback: Optional[Callable[[str, float], None]] = None
    ) -> List[Tuple[str, bool]]:
        """分割视频"""
        self._stopped = False
        video_info = self.get_video_info(video_path)

        if not self.needs_splitting(video_info):
            if progress_callback:
                progress_callback("视频时长不足，无需分割", 1.0)
            return [(video_path, False)]

        if self._stopped:
            raise RuntimeError("任务已停止")

        if progress_callback:
            progress_callback("正在分析音频，寻找静音分割点...", 0.1)

        split_points, segment_info = self.audio_analyzer.calculate_split_points_with_long_silence(
            video_path,
            target_segment_duration=self.target_duration,
            search_range=self.search_range,
            long_silence_threshold=self.long_silence_threshold,
            progress_callback=lambda msg, p: progress_callback(msg, 0.1 + p * 0.2) if progress_callback else None
        )

        if self._stopped:
            raise RuntimeError("任务已停止")

        os.makedirs(output_dir, exist_ok=True)

        output_files = []
        for i, (start_time, end_time, is_blank) in enumerate(segment_info):
            if self._stopped:
                if progress_callback:
                    progress_callback("任务已停止", 0)
                raise RuntimeError("任务已停止")

            if progress_callback:
                segment_progress = i / len(segment_info)
                status = "（空白）" if is_blank else ""
                progress_callback(
                    f"正在分割第 {i + 1}/{len(segment_info)} 段{status}...",
                    0.3 + segment_progress * 0.7
                )

            # 生成输出文件名
            if is_blank:
                output_filename = f"{video_info.name_without_ext}-{i + 1}-空白{video_info.extension}"
            else:
                output_filename = f"{video_info.name_without_ext}-{i + 1}{video_info.extension}"
            output_path = os.path.join(output_dir, output_filename)

            # 执行分割
            self._split_segment(video_path, output_path, start_time, end_time, video_info)
            output_files.append((output_path, is_blank))

        if progress_callback:
            progress_callback("分割完成", 1.0)
            
        return output_files
    
    def _split_segment(
        self, input_path: str, output_path: str,
        start_time: float, end_time: float, video_info: VideoInfo
    ):
        """分割视频片段"""
        duration = end_time - start_time
        
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-y",
            "-ss", str(start_time),
            "-i", input_path,
            "-t", str(duration),
            "-c", "copy",
            "-avoid_negative_ts", "make_zero",
            output_path
        ]
        
        try:
            subprocess.run(
                cmd, capture_output=True, text=True, check=True,
                **get_subprocess_flags()
            )
        except subprocess.CalledProcessError:
            # 如果 stream copy 失败，尝试重新编码
            cmd = [
                "ffmpeg",
                "-hide_banner",
                "-y",
                "-ss", str(start_time),
                "-i", input_path,
                "-t", str(duration),
                "-c:v", video_info.codec,
                "-c:a", video_info.audio_codec,
                output_path
            ]
            subprocess.run(
                cmd, capture_output=True, text=True, check=True,
                **get_subprocess_flags()
            )
