document.addEventListener('DOMContentLoaded', () => {
    translateUI();
    updateUI();
    loadSettings();

    document.getElementById('saveBtn').addEventListener('click', () => {
        saveSettings(() => {
            setStatusMessage(chrome.i18n.getMessage('readyStatus'));
        });
    });

    document.getElementById('manualBtn').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'manualSignIn' }, (response) => {
            const msgDiv = document.getElementById('msg');
            if (response && response.status === 'started') {
                msgDiv.innerText = chrome.i18n.getMessage('startingSignIn');
                msgDiv.style.color = '#4CAF50';
                setTimeout(() => window.close(), 1000);
            } else {
                msgDiv.innerText = chrome.i18n.getMessage('signInFailed');
                msgDiv.style.color = 'red';
            }
        });
    });
});

function translateUI() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const message = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
        if (message) {
            el.innerText = message;
        }
    });
}

function updateUI() {
    chrome.storage.local.get(['lastCheckInDates', 'lastCheckInDate'], (result) => {
        const lastCheckInDates = result.lastCheckInDates || {};
        if (!lastCheckInDates.endfield && result.lastCheckInDate) {
            lastCheckInDates.endfield = result.lastCheckInDate;
        }

        updateGameStatus('endfield', lastCheckInDates.endfield);
        updateGameStatus('arknights', lastCheckInDates.arknights);
    });
}

function updateGameStatus(targetKey, lastCheckInDate) {
    const dateEl = document.getElementById(`${targetKey}LastCheckIn`);
    const statusEl = document.getElementById(`${targetKey}Status`);
    const today = new Date().toDateString();

    if (!lastCheckInDate) {
        dateEl.innerText = chrome.i18n.getMessage('noRecord');
        statusEl.innerText = chrome.i18n.getMessage('readyStatus');
        statusEl.style.color = '#2c3e50';
        return;
    }

    dateEl.innerText = lastCheckInDate;
    if (lastCheckInDate === today) {
        statusEl.innerText = chrome.i18n.getMessage('alreadySignedIn');
        statusEl.style.color = '#4CAF50';
    } else {
        statusEl.innerText = chrome.i18n.getMessage('notSignedInYet');
        statusEl.style.color = '#ff9800';
    }
}
