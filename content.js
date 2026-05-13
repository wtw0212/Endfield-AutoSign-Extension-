console.log('SKPORT Auto Sign-in script loaded');

const MAX_ATTEMPTS = 20;
const RETRY_INTERVAL = 2000;
const POST_CLICK_VERIFY_ATTEMPTS = 8;
const POST_CLICK_VERIFY_INTERVAL = 1000;
let attempts = 0;
let signInClicked = false;

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
    const fallbackText = '查看全部獎勵';

    for (const span of spans) {
        if (span.innerText.includes(localizedText) || span.innerText.includes(fallbackText)) {
            return span;
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
function hasRewardCards() {
    return document.querySelectorAll('[class*="sc-nuIvE"]').length > 0;
}

function hasExplicitCompletionText() {
    const text = document.body?.innerText || '';
    return [
        '今日已簽到',
        '已簽到',
        '簽到完成',
        '已完成簽到',
        'already signed',
        'signed in',
        'claimed',
        'completed'
    ].some(marker => text.toLowerCase().includes(marker.toLowerCase()));
}

function isTodayAlreadyCompleted(options = {}) {
    const allowSettledRewardCards = options.allowSettledRewardCards === true;
    const lottie = document.querySelector('#lottie-container');
    // If lottie exists, today is still pending
    if (lottie) {
        return false;
    }

    if (hasExplicitCompletionText()) {
        return true;
    }

    // After we clicked the reward, the pending lottie disappearing while the
    // reward grid remains visible is the site state transition we can verify.
    if (allowSettledRewardCards && signInClicked && hasRewardCards()) {
        return true;
    }

    return false;
}

function reportSignInSuccess() {
    showNotification(chrome.i18n.getMessage('signInSuccessNotify') || '自動簽到完成');
    chrome.runtime.sendMessage({
        action: 'signInSuccess',
        targetKey: getSignInTargetKey()
    });
}

function waitForSignInCompletion(remainingAttempts = POST_CLICK_VERIFY_ATTEMPTS) {
    if (isTodayAlreadyCompleted({ allowSettledRewardCards: true })) {
        console.log('Sign-in completion verified. Reporting success to background script.');
        reportSignInSuccess();
        return;
    }

    if (remainingAttempts <= 0) {
        console.log('Sign-in click was issued but completion could not be verified. Leaving tab open.');
        return;
    }

    setTimeout(() => {
        waitForSignInCompletion(remainingAttempts - 1);
    }, POST_CLICK_VERIFY_INTERVAL);
}

function attemptSignIn() {
    attempts++;
    console.log(`Scanning for sign-in button (Attempt ${attempts}/${MAX_ATTEMPTS})...`);

    // Check if today is already signed in
    if (isTodayAlreadyCompleted()) {
        console.log('Today\'s sign-in is already completed. Reporting success to background script.');
        reportSignInSuccess();
        return true;
    }

    const target = findSignInButton();

    if (target) {
        console.log('Sign-in element found:', target);

        setTimeout(() => {
            try {
                target.click();
                signInClicked = true;
                console.log('Clicked sign-in element');
                waitForSignInCompletion();
            } catch (error) {
                console.log('Sign-in click failed. Leaving tab open.', error);
            }
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
