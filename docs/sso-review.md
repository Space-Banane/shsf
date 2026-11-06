# SSO design review

Claim: OIDC can reuse SHSF sessions and groups with bounded reauthentication and no stored provider tokens. If this boundary fails, a provider identity could inherit another user's resources or retain revoked access.

Artifact reviewed: `docs/sso-design.md`, the existing Authentication, Sharing, group-admin, and middleware implementations. Reviewer `sso_security_design` received the artifact and issue contract without the author's reasoning. It was read-only.

| Finding | Classification | Resolution |
| --- | --- | --- |
| CORS middleware logs callback query strings at info level | Valid, breaks contract | Shared `requestLogUrl` removes SSO query strings in CORS and both debug loggers. Real HTTP route tests capture logs with sentinel secrets. |
| Database collation conflates distinct external group IDs | Valid, breaks contract | New migration applies binary collation. Sync also rejects any returned identity that is not an exact match. |
| Unlinking a group leaves invisible SSO memberships | Valid, breaks contract | Group PATCH removes SSO memberships and audits removal in the same transaction as linkage changes. Local memberships and grants remain. |
| ID token signature and max_age validation are not library defaults | Valid, breaks contract | Explicit `enableNonRepudiationChecks` and `maxAge: 0`; real signed-provider tests cover invalid tokens. |
| Concurrent provisioning and stale callbacks can race | Valid, edge case | Serializable transaction, bounded conflict retries, sorted group lock order, expiry anchored to signed auth_time, and rejection of callbacks with an older freshness deadline. |
| Deleting the cookie does not atomically consume it server-side | Valid wording correction | No claim of server-side cookie consumption. Provider codes are one-use; state, nonce and PKCE bind every exchange to the encrypted browser challenge. |
| Updating a user's policy can revive old credentials | Valid, edge case | Policy transitions delete previous sessions and expire existing access tokens before creating the new session. |

The Claude/Grok design presets required by the architecture skill were unavailable in the tool catalog. The primary agent compared the two designs directly; no cross-model design or trail-review result is claimed.

## Implementation audit corrections

A second read-only audit reproduced two ordering failures with real signed tokens and MariaDB. Comparing expiry dates rejected a fresh login when policy shortened the lifetime, and allowed an older callback to restore Admin when token timestamps matched. That earlier resolution was insufficient. A second generated migration adds `User.ssoLoginStartedAt`; provisioning now rejects attempts whose encrypted challenge start time is equal to or older than the last accepted attempt. Expiry still comes from the signed authentication time. Regression tests exercise both failures, plus concurrent callbacks.

The same audit found that auth enforcement blocked the SPA and assets when a browser retained an invalid cookie. Public GET/HEAD UI requests now load while protected API and execution requests still reject invalid credentials. An HTTP test follows the failed callback to the login page with the invalid cookie and checks asset loading and execution rejection.


The final audit identified an ordering limit: two overlapping attempts can authenticate in a different order from their start times. Start ordering rejects an older attempt after a newer one succeeds, but cannot establish a total order of provider claim snapshots. This is accepted under the documented bounded refresh policy: a previously issued snapshot can apply only within its original authentication-time deadline. The lifecycle documentation does not promise immediate global revocation or that a successful sync permanently cancels every overlapping response.


## Final audit result

The fresh-context `sso_final_audit` reviewer independently read the shipped implementations, both migrations, tests, and final docs, and ran the focused database-backed suite: 63 tests passed. Its remaining blocking finding was that an expired SSO cookie prevented local password recovery before the public login handler. The primary agent exempted the existing local login/register routes from invalid-token rejection, made their already-signed-in checks inspect resolved authentication, and reused the existing session cookie domain across both login methods. This prevents two differently scoped session cookies from masking a successful recovery login. The real HTTP/database test now sends an expired SSO cookie through local password login and confirms success; protected execution still rejects it. Focused auth/recovery tests and the backend build passed after this correction.

Decision: the reported blockers are fixed. The bounded overlapping-response limitation remains documented. The full backend/UI suites, lint, builds, migration checks, and agent-doc checks are run by the primary agent before commit; external PR review and CI remain merge gates.
