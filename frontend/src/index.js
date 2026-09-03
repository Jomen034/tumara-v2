import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

// Capture household invite code from URL (?invite= or ?code=) before routing/redirects.
try {
  const p = new URLSearchParams(window.location.search);
  const code = p.get("invite") || p.get("code");
  if (code) localStorage.setItem("nusa-invite", code);
} catch {}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

// PWA service worker — production only. In dev it causes stale-cache hangs,
// so we proactively unregister any previously-installed worker + clear caches.
if ("serviceWorker" in navigator) {
  if (process.env.NODE_ENV === "production") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {});
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
    if (window.caches) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
  }
}
