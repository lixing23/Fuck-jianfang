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
- **5 种内容模式** —— 热门池 / UP主画像 / 跨分区 / 冷门优质 / 每周必看，Popup 内一键切换
- **去重机制** —— `shownBvids` Set 记录已展示，"换一批"不再重复
- **极简 UI** —— 工具栏 Popup，不占用网页界面

## 内容模式

| 模式 | 数据源 | 说明 |
|------|--------|------|
| **热门池**（默认） | `/x/web-interface/popular` | 全站热门 5 页 100 条，随机替换 |
| **UP主画像** | 搜索 + 标签 + related | 输入 UP 主名（如"老番茄"），基于其投稿标签构建视频池，related 跨 UP 主扩展。能刷到"他看的世界" |
| **跨分区** | `/x/web-interface/ranking/v2` | 随机 6 个分区排行榜，每区取 5 条，保证跨分区多样性 |
| **冷门优质** | popular + related 递归 | 从热门取种子，related 递归扩展到 50 万播放以下的冷门视频 |
| **每周必看** | `/x/web-interface/popular/series` | B 站官方"每周必看"最近 2 期编辑精选 |

## 安装

1. 下载或 clone 本仓库
2. 打开 `chrome://extensions`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择本目录（含 `manifest.json` 的文件夹）

## 使用

- 点击浏览器工具栏的 **Fuck茧房** 图标
- 开关：启用 / 关闭推荐替换
- **内容模式**：点击 5 个按钮切换视频池来源
  - 选 **UP主画像** 时，下方会出现输入框，填入 UP 主名（如"老番茄"）
- 刷新按钮：重新加载当前页（让新模式立即生效）
- 默认状态：启用 + 热门池模式

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

- 热门池模式内容偏主流（另一种"大众茧房"）
- UP主画像模式依赖搜索接口，高频调用可能触发 B 站风控（已用 WBI 签名缓解）
- 冷门优质模式依赖 related 递归，视频池较小
- 部分模式首次加载需要多次 API 请求，填充速度比热门池慢

## License

MIT
