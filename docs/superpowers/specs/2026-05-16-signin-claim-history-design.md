# Sign-in Claim History Verification Design

## Summary
Add a stricter success check that opens the claim history panel, confirms it is visible, and verifies the newest record date equals today (UTC+8). This check replaces the existing "best effort" success reporting and should work for both Arknights and Endfield sign-in pages.

## Goals
- Use the claim history panel as the single source of truth for sign-in success.
- Determine "today" using the claim record timestamp in UTC+8.
- Retry the check up to 3 times with 5s intervals before failing.
- Keep the tab open when the check fails (no success report to background).

## Non-Goals
- No changes to background scheduling or tab management beyond success reporting.
- No UI redesign of the sign-in pages.
- No localization overhaul beyond recognizing the existing panel titles.

## User Flow
1. Open the sign-in page and click the sign-in card.
2. Attempt to open claim history panel (header icon or fallback selector).
3. Confirm claim history panel title appears.
4. Read the newest claim record time.
5. If the newest record date matches today (UTC+8), report success.
6. Otherwise, retry up to 3 times with 5s intervals.

## DOM Strategy
### Header Identification
- Find a header container containing either:
  - "本月已累計簽到" (Arknights), or
  - "Signed in" (Endfield)
- Use the nearest parent container as the header scope.

### Claim History Icon
- Within the header scope, find small clickable icons (approx 10-18px).
- The left icon opens claim history, the right icon opens "About Sign-ins".
- Prefer the left-most icon by X position.
- Fallback selector if header scan fails:
  - `.sc-extOrw.giWaQb.sc-hYnFiZ.dDDjjc`

### Panel Detection
- Arknights: panel title contains "領取紀錄"
- Endfield: panel title contains "Claim History"
- Accept either string to confirm the panel is open.

## Date Parsing and Timezone
- Extract the newest record date in `YYYY-MM-DD` format from the first record entry.
- Arknights typically includes `UTC+8`; Endfield often omits timezone.
- Treat missing timezone as UTC+8.
- Compute "today" using UTC+8 and compare `YYYY-MM-DD` strings.

## Retry Policy
- If panel is not open or newest record date is not today:
  - Retry up to 3 times
  - Wait 5 seconds between attempts
- On final failure:
  - Do not call `signInSuccess`
  - Leave the tab open for manual inspection

## Error Handling and Logging
- Log each step:
  - Panel open attempt
  - Panel title detection
  - Parsed newest record date
  - UTC+8 today date
  - Retry count and final failure
- If click is blocked by overlay, dispatch a synthetic click event as fallback.

## Acceptance Criteria
- Arknights: Opening claim history shows the newest record date for today; success is reported.
- Endfield: Opening claim history shows the newest record date for today; success is reported.
- If the newest record date is not today, the extension retries 3 times and then fails without reporting success.
- Existing functionality for auto/manual sign-in remains intact aside from the stricter success condition.

## Testing Notes
- Add unit tests for date parsing (`YYYY-MM-DD` extraction) and UTC+8 comparison.
- Add integration tests to ensure claim history detection gates success reporting.
