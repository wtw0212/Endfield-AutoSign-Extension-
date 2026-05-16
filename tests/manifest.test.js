const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8'));

test('declares SKPORT host permission for Chromium site access controls', () => {
    assert.ok(
        manifest.host_permissions?.includes('https://game.skport.com/*'),
        'manifest should explicitly request access to game.skport.com'
    );
});
