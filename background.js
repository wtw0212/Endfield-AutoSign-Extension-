const SIGN_IN_TARGETS = {
    endfield: {
        name: 'Endfield',
        url: 'https://game.skport.com/endfield/sign-in?header=0&hg_media=skport&hg_link_campaign=tools'
    },
    arknights: {
        name: 'Arknights',
        url: 'https://game.skport.com/arknights/sign-in?header=0&hg_media=skport&hg_link_campaign=tools'
    }
};
const ALARM_NAME = 'dailySignCheck';
const DEFAULT_CHECK_TIME = '00:10';
const CLOSE_DELAY_MS = 1000;
const SIGN_IN_DEDUP_WINDOW_MS = 90 * 1000;

const signInTabIds = {};
const signInTabTriggers = {};
let isAutoCheckRunning = false;

chrome.runtime.onInstalled.addListener((details) => {
    console.log('SKPORT Auto Sign-in Extension Installed');
    createAlarm();

    if (details.reason === 'install') {
        chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
        console.log('First install detected - opening welcome page');
        return;
    }

    chrome.tabs.create({ url: chrome.runtime.getURL('updated.html') });
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

chrome.tabs.onRemoved.addListener((tabId) => {
    for (const targetKey of Object.keys(signInTabIds)) {
        if (tabId === signInTabIds[targetKey]) {
            delete signInTabIds[targetKey];
            delete signInTabTriggers[targetKey];
        }
    }

    chrome.storage.local.get(['signInTabIds', 'signInTabTriggers'], (result) => {
        const storedTabIds = result.signInTabIds || {};
        const storedTabTriggers = result.signInTabTriggers || {};
        let changed = false;

        for (const targetKey of Object.keys(storedTabIds)) {
            if (tabId === storedTabIds[targetKey]) {
                delete storedTabIds[targetKey];
                delete storedTabTriggers[targetKey];
                changed = true;
            }
        }

        if (changed) {
            chrome.storage.local.set({
                signInTabIds: storedTabIds,
                signInTabTriggers: storedTabTriggers
            });
        }
    });
});

// Handle messages from content script or popup.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'signInSuccess') {
        const targetKey = request.targetKey || getTargetKeyFromUrl(sender.tab?.url);
        if (!targetKey) {
            console.log('Sign-in success received from unknown target:', sender.tab?.url);
            return;
        }

        const today = new Date().toDateString();
        chrome.storage.local.get(['lastCheckInDates'], (result) => {
            const lastCheckInDates = result.lastCheckInDates || {};
            lastCheckInDates[targetKey] = today;

            chrome.storage.local.set({
                lastCheckInDates,
                lastSignInAttemptAt: 0
            }, () => {
                console.log(`${SIGN_IN_TARGETS[targetKey].name} sign-in successful, date stored:`, today);
                closeSignInTab(targetKey, sender.tab?.id);
            });
        });
    }
    else if (request.action === 'manualSignIn') {
        performAllSignIns('manual');
        sendResponse({ status: 'started' });
    }
    else if (request.action === 'updateSchedule') {
        createAlarm();
        sendResponse({ status: 'updated' });
    }
    else if (request.action === 'saveSettings') {
        saveSettings(request.settings, () => {
            createAlarm();
            sendResponse({ status: 'saved' });
        });
        return true;
    }
});

function createAlarm() {
    chrome.alarms.clear(ALARM_NAME, () => {
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

    const [hour, minute] = (customTime || DEFAULT_CHECK_TIME).split(':').map(Number);

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

    chrome.storage.local.get([
        'enabledTargets',
        'lastCheckInDates',
        'lastCheckInDate',
        'lastSignInAttemptAt'
    ], (result) => {
        const now = Date.now();
        const lastAttemptAt = result.lastSignInAttemptAt || 0;
        const isRecentAttempt = lastAttemptAt > 0 && now - lastAttemptAt < SIGN_IN_DEDUP_WINDOW_MS;
        if (isRecentAttempt) {
            console.log(`Auto check skipped: recent attempt exists (${triggerSource})`);
            isAutoCheckRunning = false;
            return;
        }

        const today = new Date().toDateString();
        const enabledTargets = getEnabledTargets(result.enabledTargets);
        const lastCheckInDates = result.lastCheckInDates || {};

        // Migrate the old single-game record as Endfield only.
        if (!lastCheckInDates.endfield && result.lastCheckInDate) {
            lastCheckInDates.endfield = result.lastCheckInDate;
            chrome.storage.local.set({ lastCheckInDates });
        }

        const targetsToOpen = Object.keys(SIGN_IN_TARGETS)
            .filter(targetKey => {
                if (!enabledTargets[targetKey]) {
                    console.log(`${SIGN_IN_TARGETS[targetKey].name} sign-in is disabled`);
                    return false;
                }

                if (lastCheckInDates[targetKey] === today) {
                    console.log(`${SIGN_IN_TARGETS[targetKey].name} already signed in today:`, today);
                    return false;
                }

                return true;
            });

        if (targetsToOpen.length === 0) {
            isAutoCheckRunning = false;
            return;
        }

        chrome.storage.local.set({ lastSignInAttemptAt: now }, () => {
            if (chrome.runtime.lastError) {
                console.warn('Failed to store sign-in attempt timestamp:', chrome.runtime.lastError.message);
            }

            for (const targetKey of targetsToOpen) {
                performSignIn(targetKey, 'auto');
            }

            isAutoCheckRunning = false;
        });
    });
}

function performAllSignIns(triggerSource = 'manual') {
    chrome.storage.local.get(['enabledTargets'], (result) => {
        const enabledTargets = getEnabledTargets(result.enabledTargets);

        for (const targetKey of Object.keys(SIGN_IN_TARGETS)) {
            if (enabledTargets[targetKey]) {
                performSignIn(targetKey, triggerSource);
            }
        }
    });
}

function performSignIn(targetKey, triggerSource = 'auto') {
    const target = SIGN_IN_TARGETS[targetKey];
    if (!target) {
        return;
    }

    const shouldFocus = triggerSource === 'manual';
    chrome.tabs.create({ url: target.url, active: shouldFocus }, (tab) => {
        if (!chrome.runtime.lastError) {
            rememberSignInTab(targetKey, tab?.id, triggerSource);
            console.log(`Opening ${target.name} sign-in tab:`, target.url, 'tabId:', tab?.id, 'trigger:', triggerSource);
            return;
        }

        const err = chrome.runtime.lastError.message;
        console.warn('tabs.create failed, falling back to windows.create:', err);

        chrome.windows.create({
            url: target.url,
            focused: shouldFocus,
            state: shouldFocus ? 'normal' : 'minimized',
            type: 'normal'
        }, (window) => {
            if (chrome.runtime.lastError) {
                console.error('windows.create also failed:', chrome.runtime.lastError.message);
                return;
            }

            rememberSignInTab(targetKey, window?.tabs?.[0]?.id, triggerSource);
            console.log(`Opening ${target.name} sign-in window:`, target.url, 'windowId:', window?.id, 'trigger:', triggerSource);
        });
    });
}

function closeSignInTab(targetKey, tabId) {
    if (!tabId) {
        return;
    }

    chrome.storage.local.get(['signInTabIds', 'signInTabTriggers'], (result) => {
        const storedTabIds = result.signInTabIds || {};
        const storedTabTriggers = result.signInTabTriggers || {};
        const expectedTabId = signInTabIds[targetKey] || storedTabIds[targetKey];
        const triggerSource = signInTabTriggers[targetKey] || storedTabTriggers[targetKey] || 'auto';

        if (tabId !== expectedTabId || triggerSource === 'manual') {
            return;
        }

        setTimeout(() => {
            chrome.tabs.remove(tabId, () => {
                if (chrome.runtime.lastError) {
                    console.log('Could not close sign-in tab:', chrome.runtime.lastError.message);
                    return;
                }

                delete signInTabIds[targetKey];
                delete signInTabTriggers[targetKey];
                delete storedTabIds[targetKey];
                delete storedTabTriggers[targetKey];
                chrome.storage.local.set({
                    signInTabIds: storedTabIds,
                    signInTabTriggers: storedTabTriggers
                });
                console.log(`Closed ${SIGN_IN_TARGETS[targetKey].name} sign-in tab after successful sign-in`);
            });
        }, CLOSE_DELAY_MS);
    });
}

function getTargetKeyFromUrl(url) {
    if (!url) {
        return null;
    }

    if (url.includes('/arknights/sign-in')) {
        return 'arknights';
    }

    if (url.includes('/endfield/sign-in')) {
        return 'endfield';
    }

    return null;
}

function rememberSignInTab(targetKey, tabId, triggerSource = 'auto') {
    if (!tabId) {
        return;
    }

    signInTabIds[targetKey] = tabId;
    signInTabTriggers[targetKey] = triggerSource;
    chrome.storage.local.get(['signInTabIds', 'signInTabTriggers'], (result) => {
        const storedTabIds = result.signInTabIds || {};
        const storedTabTriggers = result.signInTabTriggers || {};
        storedTabIds[targetKey] = tabId;
        storedTabTriggers[targetKey] = triggerSource;
        chrome.storage.local.set({
            signInTabIds: storedTabIds,
            signInTabTriggers: storedTabTriggers
        });
    });
}

function getEnabledTargets(enabledTargets) {
    return {
        endfield: enabledTargets?.endfield !== false,
        arknights: enabledTargets?.arknights !== false
    };
}

function saveSettings(settings, callback) {
    const enabledTargets = getEnabledTargets(settings?.enabledTargets);
    const checkTime = settings?.checkTime || DEFAULT_CHECK_TIME;

    chrome.storage.local.set({
        checkTime,
        enabledTargets
    }, callback);
}
