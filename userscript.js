// ==UserScript==
// @name         收藏夹管理器 - 抖音/B站/知乎
// @namespace    http://tampermonkey.net/
// @version      2.6.0
// @description  提取抖音、B站、知乎收藏夹内容，支持多页加载，导出URL和名称
// @author       You
// @match        *://www.douyin.com/*
// @match        *://space.bilibili.com/*
// @match        *://www.bilibili.com/*
// @match        *://www.zhihu.com/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    // 存储提取的收藏数据
    let favoritesData = [];
    let isAutoScrolling = false;

    // 检测是否在收藏页面
    function isFavoritesPage() {
        const url = window.location.href;
        const hostname = window.location.hostname;

        // 抖音收藏页面
        if (hostname.includes('douyin.com')) {
            return url.includes('/collection') ||
                   url.includes('showTab=favorite') ||
                   url.includes('showTab=like');
        }

        // B站收藏页面
        if (hostname.includes('bilibili.com')) {
            return url.includes('/favlist') ||
                   url.includes('/medialist') ||
                   url.includes('fid=');
        }

        // 知乎收藏页面
        if (hostname.includes('zhihu.com')) {
            return url.includes('/collection') ||
                   url.includes('/collections');
        }

        return false;
    }

    // 添加样式
    GM_addStyle(`
        #favorites-manager-panel {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 350px;
            max-height: 80vh;
            background: white;
            border: 2px solid #1890ff;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            overflow: hidden;
        }
        #favorites-manager-panel .panel-header {
            background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
            color: white;
            padding: 15px 20px;
            cursor: move;
            user-select: none;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        #favorites-manager-panel .panel-header h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
        }
        #favorites-manager-panel .panel-body {
            padding: 20px;
            max-height: calc(80vh - 60px);
            overflow-y: auto;
        }
        #favorites-manager-panel button {
            width: 100%;
            padding: 12px;
            margin: 6px 0;
            background: #1890ff;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s;
        }
        #favorites-manager-panel button:hover {
            background: #096dd9;
            transform: translateY(-1px);
        }
        #favorites-manager-panel button:disabled {
            background: #d9d9d9;
            cursor: not-allowed;
            transform: none;
        }
        #favorites-manager-panel button.success-btn {
            background: #52c41a;
        }
        #favorites-manager-panel button.success-btn:hover {
            background: #389e0d;
        }
        #favorites-manager-panel button.danger-btn {
            background: #ff4d4f;
        }
        #favorites-manager-panel button.danger-btn:hover {
            background: #cf1322;
        }
        #favorites-manager-panel button.secondary-btn {
            background: #8c8c8c;
        }
        #favorites-manager-panel button.secondary-btn:hover {
            background: #595959;
        }
        #favorites-manager-panel .status {
            margin: 10px 0;
            padding: 10px;
            background: #f0f0f0;
            border-radius: 6px;
            font-size: 13px;
            color: #666;
            line-height: 1.5;
        }
        #favorites-manager-panel .status.success {
            background: #f6ffed;
            color: #52c41a;
            border: 1px solid #b7eb8f;
        }
        #favorites-manager-panel .status.error {
            background: #fff2f0;
            color: #ff4d4f;
            border: 1px solid #ffccc7;
        }
        #favorites-manager-panel .close-btn {
            width: 28px;
            height: 28px;
            padding: 0;
            margin: 0;
            background: rgba(255,255,255,0.2);
            font-size: 18px;
            line-height: 28px;
            border-radius: 50%;
            cursor: pointer;
            border: none;
            color: white;
        }
        #favorites-manager-panel .close-btn:hover {
            background: rgba(255,255,255,0.3);
            transform: none;
        }
        #favorites-manager-panel .divider {
            height: 1px;
            background: #e0e0e0;
            margin: 15px 0;
        }
        #favorites-manager-panel .btn-group {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }
        #favorites-manager-panel .platform-info {
            font-size: 12px;
            color: #999;
            margin-bottom: 10px;
        }
        #favorites-manager-panel .data-count {
            font-size: 14px;
            color: #1890ff;
            font-weight: 600;
            margin-bottom: 10px;
        }
        #favorites-manager-panel .page-info {
            font-size: 12px;
            color: #faad14;
            margin-bottom: 5px;
        }
    `);

    // 创建面板
    function createPanel() {
        // 如果不是收藏页面，不创建面板
        if (!isFavoritesPage()) {
            console.log('[收藏夹管理器] 非收藏页面，不显示面板');
            // 监听URL变化
            observeUrlChange();
            return;
        }

        // 如果面板已存在，不重复创建
        if (document.getElementById('favorites-manager-panel')) {
            return;
        }

        const panel = document.createElement('div');
        panel.id = 'favorites-manager-panel';
        panel.innerHTML = `
            <div class="panel-header" id="fm-drag-handle">
                <h3>收藏夹管理器</h3>
                <button class="close-btn">×</button>
            </div>
            <div class="panel-body">
                <div class="platform-info">当前平台: ${detectPlatform()}</div>
                <div class="data-count" id="fm-count">已收集: 0 条</div>
                <div class="page-info" id="fm-page-info"></div>
                <div class="status" id="fm-status">就绪，点击提取按钮开始</div>
                <button id="fm-scroll-extract-btn">🔄 滚动加载全部</button>
                <button id="fm-extract-btn" class="secondary-btn">📥 仅提取当前页面</button>
                <div class="divider"></div>
                <div class="btn-group">
                    <button id="fm-export-txt-btn" class="success-btn" disabled>导出TXT</button>
                    <button id="fm-export-json-btn" class="success-btn" disabled>导出JSON</button>
                </div>
                <button id="fm-export-md-btn" class="success-btn" disabled>📝 导出Markdown</button>
                <button id="fm-copy-btn" class="success-btn" disabled>📋 复制到剪贴板</button>
                <div class="divider"></div>
                <button id="fm-clear-btn" class="danger-btn" disabled>🗑️ 清空数据</button>
            </div>
        `;
        document.body.appendChild(panel);

        // 关闭按钮
        panel.querySelector('.close-btn').addEventListener('click', () => {
            panel.style.display = 'none';
        });

        // 绑定拖拽功能
        initDrag(panel);

        // 绑定事件
        document.getElementById('fm-extract-btn').addEventListener('click', () => extractFavorites(false));
        document.getElementById('fm-scroll-extract-btn').addEventListener('click', scrollAndExtract);
        document.getElementById('fm-export-txt-btn').addEventListener('click', () => exportData('txt'));
        document.getElementById('fm-export-json-btn').addEventListener('click', () => exportData('json'));
        document.getElementById('fm-export-md-btn').addEventListener('click', () => exportData('md'));
        document.getElementById('fm-copy-btn').addEventListener('click', copyToClipboard);
        document.getElementById('fm-clear-btn').addEventListener('click', clearData);
    }

    // 拖拽功能
    function initDrag(panel) {
        const handle = document.getElementById('fm-drag-handle');
        let isDragging = false;
        let offsetX, offsetY;

        handle.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('close-btn')) return;
            isDragging = true;
            offsetX = e.clientX - panel.offsetLeft;
            offsetY = e.clientY - panel.offsetTop;
            panel.style.transition = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();

            let newX = e.clientX - offsetX;
            let newY = e.clientY - offsetY;

            // 边界检测
            const maxX = window.innerWidth - panel.offsetWidth;
            const maxY = window.innerHeight - panel.offsetHeight;

            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));

            panel.style.left = newX + 'px';
            panel.style.top = newY + 'px';
            panel.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            panel.style.transition = 'all 0.3s';
        });
    }

    // 监听URL变化
    function observeUrlChange() {
		//获得地址
        let lastUrl = window.location.href;

        const observer = new MutationObserver(() => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                setTimeout(() => {
                    if (isFavoritesPage()) {
                        createPanel();
                    } else {
                        const panel = document.getElementById('favorites-manager-panel');
                        if (panel) {
                            panel.remove();
                        }
                    }
                }, 1000);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // 也监听 popstate 事件
        window.addEventListener('popstate', () => {
            setTimeout(() => {
                if (isFavoritesPage()) {
                    createPanel();
                } else {
                    const panel = document.getElementById('favorites-manager-panel');
                    if (panel) {
                        panel.remove();
                    }
                }
            }, 1000);
        });
    }

    // 更新状态
    function updateStatus(message, type = 'info') {
        const status = document.getElementById('fm-status');
        if (status) {
            status.textContent = message;
            status.className = 'status';
            if (type === 'error') {
                status.classList.add('error');
            } else if (type === 'success') {
                status.classList.add('success');
            }
        }
    }

    // 更新页码信息
    function updatePageInfo(text) {
        const pageInfo = document.getElementById('fm-page-info');
        if (pageInfo) {
            pageInfo.textContent = text;
        }
    }

    // 更新计数
    function updateCount() {
        const countEl = document.getElementById('fm-count');
        if (countEl) {
            countEl.textContent = `已收集: ${favoritesData.length} 条`;
        }
    }

    // 启用/禁用导出按钮
    function toggleExportButtons(enabled) {
        const btns = ['fm-export-txt-btn', 'fm-export-json-btn', 'fm-export-md-btn', 'fm-copy-btn', 'fm-clear-btn'];
        btns.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = !enabled;
        });
    }

    // 下载文件
    function downloadFile(content, filename, type) {
        const blob = new Blob([content], { type: type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // 导出数据
    function exportData(format) {
        if (favoritesData.length === 0) {
            updateStatus('没有数据可导出', 'error');
            return;
        }

        const timestamp = new Date().toISOString().split('T')[0];
        const platform = detectPlatform();

        if (format === 'txt') {
            let content = `# 收藏夹导出 - ${platform}\n`;
            content += `# 导出时间: ${new Date().toLocaleString()}\n`;
            content += `# 总数: ${favoritesData.length}\n\n`;

            favoritesData.forEach((item, index) => {
                content += `${index + 1}. ${item.title}\n`;
                content += `   ${item.url}\n\n`;
            });

            downloadFile(content, `${platform}_favorites_${timestamp}.txt`, 'text/plain');
            updateStatus(`已导出 ${favoritesData.length} 条记录为TXT`, 'success');

        } else if (format === 'json') {
            const jsonData = {
                platform: platform,
                exportTime: new Date().toISOString(),
                count: favoritesData.length,
                data: favoritesData
            };

            downloadFile(JSON.stringify(jsonData, null, 2), `${platform}_favorites_${timestamp}.json`, 'application/json');
            updateStatus(`已导出 ${favoritesData.length} 条记录为JSON`, 'success');

        } else if (format === 'md') {
            let content = `# ${platform} 收藏夹导出\n\n`;
            content += `> 导出时间: ${new Date().toLocaleString()}\n`;
            content += `> 总数: ${favoritesData.length} 条\n\n`;
            content += `---\n\n`;

            favoritesData.forEach((item, index) => {
                // B站使用标题和作者作为链接文本
                if (item.platform === 'bilibili') {
                    const linkText = [item.title, item.uploader].filter(Boolean).join(' | ');
                    content += `### ${index + 1}. [${linkText}](${item.url})\n\n`;
                } else {
                    content += `### ${index + 1}. [${item.title}](${item.url})\n\n`;
                    if (item.author || item.uploader) {
                        content += `- **作者**: ${item.author || item.uploader}\n`;
                    }
                }
                content += `\n`;
            });

            downloadFile(content, `${platform}_favorites_${timestamp}.md`, 'text/markdown');
            updateStatus(`已导出 ${favoritesData.length} 条记录为Markdown`, 'success');
        }
    }

    // 复制到剪贴板
    function copyToClipboard() {
        if (favoritesData.length === 0) {
            updateStatus('没有数据可复制', 'error');
            return;
        }

        let content = `收藏夹导出 (${favoritesData.length}条)\n`;
        content += `导出时间: ${new Date().toLocaleString()}\n\n`;

        favoritesData.forEach((item, index) => {
            content += `${index + 1}. ${item.title}\n${item.url}\n\n`;
        });

        if (typeof GM_setClipboard !== 'undefined') {
            GM_setClipboard(content);
            updateStatus(`已复制 ${favoritesData.length} 条记录到剪贴板`, 'success');
        } else {
            navigator.clipboard.writeText(content).then(() => {
                updateStatus(`已复制 ${favoritesData.length} 条记录到剪贴板`, 'success');
            }).catch(() => {
                updateStatus('复制失败，请手动复制', 'error');
            });
        }
    }

    // 清空数据
    function clearData() {
        if (confirm('确定要清空所有提取的数据吗？')) {
            favoritesData = [];
            toggleExportButtons(false);
            updateCount();
            updatePageInfo('');
            updateStatus('数据已清空');
        }
    }

    // 检测平台
    function detectPlatform() {
        const hostname = window.location.hostname;
        if (hostname.includes('douyin.com')) return '抖音';
        if (hostname.includes('bilibili.com')) return 'B站';
        if (hostname.includes('zhihu.com')) return '知乎';
        return '未知';
    }

    // 延迟函数
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 获取当前页码
    function getCurrentPageNumber() {
        const platform = detectPlatform();

        if (platform === '知乎') {
            // 知乎分页器
            const activePage = document.querySelector('.PaginationButton--current') ||
                              document.querySelector('.Pagination button[aria-current="true"]') ||
                              document.querySelector('.Pagination .active');
            if (activePage) {
                const num = parseInt(activePage.textContent);
                if (!isNaN(num)) return num;
            }
        }

        if (platform === 'B站') {
            // B站分页器
            const activePage = document.querySelector('.be-pager-item-active') ||
                              document.querySelector('.pager .active') ||
                              document.querySelector('.page-item.active');
            if (activePage) {
                const num = parseInt(activePage.textContent);
                if (!isNaN(num)) return num;
            }

            // 从URL获取页码
            const urlParams = new URLSearchParams(window.location.search);
            const pn = urlParams.get('pn');
            if (pn) return parseInt(pn);
        }

        return 1;
    }

    // 获取总页数
    function getTotalPages() {
        const platform = detectPlatform();

        if (platform === '知乎') {
            const pages = document.querySelectorAll('.PaginationButton:not(.PaginationButton-next):not(.PaginationButton-prev)');
            if (pages.length > 0) {
                const lastPage = pages[pages.length - 1];
                const num = parseInt(lastPage.textContent);
                if (!isNaN(num)) return num;
            }
        }

        if (platform === 'B站') {
            const pages = document.querySelectorAll('.be-pager-item:not(.be-pager-next):not(.be-pager-prev)');
            if (pages.length > 0) {
                const lastPage = pages[pages.length - 1];
                const num = parseInt(lastPage.textContent);
                if (!isNaN(num)) return num;
            }
        }

        return 1;
    }

    // 检测是否有下一页按钮并点击
    async function goToNextPage() {
        const platform = detectPlatform();

        if (platform === '知乎') {
            const nextBtn = document.querySelector('.PaginationButton-next:not([disabled])') ||
                           document.querySelector('button[aria-label="下一页"]:not([disabled])');
            if (nextBtn && !nextBtn.disabled) {
                nextBtn.click();
                await delay(2500);
                return true;
            }
        }

        if (platform === 'B站') {
            const nextBtn = document.querySelector('.be-pager-next:not(.be-pager-disabled)') ||
                           document.querySelector('.pager .next:not(.disabled)');
            if (nextBtn && !nextBtn.classList.contains('be-pager-disabled') && !nextBtn.classList.contains('disabled')) {
                nextBtn.click();
                await delay(2500);
                return true;
            }
        }

        return false;
    }

    // 检测是否还有更多页
    function hasMorePages() {
        const platform = detectPlatform();

        if (platform === '知乎') {
            const nextBtn = document.querySelector('.PaginationButton-next:not([disabled])');
            return nextBtn && !nextBtn.disabled;
        }

        if (platform === 'B站') {
            const nextBtn = document.querySelector('.be-pager-next:not(.be-pager-disabled)');
            return nextBtn && !nextBtn.classList.contains('be-pager-disabled');
        }

        return false;
    }

    // 滚动并提取（支持多页）
    async function scrollAndExtract() {
        if (isAutoScrolling) {
            isAutoScrolling = false;
            updateStatus('已停止');
            document.getElementById('fm-scroll-extract-btn').textContent = '🔄 滚动加载全部';
            return;
        }

        isAutoScrolling = true;
        const btn = document.getElementById('fm-scroll-extract-btn');
        btn.textContent = '⏹️ 点击停止';

        let previousCount = 0;
        let noNewDataCount = 0;

        // 先提取当前页面已有内容
        await extractFavorites(true);

        while (isAutoScrolling) {
            const currentPage = getCurrentPageNumber();
            const totalPages = getTotalPages();

            updatePageInfo(`当前第 ${currentPage} 页${totalPages > 1 ? ` / 共 ${totalPages} 页` : ''}`);

            // 滚动当前页面到底部
            let scrollAttempts = 0;
            let lastScrollHeight = 0;

            while (isAutoScrolling && scrollAttempts < 5) {
                window.scrollTo(0, document.body.scrollHeight);
                updateStatus(`第 ${currentPage} 页 - 滚动加载中... 已获取 ${favoritesData.length} 条`);
                updateCount();

                await delay(1500);

                // 提取新加载的内容
                await extractFavorites(true);

                const currentScrollHeight = document.body.scrollHeight;
                if (currentScrollHeight === lastScrollHeight) {
                    scrollAttempts++;
                } else {
                    scrollAttempts = 0;
                    lastScrollHeight = currentScrollHeight;
                }
            }

            // 检查是否有新数据
            if (favoritesData.length === previousCount) {
                noNewDataCount++;
            } else {
                noNewDataCount = 0;
                previousCount = favoritesData.length;
            }

            // 尝试翻页
            if (hasMorePages() && isAutoScrolling) {
                const nextPage = currentPage + 1;
                updateStatus(`第 ${currentPage} 页完成，正在翻到第 ${nextPage} 页...`);
                const hasNext = await goToNextPage();
                if (hasNext) {
                    noNewDataCount = 0;
                    await delay(2000);
                    // 滚动到页面顶部
                    window.scrollTo(0, 0);
                    await delay(500);
                } else {
                    break;
                }
            } else {
                // 没有更多页了
                if (noNewDataCount >= 2) {
                    break;
                }
            }
        }

        isAutoScrolling = false;
        btn.textContent = '🔄 滚动加载全部';
        updateCount();

        const finalPage = getCurrentPageNumber();
        updateStatus(`完成！共 ${finalPage} 页，提取 ${favoritesData.length} 条收藏`, 'success');
    }

    // ==================== 抖音提取 ====================
    async function extractDouyinFavorites() {
        const favorites = [];

        const selectors = [
            'div[data-e2e="user-post-item"]',
            'li[data-e2e="scroll-list-item"]',
            '.video-list-item',
            '.ECMagazine',
            'div[class*="DyVideoCard"]',
            'div[class*="video-card"]',
            'a[href*="/video/"]'
        ];

        let items = [];
        for (const selector of selectors) {
            items = document.querySelectorAll(selector);
            if (items.length > 0) {
                console.log(`[抖音] 使用选择器: ${selector}, 找到 ${items.length} 个元素`);
                break;
            }
        }

        // 清理标题：去除换行符、多余空格，只保留第一行作为标题
        function cleanTitle(text) {
            if (!text) return '未知标题';
            // 按换行符分割，取第一行作为标题
            const firstLine = text.split(/[\r\n]+/)[0];
            // 去除多余空格，限制长度
            return firstLine.trim().substring(0, 100) || '未知标题';
        }

        if (items.length === 0) {
            const allLinks = document.querySelectorAll('a[href*="/video/"]');
            allLinks.forEach(link => {
                const url = link.href;
                let title = link.getAttribute('title') ||
                           link.querySelector('p, span, div')?.textContent ||
                           link.textContent ||
                           '未知标题';

                title = cleanTitle(title);

                if (url && !favorites.find(f => f.url === url)) {
                    favorites.push({
                        platform: 'douyin',
                        title: title,
                        url: url,
                    });
                }
            });
        } else {
            items.forEach(item => {
                try {
                    const link = item.querySelector('a[href*="/video/"]') || item.closest('a[href*="/video/"]') || item;
                    const url = link.href || link.querySelector('a')?.href;

                    if (!url || !url.includes('/video/')) return;

                    let title = item.querySelector('[data-e2e="video-desc"]')?.textContent ||
                               item.querySelector('p')?.textContent ||
                               item.querySelector('span[class*="title"]')?.textContent ||
                               item.getAttribute('title') ||
                               link.getAttribute('title') ||
                               '未知标题';

                    title = cleanTitle(title);

                    if (!favorites.find(f => f.url === url)) {
                        favorites.push({
                            platform: 'douyin',
                            title: title,
                            url: url,
                        });
                    }
                } catch (e) {
                    console.error('[抖音] 提取失败:', e);
                }
            });
        }

        return favorites;
    }

    // ==================== B站提取 ====================
    // 提取当前页面中的 B 站视频收藏数据
    async function extractBilibiliFavorites() {
        // 用来存放本次提取到的所有收藏数据
        const favorites = [];

        // 可能出现的收藏/视频列表 DOM 结构选择器（适配不同版本/不同页面样式）
        const selectors = [
            '.fav-video-list .items .item',   // 旧版收藏列表
            '.fav-list-main .items .item',    // 新版收藏列表
            'li.small-item',                  // 小卡片样式
            '.fav-item',                      // 通用收藏项
            '.media-list .media-item',        // 合集或媒体列表
            '.list-container .list-item',     // 通用列表容器
            'a.title[href*="/video/"]',       // 直接带 title 的视频链接
            'a[href*="/video/BV"]'            // 兜底：只要是 BV 视频链接
        ];

        let items = [];
        // 依次尝试每个选择器，找到当前页面实际使用的结构
        for (const selector of selectors) {
            items = document.querySelectorAll(selector);
            if (items.length > 0) {
                console.log(`[B站] 使用选择器: ${selector}, 找到 ${items.length} 个元素`);
                break;
            }
        }

        // 如果以上选择器都没有命中，则退化为：直接扫描整页所有 BV 视频链接
        if (items.length === 0) {
            const allLinks = document.querySelectorAll('a[href*="/video/BV"], a[href*="bilibili.com/video/"]');
            // 用 Set 去重，防止同一链接被多次加入
            const seenUrls = new Set();

            allLinks.forEach(link => {
                let url = link.href;
                // 处理相对链接或协议相对链接，统一补全为完整的 https URL
                if (!url.startsWith('http')) {
                    url = url.startsWith('//') ? 'https:' + url : 'https://www.bilibili.com' + url;
                }

                // 已经处理过的链接直接跳过
                if (seenUrls.has(url)) return;
                seenUrls.add(url);

                // 优先使用 title 属性，其次使用文本或内部 .title 文本
                let title = link.getAttribute('title') ||
                           link.textContent ||
                           link.querySelector('.title')?.textContent ||
                           '未知标题';

                // 去掉首尾空格并限制标题最长 100 字符
                title = title.trim().substring(0, 100);

                // 尝试从父级容器获取视频时长和播放量
                const parentItem = link.closest('.item, .media-item, .list-item, .small-item, .fav-item');
                let duration = '';
                let playCount = '';
                if (parentItem) {
                    duration = parentItem.querySelector('.length, .duration, .time, .video-duration, span[class*="duration"]')?.textContent?.trim() || '';
                    playCount = parentItem.querySelector('.play-count, .view, .play, span[class*="play"], span[class*="view"]')?.textContent?.trim() || '';
                }

                // 只保留标题正常且确认为视频页面的链接
                if (title && title !== '未知标题' && url.includes('/video/')) {
                    favorites.push({
                        platform: 'bilibili',                 // 平台标记
                        title: title,                          // 视频标题
                        url: url,                              // 视频链接
                        duration: duration,                    // 视频时长
                        playCount: playCount,                  // 播放量
                    });
                }
            });
        } else {
            // 找到了明确的收藏项 DOM 列表时，从每一项中抽取信息
            items.forEach(item => {
                try {
                    // 优先在当前条目内找视频链接，找不到则退化为整个条目
                    const link = item.querySelector('a[href*="/video/"], a.title') || item;
                    let url = link.href || link.querySelector('a')?.href;

                    // 没有 URL 直接跳过
                    if (!url) return;
                    // 同样处理相对/协议相对链接
                    if (!url.startsWith('http')) {
                        url = url.startsWith('//') ? 'https:' + url : 'https://www.bilibili.com' + url;
                    }

                    // 多种方式尝试获取标题：自身 title、内部 .title、内部 a 的 title 或文本
                    let title = link.getAttribute('title') ||
                               item.querySelector('.title')?.textContent ||
                               item.querySelector('a')?.getAttribute('title') ||
                               link.textContent ||
                               '未知标题';

                    // 尝试获取 UP 主名称（不同页面结构 class 名不一样）
                    const uploader = item.querySelector('.up-name a, .author')?.textContent || '';

                    // 获取视频时长
                    const duration = item.querySelector('.length, .duration, .time, .video-duration, span[class*="duration"]')?.textContent?.trim() || '';

                    // 获取播放量
                    const playCount = item.querySelector('.play-count, .view, .play, span[class*="play"], span[class*="view"]')?.textContent?.trim() || '';

                    // 标题去空格并截断长度
                    title = title.trim().substring(0, 100);

                    // 去重：同一 URL 只保留一条；同时只接受 /video/ 页面
                    if (!favorites.find(f => f.url === url) && url.includes('/video/')) {
                        favorites.push({
                            platform: 'bilibili',                 // 平台
                            title: title,                          // 标题
                            url: url,                              // 视频链接
                            uploader: uploader.trim(),             // UP 主
                            duration: duration,                    // 视频时长
                            playCount: playCount,                  // 播放量
                        });
                    }
                } catch (e) {
                    // 单条解析失败不影响整体流程，只打印错误日志
                    console.error('[B站] 提取失败:', e);
                }
            });
        }

        // 返回当前页面提取出的所有 B 站收藏数据
        return favorites;
    }

    // ==================== 知乎提取 ====================
    async function extractZhihuFavorites() {
        const favorites = [];

        const selectors = [
            '.CollectionDetailPageItem',
            '.List-item',
            '.ContentItem',
            '.AnswerItem',
            '.ArticleItem',
            '.Card'
        ];

        let items = [];
        for (const selector of selectors) {
            items = document.querySelectorAll(selector);
            if (items.length > 0) {
                console.log(`[知乎] 使用选择器: ${selector}, 找到 ${items.length} 个元素`);
                break;
            }
        }

        items.forEach(item => {
            try {
                const linkEl = item.querySelector('a[href*="/question/"], a[href*="/p/"], h2 a, .ContentItem-title a');
                if (!linkEl) return;

                let url = linkEl.href;
                if (!url.startsWith('http')) {
                    url = 'https://www.zhihu.com' + url;
                }

                let title = linkEl.textContent ||
                           item.querySelector('.ContentItem-title')?.textContent ||
                           item.querySelector('h2')?.textContent ||
                           '未知标题';

                const author = item.querySelector('.AuthorInfo-name a, .UserLink-link, .AuthorInfo a')?.textContent || '';
                const excerpt = item.querySelector('.RichContent-inner, .RichText')?.textContent?.substring(0, 200) || '';

                title = title.trim().substring(0, 100);

                if (!favorites.find(f => f.url === url)) {
                    favorites.push({
                        platform: 'zhihu',
                        title: title,
                        url: url,
                        author: author.trim(),
                        excerpt: excerpt.trim(),
                    });
                }
            } catch (e) {
                console.error('[知乎] 提取失败:', e);
            }
        });

        return favorites;
    }

    // 主提取函数
    async function extractFavorites(silent = false) {
        const btn = document.getElementById('fm-extract-btn');
        if (!silent && btn) btn.disabled = true;

        try {
            let newFavorites = [];
            const hostname = window.location.hostname;

            if (!silent) updateStatus('正在提取...');

            if (hostname.includes('douyin.com')) {
                newFavorites = await extractDouyinFavorites();
            } else if (hostname.includes('bilibili.com')) {
                newFavorites = await extractBilibiliFavorites();
            } else if (hostname.includes('zhihu.com')) {
                newFavorites = await extractZhihuFavorites();
            }

            if (newFavorites.length === 0 && !silent) {
                updateStatus('未找到收藏内容，尝试滚动页面加载更多', 'error');
                return;
            }

            // 合并数据，去重
            const existingUrls = new Set(favoritesData.map(f => f.url));
            const uniqueNew = newFavorites.filter(f => !existingUrls.has(f.url));

            favoritesData = [...favoritesData, ...uniqueNew];
            updateCount();

            if (!silent) {
                updateStatus(
                    `成功提取 ${newFavorites.length} 条（新增 ${uniqueNew.length}，总计 ${favoritesData.length}）`,
                    'success'
                );
            }

            // 启用导出按钮
            if (favoritesData.length > 0) {
                toggleExportButtons(true);
            }

        } catch (error) {
            console.error('提取失败:', error);
            if (!silent) updateStatus(`错误: ${error.message}`, 'error');
        } finally {
            if (!silent && btn) btn.disabled = false;
        }
    }

    // 初始化
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(createPanel, 1500);
            });
        } else {
            setTimeout(createPanel, 1500);
        }
    }

    init();
})();
