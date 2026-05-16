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
        claimRecordVisible: options.claimRecordVisible ?? false,
        noCharacterToastVisible: options.noCharacterToastVisible ?? false,
        bodyText: options.bodyText || '',
        clicked: false,
        notifications: [],
        claimHistoryOpen: options.claimHistoryOpen ?? false,
        claimHistoryTitleText: options.claimHistoryTitleText || '領取紀錄',
        claimHistoryNewestDateText: options.claimHistoryNewestDateText || '',
        timeoutDelays: []
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

    const claimRecord = {
        className: 'sc-extOrw giWaQb sc-hYnFiZ dDDjjc',
        innerText: ''
    };

    const claimHistoryIcon = {
        className: 'sc-extOrw giWaQb sc-hYnFiZ dDDjjc',
        click() {
            state.claimHistoryOpen = true;
        },
        dispatchEvent() {
            state.claimHistoryOpen = true;
            return true;
        }
    };

    const claimHistoryPanel = {
        get innerText() {
            return [
                state.claimHistoryTitleText,
                state.claimHistoryNewestDateText
            ].filter(Boolean).join('\n');
        },
        parentElement: null,
        querySelectorAll() {
            return [claimHistoryDate];
        }
    };

    const claimHistoryTitle = {
        get innerText() {
            return state.claimHistoryTitleText;
        },
        parentElement: claimHistoryPanel
    };

    const claimHistoryDate = {
        get innerText() {
            return state.claimHistoryNewestDateText;
        },
        parentElement: claimHistoryPanel
    };

    const noCharacterToast = {
        className: 'Toast__ToastText-inDYtP hiffcN',
        innerText: '該帳號下未查詢到遊戲角色'
    };

    const document = {
        readyState: 'loading',
        body: {
            get innerText() {
                return [
                    state.bodyText,
                    state.claimRecordVisible ? '領取紀錄' : '',
                    state.noCharacterToastVisible ? '該帳號下未查詢到遊戲角色' : ''
                    ,
                    state.claimHistoryOpen ? state.claimHistoryTitleText : '',
                    state.claimHistoryOpen ? state.claimHistoryNewestDateText : ''
                ].filter(Boolean).join('\n');
            },
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
            if (selector === '.sc-extOrw.giWaQb.sc-hYnFiZ.dDDjjc') {
                return state.claimRecordVisible ? claimHistoryIcon : null;
            }
            if (selector === '.Toast__ToastText-inDYtP') {
                return state.noCharacterToastVisible ? noCharacterToast : null;
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
            if (selector === '*') {
                return state.claimHistoryOpen ? [claimHistoryTitle, claimHistoryPanel, claimHistoryDate] : [];
            }
            return [];
        }
    };

    const FakeDate = class extends Date {
        constructor(...args) {
            if (args.length === 0 && options.now) {
                super(options.now);
                return;
            }
            super(...args);
        }

        static now() {
            return options.now ? new Date(options.now).getTime() : Date.now();
        }
    };

    const context = {
        console,
        Date: FakeDate,
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
        setTimeout(callback, delay) {
            state.timeoutDelays.push(delay);
            callback();
            return 1;
        }
    };

    vm.createContext(context);
    vm.runInContext(CONTENT_SCRIPT, context);
    context.showNotification = () => {};

    return { context, messages, state };
}

test('extractDateFromText returns YYYY-MM-DD', () => {
    const { context } = createHarness();

    assert.equal(
        context.extractDateFromText('2026-05-16 17:05:52 UTC+8'),
        '2026-05-16'
    );
});

test('getUtc8DateString uses UTC+8 day', () => {
    const { context } = createHarness({
        now: '2026-05-16T01:00:00+08:00'
    });

    assert.equal(context.getUtc8DateString(), '2026-05-16');
});

test('reports success after clicking when claim history newest date is today', () => {
    const { context, messages, state } = createHarness({
        lottieVisible: true,
        rewardCardsVisible: true,
        claimRecordVisible: true,
        claimHistoryOpen: false,
        claimHistoryTitleText: '領取紀錄',
        claimHistoryNewestDateText: '2026-05-16 17:05:52 UTC+8',
        now: '2026-05-16T01:00:00+08:00'
    });

    const finishedAttempt = context.attemptSignIn();

    assert.equal(finishedAttempt, true);
    assert.equal(state.clicked, true);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].action, 'signInSuccess');
});

test('keeps the tab open when SKPORT reports no game character after clicking', () => {
    const { context, messages, state } = createHarness({
        lottieVisible: true,
        rewardCardsVisible: true,
        claimRecordVisible: true,
        claimHistoryOpen: false,
        onClick: currentState => {
            currentState.noCharacterToastVisible = true;
        }
    });

    const finishedAttempt = context.attemptSignIn();

    assert.equal(finishedAttempt, true);
    assert.equal(state.clicked, true);
    assert.deepEqual(messages, []);
});

test('treats reward cards without the pending marker as already completed', () => {
    const { context } = createHarness({
        lottieVisible: false,
        rewardCardsVisible: true
    });

    assert.equal(context.isTodayAlreadyCompleted(), true);
});

test('reports success for already completed sign-in only after claim history check', () => {
    const { context, messages } = createHarness({
        lottieVisible: false,
        rewardCardsVisible: true,
        claimRecordVisible: true,
        claimHistoryOpen: true,
        claimHistoryTitleText: '領取紀錄',
        claimHistoryNewestDateText: '2026-05-16 08:00:00 UTC+8',
        now: '2026-05-16T01:00:00+08:00'
    });

    const finishedAttempt = context.attemptSignIn();

    assert.equal(finishedAttempt, true);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].action, 'signInSuccess');
});

test('does not report success when newest claim date is not today', () => {
    const { context, messages, state } = createHarness({
        lottieVisible: true,
        rewardCardsVisible: true,
        claimRecordVisible: true,
        claimHistoryOpen: true,
        claimHistoryTitleText: '領取紀錄',
        claimHistoryNewestDateText: '2026-05-15 12:00:00 UTC+8',
        now: '2026-05-16T01:00:00+08:00'
    });

    const finishedAttempt = context.attemptSignIn();

    assert.equal(finishedAttempt, true);
    assert.equal(messages.length, 0);
    assert.equal(
        state.timeoutDelays.filter(delay => delay === 5000).length,
        2
    );
});
