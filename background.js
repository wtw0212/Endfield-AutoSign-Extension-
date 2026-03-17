const TARGET_URL = 'https://game.skport.com/endfield/sign-in?header=0&hg_media=skport&hg_link_campaign=tools';
const ALARM_NAME = 'dailySignCheck';
const CHECK_HOUR = 0;
const CHECK_MINUTE = 30;
const SIGN_IN_DEDUP_WINDOW_MS = 90 * 1000;

let isAutoCheckRunning = false;

chrome.runtime.onInstalled.addListener((details) => {
    console.log('Endfield Auto Sign-in Extension Installed');

    // On first install, open settings page for user to configure
    if (details.reason === 'install') {
        // Open popup.html as a tab for initial setup
        chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
        console.log('First install detected - opening settings page');
    }
    
    // Always set up alarm and check sign-in on install or update
    createAlarm();
    checkAndSignIn('onInstalled');
});

chrome.runtime.onStartup.addListener(() => {
    createAlarm();
    checkAndSignIn('onStartup');
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
        checkAndSignIn('alarm');
    }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'signInSuccess') {
        const today = new Date().toDateString();
        chrome.storage.local.set({ lastCheckInDate: today, lastSignInAttemptAt: 0 }, () => {
            console.log('Sign-in successful, date stored:', today);
        });
    }
    else if (request.action === 'manualSignIn') {
        performSignIn('manual');
        sendResponse({ status: 'started' });
    }
    else if (request.action === 'updateSchedule') {
        createAlarm();
        sendResponse({ status: 'updated' });
    }
});

function createAlarm() {
    chrome.alarms.clear(ALARM_NAME, (wasCleared) => {
        chrome.storage.local.get(['checkTime'], (result) => {
            const nextTime = getNextCheckTime(result.checkTime);
            chrome.alarms.create(ALARM_NAME, {
                when: nextTime,
                periodInMinutes: 1440
            });
            console.log('Next alarm set for:', new Date(nextTime).toLocaleString());
        });
    });
}

function getNextCheckTime(customTime) {
    const now = new Date();
    const next = new Date();

    let hour = CHECK_HOUR;
    let minute = CHECK_MINUTE;

    if (customTime) {
        const [h, m] = customTime.split(':').map(Number);
        hour = h;
        minute = m;
    }

    next.setHours(hour, minute, 0, 0);
    if (next <= now) {
        next.setDate(next.getDate() + 1);
    }
    return next.getTime();
}

function checkAndSignIn(triggerSource = 'unknown') {
    if (isAutoCheckRunning) {
        console.log('Auto check skipped: another auto check is already running');
        return;
    }

    isAutoCheckRunning = true;

    chrome.storage.local.get(['lastCheckInDate', 'lastSignInAttemptAt'], (result) => {
        const today = new Date().toDateString();

        if (result.lastCheckInDate === today) {
            console.log('Already signed in today:', today);
            isAutoCheckRunning = false;
            return;
        }

        const now = Date.now();
        const lastAttemptAt = result.lastSignInAttemptAt || 0;
        const isRecentAttempt = lastAttemptAt > 0 && now - lastAttemptAt < SIGN_IN_DEDUP_WINDOW_MS;
        if (isRecentAttempt) {
            console.log(`Auto check skipped: recent attempt exists (${triggerSource})`);
            isAutoCheckRunning = false;
            return;
        }

        chrome.storage.local.set({ lastSignInAttemptAt: now }, () => {
            if (chrome.runtime.lastError) {
                console.warn('Failed to store sign-in attempt timestamp:', chrome.runtime.lastError.message);
            }
            performSignIn('auto');
            isAutoCheckRunning = false;
        });
    });
}

function performSignIn(triggerSource = 'auto') {
    const shouldFocus = triggerSource === 'manual';

    // Try opening a tab first. This may fail in background mode when no browser window exists.
    chrome.tabs.create({ url: TARGET_URL, active: shouldFocus }, (tab) => {
        if (!chrome.runtime.lastError) {
            console.log('Opening sign-in tab:', TARGET_URL, 'tabId:', tab && tab.id, 'trigger:', triggerSource);
            return;
        }

        const err = chrome.runtime.lastError.message;
        console.warn('tabs.create failed, falling back to windows.create:', err);

        chrome.windows.create({
            url: TARGET_URL,
            focused: shouldFocus,
            state: shouldFocus ? 'normal' : 'minimized',
            type: 'normal'
        }, (win) => {
            if (chrome.runtime.lastError) {
                console.error('windows.create also failed:', chrome.runtime.lastError.message);
                return;
            }

            console.log('Opening sign-in window:', TARGET_URL, 'windowId:', win && win.id, 'trigger:', triggerSource);
        });
    });
}
