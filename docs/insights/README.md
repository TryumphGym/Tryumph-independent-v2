# Tryumph Insights — future revenue stream (inactive)

This is **planning and aggregate reporting groundwork**, not an active collector, tracking service, or authorized data product.

- Scope: broad, privacy-reviewed reports on active users, live vs. on-demand attendance, and demand by HIIT/strength/core category. Differentiate unique participants from class sessions and views. Live and on-demand users may overlap.
- Protect members: never sell member-level records, pseudonymous identifiers, health conditions, personal goals, postpartum status, messages, device data or precise locations.
- Only collect minimal events after reviewing required disclosures, permissions, applicable health-data laws, retention, deletion, suppression, and opt-out handling with privacy counsel.
- Aggregation: the helper in `src/lib/insights/aggregate.ts` refuses groups below 50 and inconsistent partitions. This alone does not constitute legal de-identification. Review query differencing, repeated disclosures, outliers and overlapping cohort attacks before external release.
- Keep sensitive analytics access server-side and tightly authorized. No direct public reporting endpoint or automated exports.
- Feature flag: `futureFeatures.commercialFitnessInsights` is **false**. No tracking or data sales are enabled by this feature.
- The January member launch does not depend on data sales.

## Other planned commercial streams
- **Tryumph Store**: Tryumph-branded equipment, apparel and accessories. Tryumph retains store net profit after supplier, fulfillment, processing and related costs.
- **Trainer Trybe Stores**: Tryumph-sourced and supplier-fulfilled merchandise shares net profit 50/50 with trainers after directly attributable costs, including shipping, processing, refunds and returns, under agreed loss-sharing terms.
- Trainers keep 100% of independent affiliate and externally linked store proceeds; Tryumph takes no share.
- Both merchandise streams are disabled as future capabilities by `futureFeatures.tryumphStore` and `futureFeatures.trainerSourcedMerchandise`. Implement storefront checkout, catalog, commissions, payout settlement and supplier integrations only after separate engineering and operational reviews.
- No homepage promotion for these future features until they are launch-ready.
