const TARGET_URL = 'https://game.skport.com/endfield/sign-in?header=0&hg_media=skport&hg_link_campaign=tools';
const ALARM_NAME = 'dailySignCheck';
const CHECK_HOUR = 4;
const CHECK_MINUTE = 10;

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
});

function createAlarm() {
    chrome.alarms.create(ALARM_NAME, {
        when: getNextCheckTime(),
        periodInMinutes: 1440
    });
}

function getNextCheckTime() {
    const now = new Date();
    const next = new Date();
    next.setHours(CHECK_HOUR, CHECK_MINUTE, 0, 0);
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
    chrome.tabs.query({ url: "https://game.skport.com/endfield/sign-in*" }, (tabs) => {
        if (tabs.length > 0) {
            chrome.tabs.reload(tabs[0].id);
            chrome.tabs.update(tabs[0].id, { active: true });
        } else {
            chrome.tabs.create({ url: TARGET_URL });
        }
    });
}
