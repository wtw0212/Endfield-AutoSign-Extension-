document.addEventListener('DOMContentLoaded', () => {
    translateUI();
    updateUI();

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
    chrome.storage.local.get(['lastCheckInDate'], (result) => {
        const dateEl = document.getElementById('lastCheckIn');
        const statusEl = document.getElementById('status');

        if (result.lastCheckInDate) {
            dateEl.innerText = result.lastCheckInDate;

            const today = new Date().toDateString();
            if (result.lastCheckInDate === today) {
                statusEl.innerText = chrome.i18n.getMessage('alreadySignedIn');
                statusEl.style.color = '#4CAF50';
            } else {
                statusEl.innerText = chrome.i18n.getMessage('notSignedInYet');
                statusEl.style.color = '#ff9800';
            }
        } else {
            dateEl.innerText = chrome.i18n.getMessage('noRecord');
            statusEl.innerText = chrome.i18n.getMessage('readyStatus');
        }
    });
}
