// ─────────────────────────────────────────────────────────────
//  auth.js — CircleNet Auth, Theme & Session module
//  Covers: api(), theme toggle, registration, email verification,
//          login, phone/OTP login & register, OTP input helpers,
//          logout, setCurrentUser (session bootstrap),
//          password reset
//
//  Depends on globals: API, currentUser, showAlert(), showToast(),
//              goTo(), PostCache, Feed, _trendingLoaded,
//              _trendingWords, _activeFilter, _suggestionsLoaded,
//              _feedSugDismissed, _feedSugUsers, _newMembersLoaded,
//              _feedNewDismissed, _feedNewIndex, _newMembers,
//              loadSuggestions(), stopNotifPolling(),
//              startNotifPolling(), updateNotifBadge(), E2E,
//              CircleWS, Live, stringToColor(), resolveMediaUrl(),
//              defaultAvatar()
// ─────────────────────────────────────────────────────────────

/*  API  */
async function api(method, path, body = null, signal = undefined) {
  const opts = { method, headers: {} };
  // Send X-User-Id for all existing backend routes that still rely on it
  if (currentUser) opts.headers["X-User-Id"] = currentUser.id;
  // Also send JWT Bearer token for routes that have been upgraded to use it
  const token = localStorage.getItem("circle_token");
  if (token) opts.headers["Authorization"] = `Bearer ${token}`;
  if (body instanceof FormData) {
    // Let the browser set Content-Type with the correct multipart boundary
    opts.body = body;
  } else if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  if (signal) opts.signal = signal;
  const res = await fetch(API + path, opts);
  let data;
  try {
    data = await res.json();
  } catch (_) {
    data = {};
  }
  if (res.status === 401) {
    // Token expired or invalid — clear session and redirect to login
    localStorage.removeItem("circle_token");
    localStorage.removeItem("circle_user");
    PostCache.clear();
    Feed.reset();
    // Redirect without calling logout() to avoid re-entering api()
    setTimeout(() => goTo("login"), 0);
    throw new Error("Session expired. Please log in again.");
  }
  if (!res.ok) { const err = new Error(data.message || "Something went wrong."); if (data.unverified) err.unverified = true; throw err; }
  return data;
}

/*  THEME */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("circle_theme", theme);
  const isLight = theme === "light";
  const cb = document.getElementById("theme-toggle");
  if (cb) cb.checked = isLight;
  const icon = document.getElementById("theme-icon-top");
  if (icon)
    icon.innerHTML = isLight
      ? '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>'
      : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
}
function toggleTheme() {
  applyTheme(
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "light"
      : "dark",
  );
}

/*AUTH  */
// Stores the newly registered user data while waiting for email verification
let _pendingVerifyUser  = null;
let _pendingVerifyEmail = null;

async function registerUser() {
  const name      = document.getElementById("reg-name").value.trim();
  const email     = document.getElementById("reg-email").value.trim();
  const password  = document.getElementById("reg-password").value;
  const dialCode  = document.getElementById("reg-dial-code").value;
  const phoneRaw  = document.getElementById("reg-phone").value.trim();
  const phone     = phoneRaw ? dialCode + phoneRaw.replace(/\D/g, "") : undefined;
  const el        = document.getElementById("register-alert");
  el.className = "alert";
  const confirmPassword = document.getElementById("reg-confirm-password")?.value;
  if (!name || !email || !password)
    return showAlert(el, "All fields are required.", "error");
  if (name.trim().length < 2)
    return showAlert(el, "Name must be at least 2 characters.", "error");
  const _emailInput = document.getElementById("reg-email");
  if (!_emailInput.checkValidity())
    return showAlert(el, "Please enter a valid email address.", "error");
  if (password.length < 6)
    return showAlert(el, "Password must be at least 6 characters.", "error");
  if (confirmPassword !== undefined && password !== confirmPassword)
    return showAlert(el, "Passwords do not match.", "error");
  const btn = document.getElementById("reg-email-submit-btn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
  }
  try {
    const res = await api("POST", "/api/users/register", {
      name,
      email,
      password,
      phone: phone || undefined,
    });
    // Account created — now send a verification email and show the OTP step
    _pendingVerifyUser = res.data;
    // Ask the backend to send a verification code to the email
    try {
      await api("POST", "/api/users/email/send-verification", { email });
    } catch (_) {
      // Non-fatal: backend might send automatically on register
    }
    // Show the verify step
    document.getElementById("reg-email-step1").classList.remove("active");
    document.getElementById("reg-email-step2").classList.add("active");
    document.getElementById("reg-email-display").textContent = email;
    _clearOtpDigits("email-verify");
    el.className = "alert";
    _startEmailVerifyTimer();
    setTimeout(() => {
      const firstDigit = document.querySelector("#email-verify-otp-group .otp-digit");
      if (firstDigit) firstDigit.focus();
    }, 120);
  } catch (e) {
    showAlert(el, e.message, "error");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Create Account";
    }
  }
}

/* ── EMAIL VERIFICATION ─────────────────────────────────────── */
let _emailVerifyTimerInterval = null;

function _startEmailVerifyTimer() {
  if (_emailVerifyTimerInterval) clearTimeout(_emailVerifyTimerInterval);
  let secs = 60;
  const timerEl   = document.getElementById("email-verify-otp-timer");
  const resendBtn = document.getElementById("email-verify-resend-btn");
  if (resendBtn) resendBtn.disabled = true;
  const tick = () => {
    if (timerEl) timerEl.textContent = `(${secs}s)`;
    if (secs <= 0) {
      if (_emailVerifyTimerInterval) clearTimeout(_emailVerifyTimerInterval);
      _emailVerifyTimerInterval = null;
      if (resendBtn) resendBtn.disabled = false;
      if (timerEl) timerEl.textContent = "";
      return;
    }
    secs--;
    _emailVerifyTimerInterval = setTimeout(tick, 1000);
  };
  tick();
}

async function emailVerifyOtp() {
  const code = _getOtpValue("email-verify");
  const el = document.getElementById("register-alert");
  el.className = "alert";
  if (code.length < 6) return showAlert(el, "Enter the full 6-digit code.", "error");
  const email = document.getElementById("reg-email-display").textContent || _pendingVerifyEmail;
  const btn = document.getElementById("email-verify-btn");
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>'; }
  try {
    const res = await api("POST", "/api/users/email/verify", { email, code });
    // ✅ FIX: Store the token if returned (needed to stay logged in on refresh)
    if (res.token) localStorage.setItem("circle_token", res.token);

    if (_pendingVerifyUser) {
      // Coming from registration — user data already in memory
      setCurrentUser(_pendingVerifyUser);
      _pendingVerifyUser = null;
      showAlert(el, "Email verified! Welcome to Circle 🎉", "success");
      setTimeout(() => goTo("feed"), 900);
    } else if (_pendingVerifyEmail) {
      // Coming from login — redirect back to login
      _pendingVerifyEmail = null;
      showAlert(el, "Email verified! Please log in to continue.", "success");
      setTimeout(() => goTo("login"), 1200);
    } else {
      showAlert(el, "Email verified! Welcome to Circle 🎉", "success");
      setTimeout(() => goTo("feed"), 900);
    }
  } catch (e) {
    showAlert(el, e.message || "Invalid code. Please try again.", "error");
    _shakeOtpGroup("email-verify");
    if (btn) { btn.disabled = false; btn.textContent = "Verify Email"; }
  }
}

async function emailResendCode() {
  const email = document.getElementById("reg-email-display").textContent || _pendingVerifyEmail;
  const el = document.getElementById("register-alert");
  el.className = "alert";
  try {
    await api("POST", "/api/users/email/send-verification", { email });
    showAlert(el, "New code sent! Check your inbox.", "success");
    _clearOtpDigits("email-verify");
    _startEmailVerifyTimer();
    setTimeout(() => {
      const firstDigit = document.querySelector("#email-verify-otp-group .otp-digit");
      if (firstDigit) firstDigit.focus();
    }, 120);
  } catch (e) {
    showAlert(el, e.message || "Could not resend. Try again shortly.", "error");
  }
}

function emailVerifyBack() {
  _pendingVerifyUser = null;
  document.getElementById("reg-email-step2").classList.remove("active");
  document.getElementById("reg-email-step1").classList.add("active");
  const btn = document.getElementById("reg-email-submit-btn");
  if (btn) { btn.disabled = false; btn.textContent = "Create Account"; }
  document.getElementById("register-alert").className = "alert";
  if (_emailVerifyTimerInterval) {
    clearTimeout(_emailVerifyTimerInterval);
    _emailVerifyTimerInterval = null;
  }
}

async function loginUser() {
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const el = document.getElementById("login-alert");
  el.className = "alert";
  if (!email || !password)
    return showAlert(el, "Email and password are required.", "error");
  const btn = document.querySelector("#view-login .btn-primary");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
  }
  try {
    const res = await api("POST", "/api/users/login", { email, password });
    // Store the JWT for authenticated requests
    if (res.token) localStorage.setItem("circle_token", res.token);
    setCurrentUser(res.data);
    showToast("Welcome back, " + (res.data?.name ?? "there").split(" ")[0] + "! 👋");
    const _postLoginRedir = sessionStorage.getItem("_redirectAfterLogin");
    if (_postLoginRedir) {
      sessionStorage.removeItem("_redirectAfterLogin");
      if (_postLoginRedir.startsWith("/")) {
        setTimeout(() => { location.href = _postLoginRedir; }, 400);
        return;
      }
      if (_postLoginRedir.startsWith(window.location.origin)) {
        setTimeout(() => { location.href = _postLoginRedir; }, 400);
        return;
      }
    }
    setTimeout(() => goTo("feed"), 400);
  } catch (e) {
    // Unverified account — send them to the OTP screen
    if (e.unverified) {
      _pendingVerifyEmail = email;
      try {
        await api("POST", "/api/users/email/send-verification", { email });
      } catch (sendErr) {
        showAlert(el, "Could not send verification code. Try again.", "error");
        if (btn) { btn.disabled = false; btn.textContent = "Sign In"; }
        return;
      }
      goTo("register");
      document.getElementById("reg-email-display").textContent = email;
      document.getElementById("reg-email-step1").classList.remove("active");
      document.getElementById("reg-email-step2").classList.add("active");
      _clearOtpDigits("email-verify");
      _startEmailVerifyTimer();
      setTimeout(() => {
        const firstDigit = document.querySelector("#email-verify-otp-group .otp-digit");
        if (firstDigit) firstDigit.focus();
      }, 120);
      return;
    }
    showAlert(el, e.message, "error");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Sign In";
    }
  }
}

/* ── PHONE / OTP AUTH ─────────────────────────────────────────── */
let _otpTimerInterval = null;

function switchLoginMethod(method) {
  const isPhone = method === "phone";
  document.getElementById("login-tab-email").classList.toggle("active", !isPhone);
  document.getElementById("login-tab-phone").classList.toggle("active", isPhone);
  document.getElementById("login-email-method").style.display = isPhone ? "none" : "block";
  document.getElementById("login-phone-method").style.display = isPhone ? "block" : "none";
  document.getElementById("login-alert").className = "alert";
  if (isPhone) {
    // Reset to step 1
    phoneLoginBack();
    setTimeout(() => document.getElementById("login-phone-number").focus(), 80);
  }
}

function phoneLoginBack() {
  document.getElementById("login-phone-step1").classList.add("active");
  document.getElementById("login-phone-step2").classList.remove("active");
  _clearOtpTimer();
  _clearOtpDigits("login");
}

async function phoneLoginSendOtp(isResend = false) {
  const dialCode = document.getElementById("login-dial-code").value;
  const raw      = document.getElementById("login-phone-number").value.trim();
  const el       = document.getElementById("login-alert");
  el.className = "alert";

  if (!raw) return showAlert(el, "Please enter your phone number.", "error");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 5)
    return showAlert(el, "Please enter a valid phone number.", "error");

  const phone = dialCode + digits;
  const btn = document.getElementById("login-send-otp-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Sending…";
  }

  try {
    await api("POST", "/api/auth/phone/send-otp", { phone });
    document.getElementById("login-otp-phone-display").textContent = dialCode + " " + raw;
    document.getElementById("login-phone-step1").classList.remove("active");
    document.getElementById("login-phone-step2").classList.add("active");
    _clearOtpDigits("login");
    setTimeout(
      () => document.querySelector("#login-otp-group .otp-digit").focus(),
      80,
    );
    _startOtpTimer("login");
    if (isResend) showToast("New code sent! 📱");
  } catch (e) {
    showAlert(el, e.message || "Failed to send code. Please try again.", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Send Code";
    }
  }
}

async function phoneLoginVerifyOtp() {
  const dialCode = document.getElementById("login-dial-code").value;
  const raw = document
    .getElementById("login-phone-number")
    .value.trim()
    .replace(/\D/g, "");
  const phone = dialCode + raw;
  const code  = _getOtpValue("login");
  const el    = document.getElementById("login-alert");
  el.className = "alert";

  if (code.length < 6)
    return showAlert(el, "Please enter the full 6-digit code.", "error");

  const btn = document.getElementById("login-verify-otp-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Verifying…";
  }

  try {
    const res = await api("POST", "/api/auth/phone/verify-otp", { phone, code });
    // ✅ FIX: store token if returned (important for session persistence)
    if (res.token) localStorage.setItem("circle_token", res.token);
    _clearOtpTimer();
    setCurrentUser(res.data);
    showToast("Welcome back, " + (res.data?.name ?? "there").split(" ")[0] + "! 👋");
    setTimeout(() => goTo("feed"), 400);
  } catch (e) {
    showAlert(el, e.message || "Invalid code. Please try again.", "error");
    _shakeOtpGroup("login");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Verify & Sign In";
    }
  }
}

// ── Phone Registration ─────────────────────────────────────────

function switchRegisterMethod(method) {
  const isPhone = method === "phone";
  document.getElementById("reg-tab-email").classList.toggle("active", !isPhone);
  document.getElementById("reg-tab-phone").classList.toggle("active", isPhone);
  document.getElementById("reg-email-method").style.display = isPhone ? "none" : "block";
  document.getElementById("reg-phone-method").style.display = isPhone ? "block" : "none";
  document.getElementById("register-alert").className = "alert";
  if (isPhone) {
    phoneRegisterBack();
    // Seed dial code dropdown if not yet populated
    const dial = document.getElementById("reg-phone-dial-code");
    if (dial && !dial.options.length) {
      const src = document.getElementById("reg-dial-code");
      if (src) dial.innerHTML = src.innerHTML;
    }
    setTimeout(() => document.getElementById("reg-phone-name").focus(), 80);
  }
}

function phoneRegisterBack() {
  document.getElementById("reg-phone-step1").classList.add("active");
  document.getElementById("reg-phone-step2").classList.remove("active");
  _clearOtpTimer();
  _clearOtpDigits("reg");
}

async function phoneRegisterSendOtp(isResend = false) {
  const name     = document.getElementById("reg-phone-name").value.trim();
  const dialCode = document.getElementById("reg-phone-dial-code").value;
  const raw      = document.getElementById("reg-phone-number").value.trim();
  const el       = document.getElementById("register-alert");
  el.className = "alert";

  if (!name) return showAlert(el, "Please enter your name.", "error");
  if (name.length < 2)
    return showAlert(el, "Name must be at least 2 characters.", "error");
  if (!raw) return showAlert(el, "Please enter your phone number.", "error");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 5)
    return showAlert(el, "Please enter a valid phone number.", "error");

  const phone = dialCode + digits;
  const btn = document.getElementById("reg-send-otp-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Sending…";
  }

  try {
    await api("POST", "/api/auth/phone/register/send-otp", { phone, name });
    document.getElementById("reg-otp-phone-display").textContent = dialCode + " " + raw;
    document.getElementById("reg-phone-step1").classList.remove("active");
    document.getElementById("reg-phone-step2").classList.add("active");
    _clearOtpDigits("reg");
    setTimeout(
      () => document.querySelector("#reg-otp-group .otp-digit").focus(),
      80,
    );
    _startOtpTimer("reg");
    if (isResend) showToast("New code sent! 📱");
  } catch (e) {
    showAlert(el, e.message || "Failed to send code. Please try again.", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Send Code";
    }
  }
}

async function phoneRegisterVerifyOtp() {
  const name     = document.getElementById("reg-phone-name").value.trim();
  const dialCode = document.getElementById("reg-phone-dial-code").value;
  const raw = document
    .getElementById("reg-phone-number")
    .value.trim()
    .replace(/\D/g, "");
  const phone = dialCode + raw;
  const code  = _getOtpValue("reg");
  const el    = document.getElementById("register-alert");
  el.className = "alert";

  if (code.length < 6)
    return showAlert(el, "Please enter the full 6-digit code.", "error");

  const btn = document.getElementById("reg-verify-otp-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Creating account…";
  }

  try {
    const res = await api("POST", "/api/auth/phone/register/verify-otp", { phone, code, name });
    // ✅ FIX: store token if returned (needed to stay logged in on refresh)
    if (res.token) localStorage.setItem("circle_token", res.token);
    _clearOtpTimer();
    setCurrentUser(res.data);
    showToast("Welcome to Circle, " + (res.data?.name ?? "friend").split(" ")[0] + "! 🎉");
    setTimeout(() => goTo("feed"), 600);
  } catch (e) {
    showAlert(el, e.message || "Invalid code. Please try again.", "error");
    _shakeOtpGroup("reg");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Verify & Create Account";
    }
  }
}

// ── OTP input helpers ─────────────────────────────────────────
function _otpAutoSubmit(prefix) {
  if (prefix === "login") phoneLoginVerifyOtp();
  else if (prefix === "reg") phoneRegisterVerifyOtp();
  else if (prefix === "email-verify") emailVerifyOtp();
}

function otpInput(el, prefix) {
  el.value = el.value.replace(/\D/g, "").slice(-1);
  el.classList.toggle("filled", !!el.value);
  if (el.value) {
    const next = el.nextElementSibling;
    if (next && next.classList.contains("otp-digit")) next.focus();
    else _otpAutoSubmit(prefix); // all 6 filled
  }
}

function otpKeydown(e, el, prefix) {
  if (e.key === "Backspace" && !el.value) {
    const prev = el.previousElementSibling;
    if (prev && prev.classList.contains("otp-digit")) {
      prev.value = "";
      prev.classList.remove("filled");
      prev.focus();
    }
  }
  if (e.key === "ArrowLeft") {
    const prev = el.previousElementSibling;
    if (prev && prev.classList.contains("otp-digit")) prev.focus();
  }
  if (e.key === "ArrowRight") {
    const next = el.nextElementSibling;
    if (next && next.classList.contains("otp-digit")) next.focus();
  }
  if (e.key === "Enter") _otpAutoSubmit(prefix);
}

function otpPaste(e, prefix) {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData)
    .getData("text")
    .replace(/\D/g, "")
    .slice(0, 6);
  const digits = document.querySelectorAll(`#${prefix}-otp-group .otp-digit`);
  text.split("").forEach((ch, i) => {
    if (digits[i]) {
      digits[i].value = ch;
      digits[i].classList.add("filled");
    }
  });
  const lastFilled = Math.min(text.length, 5);
  if (digits[lastFilled]) digits[lastFilled].focus();
  if (text.length === 6) setTimeout(() => _otpAutoSubmit(prefix), 120);
}

function _getOtpValue(prefix) {
  return [...document.querySelectorAll(`#${prefix}-otp-group .otp-digit`)]
    .map((d) => d.value)
    .join("");
}

function _clearOtpDigits(prefix) {
  document.querySelectorAll(`#${prefix}-otp-group .otp-digit`).forEach((d) => {
    d.value = "";
    d.classList.remove("filled");
  });
}

function _shakeOtpGroup(prefix) {
  const g = document.getElementById(`${prefix}-otp-group`);
  if (!g) return;
  g.style.animation = "none";
  g.offsetHeight; // reflow
  g.style.animation = "otpShake 0.4s ease";
  setTimeout(() => {
    g.style.animation = "";
    _clearOtpDigits(prefix);
    document.querySelector(`#${prefix}-otp-group .otp-digit`).focus();
  }, 420);
}

function _startOtpTimer(prefix) {
  _clearOtpTimer();
  let secs = 30;
  const timerEl   = document.getElementById(`${prefix}-otp-timer`);
  const resendBtn = document.getElementById(`${prefix}-resend-btn`);
  if (resendBtn) resendBtn.disabled = true;
  const tick = () => {
    if (timerEl) timerEl.textContent = `(${secs}s)`;
    if (secs <= 0) {
      _clearOtpTimer();
      if (resendBtn) {
        resendBtn.disabled = false;
      }
      if (timerEl) timerEl.textContent = "";
      return;
    }
    secs--;
    _otpTimerInterval = setTimeout(tick, 1000);
  };
  tick();
}

function _clearOtpTimer() {
  if (_otpTimerInterval) {
    clearTimeout(_otpTimerInterval);
    _otpTimerInterval = null;
  }
}

// ── Logout ────────────────────────────────────────────────────
function logout() {
  currentUser = null;
  localStorage.removeItem("circle_user");
  localStorage.removeItem("circle_token");
  // ── Cache: clear all cached data on logout ──────────────────
  PostCache.clear();
  Feed.reset();     // wipes all feed state atomically
  _trendingLoaded = false;
  _trendingWords = [];
  _activeFilter = null;
  document.getElementById("trending-filter-bar").style.display = "none";
  document.getElementById("sidebar-user-area").style.display = "none";
  document.getElementById("login-nudge").style.display = "flex";
  document.getElementById("feed-tabs").style.display = "none";
  const hint = document.getElementById("feed-personalised-hint");
  if (hint) hint.style.display = "none";

  const ta = document.getElementById("topbar-avatar");
  if (ta) {
    ta.style.background = "var(--border2)";
    ta.innerHTML = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  }
  stopNotifPolling();
  updateNotifBadge(0);
  E2E.clearCache();
  // Disconnect WebSocket on logout
  if (typeof CircleWS !== "undefined") CircleWS.disconnect();
  showToast("Logged out successfully.");
  goTo("feed");
}

// ── Session bootstrap: called after login/register/verify ──────
function setCurrentUser(user) {
  _suggestionsLoaded = false;
  _feedSugDismissed  = false;
  _feedSugUsers      = [];
  _newMembersLoaded  = false;
  _feedNewDismissed  = !!localStorage.getItem("circle_new_dismissed");
  _feedNewIndex      = 0;
  _newMembers        = [];
  _trendingLoaded    = false;
  _trendingWords     = [];
  _activeFilter      = null;
  if (
    user &&
    document.getElementById("view-feed").classList.contains("active")
  ) {
    setTimeout(loadSuggestions, 700);
  }
  currentUser = user;
  localStorage.setItem("circle_user", JSON.stringify(user));
  if (!user) return;
  if (user) Feed.loadFollowingSet();
  const initial = (user.name || "?").charAt(0).toUpperCase(),
    color = stringToColor(user.name || "");
  const pic = resolveMediaUrl(user.picture) || null;

  function applyAv(el) {
    if (!el) return;
    if (pic) {
      el.style.background = "transparent";
      el.innerHTML = `<img src="${pic}" alt="${initial}" style="width:100%;height:100%;border-radius:inherit;object-fit:cover;display:block" onerror="this.parentElement.innerHTML=defaultAvatar();this.parentElement.style.background='${color}'"/>`;
    } else {
      el.style.background = color;
      el.innerHTML = defaultAvatar();
    }
  }

  document.getElementById("sidebar-user-area").style.display = "block";
  const ca = document.getElementById("compose-av");
  applyAv(ca);
  const ta = document.getElementById("topbar-avatar");
  if (ta) {
    ta.style.display = "grid";
    if (pic) {
      ta.style.background = "transparent";
      ta.innerHTML = `<img src="${pic}" alt="${initial}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block" onerror="this.parentElement.innerHTML=defaultAvatar();this.parentElement.style.background='${color}'"/>`;
    } else {
      ta.style.background = color;
      ta.innerHTML = defaultAvatar();
    }
  }
  document.getElementById("login-nudge").style.display = "none";
  document.getElementById("feed-tabs").style.display = "flex";
  const hint = document.getElementById("feed-personalised-hint");
  if (hint) hint.style.display = "block";
  startNotifPolling();
  loadSuggestions();
  // Generate / load E2E key-pair and publish public key to server
  E2E.publishMyPublicKey().catch(() => {});
  // Connect WebSocket for real-time DMs and notifications
  if (typeof CircleWS !== "undefined") CircleWS.connect();
  // Reload live feed cards now that we're authenticated (issue #9)
  if (typeof Live !== "undefined") Live.loadActiveSessions();
}

// ── Password reset ───────────────────────────────────────────
async function sendResetEmail() {
  const email = document.getElementById("reset-email").value.trim();
  const el = document.getElementById("reset-alert");
  el.className = "alert";
  if (!email) return showAlert(el, "Please enter your email.", "error");
  try {
    await api("POST", "/api/users/reset-password", { email });
    showAlert(el, "If that email exists, a reset link has been sent.", "success");
  } catch (e) {
    showAlert(el, e.message, "error");
  }
}

async function setNewPassword() {
  const pw  = document.getElementById("newpw-password").value;
  const cfm = document.getElementById("newpw-confirm").value;
  const el  = document.getElementById("newpw-alert");
  el.className = "alert";

  if (!pw || pw.length < 6)
    return showAlert(el, "Password must be at least 6 characters.", "error");
  if (pw !== cfm) return showAlert(el, "Passwords do not match.", "error");

  const token = new URLSearchParams(window.location.search).get("token");
  if (!token) return showAlert(el, "Invalid or expired reset link.", "error");

  try {
    await api("POST", "/api/users/reset-password/confirm", { token, password: pw });
    showAlert(el, "Password updated! Redirecting to login…", "success");
    history.replaceState({}, "", window.location.pathname); // strip ?token from URL
    setTimeout(() => goTo("login"), 1400);
  } catch (e) {
    showAlert(el, e.message, "error");
  }
}