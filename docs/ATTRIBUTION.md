# Attribution

Mi'aa brand vectors, palette and typography choices are reused from the existing project web brand kit v2.0 at the user's direction. They are project brand assets, not a grant of an open-source trademark license. The repository's application source has no newly imposed third-party project license.

Bundled fonts:

- Poppins Regular/SemiBold, obtained from `@expo-google-fonts/poppins` 0.4.1. Font copyright/license notices are retained in `packages/ui/assets/fonts/poppins-LICENSE_FONT.txt`.
- Noto Sans Ethiopic Regular/SemiBold, obtained from `@expo-google-fonts/noto-sans-ethiopic` 0.4.2. Font copyright/license notices are retained in `packages/ui/assets/fonts/ethiopic-LICENSE_FONT.txt`.

The font packages' wrapper licenses are also retained beside the font notices. The actual font license text is bundled and accessible through Settings → Open-source notices in every app. Application icons are deterministic vector compositions of the existing Mi'aa mark plus role badges; `npm run assets:generate` reproduces them using Sharp. Both color and themed icons retain role badges within the central 66dp safe zone of Android’s 108dp adaptive canvas. The repository audit checks those bounds and distinct themed pixel data for every role; see the [Android adaptive icon guidance](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive). No generated photos, remote font service or paid asset service is used.

Runtime libraries and tooling retain their upstream licenses in the npm distribution. Dependencies are pinned by the root lockfile. Native projects are generated from Expo's distributed native template, which retains its upstream notices. Source distribution does not include third-party `node_modules` or downloaded Android tooling.
