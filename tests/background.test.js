const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const BACKGROUND_SCRIPT = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');

function createHarness() {
    const removedTabs = [];
    const createdTabs = [];
    const storageData = {};
    const listeners = {};

    const storage = {
        get(keys, callback) {
            const result = {};
            for (const key of keys) {
                result[key] = storageData[key];
            }
            callback(result);
        },
        set(values, callback) {
            Object.assign(storageData, values);
            if (callback) {
                callback();
            }
        }
    };

    const makeEvent = name => ({
        addListener(callback) {
            listeners[name] = callback;
        }
    });

    const noopEvent = {
        addListener() {}
    };

    const context = {
        console,
        setTimeout(callback) {
            callback();
            return 1;
        },
        chrome: {
            runtime: {
                lastError: null,
                getURL(file) {
                    return `chrome-extension://test/${file}`;
                },
                getManifest() {
                    return { version: '1.1.2' };
                },
                onInstalled: makeEvent('onInstalled'),
                onStartup: noopEvent,
                onMessage: noopEvent
            },
            alarms: {
                onAlarm: noopEvent,
                clear(name, callback) {
                    if (callback) {
                        callback();
                    }
                },
                create() {}
            },
            tabs: {
                onRemoved: noopEvent,
                create(options, callback) {
                    const tab = {
                        id: createdTabs.length + 1,
                        url: options.url,
                        active: options.active
                    };
                    createdTabs.push(tab);
                    if (callback) {
                        callback(tab);
                    }
                },
                remove(tabId, callback) {
                    removedTabs.push(tabId);
                    if (callback) {
                        callback();
                    }
                }
            },
            windows: {
                create() {}
            },
            storage: {
                local: storage
            }
        }
    };

    vm.createContext(context);
    vm.runInContext(BACKGROUND_SCRIPT, context);

    return { context, createdTabs, listeners, removedTabs, storageData };
}

test('does not close tabs that were opened by manual sign-in', () => {
    const { context, removedTabs } = createHarness();

    context.rememberSignInTab('arknights', 7, 'manual');
    context.closeSignInTab('arknights', 7);

    assert.deepEqual(removedTabs, []);
});

test('closes tabs that were opened by automatic sign-in', () => {
    const { context, removedTabs } = createHarness();

    context.rememberSignInTab('arknights', 8, 'auto');
    context.closeSignInTab('arknights', 8);

    assert.deepEqual(removedTabs, [8]);
});

test('does not reopen an automatic sign-in target that was already attempted today', () => {
    const { context, createdTabs, storageData } = createHarness();
    const today = new Date().toDateString();
    storageData.enabledTargets = {
        endfield: false,
        arknights: true
    };
    storageData.lastSignInAttemptDates = {
        arknights: today
    };

    context.checkAndSignIn('onStartup');

    assert.deepEqual(createdTabs, []);
});

test('opens welcome page on first install', () => {
    const { createdTabs, listeners } = createHarness();

    listeners.onInstalled({ reason: 'install' });

    assert.equal(createdTabs.length, 1);
    assert.equal(createdTabs[0].url, 'chrome-extension://test/welcome.html');
});

test('does not open update page for patch version updates', () => {
    const { createdTabs, listeners, storageData } = createHarness();
    storageData.enabledTargets = {
        endfield: false,
        arknights: false
    };

    listeners.onInstalled({
        reason: 'update',
        previousVersion: '1.1.0'
    });

    assert.equal(createdTabs.some(tab => tab.url === 'chrome-extension://test/updated.html'), false);
});

test('opens update page for feature version updates', () => {
    const { createdTabs, listeners, storageData } = createHarness();
    storageData.enabledTargets = {
        endfield: false,
        arknights: false
    };

    listeners.onInstalled({
        reason: 'update',
        previousVersion: '1.0.9'
    });

    assert.equal(createdTabs.some(tab => tab.url === 'chrome-extension://test/updated.html'), true);
});

test('opens update page for major version updates', () => {
    const { createdTabs, listeners, storageData } = createHarness();
    storageData.enabledTargets = {
        endfield: false,
        arknights: false
    };

    listeners.onInstalled({
        reason: 'update',
        previousVersion: '0.9.9'
    });

    assert.equal(createdTabs.some(tab => tab.url === 'chrome-extension://test/updated.html'), true);
});

test('does not open update page for Chrome browser updates', () => {
    const { createdTabs, listeners, storageData } = createHarness();
    storageData.enabledTargets = {
        endfield: false,
        arknights: false
    };

    listeners.onInstalled({ reason: 'chrome_update' });

    assert.equal(createdTabs.some(tab => tab.url === 'chrome-extension://test/updated.html'), false);
});

test('keeps non-install sign-in check behavior', () => {
    const { createdTabs, listeners, storageData } = createHarness();
    storageData.enabledTargets = {
        endfield: false,
        arknights: true
    };

    listeners.onInstalled({
        reason: 'update',
        previousVersion: '1.1.0'
    });

    assert.equal(createdTabs.some(tab => tab.url.includes('/arknights/sign-in')), true);
});
