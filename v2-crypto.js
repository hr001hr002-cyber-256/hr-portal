(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.HrV2Crypto = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_VERSION = "2.0";
  const MIN_ITERATIONS = 250000;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  class V2CryptoError extends Error {
    constructor(code, publicMessage) {
      super(publicMessage);
      this.name = "V2CryptoError";
      this.code = code;
      this.publicMessage = publicMessage;
    }
  }

  function fail(code, message) {
    throw new V2CryptoError(code, message);
  }

  function cryptoApi() {
    if (!globalThis.crypto?.subtle) fail("WEB_CRYPTO_UNAVAILABLE", "此瀏覽器不支援必要的安全功能。");
    return globalThis.crypto;
  }

  function base64ToBytes(value) {
    if (typeof value !== "string" || !value) fail("INVALID_BASE64", "加密資料格式不正確。");
    try {
      if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(value, "base64"));
      return Uint8Array.from(atob(value), character => character.charCodeAt(0));
    } catch {
      fail("INVALID_BASE64", "加密資料格式不正確。");
    }
  }

  function bytesToBase64Url(bytes) {
    let base64;
    if (typeof Buffer !== "undefined") base64 = Buffer.from(bytes).toString("base64");
    else {
      let binary = "";
      for (const value of bytes) binary += String.fromCharCode(value);
      base64 = btoa(binary);
    }
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function assertObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) fail("INVALID_SCHEMA", "加密資料結構不正確。");
  }

  function assertString(value) {
    if (typeof value !== "string" || !value.trim()) fail("INVALID_SCHEMA", "加密資料欄位不正確。");
  }

  function validateToolId(value) {
    assertString(value);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) fail("INVALID_TOOL_ID", "工具識別碼格式不正確。");
  }

  async function derivePasswordKey(secret, vault) {
    assertString(secret);
    const material = await cryptoApi().subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveKey"]);
    return cryptoApi().subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", iterations: vault.kdf.iterations, salt: base64ToBytes(vault.kdf.salt) },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
  }

  async function digest(bytes) {
    return new Uint8Array(await cryptoApi().subtle.digest("SHA-256", bytes));
  }

  function validateVaultEnvelope(vault) {
    assertObject(vault);
    if (vault.schemaVersion !== SCHEMA_VERSION) fail("UNSUPPORTED_SCHEMA", "HR Vault 版本不支援。");
    if (vault.roleId !== "hr") fail("INVALID_ROLE", "HR Vault 角色不正確。");
    if (!Number.isInteger(vault.vaultVersion) || vault.vaultVersion < 1) fail("INVALID_SCHEMA", "HR Vault 版本資料不正確。");
    assertString(vault.keySetVersion);
    if (!Array.isArray(vault.allowedToolIds) || vault.allowedToolIds.length === 0) fail("INVALID_SCHEMA", "HR Vault 工具授權清單不正確。");
    vault.allowedToolIds.forEach(validateToolId);
    assertObject(vault.kdf);
    if (vault.kdf.algorithm !== "PBKDF2" || vault.kdf.hash !== "SHA-256" || !Number.isInteger(vault.kdf.iterations) || vault.kdf.iterations < MIN_ITERATIONS) {
      fail("UNSUPPORTED_KDF", "HR Vault 密碼驗證規格不支援。");
    }
    if (base64ToBytes(vault.kdf.salt).length !== 16) fail("INVALID_SCHEMA", "HR Vault salt 長度不正確。");
    assertObject(vault.cipher);
    if (vault.cipher.algorithm !== "AES-GCM" || base64ToBytes(vault.cipher.iv).length !== 12) fail("UNSUPPORTED_CIPHER", "HR Vault 加密規格不支援。");
    assertString(vault.cipher.ciphertext);
  }

  async function unlockRoleVault(vault, secret) {
    validateVaultEnvelope(vault);
    try {
      const key = await derivePasswordKey(secret, vault);
      const plaintext = await cryptoApi().subtle.decrypt(
        { name: "AES-GCM", iv: base64ToBytes(vault.cipher.iv) },
        key,
        base64ToBytes(vault.cipher.ciphertext)
      );
      const bundle = JSON.parse(decoder.decode(plaintext));
      if (bundle.schemaVersion !== vault.schemaVersion || bundle.keySetVersion !== vault.keySetVersion || !Array.isArray(bundle.keys)) {
        fail("VAULT_METADATA_MISMATCH", "HR Vault 內外版本不一致。");
      }
      const toolKeys = [];
      for (const record of bundle.keys) {
        assertObject(record);
        validateToolId(record.toolId);
        assertString(record.keyId);
        if (record.algorithm !== "AES-GCM") fail("INVALID_TOOL_KEY", "Tool Key 加密規格不支援。");
        const raw = base64ToBytes(record.keyMaterial);
        if (raw.length !== 32) fail("INVALID_TOOL_KEY", "Tool Key 長度不正確。");
        const hash = await digest(raw);
        if (`tk_${bytesToBase64Url(hash.slice(0, 16))}` !== record.keyId) fail("KEY_ID_MISMATCH", "Tool Key 識別碼驗證失敗。");
        toolKeys.push({ toolId: record.toolId, keyId: record.keyId, algorithm: record.algorithm, raw });
      }
      const actualIds = toolKeys.map(item => item.toolId).sort();
      const allowedIds = [...vault.allowedToolIds].sort();
      if (JSON.stringify(actualIds) !== JSON.stringify(allowedIds)) fail("VAULT_PERMISSION_MISMATCH", "HR Vault 工具授權不一致。");
      return { roleId: vault.roleId, keySetVersion: vault.keySetVersion, toolKeys };
    } catch (error) {
      if (error instanceof V2CryptoError && error.code !== "DECRYPT_FAILED") throw error;
      fail("VAULT_UNLOCK_FAILED", "HR 密碼不正確，無法進入功能區。");
    }
  }

  function findToolKey(unlockedVault, toolId) {
    validateToolId(toolId);
    const found = unlockedVault?.toolKeys?.find(item => item.toolId === toolId);
    if (!found) fail("TOOL_NOT_ALLOWED", "此 HR Vault 未授權指定工具。");
    return found;
  }

  function validateToolPayload(payload) {
    assertObject(payload);
    if (payload.schemaVersion !== SCHEMA_VERSION) fail("UNSUPPORTED_SCHEMA", "工具 payload 版本不支援。");
    validateToolId(payload.toolId);
    assertString(payload.keyId);
    if (payload.algorithm !== "AES-GCM" || base64ToBytes(payload.iv).length !== 12) fail("UNSUPPORTED_CIPHER", "工具 payload 加密規格不支援。");
    assertString(payload.ciphertext);
  }

  async function decryptToolPayload(toolKey, payload) {
    validateToolPayload(payload);
    if (toolKey.toolId !== payload.toolId || toolKey.keyId !== payload.keyId || toolKey.algorithm !== "AES-GCM") {
      fail("PAYLOAD_KEY_MISMATCH", "工具 payload 與 Tool Key 不相符。");
    }
    try {
      const key = await cryptoApi().subtle.importKey("raw", toolKey.raw, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
      const plaintext = await cryptoApi().subtle.decrypt(
        { name: "AES-GCM", iv: base64ToBytes(payload.iv) },
        key,
        base64ToBytes(payload.ciphertext)
      );
      return decoder.decode(plaintext);
    } catch {
      fail("PAYLOAD_DECRYPT_FAILED", "工具內容解密失敗。");
    }
  }

  return Object.freeze({
    V2CryptoError,
    base64ToBytes,
    validateVaultEnvelope,
    unlockRoleVault,
    findToolKey,
    validateToolPayload,
    decryptToolPayload
  });
});
