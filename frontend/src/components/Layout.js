import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PieChart,
  Target,
  Sparkles,
  Moon,
  Sun,
  Eye,
  EyeOff,
  LogOut,
  Menu,
  X,
  ScanLine,
  Plus,
  ReceiptText,
  Users,
  Settings,
  Info,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Button } from "./ui";
import SettingsModal from "./SettingsModal";
import TumaraLogo from "./TumaraLogo";
import { getUserAvatar } from "../lib/avatars";
import AiQuotaModal from "./AiQuotaModal";

const NAV = [
  { to: "/dashboard", label: "Beranda", icon: LayoutDashboard },
  { to: "/wallets", label: "Dompet", icon: Wallet },
  { to: "/transactions", label: "Transaksi", icon: ArrowLeftRight },
  { to: "/bills", label: "Tagihan", icon: ReceiptText },
  { to: "/budget", label: "Budget", icon: PieChart },
  { to: "/goals", label: "Tujuan", icon: Target },
  { to: "/reports", label: "Laporan", icon: PieChart },
  { to: "/advisor", label: "Tumara AI", icon: Sparkles },
  { to: "/household", label: "Rumah", icon: Users },
];

const BOTTOM = [
  { to: "/dashboard", label: "Beranda", icon: LayoutDashboard },
  { to: "/transactions", label: "Transaksi", icon: ArrowLeftRight },
  { to: "/bills", label: "Tagihan", icon: ReceiptText },
  { to: "/advisor", label: "Tumara AI", icon: Sparkles },
  { to: "/household", label: "Rumah", icon: Users },
];

function Logo({ small }) {
  return <TumaraLogo size={36} withText={!small} />;
}

export default function Layout({ children, onAdd, onScan }) {
  const { user, logout, aiUsage, refreshAiUsage } = useAuth();
  const { theme, toggleTheme, privacy, togglePrivacy } = useTheme();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);

  // Auto scroll to top on page / route transition
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [location.pathname]);

  const handleNavClick = (to) => {
    try {
      if (location.pathname === to) {
        window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    } catch {
      window.scrollTo(0, 0);
    }
  };

  const topActions = (
    <div className="flex items-center gap-1.5">
      <button
        data-testid="privacy-toggle-button"
        onClick={togglePrivacy}
        title="Mode privasi"
        className="p-2.5 rounded-full hover:bg-elevated text-tsecondary transition-colors"
      >
        {privacy ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
      <button
        data-testid="theme-toggle-button"
        onClick={toggleTheme}
        title="Ganti tema"
        className="p-2.5 rounded-full hover:bg-elevated text-tsecondary transition-colors"
      >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <button
        data-testid="settings-button"
        onClick={() => setSettingsOpen(true)}
        title="Pengaturan & Profil"
        className="p-2.5 rounded-full hover:bg-elevated text-tsecondary hover:text-brand transition-colors"
      >
        <Settings size={18} />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-bg text-tprimary">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-borderc bg-surface sticky top-0 h-screen p-5">
        <div className="px-2 mb-8"><Logo /></div>
        <nav className="flex-1 space-y-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              onClick={() => handleNavClick(n.to)}
              data-testid={`nav-${n.to.slice(1)}`}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                  isActive
                    ? "bg-elevated text-brand"
                    : "text-tsecondary hover:text-tprimary hover:bg-elevated"
                )
              }
            >
              <n.icon size={19} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-borderc pt-4 mt-4">
          {aiUsage && (
            <div
              onClick={() => setQuotaModalOpen(true)}
              className="p-3 mb-3 rounded-xl bg-elevated/70 border border-borderc hover:border-brand/40 cursor-pointer transition-all group"
              title="Klik untuk rincian Kuota FUP & Booster AI"
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-tprimary flex items-center gap-1.5">
                  <Sparkles size={13} className="text-brand" /> Kuota AI
                </span>
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-brand/15 text-brand">
                  {aiUsage.tier || user?.tier || "Starter"}
                </span>
              </div>
              <div className="space-y-1 text-[11px] text-tmuted">
                <div className="flex justify-between">
                  <span>Scan: <strong className="text-tprimary font-medium">{aiUsage.scans_used || 0}/{aiUsage.scans_limit || 0}</strong></span>
                  <span>Teks: <strong className="text-tprimary font-medium">{aiUsage.chats_used || 0}/{aiUsage.chats_limit || 0}</strong></span>
                </div>
                <div className="w-full bg-borderc/60 h-1.5 rounded-full overflow-hidden mt-1">
                  <div
                    className="bg-brand h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.round(((aiUsage.scans_used || 0) / Math.max(1, aiUsage.scans_limit || 1)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
          <div
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-elevated cursor-pointer transition-colors group mb-1.5"
            title="Buka Pengaturan Akun"
          >
            <img
              src={getUserAvatar(user)}
              alt=""
              className="w-9 h-9 rounded-full bg-elevated object-cover border border-borderc shadow-sm"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate group-hover:text-brand transition-colors">
                {user?.display_name || user?.name}
              </p>
              <p className="text-xs text-tmuted truncate">{user?.email}</p>
            </div>
            <Settings size={15} className="text-tmuted group-hover:text-brand transition-colors shrink-0" />
          </div>
          <NavLink
            to="/about"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-tmuted hover:text-brand hover:bg-elevated transition-colors mb-1"
          >
            <Info size={15} /> Tentang Tumara (v2.2)
          </NavLink>
          <button
            data-testid="logout-button"
            onClick={logout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-tsecondary hover:text-rose hover:bg-elevated w-full transition-colors"
          >
            <LogOut size={18} /> Keluar
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <motion.aside
              className="absolute left-0 top-0 h-full w-72 bg-surface border-r border-borderc p-5 flex flex-col"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
            >
              <div className="flex items-center justify-between mb-8">
                <Logo />
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-full hover:bg-elevated"
                >
                  <X size={18} />
                </button>
              </div>
              <nav className="flex-1 space-y-1">
                {NAV.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      clsx(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                        isActive ? "bg-elevated text-brand" : "text-tsecondary hover:bg-elevated"
                      )
                    }
                  >
                    <n.icon size={19} /> {n.label}
                  </NavLink>
                ))}
              </nav>
              <div className="border-t border-borderc pt-4 mt-auto">
                {aiUsage && (
                  <div
                    onClick={() => {
                      setOpen(false);
                      setQuotaModalOpen(true);
                    }}
                    className="p-3 mb-3 rounded-xl bg-elevated/70 border border-borderc hover:border-brand/40 cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-tprimary flex items-center gap-1.5">
                        <Sparkles size={13} className="text-brand" /> Kuota AI
                      </span>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-brand/15 text-brand">
                        {aiUsage.tier || user?.tier || "Starter"}
                      </span>
                    </div>
                    <div className="text-[11px] text-tmuted flex justify-between">
                      <span>Scan: <strong className="text-tprimary font-medium">{aiUsage.scans_used || 0}/{aiUsage.scans_limit || 0}</strong></span>
                      <span>Teks: <strong className="text-tprimary font-medium">{aiUsage.chats_used || 0}/{aiUsage.chats_limit || 0}</strong></span>
                    </div>
                  </div>
                )}
                <div
                  onClick={() => {
                    setOpen(false);
                    setSettingsOpen(true);
                  }}
                  className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-elevated cursor-pointer transition-colors mb-2"
                >
                  <img
                    src={getUserAvatar(user)}
                    alt=""
                    className="w-9 h-9 rounded-full bg-elevated object-cover border border-borderc shadow-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">
                      {user?.display_name || user?.name}
                    </p>
                    <p className="text-xs text-tmuted truncate">{user?.email}</p>
                  </div>
                  <Settings size={15} className="text-tmuted shrink-0" />
                </div>
                <NavLink
                  to="/about"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-tmuted hover:text-brand hover:bg-elevated transition-colors mb-1"
                >
                  <Info size={15} /> Tentang Tumara (v2.2)
                </NavLink>
                <button
                  onClick={logout}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-tsecondary hover:text-rose hover:bg-elevated transition-colors w-full"
                >
                  <LogOut size={18} /> Keluar
                </button>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 glass border-b border-borderc px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOpen(true)}
              className="lg:hidden p-2 rounded-full hover:bg-elevated"
            >
              <Menu size={20} />
            </button>
            <div className="lg:hidden"><Logo small /></div>
          </div>
          <div className="flex items-center gap-2">
            {aiUsage && (
              <button
                type="button"
                data-testid="header-ai-quota-badge"
                onClick={() => setQuotaModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-brand/10 hover:bg-brand/15 text-brand text-xs font-medium border border-brand/20 transition-all hover:scale-[1.02] cursor-pointer"
                title="Status Kuota AI Tumara (FUP). Klik untuk rincian / booster."
              >
                <Sparkles size={14} className="text-brand shrink-0" />
                <span className="font-semibold">
                  {Math.max(0, (aiUsage.scans_limit || 0) - (aiUsage.scans_used || 0))} Scan
                </span>
                <span className="hidden sm:inline text-brand/50">·</span>
                <span className="hidden sm:inline font-semibold">
                  {Math.max(0, (aiUsage.chats_limit || 0) - (aiUsage.chats_used || 0))} Teks
                </span>
              </button>
            )}
            <Button
              data-testid="scan-receipt-button"
              onClick={onScan}
              variant="secondary"
              size="sm"
              className="hidden sm:inline-flex"
            >
              <ScanLine size={16} /> Scan Struk
            </Button>
            <Button data-testid="add-transaction-button" onClick={onAdd} size="sm">
              <Plus size={16} /> <span className="hidden sm:inline">Transaksi</span>
            </Button>
            {topActions}
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-10 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-borderc flex items-center justify-around px-2 py-2">
        {BOTTOM.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            onClick={() => handleNavClick(n.to)}
            data-testid={`bottomnav-${n.to.slice(1)}`}
            className={({ isActive }) =>
              clsx(
                "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-medium transition-colors",
                isActive ? "text-brand" : "text-tmuted"
              )
            }
          >
            <n.icon size={20} /> {n.label}
          </NavLink>
        ))}
      </nav>

      {/* Settings & Profile Modal */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* AI Quota & Booster Modal */}
      <AiQuotaModal
        open={quotaModalOpen}
        onClose={() => setQuotaModalOpen(false)}
        quotaData={aiUsage}
        onRedeemed={refreshAiUsage}
      />
    </div>
  );
}
