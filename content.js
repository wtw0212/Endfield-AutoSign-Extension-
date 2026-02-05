console.log('Endfield Auto Sign-in script loaded');

const MAX_ATTEMPTS = 20;
const RETRY_INTERVAL = 2000;
let attempts = 0;

function getExpandButton() {
    const spans = document.querySelectorAll('span');
    const localizedText = chrome.i18n.getMessage('viewAllRewards');
    const fallbackText = '查看全部獎勵'; // Keep original as fallback

    for (const span of spans) {
        if (span.innerText.includes(localizedText) || span.innerText.includes(fallbackText)) {
            return span;
        }
    }
    return null;
}

function findSignInButton() {
    // Strategy 1: Find via stable #lottie-container ID and traverse to clickable parent
    const lottie = document.querySelector('#lottie-container');
    if (lottie) {
        // Traverse up to find a clickable parent (div that acts as a button)
        let current = lottie.parentElement;
        for (let i = 0; i < 5 && current; i++) {
            // Check if this element is clickable (has cursor pointer or click handler)
            const style = window.getComputedStyle(current);
            if (style.cursor === 'pointer') {
                console.log('Found clickable parent via lottie-container:', current);
                return current;
            }
            current = current.parentElement;
        }
        // Fallback: return the closest div ancestor that might be clickable
        const parent = lottie.parentElement?.parentElement;
        if (parent) {
            console.log('Using lottie-container parent as fallback:', parent);
            return parent;
        }
    }

    // Strategy 2: Find by looking for elements containing sign-in related text
    const allDivs = document.querySelectorAll('div');
    for (const div of allDivs) {
        const text = div.innerText?.trim();
        // Match sign-in button text in various languages
        if (text === '簽到' || text === '签到' || text === 'Sign In' || text === 'Check In') {
            console.log('Found sign-in button via text content:', div);
            return div;
        }
    }

    return null;
}

function attemptSignIn() {
    attempts++;
    console.log(`Scanning for sign-in button (Attempt ${attempts}/${MAX_ATTEMPTS})...`);

    // New: Check if already signed in (even if not by this script)
    if (document.querySelector('#completed-overlay')) {
        console.log('Completed overlay detected. Reporting sign-in success to background script.');
        chrome.runtime.sendMessage({ action: 'signInSuccess' });
        return true; // Stop checking
    }

    const target = findSignInButton();

    if (target) {
        console.log('Sign-in element found:', target);

        setTimeout(() => {
            target.click();
            console.log('Clicked sign-in element');
            chrome.runtime.sendMessage({ action: 'signInSuccess' });
            showNotification(chrome.i18n.getMessage('signInSuccessNotify') || '自動簽到完成');
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
