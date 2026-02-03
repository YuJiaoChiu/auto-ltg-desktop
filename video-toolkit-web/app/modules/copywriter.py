# -*- coding: utf-8 -*-
"""
课程团购文案生成模块
移植自 my-app-refactored/services/
功能：网页爬取、AI标题生成、AI文案改写、AI封面图生成
"""
import os
import re
import json
import base64
import io
import ssl
from typing import Tuple, Optional, List, Dict, Any
from dataclasses import dataclass

# 临时解决 SSL 问题：禁用 SSL 验证（仅用于调试）
os.environ['CURL_CA_BUNDLE'] = ''
os.environ['REQUESTS_CA_BUNDLE'] = ''
ssl._create_default_https_context = ssl._create_unverified_context

import requests
from bs4 import BeautifulSoup
from PIL import Image
from playwright.sync_api import sync_playwright


# 默认 Prompt 模板
DEFAULT_TITLE_PROMPT = """你是一位资深的课程营销专家。请根据以下课程信息，生成4个不同风格的中文营销标题。

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

课程信息如下：
"""

DEFAULT_COPY_PROMPT = """你是一位专业的团购文案撰写专家。请根据以下课程信息和选定的标题，撰写一份完整的团购文案。

【重要约束】
- 所有信息必须来自原文，严禁编造任何数据
- 如果原文未提及价格、时长、课时数等信息，请标注"（原文未提及）"
- 保持专业、真实、可信的语气

【输出参考】
今天开这门课，来自波兰插画家和概念艺术家Dariusz Kieliszek的《恐怖与黑暗幻想中的高级解剖学》。
如果你是自学艺术家，或者对恐怖、黑暗幻想题材情有独钟，但总觉得人物解剖造型不够诡异、缺乏冲击力，这门课绝对是你的解药。
教你如何扭曲、变形人体解剖，注入诡谲的氛围，让你的角色设计从平凡走向令人毛骨悚然、难以忘怀的境界。

讲师： Dariusz Kieliszek：波兰插画家和概念艺术家，主攻恐怖与黑暗幻想。
他的灵感来源于恐怖电影、古神话、民间传说，以及H.P. Lovecraft的宇宙恐怖。风格融合经典绘画技巧、20世纪幻想艺术和反乌托邦超现实主义，曾为《Pathfinder》、《Kryptig》、《Keshanar》等RPG卡牌、漫画小说、音乐专辑封面和奇幻书籍创作插图。获奖无数，还登上《Blood of Gods》和《ImagineFX》等艺术杂志。

下面我们看一下课程模块
- 引言：认识讲师的故事、创作历程和灵感来源。概述课程结构，以及在幻想解剖中造型和变形的作用，为整个课程定调。
- 造型解剖导论：核心概念如形状语言、用恐惧（恐惧症）作为设计工具，探索宇宙恐怖在角色创作中的应用。奠定基础，将解剖研究转化为情感驱动的设计，还附带Photoshop实用技巧。
- 基础解剖：覆盖人物结构基础。从基本人体模型起步，添加解剖细节。作业聚焦姿势、手势，从参考学习和大师作品分析，建立坚实的解剖理解和有效学习方法。
- 解剖造型化：应用所学到造型化、富有表现力的角色中。探索比例造型、形状语言的有效使用，结合人类和动物解剖。作业推动你创意素描，有意地应用造型技巧。
- 解剖变形：深入高级角色设计，通过添加诡异、异界特征进行变形。探讨变形类型、在身体部位绘制各种形式，挑战你的想象极限。满满创意提示，突破现实界限。
- 最终项目：整合一切，步步引导你从概念化、草图到完成一幅黑暗幻想插图。从收集参考到最终成品，还有时间加速演示作为灵感。

课程原价297美元，10小时，除了官方资源(笔刷包等)，我们额外提供中文翻译、中文朗读，咱们30发车。
选定的标题：{selected_title}

课程原始信息如下：
"""

DEFAULT_IMAGE_PROMPT = """为以下课程制作一个16:9横版营销封面图：

【课程标题】
{title}

【课程文案】
{copy}

要求：
- 视觉风格：现代、专业、吸引眼球
- 适合社交媒体传播
- 突出课程主题和价值
- 配色和谐，文字清晰可读
"""


@dataclass
class CourseInfo:
    """课程信息"""
    url: str = ""
    content: str = ""
    titles: List[Dict] = None
    selected_title: str = ""
    copy_text: str = ""


class WebScraper:
    """网页爬虫 - 使用 Playwright 支持 JavaScript 渲染"""

    # 常见的"展开更多"按钮选择器
    EXPAND_SELECTORS = [
        # 通用
        '[class*="expand"]', '[class*="more"]', '[class*="show-more"]',
        '[class*="read-more"]', '[class*="view-more"]', '[class*="load-more"]',
        '[class*="see-more"]', '[class*="showMore"]', '[class*="readMore"]',
        # aria 属性
        '[aria-expanded="false"]',
        # 按钮文本匹配（通过 JS 处理）
    ]

    # 常见的"展开更多"按钮文本关键词
    EXPAND_KEYWORDS = [
        '展开', '更多', '查看全部', '显示更多', '加载更多', '查看更多',
        'Show more', 'Read more', 'View more', 'Load more', 'See more',
        'See all', 'View all', 'Expand', 'Show all',
    ]

    @staticmethod
    def scrape(url: str, timeout: int = 90) -> Tuple[bool, str]:
        """使用 Playwright 抓取课程页面内容（支持动态加载）"""
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(
                    user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                               'AppleWebKit/537.36 (KHTML, like Gecko) '
                               'Chrome/125.0.0.0 Safari/537.36',
                    locale='zh-CN',
                    viewport={'width': 1440, 'height': 900},
                )
                page = context.new_page()
                page.set_default_timeout(timeout * 1000)

                # 1. 访问页面，等待主体加载
                page.goto(url, wait_until='domcontentloaded')
                # 再等 networkidle，但不让它阻塞太久
                try:
                    page.wait_for_load_state('networkidle', timeout=15000)
                except Exception:
                    pass  # 部分页面永远不会 networkidle，继续即可

                # 2. 多轮滚动，直到页面高度不再增长
                WebScraper._scroll_to_bottom(page)

                # 3. 点击所有"展开更多"按钮，展开折叠内容
                WebScraper._expand_all(page)

                # 4. 展开后可能有新内容，再滚动一轮
                WebScraper._scroll_to_bottom(page, max_rounds=3)

                # 5. 展开所有 <details> 标签
                page.evaluate("""
                    () => document.querySelectorAll('details:not([open])').forEach(d => d.open = true)
                """)

                # 6. 让所有隐藏内容可见（常见的 CSS 隐藏手法）
                page.evaluate("""
                    () => {
                        document.querySelectorAll('[style*="display: none"], [style*="display:none"], .hidden, .collapse:not(.show)')
                            .forEach(el => {
                                el.style.display = '';
                                el.classList.remove('hidden');
                                el.classList.add('show');
                            });
                    }
                """)

                page.wait_for_timeout(1000)

                # 7. 获取页面 HTML
                html_content = page.content()

                browser.close()

                # 清洗 HTML
                cleaned_text = WebScraper._clean_html(html_content)

                if len(cleaned_text.strip()) < 100:
                    return False, "页面内容过少，可能需要登录或页面结构特殊"

                return True, cleaned_text

        except Exception as e:
            return False, f"抓取失败: {str(e)}"

    @staticmethod
    def _scroll_to_bottom(page, max_rounds: int = 10, scroll_step: int = 600, settle_wait: int = 800):
        """多轮滚动到底部，直到页面高度稳定"""
        prev_height = 0
        stable_count = 0
        for _ in range(max_rounds):
            # 获取当前页面总高度
            curr_height = page.evaluate("() => document.body.scrollHeight")
            if curr_height == prev_height:
                stable_count += 1
                if stable_count >= 2:
                    break  # 连续两轮高度不变，认为已到底
            else:
                stable_count = 0
            prev_height = curr_height

            # 分步滚动到底部
            viewport_height = page.evaluate("() => window.innerHeight")
            pos = page.evaluate("() => window.scrollY")
            while pos < curr_height:
                pos += scroll_step
                page.evaluate(f"() => window.scrollTo(0, {pos})")
                page.wait_for_timeout(150)

            # 等待新内容加载
            page.wait_for_timeout(settle_wait)

        # 滚回顶部
        page.evaluate("() => window.scrollTo(0, 0)")

    @staticmethod
    def _expand_all(page):
        """点击页面上所有"展开更多"类型的按钮"""
        # 方法1: 通过 CSS 选择器点击
        for selector in WebScraper.EXPAND_SELECTORS:
            try:
                elements = page.query_selector_all(selector)
                for el in elements:
                    try:
                        if el.is_visible():
                            el.click()
                            page.wait_for_timeout(300)
                    except Exception:
                        continue
            except Exception:
                continue

        # 方法2: 通过按钮/链接文本匹配点击
        for keyword in WebScraper.EXPAND_KEYWORDS:
            try:
                # 匹配 button, a, span, div 中包含关键词的可点击元素
                elements = page.query_selector_all(
                    f'button, a, span[role="button"], div[role="button"]'
                )
                for el in elements:
                    try:
                        text = (el.inner_text() or '').strip()
                        if keyword.lower() in text.lower() and len(text) < 30 and el.is_visible():
                            el.click()
                            page.wait_for_timeout(300)
                    except Exception:
                        continue
            except Exception:
                continue

        # 方法3: 点击所有 aria-expanded="false" 的元素（tab/accordion）
        try:
            page.evaluate("""
                () => {
                    document.querySelectorAll('[aria-expanded="false"]').forEach(el => {
                        try { el.click(); } catch(e) {}
                    });
                }
            """)
            page.wait_for_timeout(500)
        except Exception:
            pass

    @staticmethod
    def _clean_html(html: str) -> str:
        """清洗 HTML，保留尽可能多的正文内容"""
        soup = BeautifulSoup(html, 'html.parser')

        # 只移除明确无内容价值的标签
        for tag in soup.find_all(['script', 'style', 'noscript', 'iframe', 'svg',
                                   'canvas', 'video', 'audio', 'source', 'link', 'meta']):
            tag.decompose()

        # 移除导航和侧边栏（保留 header，因为课程页面标题常在 header 里）
        for selector in [
            'nav', '[role="navigation"]',
            '.navbar', '.nav-bar', '.site-nav', '.main-nav',
            '.sidebar', '#sidebar', '[role="complementary"]',
            '.ad', '.ads', '.advertisement', '[class*="advert"]',
            '.cookie-banner', '.cookie-notice',
            '#comments', '.comments-section',
        ]:
            for element in soup.select(selector):
                element.decompose()

        # 获取文本，用换行分隔块级元素
        text = soup.get_text(separator='\n', strip=True)

        # 清理多余空白
        lines = []
        for line in text.split('\n'):
            stripped = line.strip()
            if stripped and len(stripped) > 1:
                lines.append(stripped)

        # 合并连续重复行
        cleaned_lines = []
        prev_line = None
        for line in lines:
            if line != prev_line:
                cleaned_lines.append(line)
                prev_line = line

        return '\n'.join(cleaned_lines)


class Copywriter:
    """文案生成器 — 使用 requests 直接调用，兼容标准 OpenAI 和兔子 API 等代理"""

    def __init__(self, openai_client=None):
        self.client = openai_client  # 仅用于图片生成
        self.api_key = ''
        self.api_base = ''
        self.course_info = CourseInfo()
        self.title_prompt = DEFAULT_TITLE_PROMPT
        self.copy_prompt = DEFAULT_COPY_PROMPT
        self.image_prompt = DEFAULT_IMAGE_PROMPT

    def set_client(self, client):
        """设置 OpenAI 客户端（图片生成仍需要）"""
        self.client = client

    def set_api_config(self, api_key: str, api_base: str = ''):
        """设置 API 认证信息"""
        self.api_key = api_key
        self.api_base = api_base.rstrip('/') if api_base else ''

    def scrape_url(self, url: str) -> Tuple[bool, str]:
        """抓取网页内容"""
        success, content = WebScraper.scrape(url)
        if success:
            self.course_info.url = url
            self.course_info.content = content
        return success, content

    def set_content(self, content: str):
        """手动设置内容"""
        self.course_info.content = content

    def _chat_request(self, messages: list, model: str, temperature: float = 0.7,
                      max_tokens: int = 1000) -> str:
        """发送聊天请求，兼容标准 OpenAI 和兔子 API 等包装格式"""
        import ssl
        import time
        import urllib3
        from requests.adapters import HTTPAdapter

        # 禁用 SSL 警告（仅用于调试）
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

        url = f"{self.api_base}/chat/completions" if self.api_base else "https://api.openai.com/v1/chat/completions"

        # 创建 session 并配置重试
        session = requests.Session()

        last_error = None
        for attempt in range(3):
            try:
                resp = session.post(url, json={
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": False
                }, headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }, timeout=120, verify=False)  # verify=False 临时禁用 SSL 验证
                break
            except Exception as e:
                last_error = str(e)
                print(f"[Copywriter] 请求失败 (尝试 {attempt + 1}/3): {last_error}")
                if attempt < 2:
                    time.sleep(2 ** attempt)
                continue
        else:
            raise Exception(f"API 请求失败: {last_error}")

        result = resp.json()

        # 检查错误
        if 'error' in result:
            err = result['error']
            msg = err.get('message', str(err)) if isinstance(err, dict) else str(err)
            raise Exception(f"API 错误: {msg}")

        # 提取回复 — 兼容两种格式
        # 标准: {"choices": [{"message": {"content": "..."}}]}
        # 兔子 API: {"code": 0, "data": {"choices": [...]}}
        inner = result.get('data', result)
        choices = inner.get('choices', [])
        if not choices:
            raise Exception(f"API 未返回 choices，原始响应: {json.dumps(result, ensure_ascii=False)[:300]}")

        msg = choices[0].get('message', {})
        content = msg.get('content', '') if isinstance(msg, dict) else str(msg)

        if not content:
            raise Exception(f"API 返回内容为空，原始响应: {json.dumps(result, ensure_ascii=False)[:300]}")

        # 检测返回了 HTML
        if content.strip().startswith('<!DOCTYPE') or content.strip().startswith('<html'):
            raise Exception("API 返回了 HTML 页面，请检查 API Base URL 是否正确")

        return content

    def generate_titles(self, model: str = "gpt-4o", temperature: float = 0.7, prompt_template: str = None) -> Tuple[bool, List[Dict], str]:
        """生成标题"""
        if not self.api_key:
            return False, [], "API Key 未配置"

        if not self.course_info.content:
            return False, [], "课程内容为空"

        try:
            # 使用自定义 prompt 或默认 prompt
            base_prompt = prompt_template if prompt_template else self.title_prompt
            prompt = base_prompt + "\n" + self.course_info.content[:3000]

            result_text = self._chat_request(
                messages=[{"role": "user", "content": prompt}],
                model=model, temperature=temperature, max_tokens=1000
            )

            print(f"[Copywriter] AI 返回 (前500字): {repr(result_text[:500])}")

            # 提取 JSON — 先去掉 markdown 代码块
            cleaned = re.sub(r'```(?:json)?\s*', '', result_text)
            cleaned = cleaned.strip()

            json_match = re.search(r'\{[\s\S]*\}', cleaned)
            if json_match:
                data = json.loads(json_match.group())
                titles = data.get('titles', [])
                self.course_info.titles = titles
                return True, titles, ""
            else:
                return False, [], f"无法解析 AI 返回的标题，原始内容: {result_text[:200]}"

        except Exception as e:
            return False, [], str(e)

    def generate_copy(self, selected_title: str, model: str = "gpt-4o",
                     temperature: float = 0.7, prompt_template: str = None) -> Tuple[bool, str]:
        """生成文案"""
        if not self.api_key:
            return False, "API Key 未配置"

        if not self.course_info.content:
            return False, "课程内容为空"

        try:
            # 使用自定义 prompt 或默认 prompt
            base_prompt = prompt_template if prompt_template else self.copy_prompt
            prompt = base_prompt.replace("{selected_title}", selected_title)
            prompt = prompt + "\n" + self.course_info.content[:2500]  # 减少内容量，避免 SSL 超时

            copy_text = self._chat_request(
                messages=[{"role": "user", "content": prompt}],
                model=model, temperature=temperature, max_tokens=1500
            )

            self.course_info.selected_title = selected_title
            self.course_info.copy_text = copy_text

            return True, copy_text
            
        except Exception as e:
            return False, str(e)
    
    def generate_cover_image(self, model: str = "dall-e-3", ref_image_path: str = "", copy_text: str = "", title: str = "", prompt_template: str = None) -> Tuple[bool, any, str]:
        """生成封面图，兼容标准 OpenAI 和兔子 API 异步接口"""
        if not self.api_key:
            return False, None, "API Key 未配置"

        # 优先使用传入的文案，其次使用之前生成的文案，最后用默认提示
        text = copy_text or self.course_info.copy_text or "一个吸引人的课程营销内容"
        # 优先使用传入的标题，其次使用之前选择的标题
        title_text = title or self.course_info.selected_title or "课程封面"

        # 使用自定义 prompt 或默认 prompt
        base_prompt = prompt_template if prompt_template else self.image_prompt
        prompt = base_prompt.replace("{copy}", text[:500]).replace("{title}", title_text)

        # Gemini 模型用原生 SDK（同步），其他模型用标准 OpenAI 接口
        if 'gemini' in model.lower():
            return self._generate_image_gemini(prompt, model, ref_image_path)
        else:
            return self._generate_image_standard(prompt, model)

    def _generate_image_standard(self, prompt: str, model: str) -> Tuple[bool, any, str]:
        """标准 OpenAI images.generations 接口（dall-e-3, gpt-4o-image 等）"""
        import ssl
        import time
        import urllib3
        from requests.adapters import HTTPAdapter
        from urllib3.util.retry import Retry

        # 禁用 SSL 警告
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

        url = f"{self.api_base}/images/generations" if self.api_base else "https://api.openai.com/v1/images/generations"

        # 配置重试策略
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )

        # 创建 Session 并配置重试
        session = requests.Session()
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("https://", adapter)
        session.mount("http://", adapter)

        last_error = None
        for attempt in range(3):
            try:
                resp = session.post(url, json={
                    "model": model,
                    "prompt": prompt,
                    "size": "1792x1024",  # 16:9 aspect ratio
                    "n": 1
                }, headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }, timeout=180, verify=False)

                result = resp.json()
                break  # 成功则跳出重试循环
            except (requests.exceptions.SSLError, ssl.SSLError) as e:
                last_error = f"SSL 错误 (尝试 {attempt + 1}/3): {str(e)}"
                print(f"[Copywriter] {last_error}")
                if attempt < 2:
                    time.sleep(2 ** attempt)  # 指数退避: 1s, 2s
                continue
            except requests.exceptions.ConnectionError as e:
                last_error = f"连接错误 (尝试 {attempt + 1}/3): {str(e)}"
                print(f"[Copywriter] {last_error}")
                if attempt < 2:
                    time.sleep(2 ** attempt)
                continue
            except requests.exceptions.Timeout as e:
                last_error = f"请求超时 (尝试 {attempt + 1}/3): {str(e)}"
                print(f"[Copywriter] {last_error}")
                if attempt < 2:
                    time.sleep(2 ** attempt)
                continue
        else:
            # 所有重试都失败
            return False, None, f"图片生成请求失败: {last_error}"

        try:
            inner = result.get('data', result)

            images = inner.get('images', inner.get('data', []))
            if not images:
                return False, None, f"API 未返回图片: {json.dumps(result, ensure_ascii=False)[:300]}"

            img_item = images[0]
            img_url = img_item.get('url', '')
            b64 = img_item.get('b64_json', '')

            if b64:
                img = Image.open(io.BytesIO(base64.b64decode(b64)))
            elif img_url:
                # 下载图片也使用重试机制
                for dl_attempt in range(3):
                    try:
                        img_resp = session.get(img_url, timeout=90, verify=False)
                        img = Image.open(io.BytesIO(img_resp.content))
                        break
                    except Exception as dl_e:
                        if dl_attempt < 2:
                            time.sleep(1)
                            continue
                        return False, None, f"下载图片失败: {str(dl_e)}"
            else:
                return False, None, "API 未返回图片 URL 或 base64"

            return True, img, ""
        except Exception as e:
            return False, None, str(e)

    def _generate_image_gemini(self, prompt: str, model: str, ref_image_path: str = "") -> Tuple[bool, any, str]:
        """生成图片 - 兔子 API 使用 chat/completions，官方 API 使用 SDK"""
        import time
        import urllib3

        # 禁用 SSL 警告
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

        # 判断是否使用兔子 API 中转
        is_tuzi_api = self.api_base and "tu-zi" in self.api_base.lower()

        if is_tuzi_api:
            # 兔子 API：使用 /v1/chat/completions 端点
            return self._generate_image_via_chat(prompt, model, ref_image_path)
        else:
            # 官方 API：使用 Google SDK
            return self._generate_image_via_sdk(prompt, model, ref_image_path)

    def _generate_image_via_chat(self, prompt: str, model: str, ref_image_path: str = "") -> Tuple[bool, any, str]:
        """通过 chat/completions 端点生成图片（兔子 API）"""
        import time
        import urllib3

        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

        url = f"{self.api_base}/chat/completions"

        # 构建消息内容
        content = []

        # 如果有参考图，添加图片
        if ref_image_path and os.path.isfile(ref_image_path):
            with open(ref_image_path, 'rb') as f:
                img_bytes = f.read()
            img_base64 = base64.b64encode(img_bytes).decode('utf-8')
            # 检测图片类型
            ext = ref_image_path.lower().split('.')[-1]
            mime_type = {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'webp': 'image/webp', 'gif': 'image/gif'}.get(ext, 'image/png')
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:{mime_type};base64,{img_base64}"}
            })
            print(f"[Copywriter] 参考图已编码: {ref_image_path}")

        # 添加文本提示
        content.append({"type": "text", "text": prompt})

        messages = [{"role": "user", "content": content}]

        # 创建 session
        session = requests.Session()

        last_error = None
        for attempt in range(3):
            try:
                print(f"[Copywriter] 尝试 {attempt + 1}/3: 调用 {url}")
                resp = session.post(url, json={
                    "model": model,
                    "messages": messages,
                    "max_tokens": 4096,
                    "stream": False
                }, headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }, timeout=180, verify=False)

                result = resp.json()
                print(f"[Copywriter] 响应状态: {resp.status_code}")

                # 检查错误
                if 'error' in result:
                    err = result['error']
                    msg = err.get('message', str(err)) if isinstance(err, dict) else str(err)
                    return False, None, f"API 错误: {msg}"

                # 提取响应
                inner = result.get('data', result)
                choices = inner.get('choices', [])
                if not choices:
                    return False, None, f"API 未返回 choices: {json.dumps(result, ensure_ascii=False)[:300]}"

                message = choices[0].get('message', {})
                msg_content = message.get('content', '')

                # 解析内容 - 可能是字符串或数组
                generated_image = None
                response_text = ""

                if isinstance(msg_content, str):
                    # 纯文本响应
                    response_text = msg_content

                    # 1. 尝试解析 Markdown 图片格式: ![Image](URL) 或 ![image](URL)
                    md_img_match = re.search(r'!\[.*?\]\((https?://[^\)]+)\)', msg_content, re.IGNORECASE)
                    if md_img_match:
                        img_url = md_img_match.group(1)
                        print(f"[Copywriter] 发现 Markdown 图片链接: {img_url}")
                        try:
                            img_resp = session.get(img_url, timeout=60, verify=False)
                            generated_image = Image.open(io.BytesIO(img_resp.content))
                            print(f"[Copywriter] 下载 Markdown 图片成功")
                        except Exception as e:
                            print(f"[Copywriter] 下载 Markdown 图片失败: {e}")

                    # 2. 尝试提取 base64 图片
                    if not generated_image and ('base64' in msg_content.lower() or msg_content.startswith('/9j/') or msg_content.startswith('iVBOR')):
                        try:
                            img_data = base64.b64decode(msg_content)
                            generated_image = Image.open(io.BytesIO(img_data))
                            print(f"[Copywriter] 从 base64 解析图片成功")
                        except:
                            pass
                elif isinstance(msg_content, list):
                    # 多部分响应
                    for part in msg_content:
                        if isinstance(part, dict):
                            if part.get('type') == 'text':
                                response_text += part.get('text', '')
                            elif part.get('type') == 'image_url':
                                img_url = part.get('image_url', {}).get('url', '')
                                if img_url.startswith('data:'):
                                    # base64 编码的图片
                                    try:
                                        header, b64data = img_url.split(',', 1)
                                        img_data = base64.b64decode(b64data)
                                        generated_image = Image.open(io.BytesIO(img_data))
                                        print(f"[Copywriter] 从 image_url 解析图片成功")
                                    except Exception as e:
                                        print(f"[Copywriter] 解析 image_url 失败: {e}")
                                else:
                                    # URL 图片，需要下载
                                    try:
                                        img_resp = session.get(img_url, timeout=60, verify=False)
                                        generated_image = Image.open(io.BytesIO(img_resp.content))
                                        print(f"[Copywriter] 下载图片成功")
                                    except Exception as e:
                                        print(f"[Copywriter] 下载图片失败: {e}")
                            elif part.get('type') == 'image' and part.get('data'):
                                # 直接的 base64 数据
                                try:
                                    img_data = base64.b64decode(part['data'])
                                    generated_image = Image.open(io.BytesIO(img_data))
                                    print(f"[Copywriter] 从 image.data 解析图片成功")
                                except Exception as e:
                                    print(f"[Copywriter] 解析 image.data 失败: {e}")

                if generated_image:
                    return True, generated_image, ""
                else:
                    return False, None, f"AI 未返回图片。回复: {response_text[:500]}"

            except Exception as e:
                last_error = str(e)
                print(f"[Copywriter] 请求失败 (尝试 {attempt + 1}/3): {last_error}")
                if attempt < 2:
                    time.sleep(2 ** attempt)
                continue

        return False, None, f"请求失败: {last_error}"

    def _generate_image_via_sdk(self, prompt: str, model: str, ref_image_path: str = "") -> Tuple[bool, any, str]:
        """通过 Google SDK 生成图片（官方 API）"""
        from google import genai
        from google.genai import types

        try:
            client = genai.Client(api_key=self.api_key)

            # 加载参考图
            source_image = None
            if ref_image_path and os.path.isfile(ref_image_path):
                source_image = Image.open(ref_image_path)
                print(f"[Copywriter] 参考图已加载: {ref_image_path}")

            # 创建聊天会话
            chat = client.chats.create(
                model=model,
                config=types.GenerateContentConfig(
                    response_modalities=['TEXT', 'IMAGE']
                )
            )

            # 发送消息
            if source_image:
                response = chat.send_message([prompt, source_image])
            else:
                response = chat.send_message([prompt])

            # 解析响应
            generated_image = None
            response_text = ""

            if hasattr(response, 'parts') and response.parts:
                for part in response.parts:
                    if hasattr(part, 'text') and part.text:
                        response_text += part.text
                    if hasattr(part, 'inline_data') and part.inline_data:
                        try:
                            generated_image = part.as_image()
                        except:
                            try:
                                img_data = base64.b64decode(part.inline_data.data)
                                generated_image = Image.open(io.BytesIO(img_data))
                            except:
                                pass

            if generated_image:
                return True, generated_image, ""
            else:
                return False, None, f"AI 未返回图片。回复: {response_text[:500]}"

        except Exception as e:
            return False, None, f"图片生成失败: {str(e)}"
    
    def update_prompts(self, title_prompt: str = None, copy_prompt: str = None, 
                      image_prompt: str = None):
        """更新 Prompt 模板"""
        if title_prompt:
            self.title_prompt = title_prompt
        if copy_prompt:
            self.copy_prompt = copy_prompt
        if image_prompt:
            self.image_prompt = image_prompt
