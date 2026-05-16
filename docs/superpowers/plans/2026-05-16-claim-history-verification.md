# Claim History Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open claim history after sign-in, confirm the newest record date is today (UTC+8), and only then report success.

**Architecture:** Add DOM helpers in the content script to open the claim history panel, detect its title, parse the newest record date, and compare against UTC+8 today. Gate `reportSignInSuccess()` behind this verification with 3 retries and 5s delay.

**Tech Stack:** Chrome extension content script (plain JS), node:test for unit tests.

---

### Task 1: Add failing tests for claim history verification

**Files:**
- Modify: tests/content.test.js

- [ ] **Step 1: Expand the test harness to model claim history panel and time**

Add fields to `state`, a claim history icon element, and a `*` query handler that exposes claim history title/date nodes when open. Also add a fake Date to make UTC+8 comparisons deterministic.

```js
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

    const claimHistoryTitle = {
        innerText: state.claimHistoryTitleText,
        parentElement: null
    };

    const claimHistoryDate = {
        innerText: state.claimHistoryNewestDateText,
        parentElement: null
    };

    const document = {
        readyState: 'loading',
        body: {
            get innerText() {
                return [
                    state.bodyText,
                    state.claimRecordVisible ? '領取紀錄' : '',
                    state.noCharacterToastVisible ? '該帳號下未查詢到遊戲角色' : '',
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
                return claimHistoryIcon;
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
                return state.claimHistoryOpen ? [claimHistoryTitle, claimHistoryDate] : [];
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

    return { context, messages, state };
}
```

- [ ] **Step 2: Update existing success tests and add new failing tests**

Replace the existing success tests and append these new ones:

```js
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

test('reports success for already completed sign-in only after claim history check', () => {
    const { context, messages } = createHarness({
        lottieVisible: false,
        rewardCardsVisible: true,
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
        claimHistoryOpen: true,
        claimHistoryTitleText: '領取紀錄',
        claimHistoryNewestDateText: '2026-05-15 12:00:00 UTC+8',
        now: '2026-05-16T01:00:00+08:00'
    });

    const finishedAttempt = context.attemptSignIn();

    assert.equal(finishedAttempt, true);
    assert.equal(messages.length, 0);
    assert.equal(
        state.timeoutDelays.filter(delay => delay === context.CLAIM_HISTORY_RETRY_DELAY_MS).length,
        2
    );
});
```

- [ ] **Step 3: Run the tests to confirm failures**

Run: `node --test tests/content.test.js`

Expected: FAIL because `extractDateFromText` / `getUtc8DateString` do not exist yet, and success gating is not implemented.

- [ ] **Step 4: Commit the failing tests**

```bash
git add tests/content.test.js
git commit -m "test: add claim history verification coverage"
```

---

### Task 2: Implement claim history verification logic

**Files:**
- Modify: content.js
- Test: tests/content.test.js

- [ ] **Step 1: Add claim history constants and helper functions**

Add these helpers near the top of `content.js` (after existing constants):

```js
const CLAIM_HISTORY_TITLE_TEXTS = ['領取紀錄', 'Claim History'];
const CLAIM_HISTORY_RETRY_COUNT = 3;
const CLAIM_HISTORY_RETRY_DELAY_MS = 5000;

function extractDateFromText(text) {
    if (!text) {
        return null;
    }
    const match = text.match(/(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
}

function getUtc8DateString(date = new Date()) {
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const utc8 = new Date(utc + 8 * 60 * 60000);
    const year = utc8.getFullYear();
    const month = String(utc8.getMonth() + 1).padStart(2, '0');
    const day = String(utc8.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function findClaimHistoryTitleNode() {
    const nodes = Array.from(document.querySelectorAll('*'));
    return nodes.find(node => {
        const text = node.innerText || '';
        return CLAIM_HISTORY_TITLE_TEXTS.some(title => text.includes(title));
    }) || null;
}

function isClaimHistoryPanelOpen() {
    return Boolean(findClaimHistoryTitleNode());
}

function getClaimHistoryPanelRoot() {
    const titleNode = findClaimHistoryTitleNode();
    if (!titleNode) {
        return null;
    }

    let current = titleNode.parentElement;
    for (let i = 0; i < 5 && current; i++) {
        if (extractDateFromText(current.innerText)) {
            return current;
        }
        current = current.parentElement;
    }

    return titleNode.parentElement || null;
}

function getNewestClaimHistoryDate() {
    const root = getClaimHistoryPanelRoot();
    if (!root) {
        return null;
    }

    const nodes = Array.from(root.querySelectorAll('*'));
    for (const node of nodes) {
        const date = extractDateFromText(node.innerText?.trim());
        if (date) {
            return date;
        }
    }

    return extractDateFromText(root.innerText || '');
}

function clickElement(element) {
    if (!element) {
        return false;
    }

    try {
        element.click();
    } catch (err) {
        // Ignore and fall back to dispatch.
    }

    try {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    } catch (err) {
        // Ignore secondary click errors.
    }

    return true;
}

function getHeaderContainer() {
    const markers = ['本月已累計簽到', 'Signed in'];
    const markerNode = Array.from(document.querySelectorAll('*')).find(node => {
        const text = node.innerText || '';
        return markers.some(marker => text.includes(marker));
    });

    if (!markerNode) {
        return null;
    }

    let current = markerNode.parentElement;
    for (let i = 0; i < 5 && current; i++) {
        const icons = getSmallClickableIcons(current);
        if (icons.length > 0) {
            return current;
        }
        current = current.parentElement;
    }

    return markerNode.parentElement || null;
}

function getSmallClickableIcons(container) {
    if (!container) {
        return [];
    }

    return Array.from(container.querySelectorAll('*'))
        .map(element => {
            const style = window.getComputedStyle(element);
            const clickable = style.cursor === 'pointer' || typeof element.onclick === 'function' || element.getAttribute('role') === 'button';
            if (!clickable || !element.getBoundingClientRect) {
                return null;
            }
            const rect = element.getBoundingClientRect();
            if (rect.width > 18 || rect.height > 18) {
                return null;
            }
            return { element, rect };
        })
        .filter(Boolean);
}

function findClaimHistoryIcon() {
    const header = getHeaderContainer();
    const icons = getSmallClickableIcons(header);
    if (icons.length === 0) {
        return null;
    }

    icons.sort((a, b) => a.rect.x - b.rect.x);
    return icons[0].element;
}

function openClaimHistoryPanel() {
    const headerIcon = findClaimHistoryIcon();
    if (headerIcon && clickElement(headerIcon)) {
        return true;
    }

    const fallback = document.querySelector(CLAIM_RECORD_SELECTOR);
    if (fallback) {
        return clickElement(fallback);
    }

    return false;
}

function verifyClaimHistoryWithRetry(remaining = CLAIM_HISTORY_RETRY_COUNT) {
    openClaimHistoryPanel();

    const panelOpen = isClaimHistoryPanelOpen();
    const newestDate = panelOpen ? getNewestClaimHistoryDate() : null;
    const today = getUtc8DateString();

    if (panelOpen && newestDate === today) {
        console.log('Claim history newest date matches today:', newestDate);
        reportSignInSuccess();
        return true;
    }

    if (remaining > 1) {
        console.log('Claim history check failed, retrying...', remaining - 1);
        setTimeout(() => verifyClaimHistoryWithRetry(remaining - 1), CLAIM_HISTORY_RETRY_DELAY_MS);
        return false;
    }

    console.log('Claim history check failed after retries. Leaving tab open.');
    return false;
}
```

- [ ] **Step 2: Gate success reporting through claim history verification**

Update `attemptSignIn()` to use the new verification function in both the already-completed path and the post-click path:

```js
if (isTodayAlreadyCompleted()) {
    console.log('Today\'s sign-in is already completed. Verifying claim history before reporting success.');
    verifyClaimHistoryWithRetry();
    return true;
}
```

Replace the post-click success block with:

```js
setTimeout(() => {
    if (hasNoGameCharacterToast()) {
        console.log('Sign-in failed: no game character found. Leaving tab open.');
        return;
    }

    verifyClaimHistoryWithRetry();
}, SUCCESS_REPORT_DELAY);
```

- [ ] **Step 3: Run the tests to confirm they pass**

Run: `node --test tests/content.test.js`

Expected: PASS

- [ ] **Step 4: Commit the implementation**

```bash
git add content.js tests/content.test.js
git commit -m "feat: verify sign-in via claim history"
```

---

