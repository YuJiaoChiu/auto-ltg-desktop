#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
视频工具箱 Web 版 - 启动脚本
"""
import os
import sys
import subprocess
import webbrowser
from pathlib import Path


def check_ffmpeg():
    """检查 FFmpeg 是否安装"""
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        subprocess.run(['ffprobe', '-version'], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def get_python_cmd():
    """获取可用的 Python 命令"""
    # 尝试不同的 Python 命令
    for cmd in ['python3', 'python', sys.executable]:
        try:
            result = subprocess.run([cmd, '--version'], capture_output=True, text=True)
            if result.returncode == 0:
                return cmd
        except:
            pass
    return sys.executable


def install_requirements():
    """安装依赖"""
    print("正在安装依赖...")
    
    # 尝试不同的 pip 路径
    pip_cmds = [
        'pip3',
        'pip',
        sys.executable + ' -m pip'
    ]
    
    for pip_cmd in pip_cmds:
        try:
            if ' ' in pip_cmd:
                parts = pip_cmd.split()
                result = subprocess.run(parts + ['install', '-r', 'requirements.txt'], 
                                      capture_output=True, text=True)
            else:
                result = subprocess.run([pip_cmd, 'install', '-r', 'requirements.txt'], 
                                      capture_output=True, text=True)
            if result.returncode == 0:
                print("✓ 依赖安装完成")
                return True
        except:
            continue
    
    print("✗ 依赖安装失败，请手动运行:")
    print("  pip3 install -r requirements.txt")
    return False


def main():
    print("=" * 60)
    print("视频工具箱 Web 版")
    print("=" * 60)
    
    # 检查 FFmpeg
    print("\n检查 FFmpeg...")
    if check_ffmpeg():
        print("✓ FFmpeg 已安装")
    else:
        print("✗ FFmpeg 未安装！")
        print("\n请安装 FFmpeg:")
        print("  macOS: brew install ffmpeg")
        print("  Windows: winget install ffmpeg")
        print("  或访问: https://ffmpeg.org/download.html")
        input("\n按回车键退出...")
        return
    
    # 检查依赖
    print("\n检查 Python 依赖...")
    try:
        import flask
        import openai
        print("✓ 依赖已安装")
    except ImportError:
        print("依赖未安装，开始安装...")
        if not install_requirements():
            input("\n按回车键退出...")
            return
    
    # 启动应用
    print("\n" + "=" * 60)
    print("启动视频工具箱 Web 版...")
    print("=" * 60)
    print("\n访问地址: http://127.0.0.1:5001")
    print("按 Ctrl+C 停止服务")
    print("=" * 60 + "\n")
    
    # 自动打开浏览器 (Electron 模式下不打开)
    if not os.environ.get('ELECTRON_RUN'):
        webbrowser.open('http://127.0.0.1:5001')
    
    # 启动 Flask 应用
    os.environ['FLASK_ENV'] = 'production'
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from app.app import app
    app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)


if __name__ == '__main__':
    main()
