# Development roadmap

Four separate apps share one API, design system and translation layer. Android is the first delivery target; source remains compatible with iOS. The web admin stays available while native workflows are introduced.

| Round | Scope                                                                                                                  | Acceptance                                                                               |
| ----- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1     | Repository, app identities, shared UI, bilingual foundation, navigation, public connection check, build tooling and CI | Four buildable preview shells; validated routes, locale persistence and failure handling |
| 2     | Password/Telegram authentication, signup, secure token storage, session renewal/revocation and account security        | Real role-matched accounts sign in, restart, renew and sign out correctly                |
| 3     | Client profile/address, nearby offerings, dish choices, ordering, payment instructions and order history               | Real order creation with persistent idempotency keys and no duplicate retry orders       |
| 4     | Mother queue, dish totals, packaging/deadlines, staff meals and support requests                                       | Kitchen completes its own assigned work                                                  |
| 5     | Cyclist run, sticker lookup, collection, calling/navigation, confirmation, earnings and staff meals                    | Assigned delivery progresses safely through completion                                   |
| 6     | Admin daily board, people, catalog, assignments, subscriptions, payments, support and staff credentials                | Admin coordinates the other apps through the shared API                                  |
| 7     | Admin finance, payouts, stock, analytics, archive and restoration                                                      | Correct backend-derived reports and preserved history                                    |
| 8     | Full cross-app verification, poor connections, accessibility, release signing/versioning and acceptance                | Reproducible release builds and verified device workflows                                |

Round 1 deliberately has no login form, fake dashboard totals, sample customer records, authenticated requests or simulated successful business actions. Workspace links open honest overview screens. The only server request is the explicit, cancellable public health check. Navigation, language persistence and connection feedback work now.

Payments remain off-platform. Pending-payment deliveries stay operational. Deleted records retain history while active dependent work stops. Restoration never silently restarts cancelled work. Those rules belong in the backend, not duplicated in native screens.

Native push notifications and a background mutation outbox are separate enhancements; the first usable apps will provide safe reads, local drafts and explicit retry behavior.
