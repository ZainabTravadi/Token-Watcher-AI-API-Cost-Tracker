import assert from "node:assert/strict";
import {
  DEFAULT_PERMISSIONS_BY_KEY_TYPE,
  hasApiKeyPermission,
  normalizeApiKeyPermissions,
  type ApiKeyIdentity,
  type ApiKeyPermission,
  type ApiKeyType
} from "../services/authService";

function identity(type: ApiKeyType, permissions: ApiKeyPermission[]): Pick<ApiKeyIdentity, "permissions"> {
  return { permissions: normalizeApiKeyPermissions(type, permissions) };
}

function assertAllows(type: ApiKeyType, permission: ApiKeyPermission): void {
  assert.equal(
    hasApiKeyPermission(identity(type, DEFAULT_PERMISSIONS_BY_KEY_TYPE[type]), permission),
    true,
    `${type} should allow ${permission}`
  );
}

function assertDenies(type: ApiKeyType, permissions: ApiKeyPermission[], permission: ApiKeyPermission): void {
  assert.equal(
    hasApiKeyPermission(identity(type, permissions), permission),
    false,
    `${type} should deny ${permission}`
  );
}

assert.deepEqual(normalizeApiKeyPermissions("SDK", undefined), ["telemetry:ingest"]);
assert.deepEqual(normalizeApiKeyPermissions("SDK", ["telemetry:ingest", "analytics:read"]), ["telemetry:ingest"]);
assertDenies("SDK", DEFAULT_PERMISSIONS_BY_KEY_TYPE.SDK, "analytics:read");
assertDenies("SDK", DEFAULT_PERMISSIONS_BY_KEY_TYPE.SDK, "reports:read");
assertDenies("SDK", DEFAULT_PERMISSIONS_BY_KEY_TYPE.SDK, "forecast:read");
assertDenies("SDK", DEFAULT_PERMISSIONS_BY_KEY_TYPE.SDK, "copilot:use");
assertDenies("SDK", DEFAULT_PERMISSIONS_BY_KEY_TYPE.SDK, "workspace:read");

assert.deepEqual(normalizeApiKeyPermissions("OPENCLAW", ["telemetry:ingest", "workspace:read"]), ["workspace:read"]);
assertDenies("OPENCLAW", DEFAULT_PERMISSIONS_BY_KEY_TYPE.OPENCLAW, "telemetry:ingest");
assertAllows("OPENCLAW", "copilot:use");

assertDenies("READONLY", DEFAULT_PERMISSIONS_BY_KEY_TYPE.READONLY, "telemetry:ingest");
assertDenies("READONLY", DEFAULT_PERMISSIONS_BY_KEY_TYPE.READONLY, "copilot:use");
assertAllows("READONLY", "analytics:read");

assertAllows("ADMIN", "telemetry:ingest");
assertAllows("ADMIN", "copilot:use");
assert.equal(hasApiKeyPermission({ permissions: ["admin:all"] }, "workspace:read"), true);

assert.deepEqual(normalizeApiKeyPermissions("SDK", ["admin:all"]), []);
assert.deepEqual(normalizeApiKeyPermissions("OPENCLAW", ["telemetry:ingest"]), []);
assert.deepEqual(normalizeApiKeyPermissions("READONLY", ["telemetry:ingest"]), []);

console.log("API key permission matrix passed");
