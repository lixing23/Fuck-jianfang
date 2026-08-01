// storage-bridge.js — ISOLATED 世界，桥接 chrome.storage 和 MAIN 世界 content.js
(function () {
    'use strict';

    const DEFAULT_CONFIG = { active: true, mode: 'popular', upmasterName: '' };

    function postConfig(config) {
        window.postMessage({ type: 'cocoon-config', config: config }, '*');
    }

    chrome.storage.local.get('cocoon_config', function (result) {
        postConfig(result.cocoon_config || DEFAULT_CONFIG);
    });

    chrome.storage.onChanged.addListener(function (changes, area) {
        if (area === 'local' && changes.cocoon_config) {
            postConfig(changes.cocoon_config.newValue || DEFAULT_CONFIG);
        }
    });

    window.addEventListener('message', function (event) {
        if (event.source !== window) return;
        if (event.data.type === 'cocoon-request-config') {
            chrome.storage.local.get('cocoon_config', function (result) {
                postConfig(result.cocoon_config || DEFAULT_CONFIG);
            });
        }
    });
})();
