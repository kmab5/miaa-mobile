# Admin finance, stock and archive — v0.7.0

Round 7 extends the separate Admin app. Home and Workspace open **Finance and reports**; legacy `modules/reports` redirects there. All routes are under the authenticated Admin boundary. The existing Render `/api/v1/admin/` API and Neon database are reused. No migration, transfer provider, paid service or new external dependency is required.

| Workflow                            | Existing endpoints used                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| Manual ledger                       | GET/POST `finance`; GET `finance/summary`                                              |
| Staff earnings and recorded payouts | GET/POST `payouts`                                                                     |
| Stock catalog                       | GET/POST `stock`; GET/PATCH `stock/:id`                                                |
| Stock history                       | GET `stock/:id/movements`; POST `stock/movements`                                      |
| Analytics                           | GET `analytics/revenue`, `packages`, `volume`, `mothers`, `cyclists`, `unit-economics` |
| Archive                             | GET `recycle-bin`; DELETE `records/:kind/:id`; POST `records/:kind/:id/restore`        |

## Finance and payouts

The ledger contains manual money movements. Confirmed subscription payments are a separate source used by revenue analytics. Confirming a payment does not add a manual ledger entry; the app warns against adding those cash figures or recording the same expense twice. There is no unified bank balance, payment collection or transfer action.

Finance supports a reviewed positive amount, matching income/expense category, description, money-movement date, counterparty, method, reference, text-only receipt URL and optional named mother/cyclist links. Archived staff cannot be selected; inactive live staff can be linked for historical entries. The API also accepts an optional payment link, which this manual form does not expose because the available generic payment list only contains pending payments. Use the web for that optional link. The service's 500-character description bound is enforced even though the API schema permits 2,000. Receipt URLs accept HTTP(S), disallow embedded credentials and are never automatically opened or fetched by the app.

Date filters use real `YYYY-MM-DD` calendar values. Reports require an ordered interval with at most 366 days between endpoints. The full-period ledger summary includes every category and direction. Entry filters affect only the list, which is capped at 500 recent matches; totals are never summed from that truncated list. No pagination endpoint is invented.

Payout reports display the server's exact unit count, historical/mixed rate, fallback warning, earned, paid and outstanding amounts. Numeric IDs are scoped by mother/cyclist kind. The app never multiplies counts by today's rate. A payout is launched from a named report row, which is re-read before writing. Inactive live people can still be paid for completed work. The backend makes the final decision about archived/missing people and invalid state.

Recording a payout logs money already paid off-platform. Its `occurredOn` date determines which report includes the payment; the period description does not allocate payment to another service period. Negative outstanding balances are preserved, and deliberate positive overpayments are possible after explicit review. A negative outstanding value is never prefilled as a new payment. No bulk pay or actual transfer is implied.

## Stock and analytics

Items show exact decimal-string balances, units, reorder thresholds, negative/low-stock flags and history counts. Creation starts from the server's zero balance. There is no balance editor. An item with live movement history keeps its unit; retire it and create another item if the unit changes. Retired live items remain visible but cannot receive new movements.

Purchases add positive quantities. Consumption/waste take positive magnitudes and the server subtracts them. Adjustments accept signed corrections and may produce negative balances. Input quantities have up to nine whole digits and three decimal places; whole units require integral quantities. Validation uses integer thousandths, blocks zero/shortages and checks the EAT movement date. Unit cost follows the database's eight-whole-digit/two-decimal bound. An expense additionally requires a positive rounded cost within the ledger input range. The backend locks the item and makes the final stock/rounding decision.

Only purchases expose unit cost and optional expense creation; switching movement type clears those fields. A purchase expense is created atomically by the server. The receipt displays its returned expense ID, total cost and balance. Movement history shows server running balances and linked ledger amount/ID; the client does not approximate stock cost or send a second finance request.

All six analytics reports use the server's selected-period figures. Ratios are displayed as percentages; unavailable values are labelled. Revenue distinguishes confirmed cash, service delivered and their gap. Package mix includes delivered dish composition. Unit economics labels the low-confidence flag, direct expense breakdown and modelled comparison. Lump purchases and sparse ledger coverage can distort a short window; the app recommends at least a month. These are server estimates, not audited profits. No export/download endpoint or locally fabricated report total is added.

## Archive and restoration

Archive controls are attached to verified live reads: staff/client/order details, dishes/packages, kitchen offerings, daily deliveries, order deliveries/payments, pending payments, requests, finance entries and stock items/movements. They capture the exact target and re-read their source before confirmation. The archive lists all 14 supported kinds with composite kind/ID identity and up to 200 recent records per kind, including staff meals. The API has no live Admin staff-meal list, so that kind can be restored from the bin but cannot be blindly archived by typing an ID in mobile.

Archiving is soft deletion: historical rows/references remain. Existing database rules stop affected active links and unfinished work. The API exposes no dependency-count/impact-preview route; mobile gives a consequence warning without inventing counts. Finance archive removes that record from live totals; movement archive changes the derived stock balance. Their linked records are separate: archiving one is not an automatic refund or archive of the other.

Restoring requires a fresh bin record and live valid parents. It does not restart cancelled work or reactivate disabled staff. **Client restoration also reactivates the linked user account**, which is explicitly disclosed. Related records are restored individually. The server can refuse invalid restoration. There is no permanent-delete, empty-bin or silent cascade-restore action.

## Recovery, compatibility and verification

All writes use the existing Admin review, serialized owner-scoped journal and explicit confirmation. DELETE archives are bodyless; restoration uses bodyless POST. Pending action details are persisted before network writes. Unknown responses, generic conflicts, malformed acknowledgements and receipt-storage failures remain unresolved across restarts. Financial entries, payouts, stock movements and archive/restoration are never automatically retried; resolve them against the records and office before releasing the reminder. Only subscription creation has an existing keyed retry route.

The journal stays version 1 in the same storage namespace, preserving pending Round 6 actions. Confirmed/resolved receipts remove business details but retain the action revision. Composite guard identity prevents a mother and cyclist, or different archive kinds with the same ID, from satisfying each other's review. Reads are refreshed only while observed; stale target/report/stock results block the write. Preflight is not a database compare-and-swap: another admin can change records after the read, and separate admins can deliberately record the same off-platform transaction. The API's transaction rules and office reconciliation remain authoritative.

Both locales include form, report and warning labels. Native interaction/core fixture tests do not mutate production or establish actual device acceptance. Screen-reader, real OS storage, authorized real-account integration and human Amharic editorial review remain in [ACCEPTANCE.md](ACCEPTANCE.md). No Round 7 platform export or native build was run. See [VALIDATION.md](../VALIDATION.md) and [DEPENDENCIES.md](DEPENDENCIES.md).
