# Fuck茧房 🍃

> 在数据源头替换 B 站首页推荐流，打破信息茧房，零卡顿。

一个 Chrome 扩展（Manifest V3），通过响应拦截技术在 B 站推荐 API 返回数据**到达页面渲染前**完成替换，把首页推荐流换成跨分区热门视频池。无 DOM 替换、无二次渲染、无加载卡顿。

## 为什么叫这个名字

因为信息茧房该被Fuck掉。

## 工作原理

```
B站前端 ──fetch──▶ 推荐API
                     │
                     ▼
              响应拦截器（MAIN world, document_start）
                     │
                     ▼
              替换 item[] 为视频池中的内容
                     │
                     ▼
              页面正常渲染（零卡顿）
```

传统 DOM 替换方案会触发二次渲染、图片重载导致卡顿。本扩展在 `fetch` / `XMLHttpRequest` 的响应阶段直接改写 JSON，页面拿到替换后的数据一次渲染完成。

## 特性

- **响应层拦截** —— 零卡顿，页面无感知
- **跨分区视频池** —— 5 页 100+ 条热门视频随机替换
- **去重机制** —— `shownBvids` Set 记录已展示，"换一批"不再重复
- **极简 UI** —— 工具栏 Popup 仅含开关 + 刷新按钮，不占用网页界面

## 安装

1. 下载或 clone 本仓库
2. 打开 `chrome://extensions`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择本目录（含 `manifest.json` 的文件夹）

## 使用

- 点击浏览器工具栏的 **Fuck茧房** 图标
- 开关：启用 / 关闭推荐替换
- 刷新按钮：重新加载当前页（让替换立即生效）
- 默认状态：启用

## 文件结构

```
Fuck茧房/
├── manifest.json       # Manifest V3 配置
├── content.js          # 核心逻辑：响应拦截 + 视频池 + 替换
├── popup.html          # 工具栏弹窗 UI
├── popup.js            # 弹窗逻辑：开关 + 刷新
└── storage-bridge.js   # 跨世界桥接：chrome.storage ↔ MAIN world
```

## 技术细节

### 跨世界通信

Manifest V3 的 content script 默认运行在隔离世界，无法直接访问页面 JS 上下文。本扩展用双脚本方案：

- `storage-bridge.js`（ISOLATED 世界）：读写 `chrome.storage.local`，通过 `postMessage` 转发配置
- `content.js`（MAIN 世界）：监听 `postMessage`，执行 `fetch` / `XHR` 拦截

### 视频池

- 数据源：`/x/web-interface/popular`（B 站全站热门）
- 容量：5 页 × 20 条 = 100 条
- 随机起始页，避免每次刷新都看到同样顺序
- `shownBvids` 跟踪已展示视频，用尽后自动清空重开始

### 响应拦截

在 `fetch` 和 `XMLHttpRequest.prototype.open` 上打补丁，匹配 B 站推荐流接口（`/x/web-interface/index/top/feed/rcmd` 等），在 `response` 返回前改写 `data.item[]`：

- 标题、UP 主、封面、播放量、bvid、cid 全量替换
- 保留原始 `item` 中未替换项，避免页面空白
- 按顺序消费视频池，池空时自动补充

## 兼容性

- Chrome / Edge / 任何基于 Chromium 的浏览器
- 需要开启「开发者模式」加载未打包扩展
- Manifest V3，兼容最新版浏览器策略

## 已知限制

- 视频池来源是全站热门，分区分布可能偏主流
- 如需精准匹配特定兴趣，可扩展 `fillPool()` 加入 `related` / `search` 等数据源

## License

MIT
