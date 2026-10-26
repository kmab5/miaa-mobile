# Mother workflows — v0.4.0

The Mother app has its own home, workspace and protected `mother/[screen]` routes. The shared root registers them only for the Mother app. Legacy preparation/meal/request module links redirect to the matching screen. Unknown and other-role routes fail closed. The backend derives the kitchen identity from the bearer session; the app never sends a mother/recipient ID.

| API relative path                    | Purpose                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `GET mother/day`                     | Today's assigned queue, dish totals, preparation deadline, meal flag and open-request count |
| `GET mother/dishes`                  | Named dishes in today's kitchen batch                                                       |
| `POST mother/deliveries/:id/package` | Confirm one reviewed sticker as cooked and packaged; no body                                |
| `POST mother/comp-meal`              | Record today's staff meal with a batch dish ID or `null`                                    |
| `GET mother/tickets`                 | Backend's latest 50 requests, including resolved requests                                   |
| `POST mother/tickets`                | Submit an explicitly reviewed, trimmed 1–2,000-character request                            |

## Queue and deadlines

The queue shows the server's dish totals, non-spicy counts and remaining counts, along with each sticker, client, directions, notes, fasting category and replacement flag. Search filters sticker/client text; status filters expose checked radio state. An empty queue, no filter matches, read failure and malformed response have separate feedback. Counts are backend values; "Beyond preparation" does not imply delivery is complete.

Only today's preparing entries can be reviewed for packaging. The displayed server date and deadline are in EAT (UTC+3), independent of phone timezone. A local clock disables packaging exactly at the deadline even if the last server snapshot still says it is open. A confirmation re-reads the day, verifies the identifier/status/deadline, sends one explicit POST, validates the receipt's ID/status/timestamp and refreshes the queue. The backend owns authorization and final deadline/status enforcement. There is no admin override in this app.

No business POST is retried automatically. A lost packaging response is shown as uncertain; refresh the queue before reviewing again. A successful transition no longer exposes the action. The backend serializes delivery transitions, so repeating a confirmation cannot repeat the cooking transition. A device clock that is wrong may block early or lag visually; it never grants a backend exception.

Reads refresh on entry and when the day screen returns to the foreground. Read generations discard late results, and failed reads remove actionable stale data. The authentication controller locks private navigation during session revalidation and cancels its requests. The Mother controller is scoped to that authenticated owner and disposed when that scope ends. No queue, address, request history or identity is persisted offline.

## Staff meal

Review a named dish from today's batch, or choose no specified dish. Before writing, both the day and dish options are reloaded. A recorded daily meal is shown immediately and causes no second POST. Invalid/removed dishes and stale EAT days are blocked. The backend's daily uniqueness constraint is the final duplicate guard. The meal is separate from client orders and is not tied to payment status. The current endpoint always records the server's current EAT day; avoid confirming across midnight and verify the resulting day if a request spans rollover.

## Support-request recovery

Support requests do not have a backend idempotency key. Before sending, the app reloads history and commits a small device recovery marker containing SHA-256 of the reviewed text, the observed ticket IDs and an attempt timestamp. The message text, client data and credentials are not in this marker. The unsubmitted editor/review remains in memory only.

Native markers use Expo SecureStore with device-only access, no shared keychain group and no biometric prompt. The maximum marker is below 1,500 UTF-8 bytes. Scope includes authenticated user, API origin and variant, and survives app version changes. Browser previews use localStorage and Web Locks; credentials remain memory-only. Same-scope native operations are serialized. Unavailable/corrupt storage or unavailable browser locks blocks sending; request history can still be read.

A valid `{ok:true}` receipt clears the marker. Malformed responses, network/timeouts, unknown errors, generic conflicts and failed receipt cleanup retain it. Only known pre-insert HTTP parser/auth/rate-limit refusals permit automatic marker cleanup; there is no automatic resend. Rate-limit feedback honors Retry-After before another mutation.

"Check request history" reconciles a matching message with an ID above the pre-attempt history maximum. It never posts. An existing identical request in the pre-attempt history cannot be mistaken for this attempt. If a matching entry is absent, the app cannot prove the write failed and retains the reminder. The user can explicitly review history and consult the office, then confirm "Allow another request" after a duplicate-risk explanation. Clearing only removes the reminder, not a server record.

This is conservative recovery, not cross-device exactly-once delivery: separate devices, independently intended messages, out-of-band changes, cleared app data, the history limit and server changes can require office confirmation. No background outbox, push service or paid infrastructure is added. All tests use fixtures; actual account/device and Amharic editorial acceptance remains in [ACCEPTANCE.md](ACCEPTANCE.md).
