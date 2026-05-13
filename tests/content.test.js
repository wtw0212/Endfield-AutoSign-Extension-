const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const CONTENT_SCRIPT = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');

function createHarness(options = {}) {
    const state = {
        lottieVisible: options.lottieVisible ?? false,
        rewardCardsVisible: options.rewardCardsVisible ?? false,
        bodyText: options.bodyText || '',
        clicked: false,
        notifications: []
    };

    const messages = [];

    const card = {
        className: 'sc-nuIvE reward-card',
        parentElement: null
    };

    const clickableTarget = {
        className: 'sc-nuIvE clickable-card',
        parentElement: null,
        click() {
            if (options.clickError) {
                throw options.clickError;
            }
            state.clicked = true;
            if (typeof options.onClick === 'function') {
                options.onClick(state);
            }
        }
    };

    const lottie = {
        parentElement: clickableTarget
    };

    const document = {
        readyState: 'loading',
        body: {
            innerText: state.bodyText,
            appendChild(element) {
                state.notifications.push(element);
            }
        },
        addEventListener() {},
        createElement() {
            return {
                style: {},
                remove() {}
            };
        },
        querySelector(selector) {
            if (selector === '#lottie-container') {
                return state.lottieVisible ? lottie : null;
            }
            return null;
        },
        querySelectorAll(selector) {
            if (selector === '[class*="sc-nuIvE"]') {
                return state.rewardCardsVisible ? [card] : [];
            }
            if (selector === 'span') {
                return [];
            }
            return [];
        }
    };

    const context = {
        console,
        location: {
            pathname: '/arknights/sign-in'
        },
        document,
        window: {
            getComputedStyle(element) {
                return {
                    cursor: element === clickableTarget ? 'pointer' : 'default'
                };
            }
        },
        chrome: {
            i18n: {
                getMessage(key) {
                    return key === 'viewAllRewards' ? '查看全部獎勵' : '';
                }
            },
            runtime: {
                sendMessage(message) {
                    messages.push(message);
                }
            }
        },
        setInterval() {
            throw new Error('startCheck should not auto-run in this harness');
        },
        clearInterval() {},
        setTimeout(callback) {
            callback();
            return 1;
        }
    };

    vm.createContext(context);
    vm.runInContext(CONTENT_SCRIPT, context);

    return { context, messages, state };
}

test('does not report success immediately after clicking while the sign-in marker is still pending', () => {
    const { context, messages, state } = createHarness({
        lottieVisible: true,
        rewardCardsVisible: true
    });

    const finishedAttempt = context.attemptSignIn();

    assert.equal(finishedAttempt, true);
    assert.equal(state.clicked, true);
    assert.deepEqual(messages, []);
});

test('does not treat reward cards without the pending marker as completed before a click is verified', () => {
    const { context } = createHarness({
        lottieVisible: false,
        rewardCardsVisible: true
    });

    assert.equal(context.isTodayAlreadyCompleted(), false);
});

test('keeps the tab open and does not report success when the click fails', () => {
    const { context, messages } = createHarness({
        lottieVisible: true,
        rewardCardsVisible: true,
        clickError: new Error('element detached')
    });

    assert.doesNotThrow(() => context.attemptSignIn());
    assert.deepEqual(messages, []);
});
