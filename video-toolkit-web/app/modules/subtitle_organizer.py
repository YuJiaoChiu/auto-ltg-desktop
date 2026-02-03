# -*- coding: utf-8 -*-
"""
视频字幕整理模块
移植自 auto-zh-cn-main/video_subtitle_organizer.py
"""
import os
import shutil
from pathlib import Path
from typing import Optional, List, Tuple, Callable
from dataclasses import dataclass


VIDEO_EXTENSIONS = {'.mp4', '.mkv', '.mov', '.avi', '.wmv', '.flv', '.webm', '.m4v'}
SUBTITLE_EXTENSIONS = {'.srt', '.ass', '.ssa', '.sub', '.vtt'}


@dataclass
class ProcessResult:
    """处理结果"""
    video_name: str
    subtitle_path: Optional[str]
    success: bool
    message: str


class SubtitleOrganizer:
    """视频字幕整理器"""
    
    VIDEOSRT_SUFFIX = "_压制"
    
    def __init__(self, callback: Optional[Callable] = None, videosrt_mode=False):
        self.callback = callback
        self.videosrt_mode = videosrt_mode
        self.processed_count = 0
        self.total_videos = 0
        self.results: List[ProcessResult] = []
        self.videosrt_folder: Optional[Path] = None
        
    def log(self, message: str):
        """记录日志"""
        if self.callback:
            self.callback(message)
            
    def find_videos_in_directory(self, directory: Path) -> List[Path]:
        """查找目录中的所有视频文件（非递归）"""
        videos = []
        try:
            for item in directory.iterdir():
                if item.is_file() and item.suffix.lower() in VIDEO_EXTENSIONS:
                    videos.append(item)
        except PermissionError:
            self.log(f"⚠️ 无权访问: {directory}")
        return videos
    
    def find_matching_subtitle(self, video_path: Path) -> Optional[Path]:
        """查找与视频匹配的字幕文件"""
        video_stem = video_path.stem
        video_dir = video_path.parent
        
        for ext in SUBTITLE_EXTENSIONS:
            subtitle_path = video_dir / f"{video_stem}{ext}"
            if subtitle_path.exists():
                return subtitle_path
        return None
    
    def find_videosrt_files(self, directory: Path) -> List[Tuple[Path, Optional[Path]]]:
        """递归查找所有带 _压制 后缀的视频文件及其匹配字幕"""
        results = []
        try:
            for root, dirs, files in os.walk(directory):
                # 跳过已处理的目录
                dirs[:] = [d for d in dirs if d not in ("_videosrt_processed", "_video_out")]
                root_path = Path(root)
                for filename in files:
                    item = root_path / filename
                    if item.suffix.lower() in VIDEO_EXTENSIONS and item.stem.endswith(self.VIDEOSRT_SUFFIX):
                        # 字幕文件名不带 _压制 后缀
                        base_name = item.stem[:-len(self.VIDEOSRT_SUFFIX)]
                        subtitle = None
                        for ext in SUBTITLE_EXTENSIONS:
                            subtitle_path = root_path / f"{base_name}{ext}"
                            if subtitle_path.exists():
                                subtitle = subtitle_path
                                break
                        results.append((item, subtitle))
        except PermissionError:
            self.log(f"⚠️ 无权访问: {directory}")
        return results
    
    def preprocess_videosrt_inplace(self, root_path: Path) -> List[Path]:
        """
        就地预处理 videosrt 文件（递归穿透所有子文件夹）：
        在原位重命名 _压制 视频文件，去除后缀，并保留字幕文件
        只处理有对应字幕的视频，跳过没有字幕的文件
        返回所有重命名后的视频路径
        """
        renamed_videos = []
        skipped_count = 0
        videosrt_files = self.find_videosrt_files(root_path)

        for video_path, subtitle_path in videosrt_files:
            # 跳过没有对应字幕的视频
            if subtitle_path is None:
                self.log(f"  ○ 跳过（无字幕）: {video_path.stem}{video_path.suffix}")
                skipped_count += 1
                continue

            original_video_stem = video_path.stem
            new_stem = original_video_stem[:-len(self.VIDEOSRT_SUFFIX)]
            video_dir = video_path.parent

            # 就地重命名视频文件
            new_video_path = video_dir / f"{new_stem}{video_path.suffix}"
            try:
                shutil.move(str(video_path), str(new_video_path))
                self.log(f"  ↳ 重命名: {original_video_stem}{video_path.suffix} → {new_stem}{video_path.suffix}")
                renamed_videos.append(new_video_path)
            except Exception as e:
                self.log(f"  ✗ 重命名失败: {original_video_stem} - {e}")

        self.log(f"📊 已重命名 {len(renamed_videos)} 个视频文件" + (f"，跳过 {skipped_count} 个无字幕文件" if skipped_count > 0 else ""))
        self.log("-" * 40)

        return renamed_videos
    
    def count_total_videos(self, root_path: Path) -> int:
        """统计视频总数"""
        count = 0
        for dirpath, _, filenames in os.walk(root_path):
            for filename in filenames:
                if Path(filename).suffix.lower() in VIDEO_EXTENSIONS:
                    count += 1
        return count
    
    def process_directory(self, directory: Path):
        """处理单个目录中的视频"""
        videos = self.find_videos_in_directory(directory)
        
        if videos:
            video_out_dir = directory / "_video_out"
            
            for video in videos:
                self.process_video(video, video_out_dir)
                
    def process_video(self, video_path: Path, video_out_dir: Path):
        """处理单个视频文件"""
        video_name = video_path.stem
        
        # 查找匹配字幕
        subtitle = self.find_matching_subtitle(video_path)
        
        if subtitle:
            # 只有找到字幕时才创建文件夹
            video_out_dir.mkdir(exist_ok=True)
            target_dir = video_out_dir / video_name
            target_dir.mkdir(exist_ok=True)
            
            target_ext = subtitle.suffix
            target_path = target_dir / f"zh-cn{target_ext}"
            
            try:
                shutil.copy2(str(subtitle), str(target_path))
                self.log(f"✓ {video_name}: 字幕已复制")
                self.results.append(ProcessResult(video_name, str(target_path), True, "字幕已复制"))
            except Exception as e:
                self.log(f"✗ {video_name}: 复制失败 - {e}")
                self.results.append(ProcessResult(video_name, None, False, str(e)))
        else:
            self.log(f"○ {video_name}: 未找到匹配字幕")
            self.results.append(ProcessResult(video_name, None, False, "未找到字幕"))
            
        self.processed_count += 1
        
    def process_root(self, root_path: str, progress_callback: Optional[Callable] = None) -> Tuple[int, int]:
        """
        处理根目录及其所有子目录
        
        Returns:
            (成功数, 总数)
        """
        root_path = Path(root_path)
        self.processed_count = 0
        self.results = []
        
        # VideoSRT 模式：只处理原本带 _压制 后缀的文件
        if self.videosrt_mode:
            self.log(f"🎬 VideoSRT 模式已启用")
            self.log(f"📂 扫描目录: {root_path}")
            self.log("-" * 40)

            # 预处理：就地重命名 _压制 文件，返回重命名后的视频路径列表
            renamed_videos = self.preprocess_videosrt_inplace(root_path)

            self.total_videos = len(renamed_videos)
            self.log(f"📊 准备处理 {self.total_videos} 个视频文件")
            self.log("-" * 40)

            # 只处理重命名后的视频，不处理其他视频
            for video_path in renamed_videos:
                video_out_dir = video_path.parent / "_video_out"
                self.process_video(video_path, video_out_dir)

                if progress_callback:
                    progress = self.processed_count / self.total_videos * 100 if self.total_videos > 0 else 100
                    progress_callback(f"处理进度: {self.processed_count}/{self.total_videos}", progress)
        else:
            # 普通模式：处理所有目录
            self.total_videos = self.count_total_videos(root_path)
            
            self.log(f"📂 开始扫描: {root_path}")
            self.log(f"📊 发现 {self.total_videos} 个视频文件")
            self.log("-" * 40)
            
            # 遍历所有目录
            for dirpath, dirnames, _ in os.walk(root_path):
                # 跳过 _video_out 和 _videosrt_processed 目录
                dirnames[:] = [d for d in dirnames if d not in ("_video_out", "_videosrt_processed")]
                self.process_directory(Path(dirpath))
                
                if progress_callback:
                    progress = self.processed_count / self.total_videos * 100 if self.total_videos > 0 else 100
                    progress_callback(f"处理进度: {self.processed_count}/{self.total_videos}", progress)
        
        success_count = sum(1 for r in self.results if r.success)
        missing_count = self.total_videos - success_count
        
        self.log("-" * 40)
        self.log(f"✅ 完成! 成功处理 {success_count}/{self.total_videos} 个字幕")
        
        # 列出没有字幕的视频
        if missing_count > 0:
            self.log("")
            self.log(f"⚠️ 以下 {missing_count} 个视频没有找到匹配字幕:")
            for result in self.results:
                if not result.success and result.message == "未找到字幕":
                    self.log(f"   • {result.video_name}")
                    
        return success_count, self.total_videos
