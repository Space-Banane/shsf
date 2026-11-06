import { describe, expect, it } from "vitest";
import { parseSsoConfig, mapSsoClaims, ssoDigest } from "../lib/SsoConfig";

const input = {
	SSO_ENABLED: "true", SSO_ISSUER: "https://id.example/realm", SSO_CLIENT_ID: "shsf",
	SSO_CLIENT_SECRET: "client-secret-sentinel", INSTANCE_SECRET: "instance-secret-at-least-32-characters",
	REACT_APP_API_URL: "https://api.example", UI_URL: "https://app.example",
	SSO_GROUP_MAPPING: '{"group-123":"Engineering"}', SSO_ADMIN_ROLES: '["shsf-admin"]',
};
const config = () => {
	const result = parseSsoConfig(input);
	if (!result) throw new Error("Missing test config");
	return result;
};
const claims = () => ({
	sub: "subject-123", email: "person@example.com", email_verified: true, name: "Person",
	groups: ["group-123", "unmapped"], roles: [], auth_time: Math.floor(Date.now() / 1000),
	exp: Math.floor(Date.now() / 1000) + 600,
});

describe("SSO configuration and claim boundary", () => {
	it("leaves local-only instances enabled and ignores unused provider settings", () => {
		expect(parseSsoConfig({ SSO_CLIENT_SECRET: "unused", SSO_ISSUER: "bad" })).toBeNull();
		expect(() => parseSsoConfig({ SSO_LOCAL_LOGIN_ENABLED: "false" })).toThrow("Invalid SSO configuration");
	});
	it.each([
		{ SSO_ENABLED: "yes" }, { SSO_LOCAL_LOGIN_ENABLED: "yes" }, { SSO_SESSION_SECONDS: "3601" },
		{ SSO_TIMEOUT_SECONDS: "0" }, { SSO_ISSUER: "http://id.example" }, { SSO_ISSUER: "https://a:b@id.example" },
		{ SSO_GROUP_MAPPING: "not json" }, { SSO_GROUP_MAPPING: '{"g":""}' }, { SSO_ADMIN_ROLES: '{}' },
		{ INSTANCE_SECRET: "default_insecure_secret_please_set" }, { SSO_SCOPES: "openid offline_access" },
		{ REACT_APP_API_URL: "https://api.example/subpath" }, { UI_URL: "https://ui.example?redirect=evil" },
	])("rejects invalid configuration without reflecting secrets: %j", (patch) => {
		expect(() => parseSsoConfig({ ...input, ...patch })).toThrow(/^Invalid SSO configuration\. Check docs\/sso\.md\.$/);
	});
	it("only allows HTTP loopback when explicitly enabled outside production", () => {
		const local = { ...input, SSO_ISSUER: "http://127.0.0.1:1234", SSO_ALLOW_HTTP_LOOPBACK: "true" };
		expect(parseSsoConfig(local)?.issuer).toBe("http://127.0.0.1:1234");
		expect(() => parseSsoConfig({ ...local, NODE_ENV: "production" })).toThrow();
		expect(() => parseSsoConfig({ ...local, SSO_ISSUER: "http://private.example" })).toThrow();
	});
	it("maps stable ids and verified attributes while keeping role mapping separate", () => {
		const c = config();
		expect(mapSsoClaims(c, claims())).toMatchObject({
			ssoIdentity: ssoDigest([c.issuer, "subject-123"]), email: "person@example.com", displayName: "Person",
			groups: [{ id: "group-123", name: "Engineering" }], role: "User",
		});
		expect(mapSsoClaims(c, { ...claims(), roles: ["shsf-admin"], groups: [] })).toMatchObject({ groups: [], role: "Admin" });
		expect(mapSsoClaims(c, { ...claims(), groups: ["shsf-admin"] })).toMatchObject({ groups: [], role: "User" });
		expect(mapSsoClaims(c, { ...claims(), sub: "SUBJECT-123" }).ssoIdentity).not.toBe(mapSsoClaims(c, claims()).ssoIdentity);
	});
	it.each([{ email_verified: false }, { email_verified: "true" }, { email: "bad" }, { name: "" }, { groups: "group-123" }, { roles: [1] }, { auth_time: undefined }])("rejects malformed claims: %j", (patch) => {
		expect(() => mapSsoClaims(config(), { ...claims(), ...patch })).toThrow();
	});
	it("invalidates the policy on mapping changes without changing the stable provider identity", () => {
		const changed = parseSsoConfig({ ...input, SSO_GROUP_MAPPING: '{}' });
		expect(changed?.provider).toBe(config().provider);
		expect(changed?.policy).not.toBe(config().policy);
	});
	it("anchors expiry to authentication time rather than callback completion", () => {
		const authTime = Math.floor(Date.now() / 1000) - 30;
		expect(mapSsoClaims(config(), { ...claims(), auth_time: authTime }).expiresAt.getTime()).toBe((authTime + 300) * 1000);
	});
});
