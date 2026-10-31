// Keeps the swelux.ai sign-in alive while the map is open. The gateway injects
// this script into Hajk's page.
//
// Platform access tokens last 15 minutes. The gateway turns the swelux_token
// cookie into the Authorization header (Hajk's layer loader can't add headers),
// so a minute or two before the token expires this script asks the platform for
// a new one with the refresh cookie (HttpOnly, Path=/api/v1/sessions) and writes
// it back to swelux_token. When the platform says the session is over (401), it
// goes to the login page and comes back here afterwards.
(function () {
  "use strict";

  var EARLY_MS = 120 * 1000; // refresh this long before expiry
  var CHECK_MS = 20 * 1000;
  var RETRY_MS = 30 * 1000;
  var busy = false;
  var notBefore = 0;

  function readCookie(name) {
    var prefix = name + "=";
    var found = document.cookie.split(";").map(function (c) { return c.trim(); })
      .filter(function (c) { return c.indexOf(prefix) === 0; })[0];
    return found ? decodeURIComponent(found.slice(prefix.length)) : "";
  }

  function writeCookie(name, value, maxAge) {
    document.cookie = name + "=" + encodeURIComponent(value) +
      "; Path=/; Max-Age=" + maxAge + "; Secure; SameSite=Strict";
  }

  function expiresAt() {
    return Number(readCookie("swelux_token_expires")) || 0;
  }

  function due() {
    return expiresAt() - Date.now() < EARLY_MS;
  }

  function toLogin() {
    location.replace("/login?next=" +
      encodeURIComponent(location.pathname + location.search + location.hash));
  }

  function store(session) {
    var exp = new Date(session.expiresAt).getTime();
    var maxAge = Math.max(60, Math.floor((exp - Date.now()) / 1000));
    writeCookie("swelux_token", session.accessToken, maxAge);
    writeCookie("swelux_token_expires", String(exp), maxAge);
  }

  function refresh() {
    // Another tab may have refreshed while this one waited for the lock; the
    // refresh cookie rotates, so don't spend it twice.
    if (!due()) return Promise.resolve();
    return fetch("/api/v1/sessions/refresh", {
      method: "POST",
      credentials: "same-origin"
    }).then(function (res) {
      if (res.status === 401) {
        toLogin();
        return;
      }
      if (!res.ok) throw new Error("refresh answered " + res.status);
      return res.json().then(store);
    });
  }

  function check() {
    if (busy || Date.now() < notBefore || !due()) return;
    busy = true;
    var run = navigator.locks
      ? navigator.locks.request("swelux-session-refresh", refresh)
      : refresh();
    run.catch(function (error) {
      console.warn("swelux: could not renew the sign-in, retrying", error);
      notBefore = Date.now() + RETRY_MS;
    }).then(function () {
      busy = false;
    });
  }

  check();
  setInterval(check, CHECK_MS);
  // Timers are throttled in background tabs and stop while the computer sleeps.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") check();
  });
  window.addEventListener("focus", check);
})();
