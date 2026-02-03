# -*- coding: utf-8 -*-
"""
AI 批量重命名模块
移植自 ai-batch-renamer-main/ai_renamer_v3.py
"""
import os
import re
import threading
from typing import List, Dict, Callable, Optional
from dataclasses import dataclass, field


DEFAULT_PROMPT_TEMPLATE = """
你是一位资深内容归档专家，擅长优化各类文件和文件夹的标题，确保标题专业、清晰、有条理，且风格统一。

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
- 每行一个文件名，格式：`序号|新标题`
- 序号从1开始，与输入列表一一对应
- 只输出新标题，不要包含文件扩展名

## 输出示例
```
1|透视素描 1
2|透视素描 2
3|色彩理论基础
4|光影表现技法
```

## 输入信息
**内容大背景**：{course_context}

**文件名列表**：
{file_list}

请根据上述要求，为每个文件生成统一风格的中文标题。
""".strip()

SUPPORTED_VIDEO_FORMATS = ['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.ts']
SUPPORTED_AUDIO_FORMATS = ['.mp3', '.wav', '.flac', '.m4a', '.ogg']
SUPPORTED_PDF_FORMATS = ['.pdf']


@dataclass
class RenameItem:
    """重命名项目"""
    item_id: str
    old_path: str
    original_name: str
    new_name: str = ""
    status: str = "pending"  # pending, processing, completed, error
    ext: str = ""


def sanitize_filename(filename):
    """清理文件名中的非法字符"""
    return re.sub(r'[\\/*?:"<>|]', "_", filename)


def get_relative_path(full_path, base_folder):
    """获取相对于基础文件夹的相对路径"""
    try:
        path_to_check = full_path if os.path.isdir(full_path) else os.path.dirname(full_path)
        rel_path = os.path.relpath(path_to_check, base_folder)
        return "根目录" if rel_path == "." else rel_path
    except Exception:
        return os.path.dirname(full_path)


class AIRenamer:
    """AI 批量重命名器"""
    
    def __init__(self, client=None):
        self.client = client
        self.items: Dict[str, RenameItem] = {}
        self.stop_event = threading.Event()
        self.lock = threading.Lock()
        
    def set_client(self, client):
        """设置 OpenAI 客户端"""
        self.client = client
        
    def scan_files(self, folder: str, 
                   scan_videos=True, scan_audio=True, 
                   scan_pdf=True, scan_folders=True,
                   progress_callback: Optional[Callable] = None) -> List[RenameItem]:
        """扫描文件夹中的所有匹配项目"""
        supported_extensions = []
        if scan_videos:
            supported_extensions.extend(SUPPORTED_VIDEO_FORMATS)
        if scan_audio:
            supported_extensions.extend(SUPPORTED_AUDIO_FORMATS)
        if scan_pdf:
            supported_extensions.extend(SUPPORTED_PDF_FORMATS)
        
        items = []
        counts = {"video": 0, "audio": 0, "pdf": 0, "folder": 0}
        
        for root, dirs, files in os.walk(folder):
            if scan_folders:
                for dirname in dirs:
                    full_path = os.path.join(root, dirname)
                    item_id = f"folder_{len(items)}"
                    item = RenameItem(
                        item_id=item_id,
                        old_path=full_path,
                        original_name=dirname,
                        ext=""
                    )
                    items.append(item)
                    counts["folder"] += 1
                    if progress_callback:
                        progress_callback(f"扫描到文件夹: {dirname}", len(items))

            for filename in files:
                ext = os.path.splitext(filename)[1].lower()
                if ext in supported_extensions:
                    full_path = os.path.join(root, filename)
                    item_id = f"file_{len(items)}"
                    original_name, file_ext = os.path.splitext(filename)
                    item = RenameItem(
                        item_id=item_id,
                        old_path=full_path,
                        original_name=original_name,
                        ext=file_ext
                    )
                    items.append(item)
                    
                    if ext in SUPPORTED_VIDEO_FORMATS:
                        counts["video"] += 1
                    elif ext in SUPPORTED_AUDIO_FORMATS:
                        counts["audio"] += 1
                    elif ext in SUPPORTED_PDF_FORMATS:
                        counts["pdf"] += 1
                    
                    if progress_callback:
                        progress_callback(f"扫描到文件: {filename}", len(items))
        
        # 按路径深度降序排序（重命名时从最深层开始）
        items.sort(key=lambda x: x.old_path.count(os.sep), reverse=True)
        
        # 更新 item_id 并存储
        self.items = {}
        for i, item in enumerate(items):
            item.item_id = f"item_{i}"
            self.items[item.item_id] = item
            
        return items, counts
    
    def generate_names(self, course_context: str, 
                      prompt_template: str = None,
                      model_name: str = "gpt-4o",
                      progress_callback: Optional[Callable] = None) -> bool:
        """使用 AI 生成新名称"""
        if not self.client:
            raise ValueError("OpenAI 客户端未配置")
            
        if not self.items:
            raise ValueError("没有扫描到任何项目")
            
        self.stop_event.clear()
        
        if prompt_template is None:
            prompt_template = DEFAULT_PROMPT_TEMPLATE
            
        item_list = list(self.items.values())
        total = len(item_list)
        
        # 分批处理（每批最多 30 个）
        batch_size = 30
        batches = [item_list[i:i + batch_size] for i in range(0, len(item_list), batch_size)]
        
        success_count = 0
        
        for batch_idx, batch in enumerate(batches):
            if self.stop_event.is_set():
                if progress_callback:
                    progress_callback("任务已停止", success_count / total * 100)
                break
                
            # 标记当前批次为处理中
            for item in batch:
                item.status = "processing"
                
            # 构建文件名列表
            file_list_str = "\n".join([
                f"{i+1}. {item.original_name}"
                for i, item in enumerate(batch)
            ])
            
            batch_start = batch_idx * batch_size + 1
            batch_end = min((batch_idx + 1) * batch_size, total)
            
            if progress_callback:
                progress_callback(f"批量处理 [{batch_start}-{batch_end}]/{total}...", 
                                (batch_idx / len(batches)) * 100)
            
            try:
                prompt = prompt_template.format(
                    course_context=course_context,
                    file_list=file_list_str
                )
                
                response = self.client.chat.completions.create(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3
                )
                
                result_text = response.choices[0].message.content.strip()
                
                # 解析结果
                result_map = self._parse_batch_result(result_text, len(batch))
                
                # 应用结果
                for i, item in enumerate(batch):
                    idx = i + 1
                    if idx in result_map:
                        new_title = sanitize_filename(result_map[idx])
                        item.new_name = new_title + item.ext
                        item.status = "completed"
                        success_count += 1
                    else:
                        item.status = "error"
                        
                if progress_callback:
                    progress_callback(f"已处理 {min(batch_end, total)}/{total}", 
                                    (batch_idx + 1) / len(batches) * 100)
                    
            except Exception as e:
                for item in batch:
                    item.status = "error"
                if progress_callback:
                    progress_callback(f"批次处理失败: {str(e)}", 
                                    (batch_idx + 1) / len(batches) * 100)
        
        if progress_callback:
            progress_callback(f"AI 处理完成！成功: {success_count}/{total}", 100)
            
        return success_count > 0
    
    def _parse_batch_result(self, result_text: str, expected_count: int) -> Dict[int, str]:
        """解析批量处理结果"""
        result_map = {}
        lines = result_text.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # 格式1: "1|标题"
            if '|' in line:
                parts = line.split('|', 1)
                if len(parts) == 2:
                    try:
                        idx = int(parts[0].strip())
                        title = parts[1].strip().replace('"', '').replace('`', '')
                        result_map[idx] = title
                    except ValueError:
                        pass
            # 格式2: "1. 标题" 或 "1、标题"
            elif '. ' in line or '、' in line:
                for sep in ['. ', '、', '．']:
                    if sep in line:
                        parts = line.split(sep, 1)
                        if len(parts) == 2:
                            try:
                                idx = int(parts[0].strip())
                                title = parts[1].strip().replace('"', '').replace('`', '')
                                result_map[idx] = title
                                break
                            except ValueError:
                                pass
        
        return result_map
    
    def execute_rename(self, progress_callback: Optional[Callable] = None) -> Dict:
        """执行重命名"""
        results = {"success": [], "failed": []}
        
        for item_id, item in self.items.items():
            if item.status != "completed" or not item.new_name:
                continue
                
            old_path = item.old_path
            parent_dir = os.path.dirname(old_path)
            new_path = os.path.join(parent_dir, item.new_name)
            
            # 检查文件名冲突
            counter = 1
            base_name, ext = os.path.splitext(item.new_name)
            while os.path.exists(new_path) and new_path != old_path:
                new_path = os.path.join(parent_dir, f"{base_name}_{counter}{ext}")
                counter += 1
            
            try:
                os.rename(old_path, new_path)
                item.old_path = new_path
                item.original_name = item.new_name
                results["success"].append({
                    "old": os.path.basename(old_path),
                    "new": item.new_name
                })
                if progress_callback:
                    progress_callback(f"重命名成功: {os.path.basename(old_path)} -> {item.new_name}",
                                    len(results["success"]) / len(self.items) * 100)
            except Exception as e:
                results["failed"].append({
                    "old": os.path.basename(old_path),
                    "error": str(e)
                })
                if progress_callback:
                    progress_callback(f"重命名失败: {os.path.basename(old_path)} - {str(e)}",
                                    len(results["success"]) / len(self.items) * 100)
        
        return results
    
    def update_item_name(self, item_id: str, new_name: str) -> bool:
        """手动更新项目名称"""
        if item_id in self.items:
            self.items[item_id].new_name = new_name + self.items[item_id].ext
            return True
        return False
    
    def stop(self):
        """停止任务"""
        self.stop_event.set()
