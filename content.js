(function () {
    'use strict';

    // ==================== 配置 ====================
    let active = true;

    window.addEventListener('message', function (event) {
        if (event.source !== window) return;
        if (event.data.type === 'cocoon-config' && event.data.config) {
            active = event.data.config.active !== false;
            console.log('[Fuck茧房] 配置已更新:', active ? '启用' : '关闭');
            if (active) fillPool();
        }
    });
    window.postMessage({ type: 'cocoon-request-config' }, '*');

    // ==================== 视频池 + 去重 ====================
    const videoPool = [];
    const shownBvids = new Set();
    const poolBvids = new Set();
    let loadingMore = false;

    async function fillPool() {
        if (loadingMore) return;
        loadingMore = true;
        try {
            const startPage = Math.floor(Math.random() * 5) + 1;
            const results = await Promise.all(
                [0, 1, 2, 3, 4].map(i =>
                    fetch(`https://api.bilibili.com/x/web-interface/popular?ps=20&pn=${startPage + i}`, { credentials: 'include' })
                        .then(r => r.json()).catch(() => null)
                )
            );
            let added = 0;
            results.forEach(d => {
                if (!d || d.code !== 0 || !d.data?.list) return;
                d.data.list.forEach(v => {
                    if (poolBvids.has(v.bvid)) return;
                    poolBvids.add(v.bvid);
                    videoPool.push({
                        bvid: v.bvid,
                        aid: v.aid,
                        cid: v.cid,
                        title: v.title,
                        pic: (v.pic || '').replace('http://', 'https://'),
                        up: v.owner?.name || '',
                        mid: v.owner?.mid || 0,
                        face: v.owner?.face || '',
                        view: v.stat?.view || 0,
                        like: v.stat?.like || 0,
                        danmaku: v.stat?.danmaku || 0,
                        duration: v.duration,
                        pubdate: v.pubdate,
                    });
                    added++;
                });
            });
            console.log('[Fuck茧房] 视频池已填充:', videoPool.length, '个 (+', added, ')');
        } catch (e) {
            console.log('[Fuck茧房] 填充视频池失败:', e);
        }
        loadingMore = false;
    }

    function getVideoFromPool() {
        if (!active) return null;

        let candidates = videoPool.filter(v => !shownBvids.has(v.bvid));

        if (candidates.length === 0) {
            console.log('[Fuck茧房] 去重记录已清空，重新开始');
            shownBvids.clear();
            candidates = videoPool.filter(v => true);
        }

        if (candidates.length === 0) return null;

        const idx = Math.floor(Math.random() * candidates.length);
        const video = candidates[idx];
        videoPool.splice(videoPool.indexOf(video), 1);
        poolBvids.delete(video.bvid);
        shownBvids.add(video.bvid);

        if (videoPool.length < 20) fillPool();

        return video;
    }

    // ==================== 响应拦截 ====================
    function buildFeedItem(video) {
        return {
            id: video.aid,
            bvid: video.bvid,
            cid: video.cid,
            goto: 'av',
            uri: 'https://www.bilibili.com/video/' + video.bvid,
            pic: video.pic,
            pic_4_3: video.pic,
            title: video.title,
            duration: video.duration,
            pubdate: video.pubdate,
            owner: { mid: video.mid, name: video.up, face: video.face },
            stat: { view: video.view || 0, like: video.like || 0, danmaku: video.danmaku || 0, vt: 0 },
            av_feature: null,
            is_followed: 0,
            rcmd_reason: { reason_type: 0 },
            show_info: 1,
            track_id: '',
            pos: 0,
            room_info: null,
            ogv_info: null,
            business_info: null,
            is_stock: 0,
            enable_vt: 0,
            vt_display: '',
            dislike_switch: 1,
            dislike_switch_pc: 1
        };
    }

    function replaceFeedItems(items) {
        if (!items || !items.length) return items;
        const result = [];
        let replaced = 0;
        items.forEach(item => {
            if (item.goto === 'av') {
                const video = getVideoFromPool();
                if (video) {
                    result.push(buildFeedItem(video));
                    replaced++;
                } else {
                    result.push(item);
                }
            } else {
                result.push(item);
            }
        });
        if (replaced > 0) console.log('[Fuck茧房] 响应拦截: 替换', replaced, '个, 已展示', shownBvids.size, '个, 池剩余', videoPool.length);
        return result;
    }

    function patchResponse(data) {
        try {
            if (data && data.code === 0 && data.data && data.data.item) {
                if (!active) return false;
                data.data.item = replaceFeedItems(data.data.item);
                return true;
            }
        } catch (e) { }
        return false;
    }

    function installResponseInterceptor() {
        if (window.__cocoonRespInterceptorInstalled) return;
        window.__cocoonRespInterceptorInstalled = true;

        // ---- fetch ----
        const origFetch = window.fetch;
        window.fetch = function (input, init) {
            const url = typeof input === 'string' ? input : (input && input.url);
            if (!url || url.indexOf('/index/top/feed/rcmd') === -1) return origFetch.apply(this, arguments);
            return origFetch.apply(this, arguments).then(response => {
                return response.clone().text().then(text => {
                    try {
                        const data = JSON.parse(text);
                        if (patchResponse(data)) {
                            return new Response(JSON.stringify(data), {
                                status: response.status,
                                statusText: response.statusText,
                                headers: response.headers
                            });
                        }
                    } catch (e) { }
                    return response;
                });
            });
        };

        // ---- XHR 兜底 ----
        const origOpen = XMLHttpRequest.prototype.open;
        const origTextDesc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText');
        XMLHttpRequest.prototype.open = function (method, url) {
            if (typeof url === 'string' && url.indexOf('/index/top/feed/rcmd') !== -1) {
                const xhr = this;
                let patched = null;
                Object.defineProperty(xhr, 'responseText', {
                    get() {
                        if (patched !== null) return patched;
                        const orig = origTextDesc.get.call(xhr);
                        try {
                            const data = JSON.parse(orig);
                            if (patchResponse(data)) {
                                patched = JSON.stringify(data);
                                return patched;
                            }
                        } catch (e) { }
                        return orig;
                    },
                    configurable: true
                });
            }
            return origOpen.apply(this, arguments);
        };

        console.log('[Fuck茧房] 响应拦截器已安装（fetch + XHR）');
    }

    // ==================== 初始化 ====================
    function init() {
        if (window.location.hostname !== 'www.bilibili.com' && window.location.hostname !== 'bilibili.com') return;
        installResponseInterceptor();
        fillPool();
    }

    init();
})();
