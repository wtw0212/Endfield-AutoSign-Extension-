console.log('SKPORT Auto Sign-in script loaded');

const MAX_ATTEMPTS = 20;
const RETRY_INTERVAL = 2000;
const SUCCESS_REPORT_DELAY = 3000;
let attempts = 0;
const NO_GAME_CHARACTER_TEXT = '該帳號下未查詢到遊戲角色';
const CLAIM_RECORD_SELECTOR = '.sc-extOrw.giWaQb.sc-hYnFiZ.dDDjjc';
const DAY_LABEL_REGEX = /^Day\s+\d+$/;
const CLAIM_HISTORY_TITLE_TEXTS = ['領取紀錄', 'Claim History'];
const CLAIM_HISTORY_RETRY_COUNT = 3;
const CLAIM_HISTORY_RETRY_DELAY_MS = 5000;

function getSignInTargetKey() {
    if (location.pathname.includes('/arknights/sign-in')) {
        return 'arknights';
    }

    if (location.pathname.includes('/endfield/sign-in')) {
        return 'endfield';
    }

    return null;
}

function getExpandButton() {
    const spans = document.querySelectorAll('span');
    const localizedText = chrome.i18n.getMessage('viewAllRewards');
    const fallbackTexts = [localizedText, '查看全部獎勵', '查看全部', 'Show All Rewards'];

    for (const span of spans) {
        const spanText = span.innerText || '';
        for (const text of fallbackTexts) {
            if (text && spanText.includes(text)) {
                return span;
            }
        }
    }
    return null;
}

function getDayLabelElements() {
    return Array.from(document.querySelectorAll('div'))
        .filter((el) => {
            const text = el.innerText?.trim();
            return text && DAY_LABEL_REGEX.test(text);
        });
}

function findClickableDayLabel() {
    const dayLabels = getDayLabelElements();
    for (const label of dayLabels) {
        let current = label;
        for (let i = 0; i < 6 && current; i++) {
            const style = window.getComputedStyle(current);
            if (style.cursor === 'pointer' || typeof current.onclick === 'function' || current.getAttribute('role') === 'button') {
                return current;
            }
            current = current.parentElement;
        }
    }
    return null;
}

/**
 * Find the current day's reward element that needs to be clicked.
 * The current unchecked day is the ONLY element with #lottie-container.
 */
function findSignInButton() {
    const lottie = document.querySelector('#lottie-container');
    if (!lottie) {
        const dayLabelButton = findClickableDayLabel();
        if (dayLabelButton) {
            console.log('Found clickable day label:', dayLabelButton.innerText?.trim());
            return dayLabelButton;
        }

        console.log('No lottie-container found - either already signed in or page not loaded');
        return null;
    }

    // Find the clickable parent container (the reward card)
    // The lottie is nested inside the card, traverse up to find the clickable element
    let current = lottie.parentElement;
    for (let i = 0; i < 10 && current; i++) {
        const style = window.getComputedStyle(current);
        // Check if this element looks like the reward card (sc-nuIvE class pattern)
        if (current.className && typeof current.className === 'string' && current.className.includes('sc-nuIvE')) {
            console.log('Found reward card container:', current.className);
            return current;
        }
        // Also check if it's clickable
        if (style.cursor === 'pointer') {
            console.log('Found clickable parent via cursor:pointer:', current.className);
            return current;
        }
        current = current.parentElement;
    }

    // Fallback: just return the parent of the lottie (usually clickable)
    const parent = lottie.parentElement?.parentElement;
    if (parent) {
        console.log('Using lottie parent as fallback:', parent.className);
        return parent;
    }

    return null;
}

/**
 * Check if today's sign-in is already completed.
 * Simple logic: if #lottie-container exists, today is NOT completed yet.
 */
function isTodayAlreadyCompleted() {
    const lottie = document.querySelector('#lottie-container');
    // If lottie exists, today is still pending
    if (lottie) {
        return false;
    }

    // Arknights may not use lottie - check for a clickable day label.
    if (findClickableDayLabel()) {
        return false;
    }

    // No lottie = either completed or page not fully loaded
    // Check if there are any reward cards visible at all
    const rewardCards = document.querySelectorAll('[class*="sc-nuIvE"]');
    if (rewardCards.length > 0) {
        // Cards exist but no lottie = already completed
        return true;
    }

    const dayLabels = getDayLabelElements();
    if (dayLabels.length > 0) {
        return true;
    }
    // No cards yet = page still loading
    return false;
}

function hasNoGameCharacterToast() {
    const toast = document.querySelector('.Toast__ToastText-inDYtP');
    const toastText = toast?.innerText || '';
    const bodyText = document.body?.innerText || '';

    return toastText.includes(NO_GAME_CHARACTER_TEXT) || bodyText.includes(NO_GAME_CHARACTER_TEXT);
}

function hasClaimRecordSection() {
    const bodyText = document.body?.innerText || '';

    return Boolean(document.querySelector(CLAIM_RECORD_SELECTOR)) || bodyText.includes('領取紀錄');
}

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
        // Ignore click errors and fall back to dispatch.
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
            const clickable = style.cursor === 'pointer'
                || typeof element.onclick === 'function'
                || element.getAttribute('role') === 'button';
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

function reportSignInSuccess() {
    chrome.runtime.sendMessage({
        action: 'signInSuccess',
        targetKey: getSignInTargetKey()
    });
}

function attemptSignIn() {
    attempts++;
    console.log(`Scanning for sign-in button (Attempt ${attempts}/${MAX_ATTEMPTS})...`);

    // Check if today is already signed in
    if (isTodayAlreadyCompleted()) {
        console.log('Today\'s sign-in is already completed. Verifying claim history before reporting success.');
        verifyClaimHistoryWithRetry();
        return true;
    }

    const target = findSignInButton();

    if (target) {
        console.log('Sign-in element found:', target);

        setTimeout(() => {
            target.click();
            console.log('Clicked sign-in element');
            showNotification(chrome.i18n.getMessage('signInSuccessNotify') || '自動簽到完成');
            setTimeout(() => {
                if (hasNoGameCharacterToast()) {
                    console.log('Sign-in failed: no game character found. Leaving tab open.');
                    return;
                }

                verifyClaimHistoryWithRetry();
            }, SUCCESS_REPORT_DELAY);
        }, 1000);

        return true;
    }

    const expandBtn = getExpandButton();
    if (expandBtn) {
        console.log('Sign-in button not visible yet. Found "View all rewards" button, clicking to expand...');
        expandBtn.click();
        return false;
    }

    if (attempts >= MAX_ATTEMPTS) {
        console.log('Could not find sign-in element after maximum attempts.');
        return true;
    }

    return false;
}

function startCheck() {
    const interval = setInterval(() => {
        if (attemptSignIn()) {
            clearInterval(interval);
        }
    }, RETRY_INTERVAL);
}

function showNotification(msg) {
    const div = document.createElement('div');
    div.innerText = msg;
    div.style.position = 'fixed';
    div.style.top = '20px';
    div.style.right = '20px';
    div.style.backgroundColor = '#4CAF50';
    div.style.color = 'white';
    div.style.padding = '10px 20px';
    div.style.borderRadius = '5px';
    div.style.zIndex = '999999';
    div.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    div.style.fontFamily = 'Arial, sans-serif';
    document.body.appendChild(div);
    setTimeout(() => {
        div.remove();
    }, 5000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startCheck);
} else {
    startCheck();
}
