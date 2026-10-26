# Foundation device acceptance — v0.1.0

These are manual device checks, not claims of completed emulator/phone testing. Automated source, browser and compilation evidence is recorded in [VALIDATION.md](../VALIDATION.md).

1. Install all four preview APKs together. Confirm distinct names, role badges and `.preview` package IDs; each app should open its own workspace.
2. Cold-launch a standalone preview without Metro, including in airplane mode. Home, Workspace, Settings and font-license notices should remain usable.
3. Switch English/Amharic, navigate across tabs, force-close and restart. Confirm the selected language survives and both scripts remain legible.
4. Check a narrow Android phone, gesture navigation, three-button navigation and a large system font setting. Labels must stay visible, touch targets usable and content scrollable above system bars.
5. Open every module overview, return using both the on-screen and Android back actions, and open an invalid/other-role module link. A direct link without navigation history must provide a route back to the workspace.
6. Start a public connection check, cancel it, retry, leave Settings during a pending check and test offline failure. A sleeping backend may take up to 90 seconds. No account data or login is used.
7. Confirm a preview build needs no microphone/storage permission and cannot overwrite a production app. Production signing and real business workflows belong to later rounds.

Native iOS acceptance additionally requires a macOS/Xcode build and an iPhone/iPad. Linux platform export alone does not satisfy that requirement. Final Amharic editorial review should be done by the product's Amharic-speaking reviewer.
