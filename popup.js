document.addEventListener('DOMContentLoaded', () => {
    translateUI();
    updateUI();

    // Load saved time
    chrome.storage.local.get(['checkTime'], (result) => {
        if (result.checkTime) {
            document.getElementById('checkTime').value = result.checkTime;
        }
    });

    document.getElementById('saveBtn').addEventListener('click', () => {
        const timeValue = document.getElementById('checkTime').value;
        if (timeValue) {
            chrome.storage.local.set({ checkTime: timeValue }, () => {
                chrome.runtime.sendMessage({ action: 'updateSchedule', time: timeValue }, (response) => {
                    const msgDiv = document.getElementById('msg');
                    msgDiv.innerText = chrome.i18n.getMessage('readyStatus'); // Use a generic success message or add new one
                    msgDiv.style.color = '#4CAF50';
                    setTimeout(() => { msgDiv.innerText = ''; }, 3000);
                });
            });
        }
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
