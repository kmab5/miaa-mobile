# Cyclist workflows — v0.5.0

The Cyclist app has its own home, workspace and protected `cyclist/[screen]` allowlist: run, lookup, earnings and meal. Legacy module links redirect to these screens. Other roles do not import this workflow package. The backend derives cyclist identity from the bearer session; the app supplies no rider, kitchen, recipient or payout override.

| API relative path                              | Purpose                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GET cyclist/run?date=YYYY-MM-DD`              | Assigned packaged/on-the-way/delivered meals, still-cooking count, kitchen details and staff-meal flag |
| `GET cyclist/lookup?sticker=…&date=YYYY-MM-DD` | Exact sticker match within the authenticated rider's assigned day                                      |
| `GET cyclist/earnings?date=YYYY-MM-DD`         | Completed deliveries today and in the last seven days, plus current rate                               |
| `GET cyclist/dishes?date=YYYY-MM-DD`           | Named dishes on the assigned day for a staff meal                                                      |
| `POST cyclist/deliveries/:id/collect`          | One reviewed packaged meal becomes out for delivery; no body                                           |
| `POST cyclist/deliveries/:id/confirm`          | One reviewed collected meal becomes delivered; no body                                                 |
| `POST cyclist/comp-meal`                       | Today's staff meal with a named dish ID or `null`                                                      |

## Assigned run and confirmations

The run is split into ready-to-collect, on-the-way and delivered sections. Preparing meals are a count, matching the API rather than inventing actionable rows. Kitchen phone/address, delivery sticker, client, dish, directions, notes and replacement indicators come from the backend. Search filters sticker/client text. Delivered cards have no delivery action, calling or maps controls.

The kitchen's prep target is informational for collection. The existing backend allows a packaged meal to be collected before that target; the app does not add a new time lock. Backend authorization and transitions remain authoritative. Payment state does not block work.

Every collection/handover requires an explicit review. The model owns a frozen snapshot and consumes each review once. Before POST it reloads the assigned run for the reviewed EAT date, checks the delivery is still present and its details/status match, then sends one body-free request to that delivery's endpoint. A reassignment, changed address/client/sticker/status, invalid receipt or midnight rollover stops the workflow for a fresh review. No bulk completion or automatic write retry is introduced.

The current backend policy completes a delivery from the cyclist's confirmation alone; there is no invented client PIN or client approval step. The confirmation screen explains that completion. The backend records the delivery rate once, and repeating a confirmation cannot create another delivery row. A lost response is uncertain: refresh first, observe actual status, then review again only if still appropriate. Collection transitions are serialized by the service, and confirmation is idempotent after delivery. These service properties do not grant the mobile app an override.

## Lookup and external actions

Lookup uses an exact sticker, accepts case/spacing variations and a missing `MA-` prefix, and preserves replacement suffixes such as `-R1`. It does not guess a partial matching client. The canonical value is query-encoded, and the response must match that sticker. Editing/clearing/leaving lookup aborts its read and removes the previous client result. A missing or other-rider sticker shows no private data.

Only a current-day on-the-way meal offers client calling and maps. Phone links are built from validated telephone numbers, never arbitrary backend URLs. Maps opens the fixed HTTPS Google Maps host using the subscription's validated coordinates; zero coordinates are valid. The user explicitly taps this action, which explains the coordinates are opened in Google Maps. No current-location permission, map SDK, geocoding, paid service or automatic navigation is added. The kitchen's validated phone can be called from the run summary. OS link-opening failures remain visible and retryable.

## Earnings and staff meal

The earnings screen shows server counts for the selected EAT day and the inclusive rolling seven-day window ending on it, plus the current decimal rate in ETB. It does not multiply that rate into an invented payout. The office's report accounts for historical rates and payments already made.

Staff meal review captures the EAT date and selected dish. The run and dish options are reloaded before sending. Recorded meals, removed dishes, failed preflight reads and midnight rollover block another write. An unnamed dish is an explicit `null` choice. The existing database uniqueness rule guards one meal per recipient/day. The current write endpoint always uses the server's current day: a request in flight across midnight can still require office verification; the UI cannot change that endpoint's semantics.

## State, dates and limits

Reads explicitly request an EAT date, validate the returned shape and bind results to that date/query. A newer read aborts the older one; failed reads remove stale actionable data. Day screens refresh on focus/foreground. Lookup is cleared on blur. Authentication continues to gate foreground/session checks; owner-scoped controller disposal aborts requests and rejects late private results. One provider timer observes date rollover without polling the API or rerendering all rows every second.

Retry-After from reads or writes temporarily blocks mutations. Private run/lookup/earnings responses and unsubmitted reviews stay in memory; there is no business-response disk cache, background mutation outbox, route optimization, push service or offline identity fallback. A sleeping Render instance retains the shared 90-second transport timeout. No backend migration or new native dependency version is required.

Automated checks use fixtures and preserve all auth/Client/Mother regressions. Actual Android/iOS devices, real backend accounts, phone/maps handlers, accessibility and Amharic editorial review remain acceptance work in [ACCEPTANCE.md](ACCEPTANCE.md). No Round 5 platform exports or native builds were run.
