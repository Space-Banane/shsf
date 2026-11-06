# Configure OIDC sign-in

SHSF supports one optional OpenID Connect provider using authorization code flow with PKCE. SSO creates normal SHSF users and sessions. It uses the same groups and resource grants as local accounts. Local sign-in remains enabled by default. Local and SSO logins replace the same session cookie, including when a browser retains an expired SSO session. SAML, LDAP, automatic email linking, and refresh tokens are not supported.

## Set up your provider

1. Create a confidential OIDC client with authorization code flow and S256 PKCE. Enable `client_secret_post` authentication. Use signed RS256 ID tokens and publish the signing keys through the discovery document's `jwks_uri`.
2. Register the exact redirect URI `https://shsf.example.com/api/account/sso/callback`. If the API uses a different hostname, use that hostname. SHSF derives this URI from `REACT_APP_API_URL`; request headers cannot override it.
3. Configure the provider to include `sub`, verified `email`, `email_verified: true`, `name`, and `auth_time` in the ID token. Include group and role claims as arrays of immutable string identifiers. Claims must be top-level fields. A display name alone is not a stable group identifier.
4. Add these settings to the backend environment. Compose already reads `.env` through `env_file`.

```dotenv
SSO_ENABLED=true
SSO_NAME=Company sign-in
SSO_ISSUER=https://identity.example.com/realms/company
SSO_CLIENT_ID=shsf
SSO_CLIENT_SECRET=replace-with-your-client-secret
SSO_SCOPES=openid email profile groups roles
SSO_GROUP_MAPPING={"a1b2c3-group-id":"Engineering","d4e5f6-group-id":"Operations"}
SSO_ADMIN_ROLES=["shsf-administrators-role-id"]
SSO_SESSION_SECONDS=300
```

5. Set `REACT_APP_API_URL` and `UI_URL` to their public HTTPS origins, without a subpath, query, or fragment. Set a unique `INSTANCE_SECRET` of at least 32 characters. Generate one with `openssl rand -hex 32`.
6. Apply the deployment's pending migrations with `pnpm migrate:deploy` and restart SHSF. The login page now offers **Sign in with Company sign-in**. Keep a separate local administrator account for recovery.
7. Sign in with a provider test account. In **Admin → Groups**, confirm its mapped groups and memberships. Grant a group access using a resource's sharing controls.

Provider credentials stay at the provider. SHSF requires a verified email and never links a provider subject to a local account by matching its email. If that email already belongs to another user, sign-in fails without changing either account. Resolve the collision through your administrator. There is no automatic account takeover or merge flow.

## Link a provider group to an existing SHSF group

Use the group's immutable provider identifier as `SSO group id`. The `SSO provider` field is `oidc:` followed by the SHA-256 hex digest of the JSON-encoded issuer string. Calculate it with the exact issuer configured above:

```sh
node -e 'const c = require("node:crypto"); process.stdout.write("oidc:" + c.createHash("sha256").update(JSON.stringify(process.argv[1])).digest("hex") + "\n")' 'https://identity.example.com/realms/company'
```

Add that external group ID to `SSO_GROUP_MAPPING`. On the next login, SHSF resolves the mapping to the existing local group ID. Group names are labels; changing a label does not change the identity or move a grant. A new mapped identity creates a group when necessary. A name collision creates a separate group with a hash suffix.

Removing an entry from the mapping never deletes its group or grants. Unlinking or changing a group's provider identity removes its SSO memberships in the same transaction. Local memberships remain. Adding a member manually pins that membership as local, so later SSO synchronization does not remove it.

## Refresh and account removal

Every SSO sign-in requires fresh provider authentication, updates mapped user attributes and roles, and replaces the user's SSO memberships for this provider. Missing group claims are treated as an empty list. Unmapped groups grant nothing.

SSO sessions last five minutes by default. `SSO_SESSION_SECONDS` accepts 60–3600 seconds. Expiry is measured from the provider's validated `auth_time` and is capped by the ID token expiry. A delayed callback cannot extend that window. SHSF rejects callbacks from login attempts started before an already accepted attempt. Attempts with the same millisecond start time are also rejected after one succeeds; retry sign-in in that case. The user signs in again after expiry. SHSF stores neither access nor refresh tokens from the provider.

Each successful sign-in synchronizes group membership and roles. If sign-ins overlap, an authorization response issued before a provider change can still apply within its original freshness window. The provider does not supply a total order for claim snapshots. All access to an older snapshot stops within `SSO_SESSION_SECONDS` of its authentication time. A disabled or deleted provider account cannot sign in if the provider rejects its authorization and token requests. Existing SHSF sessions expire within the configured window. Configure the provider to reject grants for disabled accounts and honor fresh authentication. There is no provider polling or back-channel logout.

Access tokens belonging to an SSO user also require a current SSO login. They cannot outlive the user's latest identity freshness window, even when their own expiry is later. A subsequent login can renew that user-level window, but each browser session retains its original expiry. For unattended automation, use a separately managed local account. Local access tokens, guest access, and local sessions retain their existing behavior.

Changing the issuer, client ID, claim mappings, group mappings, admin roles, or session lifetime invalidates access while the stored policy differs from configuration. The next successful login under a changed policy deletes older browser sessions and expires existing access tokens. Disabling SSO immediately blocks SSO identities, including their access tokens. No user data, functions, groups, or grants are deleted.

`SSO_ADMIN_ROLES` is independent of group membership. A match in the configured roles claim assigns `Admin`; no match assigns `User`, including the first SSO user. A group membership never promotes a user. When the roles claim is absent, the user becomes `User` on sign-in. Provider role mapping owns SSO user roles; local admin edits are replaced on the next login.

## Configuration reference

| Setting | Default | Meaning |
| --- | --- | --- |
| `SSO_ENABLED` | `false` | Enable the provider. Invalid enabled configuration stops startup. |
| `SSO_LOCAL_LOGIN_ENABLED` | `true` | Allow local login and registration. Setting this to `false` requires enabled SSO. Existing local sessions and access tokens remain valid. |
| `SSO_NAME` | `SSO` | Provider label on the login page. |
| `SSO_ISSUER` | Required when enabled | Exact HTTPS issuer used for OIDC discovery and token validation. |
| `SSO_CLIENT_ID` | Required when enabled | Confidential client identifier. |
| `SSO_CLIENT_SECRET` | Required when enabled | Client secret; keep it in the instance's secret environment. |
| `SSO_SCOPES` | `openid email profile` | Space-separated scopes. `openid` is always included; `offline_access` is rejected. |
| `SSO_EMAIL_CLAIM` | `email` | Verified email attribute. |
| `SSO_EMAIL_VERIFIED_CLAIM` | `email_verified` | Must contain boolean `true`. |
| `SSO_NAME_CLAIM` | `name` | Display name, up to 128 characters. |
| `SSO_GROUPS_CLAIM` | `groups` | Array of stable external group IDs. |
| `SSO_ROLES_CLAIM` | `roles` | Array of provider role IDs, separate from membership. |
| `SSO_GROUP_MAPPING` | `{}` | JSON object mapping external group IDs to local display labels. |
| `SSO_ADMIN_ROLES` | `[]` | JSON array of role IDs allowed to assign `Admin`. |
| `SSO_SESSION_SECONDS` | `300` | Maximum identity freshness, 60–3600 seconds. |
| `SSO_TIMEOUT_SECONDS` | `5` | Per-request provider timeout, 1–30 seconds. |
| `SSO_ALLOW_HTTP_LOOPBACK` | `false` | Permit HTTP on localhost, 127.0.0.1, or ::1 outside production for development tests only. |
| `NODE_EXTRA_CA_CERTS` | Node trust store | Path to additional trusted CA certificates. Mount the file into the backend when using containers. Certificate verification remains enabled. |

## Troubleshooting and recovery

All provider, claim, and provisioning failures show the same sign-in error. SHSF logs a generic SSO failure without tokens, callback query strings, raw claims, or provider responses. Check provider audit logs for credential failures or disabled users. Do not paste tokens or client secrets into issues.

For configuration failures, compare the exact issuer and callback URL with the client registration. Check outbound HTTPS connectivity to discovery, token, and JWKS endpoints. HTTP redirects from these endpoints are rejected. Check trusted CAs and provider timeout settings. Confirm that the required claims appear in the signed ID token rather than only in UserInfo. Custom claim names select top-level fields, not dotted paths.

If the provider is unavailable, set `SSO_LOCAL_LOGIN_ENABLED=true`, restart, and sign in with the separate local recovery account. An SSO-created account has no local password and cannot use local login, even if a password is later assigned by an administrator.

Use HTTPS and a reverse proxy that omits query strings for `/api/account/sso/*` from its access logs. SHSF's log redaction cannot change proxy or identity-provider logs. Keep the API and UI on the same site so the session cookie's SameSite policy works; separate subdomains are supported. Protect `INSTANCE_SECRET`, which encrypts the short-lived login challenge cookie.

## Run verification

The normal backend suite runs configuration, claim, HTTP route, cookie, log-redaction, and OIDC protocol checks. Database checks additionally need a disposable migrated MariaDB database:

```sh
cd Backend
DATABASE_URL=mysql://root:password@127.0.0.1:3306/shsf_test pnpm migrate:deploy
SSO_TEST_DATABASE_URL=mysql://root:password@127.0.0.1:3306/shsf_test pnpm test
```

The tests use a local HTTP provider that signs ID tokens and enforces one-use codes and PKCE. No live provider account is required.
