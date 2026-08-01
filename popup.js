let config = { active: true, mode: 'popular', upmasterName: '' };

function render() {
    document.getElementById('active').checked = config.active;
    const badge = document.getElementById('status');
    badge.textContent = config.active ? '运行中' : '已关闭';
    badge.classList.toggle('off', !config.active);

    // 模式按钮高亮
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === config.mode);
    });

    // UP主输入框显示/隐藏
    const upInput = document.getElementById('upmaster-input');
    upInput.classList.toggle('show', config.mode === 'upmaster');
    document.getElementById('upmaster-name').value = config.upmasterName || '';
}

function save() {
    chrome.storage.local.set({ cocoon_config: config });
}

chrome.storage.local.get('cocoon_config', function (result) {
    if (result.cocoon_config) config = Object.assign({ active: true, mode: 'popular', upmasterName: '' }, result.cocoon_config);
    render();
});

document.getElementById('active').addEventListener('change', function () {
    config.active = this.checked;
    save();
    render();
});

document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        config.mode = this.dataset.mode;
        save();
        render();
    });
});

document.getElementById('upmaster-name').addEventListener('change', function () {
    config.upmasterName = this.value.trim();
    save();
});

document.getElementById('refresh').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) chrome.tabs.reload(tabs[0].id);
        window.close();
    });
});
