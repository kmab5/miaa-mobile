# Client workflows — Round 3 / v0.3.0

The Client app uses the existing web v0.19.0 authenticated API. It introduces no backend migration, payment processor, map SDK, location permission or paid infrastructure. Staff operations remain in their later rounds.

## Screens and contract

| Screen/action         | API                                                                            |
| --------------------- | ------------------------------------------------------------------------------ |
| Home / today’s lunch  | `GET client/today` (server’s current EAT date)                                 |
| Profile               | `GET client/profile`                                                           |
| Save delivery address | `PATCH client/address` with numeric latitude/longitude and optional directions |
| Nearby packages       | `GET client/offerings?latitude=…&longitude=…`                                  |
| Dish choices          | `GET client/dishes`                                                            |
| Reviewed order        | `POST client/orders` with persisted `Idempotency-Key`                          |
| Recent history        | `GET client/orders` (backend limit: latest 100)                                |
| Own order details     | `GET client/orders/:id`                                                        |
| Payment instructions  | `GET client/payment-instructions`                                              |

Name/phone are read-only because this API exposes address updates, not identity editing. Enter coordinates from a delivery pin in a maps app; empty/non-finite/out-of-range values are rejected and zero is valid. A partial legacy location can be completed. Saving the profile does not move an existing subscription. Coverage uses the saved address and distinguishes a missing location, an empty service area and a failed request.

Regular packages need Monday–Friday dishes. Fasting packages show fasting dishes, non-fasting packages show non-fasting dishes, and combined packages use fasting Wednesday/Friday. Demo packages accept either active dish and require one future weekday. These filters guide selection; the server remains authoritative for active dishes, radius, capacity, price, package dates and authorization. A review is required before any order POST. The reviewed address/dish/payment/note values are copied, not read again from editable fields during a retry.

Payments happen outside the app. Organization instructions come from persistent backend settings and remain accessible on Home, checkout and order details. The chosen method/reference is recorded for an administrator; no money is transferred. Missing payment instructions explain whom to contact. Payment state does not gate today’s lunch, delivery status or calling. Only an on-the-way delivery exposes a validated cyclist phone link. Client delivery confirmation and self-service cancellation are not invented beyond the existing API.

## Durable order intentions

The controller commits an owner/variant/backend-scoped journal before network I/O. Native storage uses `WHEN_UNLOCKED_THIS_DEVICE_ONLY` SecureStore with UTF-8 chunks of at most 1,500 bytes; a small head becomes visible only after all chunks are stored. Browser previews use localStorage and Web Locks, independently of memory-only bearer tokens. The checkout explains pending-detail persistence. Missing/blocked/corrupt storage refuses a new order rather than pretending the journal is empty. Browsers need a secure context with Web Locks; native apps do not depend on that browser capability.

| Journal state | Meaning                                  | Available action                                           |
| ------------- | ---------------------------------------- | ---------------------------------------------------------- |
| Prepared      | Payload/key saved; not yet submitted     | Explicit send with saved key/body                          |
| Uncertain     | POST could have reached the server       | Retry the exact saved request; no replacement intention    |
| Rejected      | Recognized initial pre-commit refusal    | Explicitly start again and review a fresh draft            |
| Confirmed     | Valid order response and durable receipt | View order; a separately reviewed next intention may begin |

A timeout, lost/malformed response, storage failure while saving the receipt, session closure or unknown error retains the existing intention. A retry never creates a new key or changes its payload. There is no background mutation queue or automatic write retry. A 429 respects `Retry-After` before enabling manual retry. Writes/reads serialize across native controllers, and browser tabs use Web Locks. A review also captures the observed journal revision: a concurrent submission surfaces the existing outcome instead of generating another key. The same submitted review cannot be used twice.

The v0.19 API reads order details after the creation transaction. A generic 404/409 can therefore occur after a successful commit. Only schema/parser refusals and explicitly recognized pre-commit business messages unlock a fresh review on the first attempt. Unknown wording or any refusal after an uncertain attempt stays unresolved. That conservative compatibility boundary is regression-tested; future backend changes must not broaden it to every 4xx. An archived key or persistent conflict needs administrator review using the displayed recovery reference, not a new random key.

Pending intentions survive logout/restart but are rendered only after the same Client signs back in. A resolved receipt keeps an order ID and replaces the committed draft details. No identity/profile/menu response cache is persisted. Unsubmitted form drafts remain in memory. Do not clear app data, uninstall or change preview signing while an outcome is uncertain. Independent purchases on different devices are separate intentions; local recovery cannot reconstruct data the user deleted.

## Navigation, errors and acceptance

Client routes are protected by the existing session owner. The fixed `client/[screen]` map cannot select staff screens; legacy Client module links redirect to real workflows. Detail IDs are validated and private responses are associated with their requested route. Read requests abort on blur and ignore late completions. No raw backend error, stack or credential is displayed. English/Amharic dictionaries have matching typed keys, with Ethiopic fonts for free-form names/directions and accessible selected states for choices.

Automated tests use contract fixtures, including all private mutations. They exercise durable failures/concurrency and real exported UI; they do not prove production account/Telegram delivery, physical SecureStore behavior or device accessibility. Complete [ACCEPTANCE.md](ACCEPTANCE.md) on authorized devices/accounts. Native iOS needs macOS/Xcode; a JavaScript export alone does not compile it. See [VALIDATION.md](../VALIDATION.md) for results actually observed in this round.
