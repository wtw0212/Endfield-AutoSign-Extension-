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
                onInstalled: noopEvent,
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

    return { context, createdTabs, removedTabs, storageData };
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
