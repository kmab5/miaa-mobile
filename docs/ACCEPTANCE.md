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
