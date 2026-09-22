(() => {
  "use strict";
  const storageKey = "soberHrSessionSecret";
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const form = document.getElementById("authForm");
  const password = document.getElementById("accessPassword");
  const error = document.getElementById("authError");
  const button = document.getElementById("authButton");

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
      const showPassword = password.type === "password";
      password.type = showPassword ? "text" : "password";
      toggle.textContent = showPassword ? "隱藏" : "顯示";
      toggle.setAttribute("aria-pressed", String(showPassword));
      toggle.setAttribute("aria-label", showPassword ? "隱藏密碼" : "顯示密碼");
      password.focus({ preventScroll: true });
    });
    field.append(toggle);
  }

  function bytes(base64) {
    return Uint8Array.from(atob(base64), char => char.charCodeAt(0));
  }

  async function deriveKey(secret) {
    const material = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: bytes(window.SECURE_PAGE.salt), iterations: 250000, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      true,
      ["decrypt"]
    );
  }

  async function decrypt(key) {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes(window.SECURE_PAGE.iv) },
      key,
      bytes(window.SECURE_PAGE.ciphertext)
    );
    return decoder.decode(plaintext);
  }

  async function openWithKey(key, sessionSecret) {
    const html = await decrypt(key);
    if (sessionSecret) sessionStorage.setItem(storageKey, sessionSecret);
    document.open();
    document.write(html);
    document.close();
  }

  async function restoreSession() {
    const sessionSecret = sessionStorage.getItem(storageKey);
    if (!sessionSecret) return;
    try {
      await openWithKey(await deriveKey(sessionSecret));
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    error.textContent = "";
    button.disabled = true;
    button.textContent = "驗證中…";
    try {
      await openWithKey(await deriveKey(password.value), password.value);
    } catch {
      error.textContent = "密碼不正確，請重新輸入。";
      password.select();
      button.disabled = false;
      button.textContent = "進入功能區";
    }
  });

  installPasswordToggle();
  restoreSession();
})();
