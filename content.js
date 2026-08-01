(function () {
    'use strict';

    // ==================== 配置 ====================
    let active = true;
    let mode = 'popular'; // popular | upmaster | crossregion | niche | weekly
    let upmasterName = ''; // UP主画像模式用的名字

    window.addEventListener('message', function (event) {
        if (event.source !== window) return;
        if (event.data.type === 'cocoon-config' && event.data.config) {
            const cfg = event.data.config;
            const newMode = cfg.mode || 'popular';
            const newName = cfg.upmasterName || '';
            const modeChanged = (newMode !== mode) || (newMode === 'upmaster' && newName !== upmasterName);
            active = cfg.active !== false;
            mode = newMode;
            upmasterName = newName;
            console.log('[Fuck茧房] 配置已更新:', active ? '启用' : '关闭', '模式:', mode, upmasterName ? 'UP:' + upmasterName : '');
            if (active) {
                if (modeChanged) {
                    resetPool();
                    loadingMore = false; // 强制解锁，让新模式能立即填充
                }
                fillPool();
            }
        }
    });
    window.postMessage({ type: 'cocoon-request-config' }, '*');

    // ==================== WBI 签名 ====================
    const MIXIN_KEY_ENC_TAB = [
        46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
        27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
        37, 36, 25, 24, 21, 17, 20, 44, 55, 39, 57, 7, 52, 51, 6, 16,
        0, 11, 1, 22, 40, 30, 34, 59, 54, 4, 26, 56, 61, 48, 60, 63
    ];
    let _wbiKeys = null;
    async function getWbiKeys() {
        if (_wbiKeys) return _wbiKeys;
        try {
            const r = await fetch('https://api.bilibili.com/x/web-interface/nav', { credentials: 'include' });
            const d = await r.json();
            const img = d.data.wbi_img.img_url.rsplit('/', 1)[0].split('.')[0];
            const sub = d.data.wbi_img.sub_url.rsplit('/', 1)[0].split('.')[0];
            _wbiKeys = { img, sub };
            return _wbiKeys;
        } catch (e) { return null; }
    }
    function mixinKey(orig) {
        return [...MIXIN_KEY_ENC_TAB].map(i => orig[i]).join('').slice(0, 32);
    }
    async function wbiSign(params) {
        const keys = await getWbiKeys();
        if (!keys) return new URLSearchParams(params).toString();
        const mk = mixinKey(keys.img + keys.sub);
        params.wts = Math.round(Date.now() / 1000);
        const query = Object.keys(params).sort().map(k => {
            const v = String(params[k]).replace(/[!'()*]/g, '');
            return `${k}=${encodeURIComponent(v)}`;
        }).join('&');
        const w_rid = await md5hex(query + mk);
        return query + '&w_rid=' + w_rid;
    }
    // MD5 实现（inline，避免依赖外部库）
    function md5hex(str) {
        function rl(n, c) { return (n << c) | (n >>> (32 - c)); }
        function cmn(q, a, b, x, s, t) { a = add(add(a, q), add(x, t)); return add(rl(a, s), b); }
        function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
        function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
        function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
        function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }
        function add(x, y) { const m = 0x80000000; const a = x & m; const b = y & m; const r = (x & 0x3fffffff) + (y & 0x3fffffff); if (a & b) return r ^ m ^ 0x80000000; if (a | b) { return (r & 0x40000000) ? (r ^ m ^ 0x40000000) : (r | 0x40000000); } return r; }
        function toHex(n) { let s = ''; for (let j = 0; j < 4; j++) { s += ((n >> (j * 8 + 4)) & 0xf).toString(16) + ((n >> (j * 8)) & 0xf).toString(16); } return s; }
        const utf8 = unescape(encodeURIComponent(str));
        const len = utf8.length;
        const x = [];
        for (let i = 0; i < len; i++) x[i >> 2] = (x[i >> 2] || 0) | (utf8.charCodeAt(i) << ((i % 4) * 8));
        x[len >> 2] = (x[len >> 2] || 0) | (0x80 << ((len % 4) * 8));
        x[(((len + 8) >> 6) + 1) * 16 - 2] = len * 8;
        let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
        for (let i = 0; i < x.length; i += 16) {
            const oa = a, ob = b, oc = c, od = d;
            a = ff(a, b, c, d, x[i], 7, -680876936); d = ff(d, a, b, c, x[i+1], 12, -389564586); c = ff(c, d, a, b, x[i+2], 17, 606105819); b = ff(b, c, d, a, x[i+3], 22, -1044525330);
            a = ff(a, b, c, d, x[i+4], 7, -176418897); d = ff(d, a, b, c, x[i+5], 12, 1200080426); c = ff(c, d, a, b, x[i+6], 17, -1473231341); b = ff(b, c, d, a, x[i+7], 22, -45705983);
            a = ff(a, b, c, d, x[i+8], 7, 1770035416); d = ff(d, a, b, c, x[i+9], 12, -1958414417); c = ff(c, d, a, b, x[i+10], 17, -42063); b = ff(b, c, d, a, x[i+11], 22, -1990404162);
            a = ff(a, b, c, d, x[i+12], 7, 1804603682); d = ff(d, a, b, c, x[i+13], 12, -40341101); c = ff(c, d, a, b, x[i+14], 17, -1502002290); b = ff(b, c, d, a, x[i+15], 22, 1236535329);
            a = gg(a, b, c, d, x[i+1], 5, -165796510); d = gg(d, a, b, c, x[i+6], 9, -1069501632); c = gg(c, d, a, b, x[i+11], 14, 643717713); b = gg(b, c, d, a, x[i], 20, -373897302);
            a = gg(a, b, c, d, x[i+5], 5, -701558691); d = gg(d, a, b, c, x[i+10], 9, 38016083); c = gg(c, d, a, b, x[i+15], 14, -660478335); b = gg(b, c, d, a, x[i+4], 20, -405537848);
            a = gg(a, b, c, d, x[i+9], 5, 568446438); d = gg(d, a, b, c, x[i+14], 9, -1019803690); c = gg(c, d, a, b, x[i+3], 14, -187363961); b = gg(b, c, d, a, x[i+8], 20, 1163531501);
            a = gg(a, b, c, d, x[i+13], 5, -1444681467); d = gg(d, a, b, c, x[i+2], 9, -51403784); c = gg(c, d, a, b, x[i+7], 14, 1735328473); b = gg(b, c, d, a, x[i+12], 20, -1926607734);
            a = hh(a, b, c, d, x[i+5], 4, -378558); d = hh(d, a, b, c, x[i+8], 11, -2022574463); c = hh(c, d, a, b, x[i+11], 16, 1839030562); b = hh(b, c, d, a, x[i+14], 23, -35309556);
            a = hh(a, b, c, d, x[i+1], 4, -1530992060); d = hh(d, a, b, c, x[i+4], 11, 1272893353); c = hh(c, d, a, b, x[i+7], 16, -155497632); b = hh(b, c, d, a, x[i+10], 23, -1094730640);
            a = hh(a, b, c, d, x[i+13], 4, 681279174); d = hh(d, a, b, c, x[i], 11, -358537222); c = hh(c, d, a, b, x[i+3], 16, -722521979); b = hh(b, c, d, a, x[i+6], 23, 76029189);
            a = hh(a, b, c, d, x[i+9], 4, -640364487); d = hh(d, a, b, c, x[i+12], 11, -421815835); c = hh(c, d, a, b, x[i+15], 16, 530742520); b = hh(b, c, d, a, x[i+2], 23, -995338651);
            a = ii(a, b, c, d, x[i], 6, -198630844); d = ii(d, a, b, c, x[i+7], 10, 1126891415); c = ii(c, d, a, b, x[i+14], 15, -1416354905); b = ii(b, c, d, a, x[i+5], 21, -57434055);
            a = ii(a, b, c, d, x[i+12], 6, 1700485571); d = ii(d, a, b, c, x[i+3], 10, -1894986606); c = ii(c, d, a, b, x[i+10], 15, -1051523); b = ii(b, c, d, a, x[i+1], 21, -2054922799);
            a = ii(a, b, c, d, x[i+8], 6, 1873313359); d = ii(d, a, b, c, x[i+15], 10, -30611744); c = ii(c, d, a, b, x[i+6], 15, -1560198380); b = ii(b, c, d, a, x[i+13], 21, 1309151649);
            a = ii(a, b, c, d, x[i+4], 6, -145523070); d = ii(d, a, b, c, x[i+11], 10, -1120210379); c = ii(c, d, a, b, x[i+2], 15, 718787259); b = ii(b, c, d, a, x[i+9], 21, -343485551);
            a = add(a, oa); b = add(b, ob); c = add(c, oc); d = add(d, od);
        }
        return (toHex(a) + toHex(b) + toHex(c) + toHex(d));
    }

    // ==================== 视频池 + 去重 ====================
    const videoPool = [];
    const shownBvids = new Set();
    const poolBvids = new Set();
    let loadingMore = false;

    function resetPool() {
        videoPool.length = 0;
        shownBvids.clear();
        poolBvids.clear();
        console.log('[Fuck茧房] 视频池已重置（模式切换）');
    }

    function pushVideo(v) {
        if (!v || !v.bvid || poolBvids.has(v.bvid)) return false;
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
        return true;
    }

    // ---- 模式1: 热门池（默认）----
    async function fillPopular() {
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
            d.data.list.forEach(v => { if (pushVideo(v)) added++; });
        });
        return added;
    }

    // ---- 模式2: UP主画像 ----
    async function fillUpmaster() {
        if (!upmasterName) return 0;
        let added = 0;
        try {
            // 步骤1: 搜索UP主的视频作为种子
            const seedParams = { keyword: upmasterName, search_type: 'video', order: 'pubdate', page: 1 };
            const seedSigned = await wbiSign(seedParams);
            const seedRes = await fetch(`https://api.bilibili.com/x/web-interface/wbi/search/type?${seedSigned}`, { credentials: 'include' })
                .then(r => r.json()).catch(() => null);
            if (!seedRes || seedRes.code !== 0) return 0;
            const seedVideos = seedRes.data?.result || [];
            // 搜索结果直接加入池
            seedVideos.forEach(v => {
                if (pushVideo({ bvid: v.bvid, aid: v.aid, cid: v.cid, title: v.title.replace(/<[^>]+>/g, ''), pic: (v.pic || '').replace('http://', 'https://'), owner: { name: v.author, mid: v.mid }, stat: { view: v.play, like: v.like }, duration: v.duration, pubdate: v.pubdate })) added++;
            });

            // 步骤2: 取前3个视频的标签
            const tagCounter = {};
            for (const v of seedVideos.slice(0, 3)) {
                try {
                    const tagRes = await fetch(`https://api.bilibili.com/x/tag/archive/tags?bvid=${v.bvid}`, { credentials: 'include' }).then(r => r.json());
                    if (tagRes.code === 0 && tagRes.data) {
                        tagRes.data.forEach(t => { tagCounter[t.tag_name] = (tagCounter[t.tag_name] || 0) + 1; });
                    }
                } catch (e) { }
            }
            // 步骤3: 用高频标签搜索扩展
            const topTags = Object.entries(tagCounter).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
            for (const tag of topTags) {
                try {
                    const sp = { keyword: tag, search_type: 'video', order: 'totalrank', page: 1 };
                    const ss = await wbiSign(sp);
                    const sr = await fetch(`https://api.bilibili.com/x/web-interface/wbi/search/type?${ss}`, { credentials: 'include' }).then(r => r.json());
                    if (sr.code === 0 && sr.data?.result) {
                        sr.data.result.forEach(v => {
                            if (pushVideo({ bvid: v.bvid, aid: v.aid, cid: v.cid, title: v.title.replace(/<[^>]+>/g, ''), pic: (v.pic || '').replace('http://', 'https://'), owner: { name: v.author, mid: v.mid }, stat: { view: v.play, like: v.like }, duration: v.duration, pubdate: v.pubdate })) added++;
                        });
                    }
                } catch (e) { }
            }

            // 步骤4: related跨UP主扩展
            if (seedVideos.length > 0) {
                const seed = seedVideos[0];
                try {
                    const rr = await fetch(`https://api.bilibili.com/x/web-interface/archive/related?bvid=${seed.bvid}`, { credentials: 'include' }).then(r => r.json());
                    if (rr.code === 0 && rr.data) {
                        rr.data.forEach(v => { if (pushVideo(v)) added++; });
                    }
                } catch (e) { }
            }
        } catch (e) {
            console.log('[Fuck茧房] UP主画像填充失败:', e);
        }
        return added;
    }

    // ---- 模式3: 跨分区 ----
    async function fillCrossRegion() {
        // 主要分区tid列表
        const rids = [1, 3, 4, 5, 36, 119, 129, 155, 160, 168, 188, 211, 217, 223, 234];
        // 随机选6个分区，每个拉排行榜
        const shuffled = rids.sort(() => Math.random() - 0.5).slice(0, 6);
        let added = 0;
        const results = await Promise.all(shuffled.map(rid =>
            fetch(`https://api.bilibili.com/x/web-interface/ranking/v2?rid=${rid}&type=all`, { credentials: 'include' })
                .then(r => r.json()).catch(() => null)
        ));
        results.forEach(d => {
            if (!d || d.code !== 0 || !d.data?.list) return;
            // 每个分区取前5个
            d.data.list.slice(0, 5).forEach(v => { if (pushVideo(v)) added++; });
        });
        return added;
    }

    // ---- 模式4: 冷门优质（related递归到非热门）----
    async function fillNiche() {
        let added = 0;
        try {
            // 先从热门取1个种子
            const seedRes = await fetch(`https://api.bilibili.com/x/web-interface/popular?ps=5&pn=1`, { credentials: 'include' }).then(r => r.json());
            if (seedRes.code !== 0 || !seedRes.data?.list) return 0;
            const seed = seedRes.data.list[Math.floor(Math.random() * seedRes.data.list.length)];
            // related第1层
            const r1 = await fetch(`https://api.bilibili.com/x/web-interface/archive/related?bvid=${seed.bvid}`, { credentials: 'include' }).then(r => r.json());
            if (r1.code !== 0) return 0;
            // 过滤掉高播放的，保留中低播放
            const niche1 = r1.data.filter(v => (v.stat?.view || 0) < 500000);
            niche1.forEach(v => { if (pushVideo(v)) added++; });
            // related第2层：从第1层选一个非热门的继续扩展
            if (niche1.length > 0) {
                const seed2 = niche1[Math.floor(Math.random() * Math.min(3, niche1.length))];
                const r2 = await fetch(`https://api.bilibili.com/x/web-interface/archive/related?bvid=${seed2.bvid}`, { credentials: 'include' }).then(r => r.json());
                if (r2.code === 0) {
                    r2.data.filter(v => (v.stat?.view || 0) < 500000).forEach(v => { if (pushVideo(v)) added++; });
                }
            }
        } catch (e) {
            console.log('[Fuck茧房] 冷门优质填充失败:', e);
        }
        return added;
    }

    // ---- 模式5: 每周必看 ----
    async function fillWeekly() {
        let added = 0;
        try {
            // 获取每周必看列表
            const seriesRes = await fetch(`https://api.bilibili.com/x/web-interface/popular/series/list`, { credentials: 'include' }).then(r => r.json());
            if (seriesRes.code !== 0 || !seriesRes.data?.list) return 0;
            // 取最近2期
            const recent = seriesRes.data.list.slice(0, 2);
            const results = await Promise.all(recent.map(s =>
                fetch(`https://api.bilibili.com/x/web-interface/popular/series/one?number=${s.number}`, { credentials: 'include' })
                    .then(r => r.json()).catch(() => null)
            ));
            results.forEach(d => {
                if (!d || d.code !== 0 || !d.data?.list) return;
                d.data.list.forEach(v => { if (pushVideo(v)) added++; });
            });
        } catch (e) {
            console.log('[Fuck茧房] 每周必看填充失败:', e);
        }
        return added;
    }

    async function fillPool() {
        if (loadingMore) return;
        loadingMore = true;
        try {
            let added = 0;
            const modeLabel = { popular: '热门池', upmaster: 'UP主画像', crossregion: '跨分区', niche: '冷门优质', weekly: '每周必看' }[mode] || mode;
            switch (mode) {
                case 'upmaster': added = await fillUpmaster(); break;
                case 'crossregion': added = await fillCrossRegion(); break;
                case 'niche': added = await fillNiche(); break;
                case 'weekly': added = await fillWeekly(); break;
                default: added = await fillPopular(); break;
            }
            console.log(`[Fuck茧房] [${modeLabel}] 视频池已填充:`, videoPool.length, '个 (+', added, ')');
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
        // 不主动填充，等配置消息到达后由配置驱动 fillPool()
        // 若 1.5 秒后仍未收到配置，兜底用默认模式填充
        setTimeout(function () {
            if (videoPool.length === 0 && !loadingMore) fillPool();
        }, 1500);
    }

    init();
})();
