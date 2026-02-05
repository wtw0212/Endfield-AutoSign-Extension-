const TARGET_URL = 'https://game.skport.com/endfield/sign-in?header=0&hg_media=skport&hg_link_campaign=tools';
const ALARM_NAME = 'dailySignCheck';
const CHECK_HOUR = 0;
const CHECK_MINUTE = 3;

chrome.runtime.onInstalled.addListener(() => {
    console.log('Endfield Auto Sign-in Extension Installed');
    createAlarm();
    checkAndSignIn();
});

chrome.runtime.onStartup.addListener(() => {
    checkAndSignIn();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
        checkAndSignIn();
    }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'signInSuccess') {
        const today = new Date().toDateString();
        chrome.storage.local.set({ lastCheckInDate: today }, () => {
            console.log('Sign-in successful, date stored:', today);
        });
    }
    else if (request.action === 'manualSignIn') {
        performSignIn();
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

function checkAndSignIn() {
    chrome.storage.local.get(['lastCheckInDate'], (result) => {
        const today = new Date().toDateString();
        if (result.lastCheckInDate !== today) {
            performSignIn();
        } else {
            console.log('Already signed in today:', today);
        }
    });
}

function performSignIn() {
    // Simply create a new tab - no host_permissions needed for chrome.tabs.create()
    chrome.tabs.create({ url: TARGET_URL, active: false });
    console.log('Opening sign-in page:', TARGET_URL);
}
