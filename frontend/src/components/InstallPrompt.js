import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Share } from "lucide-react";

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [show, setShow] = useState(false);
  const [iosShow, setIosShow] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (isStandalone || localStorage.getItem("nusa-install-dismissed") === "1") return;

    const handler = (e) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari doesn't fire beforeinstallprompt — show manual hint
    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (isIOS && !isStandalone) {
      const t = setTimeout(() => setIosShow(true), 2500);
      return () => { clearTimeout(t); window.removeEventListener("beforeinstallprompt", handler); };
    }
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setShow(false);
    setDeferred(null);
  };

  const dismiss = () => {
    setShow(false);
    setIosShow(false);
    localStorage.setItem("nusa-install-dismissed", "1");
  };

  const visible = show || iosShow;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          data-testid="pwa-install-banner"
          className="fixed bottom-24 lg:bottom-6 inset-x-4 lg:inset-x-auto lg:right-6 lg:w-96 z-[60]"
          initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 24 }}
        >
          <div className="bg-surface border border-brand/40 rounded-2xl p-4 shadow-2xl shadow-[var(--glow)] flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand flex items-center justify-center shrink-0">
              <span className="text-black font-head font-extrabold text-lg">N</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Install Nusa di HP kamu</p>
              {iosShow ? (
                <p className="text-xs text-tsecondary mt-0.5 flex items-center gap-1 flex-wrap">
                  Tap <Share size={13} className="inline" /> lalu "Add to Home Screen".
                </p>
              ) : (
                <p className="text-xs text-tsecondary mt-0.5">Akses cepat, jalan seperti aplikasi native.</p>
              )}
              {!iosShow && (
                <button data-testid="pwa-install-button" onClick={install}
                  className="mt-2.5 inline-flex items-center gap-1.5 bg-brand text-black text-xs font-semibold px-3.5 py-2 rounded-full hover:brightness-110 transition">
                  <Download size={14} /> Install Sekarang
                </button>
              )}
            </div>
            <button onClick={dismiss} className="p-1.5 rounded-full hover:bg-elevated text-tmuted"><X size={16} /></button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
