# -*- coding: utf-8 -*-
"""
统计模块 - 记录各功能的使用情况
"""
import os
import json
import time
from datetime import datetime, timedelta
from pathlib import Path
from threading import Lock


class StatisticsManager:
    """统计管理器 - 单例模式"""
    _instance = None
    _lock = Lock()
    
    # 程序标识符映射
    PROGRAMS = {
        'ai_rename': 'AI 重命名',
        'video_split': '视频分割',
        'add_intro': '添加片头',
        'subtitles': '字幕整理',
        'compress': '视频压缩',
        'course': '课程文案',
        'cover': '封面生成',
    }
    
    def __new__(cls, data_file=None):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self, data_file=None):
        if self._initialized:
            return
            
        if data_file is None:
            # 默认存储在应用目录
            base_dir = Path(__file__).parent.parent.parent
            data_file = base_dir / 'data' / 'statistics.json'
        
        self.data_file = Path(data_file)
        self.data_file.parent.mkdir(parents=True, exist_ok=True)
        
        self._data = self._load_data()
        self._initialized = True
    
    def _load_data(self):
        """加载统计数据"""
        if self.data_file.exists():
            try:
                with open(self.data_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"加载统计数据失败: {e}")
        
        # 初始化默认数据结构
        return {
            'version': '1.0',
            'created_at': datetime.now().isoformat(),
            'records': [],  # 详细记录列表
            'daily_stats': {},  # 按日期统计 { '2025-01-15': { 'ai_rename': 10, ... } }
            'program_totals': {k: 0 for k in self.PROGRAMS.keys()},  # 各程序总计
        }
    
    def _save_data(self):
        """保存统计数据"""
        try:
            with open(self.data_file, 'w', encoding='utf-8') as f:
                json.dump(self._data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"保存统计数据失败: {e}")
    
    def record(self, program, count=1, details=None):
        """
        记录一次使用
        
        Args:
            program: 程序标识符 (ai_rename, video_split, 等)
            count: 处理数量（如文件数）
            details: 详细信息的字典（可选）
        """
        if program not in self.PROGRAMS:
            print(f"未知的程序标识符: {program}")
            return
        
        now = datetime.now()
        today_str = now.strftime('%Y-%m-%d')
        
        # 1. 添加详细记录
        record = {
            'program': program,
            'count': count,
            'timestamp': now.isoformat(),
            'date': today_str,
        }
        if details:
            record['details'] = details
        
        self._data['records'].append(record)
        
        # 2. 更新每日统计
        if today_str not in self._data['daily_stats']:
            self._data['daily_stats'][today_str] = {k: 0 for k in self.PROGRAMS.keys()}
        
        self._data['daily_stats'][today_str][program] += count
        
        # 3. 更新总计
        self._data['program_totals'][program] += count
        
        # 保存数据
        self._save_data()
    
    def get_statistics(self, days=30):
        """
        获取统计数据
        
        Args:
            days: 获取最近几天的数据
            
        Returns:
            dict: 统计数据
        """
        now = datetime.now()
        today_str = now.strftime('%Y-%m-%d')
        
        # 计算今日数据
        today_stats = self._data['daily_stats'].get(today_str, {})
        today_total = sum(today_stats.values())
        
        # 计算本周数据
        week_start = now - timedelta(days=now.weekday())
        week_total = 0
        for i in range(7):
            date_str = (week_start + timedelta(days=i)).strftime('%Y-%m-%d')
            if date_str in self._data['daily_stats']:
                week_total += sum(self._data['daily_stats'][date_str].values())
        
        # 计算总计
        total = sum(self._data['program_totals'].values())
        
        # 各程序统计
        programs = []
        for key, name in self.PROGRAMS.items():
            programs.append({
                'key': key,
                'name': name,
                'count': self._data['program_totals'].get(key, 0),
                'today': today_stats.get(key, 0),
            })
        
        # 近期活动（最近 20 条）
        recent_activity = []
        for record in reversed(self._data['records'][-20:]):
            recent_activity.append({
                'program': record['program'],
                'count': record['count'],
                'time': record['timestamp'][:16].replace('T', ' '),  # 格式化时间
            })
        
        return {
            'total': total,
            'today': today_total,
            'week': week_total,
            'programs': programs,
            'recent_activity': recent_activity,
        }
    
    def get_program_stats(self, program, days=7):
        """
        获取特定程序的近期统计
        
        Args:
            program: 程序标识符
            days: 最近几天
            
        Returns:
            list: 每日统计数据
        """
        result = []
        now = datetime.now()
        
        for i in range(days - 1, -1, -1):
            date = now - timedelta(days=i)
            date_str = date.strftime('%Y-%m-%d')
            daily = self._data['daily_stats'].get(date_str, {})
            result.append({
                'date': date_str,
                'count': daily.get(program, 0),
            })
        
        return result
    
    def clear_old_records(self, keep_days=90):
        """
        清理旧记录，保留最近 N 天的数据
        
        Args:
            keep_days: 保留天数
        """
        cutoff_date = (datetime.now() - timedelta(days=keep_days)).strftime('%Y-%m-%d')
        
        # 清理详细记录
        self._data['records'] = [
            r for r in self._data['records']
            if r['date'] >= cutoff_date
        ]
        
        # 清理每日统计
        self._data['daily_stats'] = {
            k: v for k, v in self._data['daily_stats'].items()
            if k >= cutoff_date
        }
        
        self._save_data()


# 全局统计管理器实例
stats_manager = StatisticsManager()


# 便捷函数
def record_usage(program, count=1, details=None):
    """记录使用"""
    stats_manager.record(program, count, details)


def get_stats(days=30):
    """获取统计数据"""
    return stats_manager.get_statistics(days)


def get_program_history(program, days=7):
    """获取程序历史"""
    return stats_manager.get_program_stats(program, days)
