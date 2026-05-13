const DEFAULT_CHECK_TIME = '00:10';

function loadSettings() {
    chrome.storage.local.get(['checkTime', 'enabledTargets'], (result) => {
        const checkTimeEl = document.getElementById('checkTime');
        const endfieldEl = document.getElementById('enableEndfield');
        const arknightsEl = document.getElementById('enableArknights');

        if (checkTimeEl) {
            checkTimeEl.value = result.checkTime || DEFAULT_CHECK_TIME;
        }

        if (endfieldEl) {
            endfieldEl.checked = result.enabledTargets?.endfield !== false;
        }

        if (arknightsEl) {
            arknightsEl.checked = result.enabledTargets?.arknights !== false;
        }
    });
}

function collectSettings() {
    return {
        checkTime: document.getElementById('checkTime')?.value || DEFAULT_CHECK_TIME,
        enabledTargets: {
            endfield: document.getElementById('enableEndfield')?.checked !== false,
            arknights: document.getElementById('enableArknights')?.checked !== false
        }
    };
}

function saveSettings(callback) {
    chrome.runtime.sendMessage({
        action: 'saveSettings',
        settings: collectSettings()
    }, callback);
}

function setStatusMessage(message, color = '#4CAF50') {
    const msgDiv = document.getElementById('msg');
    if (!msgDiv) {
        return;
    }

    msgDiv.innerText = message;
    msgDiv.style.color = color;
    setTimeout(() => {
        msgDiv.innerText = '';
    }, 3000);
}
