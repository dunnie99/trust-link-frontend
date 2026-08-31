# Fix dashboard safety and strengthen API response handling

## Description

This PR addresses four dashboard and API-client issues while preserving existing UI behavior.

- Replaced `VendorDashboardList` non-null assertions with safe optional access and retained its null/loading guard.
- Extracted the shared keyboard focus-trap behavior from `NotificationBell` and `ShipTrackingModal` into `useFocusTrap`.
- Normalized vendor analytics payload variants (`dailyMetrics`, `series`, and `data`) into one `dataPoints` field before consumers receive the response.
- Added runtime type guards for Escrow, Dispute, Tracking, and Subscription responses. The API request helper now optionally validates these critical responses and throws an error that identifies the affected endpoint when a response is malformed or has an unexpected shape.
- Regenerated `package-lock.json` so clean npm installs work again. Use `npm ci --ignore-scripts` in environments where lifecycle scripts must be skipped.

The motivation is to eliminate avoidable client-side runtime failures, reduce duplicate accessibility logic, make analytics consumption stable across API versions, and fail early when the backend returns an incompatible payload.

## Related Issues

- Closes #673
- Closes #674
- Closes #675
- Closes #676

## Validation

- `npm ci --ignore-scripts` succeeds with the updated lockfile.
- `npm test -- types/guards.test.ts lib/api/client.test.ts lib/api.test.ts` passes: 36 tests across 3 files.
- `npm run type-check` is currently blocked by pre-existing syntax errors in `app/api/og/route.tsx` and `lib/stellar/contract.test.ts`, outside this PR's scope.

## Checklist

- [x] I have read the CONTRIBUTING.md guidelines.
- [ ] I have updated the documentation accordingly. No user-facing documentation changes were needed.
- [x] I have added/updated tests for my changes.
- [ ] All CI validations pass. Full type-check remains blocked by pre-existing errors noted above.
