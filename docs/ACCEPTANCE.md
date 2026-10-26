# Round 6 acceptance additions

These need authorized Admin accounts/devices; automated private actions use fixtures.

- Compare daily board totals/statuses, kitchen groups, unassigned work, prep/run sheets and labels with the web portal, including future dates and cancelled work. Print through the web portal when needed.
- Create/edit real test people/catalog records, inspect a kitchen, adjust prices and staff status, and verify in-flight/deactivated-link restrictions. Existing orders must retain their prices and histories.
- Verify a staff member in person, reset their password and check all their old sessions are revoked. Lose the response and verify actual staff access before releasing the reminder. Inspect device/browser persistence to confirm no password text/hash is stored.
- Place regular/combined/demo Admin orders, copy a client address, verify all fasting choices, radius/capacity/final price/dates and retry one lost result with the same key/body after restart. Find an older client through server search and start their order from the profile.
- Correct a packaging/collection/delivery event, reassign work, change a future dish and issue a reviewed replacement. Verify current assignments, terminal states, fasting/capacity and audit reasons remain backend-enforced.
- Confirm/fail an already received off-platform payment and cancel a test subscription. Compare pending-payment work and refund-due results with the backend; no transfer should occur.
- Create/resolve/reopen requests and change organization payment instructions; verify the Client reads the persisted instructions.
- Lose responses and restart/logout/switch admins. Test blocked/corrupt storage, concurrent stale reviews, rate limits, explicit result checking and no automatic resend. Native linking for Admin Crypto and real Android/iOS SecureStore remain device acceptance.
- Verify keyboard/large-text/screen-reader behavior, long lists/notes, English/Amharic and human Amharic editorial accuracy. Test operations around EAT rollover and record changes after preflight; the API has no new compare-and-swap contract.

No Round 6 platform exports or native builds were run. Finance/payouts/stock/analytics/archive remain Round 7. See [ADMIN.md](ADMIN.md) and [VALIDATION.md](../VALIDATION.md).

---

# Round 5 acceptance additions

These require authorized Cyclist accounts/devices; automation uses fixtures.

- Compare the real rider's kitchen, ready/on-the-way/delivered sections, preparing count and assigned total with the web portal. Verify other-rider stickers and assignments cannot be read or changed.
- Review/collect one actual package and review/confirm its handover. Compare server status, confirmation time, one-time delivery rate and earnings counts. Repeated taps, concurrent rider sessions and lost responses must not duplicate transitions.
- Reassign, cancel or change a delivery between review and confirmation; verify a refresh/fresh review is required. Confirm no client PIN or new collection-time lock has been invented.
- Look up exact normal and replacement stickers with/without `MA-`. Edit/clear/leave a pending lookup; verify the previous client's details disappear and stale results cannot reopen it.
- Test real kitchen/client phone handlers, malformed phone data, failed OS handlers and maps on Android/iOS. Confirm the saved delivery pin is used and no new location permission is requested.
- Verify the last-seven-day count/current rate and office payout explanation against the backend. The app must not show a fabricated owed/paid total.
- Record a named and unnamed staff meal on separate test days; retry an uncertain result and confirm one daily row. Exercise EAT midnight during an open review and during a network request.
- Test session revocation, foreground validation, slow Render startup, offline recovery, rate limits, English/Amharic, narrow/large-text layouts and screen readers. Human Amharic editorial review remains pending.

No Round 5 exports or native builds were run. See [CYCLIST.md](CYCLIST.md) and [VALIDATION.md](../VALIDATION.md).

---

# Round 4 acceptance additions

These require authorized Mother accounts/devices; automated tests use fixtures.

- Compare the actual kitchen queue, dish/non-spicy/remaining totals and sticker/notes/replacement details with the web portal. Verify another kitchen cannot be read or changed.
- Review/package one preparing delivery before the configured EAT deadline. Repeat taps and simulate a lost response; verify one transition and recorded cooking rate/time. Confirm the deadline blocks the Mother but permits the existing web Admin correction flow.
- Set the phone to another timezone, cross the deadline while a review is open, background/foreground and revoke the session. Verify actions remain scoped and backend rules prevail.
- Record a named and unnamed staff meal on separate test days. Retry a lost receipt and confirm one row per day. Inspect rollover behavior; the existing endpoint uses server today.
- Send a reviewed support request, lose the response, restart/logout/sign back into the same account and check history without resending. Confirm a different account sees no marker. Inspect absent-history/office-review clearing, rate limits and blocked/corrupt storage.
- Verify SecureStore recovery on actual Android/iOS and browser preview Web Locks/storage. Clear app data only after resolving uncertain writes.
- Verify English/Amharic layout, long notes, large text, TalkBack/VoiceOver, keyboards and narrow phones. Human Amharic editorial review remains pending.

No Round 4 platform exports, APKs or native builds were run. See [MOTHER.md](MOTHER.md) and [VALIDATION.md](../VALIDATION.md).

---

# Round 3 acceptance additions

These checks require authorized devices/accounts; automation uses fixtures.

- Save an actual delivery pin (including a zero coordinate in a test environment), verify nearby coverage and confirm older orders keep their address.
- Purchase a regular and demo package with valid fasting choices; compare the actual backend’s kitchen, final price, dates, payment record and delivery rows.
- Lose connectivity after sending, kill/restart the app and sign back into the same Client account. Retry the saved request and confirm one database subscription/payment set, not two.
- Preserve an uncertain key across logout, background/foreground and storage errors. Resolve an archived/conflicting request with an administrator; never clear data merely to bypass recovery.
- Confirm payment instructions match organization settings. Pending payment must not hide scheduled deliveries or calling while food is on the way.
- Inspect recent history/details and revoked/wrong-role links. Confirm Client order/address operations cannot read or mutate other clients.
- Verify native SecureStore chunk persistence/backup exclusions on Android and iOS. Inspect form/keyboard behavior, TalkBack/VoiceOver, large text, low-memory phones and Amharic editorial accuracy.
- Resolve pending orders before uninstalling a preview or changing its signing certificate. Native iOS compilation and actual devices remain separate from a JavaScript export.

See [CLIENT.md](CLIENT.md) and [VALIDATION.md](../VALIDATION.md).

---

# Round 2 acceptance additions

These manual items are pending until exercised on authorized native test devices/accounts; automated fixture checks do not mark them complete.

- Sign in with a real authorized account for each of Admin, Mother, Cyclist and Client; reject wrong-role and deactivated accounts.
- Cold restart with a saved token; verify the workspace stays locked until server validation succeeds.
- Background/foreground, lose network, retry and revoke access from the web; ensure no stale private screen survives.
- Use actual Telegram own-contact verification, OTP delivery/resend, expired code/link and Client signup. Confirm linked status alone never signs an existing user in.
- Set/change passwords, confirm other devices are signed out, prevent Telegram unlink without a password, and revoke all sessions including the current app and website.
- Sign out offline and verify local removal; inspect the explicit remote-revocation warning. Exercise native storage failure recovery and uninstall/reinstall behavior separately.
- Check Android/iOS keyboard avoidance, large text, screen readers, English/Amharic layout and editorial accuracy.
- Rebuild native apps for SecureStore; an old Round 1 binary does not contain the module.

The foundation checklist below remains applicable. Round 1 build records describe v0.1.0 only; current verification is in [VALIDATION.md](../VALIDATION.md).

---

# Foundation device acceptance — v0.1.0

These are manual device checks, not claims of completed emulator/phone testing. Automated source, browser and compilation evidence is recorded in [VALIDATION.md](../VALIDATION.md).

1. Install all four preview APKs together. Confirm distinct names, role badges and `.preview` package IDs; each app should open its own workspace.
2. Cold-launch a standalone preview without Metro, including in airplane mode. Public sign-in/recovery should remain usable; private screens must stay locked when session validation cannot reach the server.
3. Switch English/Amharic, navigate across tabs, force-close and restart. Confirm the selected language survives and both scripts remain legible.
4. Check a narrow Android phone, gesture navigation, three-button navigation and a large system font setting. Labels must stay visible, touch targets usable and content scrollable above system bars.
5. Open Client workflow screens and each remaining staff module overview, return using both the on-screen and Android back actions, and open an invalid/other-role module link. A direct link without navigation history must provide a route back to the workspace.
6. Start a public connection check, cancel it, retry, leave Settings during a pending check and test offline failure. A sleeping backend may take up to 90 seconds. No account data or login is used.
7. Confirm a preview build needs no microphone/storage permission and cannot overwrite a production app. Production signing and staff business workflows belong to later rounds. Client workflows are active in Round 3.

Native iOS acceptance additionally requires a macOS/Xcode build and an iPhone/iPad. Linux platform export alone does not satisfy that requirement. Final Amharic editorial review should be done by the product's Amharic-speaking reviewer.
