(() => {
  "use strict";

  const TOOL_ID = "appointment-letter";
  const SESSION_KEY = "soberHrV2Session:appointment-letter:v1";
  const SESSION_SCHEMA = "2.0-session";
  const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
  const V2 = window.HrV2Crypto;
  const vault = window.HR_KEY_VAULT;
  const manifest = window.HR_V2_MANIFEST;
  const payload = window.APPOINTMENT_LETTER_V2_PAYLOAD;
  const form = document.getElementById("authForm");
  const password = document.getElementById("accessPassword");
  const error = document.getElementById("authError");
  const button = document.getElementById("authButton");
  let submitting = false;

  function bytesToBase64(bytes) {
    let binary = "";
    for (const value of bytes) binary += String.fromCharCode(value);
    return btoa(binary);
  }

  function base64ToBytes(value) {
    return Uint8Array.from(atob(value), character => character.charCodeAt(0));
  }

  function installPasswordToggle() {
    const field = document.createElement("span");
    field.className = "auth-password-field";
    password.parentNode.insertBefore(field, password);
    field.append(password);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "auth-password-toggle";
    toggle.textContent = "顯示";
    toggle.setAttribute("aria-controls", password.id);
    toggle.setAttribute("aria-pressed", "false");
    toggle.setAttribute("aria-label", "顯示密碼");
    toggle.addEventListener("click", () => {
      const show = password.type === "password";
      password.type = show ? "text" : "password";
      toggle.textContent = show ? "隱藏" : "顯示";
      toggle.setAttribute("aria-pressed", String(show));
      toggle.setAttribute("aria-label", show ? "隱藏密碼" : "顯示密碼");
      password.focus({ preventScroll: true });
    });
    field.append(toggle);
  }

  function manifestTool() {
    if (!V2 || !vault || !manifest || !payload) throw new Error("V2_ASSET_MISSING");
    if (manifest.schemaVersion !== "2.0" || manifest.keySetVersion !== vault.keySetVersion || !Array.isArray(manifest.tools)) {
      throw new Error("V2_MANIFEST_MISMATCH");
    }
    const record = manifest.tools.find(item => item?.toolId === TOOL_ID);
    if (!record?.keyId || payload.toolId !== TOOL_ID || payload.keyId !== record.keyId) {
      throw new Error("V2_TOOL_MISMATCH");
    }
    return record;
  }

  function setBusy(busy, text = "驗證中…") {
    submitting = busy;
    button.disabled = busy;
    password.disabled = busy;
    button.textContent = busy ? text : "進入功能區";
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function saveToolSession(toolKey) {
    const now = Date.now();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      schemaVersion: SESSION_SCHEMA,
      toolId: TOOL_ID,
      keyId: toolKey.keyId,
      keySetVersion: vault.keySetVersion,
      algorithm: "AES-GCM",
      keyMaterial: bytesToBase64(toolKey.raw),
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS
    }));
  }

  function restoreToolSession() {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    try {
      const record = manifestTool();
      const session = JSON.parse(stored);
      if (session.schemaVersion !== SESSION_SCHEMA || session.toolId !== TOOL_ID || session.keyId !== record.keyId ||
          session.keySetVersion !== manifest.keySetVersion || session.algorithm !== "AES-GCM" ||
          !Number.isFinite(session.expiresAt) || Date.now() >= session.expiresAt) {
        throw new Error("INVALID_V2_SESSION");
      }
      const raw = base64ToBytes(session.keyMaterial);
      if (raw.length !== 32) throw new Error("INVALID_V2_SESSION_KEY");
      return { toolId: TOOL_ID, keyId: session.keyId, algorithm: "AES-GCM", raw };
    } catch {
      clearSession();
      return null;
    }
  }

  async function openTool(toolKey, saveSession) {
    const html = await V2.decryptToolPayload(toolKey, payload);
    if (!/^<!doctype html>/i.test(html.trim())) throw new Error("INVALID_TOOL_HTML");
    if (saveSession) saveToolSession(toolKey);
    document.open();
    document.write(html);
    document.close();
  }

  async function restoreSession() {
    const toolKey = restoreToolSession();
    if (!toolKey) return;
    setBusy(true, "恢復登入中…");
    try {
      await openTool(toolKey, false);
    } catch {
      toolKey.raw.fill(0);
      clearSession();
      setBusy(false);
      error.textContent = "登入狀態已失效，請重新輸入密碼。";
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (submitting) return;
    error.textContent = "";
    setBusy(true);
    const secret = password.value;
    password.value = "";
    try {
      const record = manifestTool();
      const unlocked = await V2.unlockRoleVault(vault, secret);
      if (unlocked.roleId !== "hr" || unlocked.keySetVersion !== manifest.keySetVersion) throw new Error("INVALID_HR_VAULT");
      const toolKey = V2.findToolKey(unlocked, TOOL_ID);
      if (toolKey.keyId !== record.keyId) throw new Error("V2_TOOL_MISMATCH");
      await openTool(toolKey, true);
    } catch {
      error.textContent = "密碼不正確，請重新輸入。";
      setBusy(false);
      password.focus({ preventScroll: true });
    }
  });

  installPasswordToggle();
  try {
    manifestTool();
    if (document.readyState === "loading") {
      window.addEventListener("DOMContentLoaded", restoreSession, { once: true });
    } else {
      restoreSession();
    }
  } catch {
    error.textContent = "登入元件載入失敗，請重新整理後再試。";
    button.disabled = true;
  }
})();
