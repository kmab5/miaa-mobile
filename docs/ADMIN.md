# Admin workflows — v0.7.0

The Admin app remains a separately installed app. Its protected `admin/[screen]` allowlist now exposes daily operations, people, catalog/prices, subscriptions, pending payments, support, organization settings and their detail/review forms. Legacy module links redirect to these workflows. Round 7 adds finance, payouts, stock, analytics and archive/restoration; see [ADMIN_FINANCE.md](ADMIN_FINANCE.md) for contracts and financial distinctions. Legacy reports now opens the implemented reports hub.

## Existing API coverage

All paths below are relative to `/api/v1/admin/` and require an authenticated Admin. There is no database client or server secret in the app.

| Workflow                          | Existing endpoints used                                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Daily board and oversight         | GET `day`, `prep-sheets`, `run-sheets`, `labels`, with explicit EAT `date`                                       |
| Mothers                           | GET/POST `mothers`, GET/PATCH `mothers/:id`, PATCH `mothers/:id/status`, PATCH `mothers/:id/password`            |
| Inspections and package prices    | POST `inspections`, GET `mothers/:id/offerings`, POST `offerings`                                                |
| Cyclists                          | GET/POST `cyclists`, GET/PATCH `cyclists/:id`, PATCH `cyclists/:id/status`, PATCH `cyclists/:id/password`        |
| Clients                           | GET/POST `clients`, GET/PATCH `clients/:id`; server name/phone search                                            |
| Catalog                           | GET/POST `dishes` and `packages`, PATCH `dishes/:id` and `packages/:id`; inactive items remain visible/editable  |
| Subscriptions                     | GET/POST `orders`, GET `orders/:id`, POST `orders/:id/cancel`                                                    |
| Delivery corrections              | PATCH `deliveries/:id/assignment` and `deliveries/:id/dish`; POST `deliveries/:id/package`, `collect`, `confirm` |
| Replacement meals                 | POST `redeliveries`, with original delivery ID, future weekday, reason and optional dish                         |
| Off-platform payments             | GET `payments/pending`, POST `payments/:id/confirm` with a reference, POST `payments/:id/fail`                   |
| Mother requests                   | GET/POST `tickets`, POST `tickets/:id/resolve` and `tickets/:id/reopen`                                          |
| Organization/payment instructions | GET/PATCH `settings`                                                                                             |

Read parsers also validate `reassign-options`; the assignment form uses the full live people lists so the selected name, status and identity can be reviewed together. No new backend route or migration is needed. The implementation follows web v0.19.0's existing schemas/services.

## Daily board, people and catalog

The daily board binds counts/groups/stickers to the requested EAT calendar day and distinguishes unassigned work. Preparation/run sheets and label data are read-only oversight views. The backend's prep-sheet function currently defaults its embedded sheet deadline to `11:00`; the app does not display that embedded field as an authoritative current setting. Organization settings and the actual transition services remain the authority. Label viewing is included; printing continues through the web portal. No print/export dependency or generated document is added.

Admin delivery actions are explicitly reviewed corrections, including packaging after a mother's deadline. The actual state machine still applies. Mother reassignment is only offered while preparing; cyclist assignment remains subject to backend active-link rules. Dish changes are available through the selected future day's board. Terminal/cancelled work has no normal transition control. A replacement requires its own reason and future weekday; the backend validates fasting, capacity and the original subscription.

People forms use named choices and backend IDs, normalize Ethiopian phones, accept zero coordinates and enforce numeric/money/date/text bounds. Staff status changes and password resets have their own explanations. The server may refuse deactivation/reassignment when work is in flight. Client profiles with missing legacy coordinates require a real location before an address update. Staff accounts are provisioned by an Admin; no staff signup or Client password-reset endpoint is invented.

Mother inspections update the backend's latest inspection date/notes. Mother package prices are upserted with POST, including explicit active flags. Catalog prices never reprice existing subscriptions. Round 7 adds reviewed soft deletion and restoration from these live views. Historical rows remain stored; there is no hard-delete action.

## Orders, payments and requests

Subscription creation selects a named client, kitchen and active priced offering. The client’s saved address can be copied explicitly, then reviewed. Regular orders collect all five weekday choices; combined packages require fasting dishes Wednesday/Friday. Demo orders collect only the selected future weekday's dish. Before an initial order write, the priced offering is re-read and must still match the reviewed row. The backend makes the final radius, capacity, date and price decision. Known returned price/dates are shown in the receipt.

Regular start dates follow the backend's next-Monday rule. A reviewed new order is invalidated if the observed EAT day changes before sending; a request crossing server midnight can still require verification, since the API derives purchase dates at execution time. Explicit retry of an uncertain order keeps its saved original body/key.

Cancellation displays the backend's refund-due flag and cancelled/delivered counts. It does not transfer a refund. Payment confirmation records only money already received off-platform and requires a transaction/receipt reference. Failure recording does not create a transfer or payment gate. Scheduled deliveries continue independently of pending payment, as required by the existing business policy.

Clients, subscriptions and requests are limited by the API to the most recent 200 rows; pending payments show at most 100. Limits are labelled. Client search goes to the server. For a client outside the recent order picker, search People → Clients, open that client and start a new subscription there; the form loads that selected client directly. There is no invented pagination or missing-record total.

## Reviewed writes and durable recovery

Every business write requires a separate review/confirmation. The controller captures a copy of the validated body, issues and consumes a review once, and re-reads an existing target/price before mutation. Changed or missing targets are refused. Only fixed form/action/read paths are allowed; invalid/other-role routes and malformed IDs cannot trigger a fabricated `/0` request. Read parsers select explicit fields and do not render arbitrary raw server records or errors.

Before any POST/PATCH, an owner/origin/variant-scoped journal is committed. Native storage uses device-only SecureStore chunks below 1,500 UTF-8 bytes with an atomic head; browser preview uses localStorage and Web Locks. Pending payloads can include personal addresses/notes and payment references, and the UI explains this. Password-reset payloads are excluded from persistence entirely. Browser authentication remains memory-only. Blocked/corrupt storage and missing browser locks fail closed for writes; read-only workflows remain usable.

The journal also retains a minimal, non-sensitive revision receipt after a confirmed or explicitly resolved action. Completed payloads are removed; replacement receipts keep only their original delivery ID. This revision prevents a stale second admin review from silently creating a duplicate after the first tab/controller succeeds. Native operations and browser tabs serialize their journal critical sections. The journal stays scoped across app version updates; different accounts, backend origins and build variants cannot read one another's recovery state.

Unknown/lost/malformed responses and failed receipt persistence retain the unresolved action. No write is retried automatically. Only known initial HTTP parser/auth/rate-limit refusals clear an unsent intention. Generic 404/409 responses are kept conservative. Rate-limit cooldown is respected for reads/writes.

An unresolved subscription can be explicitly retried with its exact saved key/body. An unresolved non-idempotent action has no resend button. The Admin must inspect the affected record/list and, where necessary, consult the office/staff before explicitly allowing another change after a duplicate-risk explanation. For an uncertain password reset, verify the staff member's actual access; no read endpoint claims to reveal their password. Clearing a reminder cannot undo a server write. Stale clearing reviews cannot release a newer action.

These are client-side safeguards, not a new backend compare-and-swap contract or cross-device exactly-once guarantee. Independent devices, records changing after preflight, app-data deletion, archived retry keys and unknown server results can need office reconciliation. The original API's transaction/uniqueness/authorization rules are the final authority. No mutation outbox, automatic background resend, analytics SDK, payment processor or paid infrastructure is introduced.

## State and acceptance limits

All account and business response data remains in memory apart from the explicit recovery journal. Active screens own their read observations; superseded/blurred reads are aborted, failed reads remove actionable stale data, and only currently observed resources refresh after a write. Auth phase/owner changes dispose the controller and abort requests. Strict Mode replay is covered.

Admin now declares the already pinned SDK-compatible Expo Crypto 58.0.7 module for secure action keys. This adds no new external package version, but an older Admin binary may require its normal native update when the owner builds it. No native build or platform export was run for this round.

Automated tests use fixtures and include all previous role regressions. Actual Android/iOS linking/devices, real-account API acceptance, screen readers/large text, the native keyboard and human Amharic editorial review remain pending. See [ACCEPTANCE.md](ACCEPTANCE.md) and [VALIDATION.md](../VALIDATION.md).
