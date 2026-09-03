import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Wallet, ArrowLeftRight, PieChart, Target,
  Sparkles, Moon, Sun, Eye, EyeOff, LogOut, Menu, X, ScanLine, Plus,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Button } from "./ui";

const NAV = [
  { to: "/dashboard", label: "Beranda", icon: LayoutDashboard },
  { to: "/wallets", label: "Dompet", icon: Wallet },
  { to: "/transactions", label: "Transaksi", icon: ArrowLeftRight },
  { to: "/budget", label: "Budget", icon: PieChart },
  { to: "/goals", label: "Tujuan", icon: Target },
  { to: "/advisor", label: "Nusa AI", icon: Sparkles },
  { to: "/reports", label: "Laporan", icon: PieChart },
];

const BOTTOM = [NAV[0], NAV[1], NAV[2], NAV[4], NAV[5]];

function Logo({ small }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center shadow-lg shadow-[var(--glow)]">
        <span className="text-black font-head font-extrabold text-lg">N</span>
      </div>
      {!small && <span className="font-head font-extrabold text-xl tracking-tight">Nusa</span>}
    </div>
  );
}

export default function Layout({ children, onAdd, onScan }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, privacy, togglePrivacy } = useTheme();
  const [open, setOpen] = useState(false);

  const topActions = (
    <div className="flex items-center gap-1.5">
      <button data-testid="privacy-toggle-button" onClick={togglePrivacy} title="Mode privasi"
        className="p-2.5 rounded-full hover:bg-elevated text-tsecondary transition-colors">
        {privacy ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
      <button data-testid="theme-toggle-button" onClick={toggleTheme} title="Ganti tema"
        className="p-2.5 rounded-full hover:bg-elevated text-tsecondary transition-colors">
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
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
            <NavLink key={n.to} to={n.to} data-testid={`nav-${n.to.slice(1)}`}
              className={({ isActive }) => clsx(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                isActive ? "bg-elevated text-brand" : "text-tsecondary hover:text-tprimary hover:bg-elevated"
              )}>
              <n.icon size={19} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-borderc pt-4 mt-4">
          <div className="flex items-center gap-3 px-2 mb-3">
            <img src={user?.picture || `https://api.dicebear.com/7.x/notionists/svg?seed=${user?.name}`}
              alt="" className="w-9 h-9 rounded-full bg-elevated object-cover" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-tmuted truncate">{user?.email}</p>
            </div>
          </div>
          <button data-testid="logout-button" onClick={logout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-tsecondary hover:text-rose hover:bg-elevated w-full transition-colors">
            <LogOut size={18} /> Keluar
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <motion.aside className="absolute left-0 top-0 h-full w-72 bg-surface border-r border-borderc p-5 flex flex-col"
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "spring", damping: 28, stiffness: 300 }}>
              <div className="flex items-center justify-between mb-8">
                <Logo />
                <button onClick={() => setOpen(false)} className="p-2 rounded-full hover:bg-elevated"><X size={18} /></button>
              </div>
              <nav className="flex-1 space-y-1">
                {NAV.map((n) => (
                  <NavLink key={n.to} to={n.to} onClick={() => setOpen(false)}
                    className={({ isActive }) => clsx(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                      isActive ? "bg-elevated text-brand" : "text-tsecondary hover:bg-elevated"
                    )}>
                    <n.icon size={19} /> {n.label}
                  </NavLink>
                ))}
              </nav>
              <button onClick={logout} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-tsecondary hover:text-rose hover:bg-elevated transition-colors">
                <LogOut size={18} /> Keluar
              </button>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 glass border-b border-borderc px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setOpen(true)} className="lg:hidden p-2 rounded-full hover:bg-elevated"><Menu size={20} /></button>
            <div className="lg:hidden"><Logo small /></div>
          </div>
          <div className="flex items-center gap-2">
            <Button data-testid="scan-receipt-button" onClick={onScan} variant="secondary" size="sm" className="hidden sm:inline-flex">
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
          <NavLink key={n.to} to={n.to} data-testid={`bottomnav-${n.to.slice(1)}`}
            className={({ isActive }) => clsx(
              "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-medium transition-colors",
              isActive ? "text-brand" : "text-tmuted"
            )}>
            <n.icon size={20} /> {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
