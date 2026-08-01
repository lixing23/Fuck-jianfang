let config = { active: true };

function render() {
    document.getElementById('active').checked = config.active;
    const badge = document.getElementById('status');
    badge.textContent = config.active ? '运行中' : '已关闭';
    badge.classList.toggle('off', !config.active);
}

function save() {
    chrome.storage.local.set({ cocoon_config: config });
}

chrome.storage.local.get('cocoon_config', function (result) {
    if (result.cocoon_config) config = result.cocoon_config;
    render();
});

document.getElementById('active').addEventListener('change', function () {
    config.active = this.checked;
    save();
    render();
});

document.getElementById('refresh').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) chrome.tabs.reload(tabs[0].id);
        window.close();
    });
});
