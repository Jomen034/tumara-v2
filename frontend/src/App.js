import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { RefreshProvider, useRefresh } from "./context/RefreshContext";

import Layout from "./components/Layout";
import InstallPrompt from "./components/InstallPrompt";
import AddTransactionModal from "./components/AddTransactionModal";
import ScanReceiptModal from "./components/ScanReceiptModal";
import { Spinner } from "./components/ui";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";

import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Wallets from "./pages/Wallets";
import Transactions from "./pages/Transactions";
import Budget from "./pages/Budget";
import Goals from "./pages/Goals";
import Advisor from "./pages/Advisor";
import Reports from "./pages/Reports";
import Bills from "./pages/Bills";
import Household from "./pages/Household";

function FullLoader() {
  const { serverWaking, wakingAttempt, connectionError, retryAuth, logout } = useAuth();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center mb-6">
        <Sparkles size={28} className="text-brand animate-pulse" />
      </div>

      {connectionError ? (
        <div className="max-w-sm space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose/10 text-rose border border-rose/20">
            <AlertCircle size={14} />
            Server Sedang Bangun / Terputus
          </div>
          <h2 className="text-xl font-bold font-head text-tprimary">Menyambungkan Tertunda</h2>
          <p className="text-sm text-tsecondary leading-relaxed">
            Server Tumara membutuhkan waktu lebih lama untuk bangun dari mode hemat daya. Sesi login di perangkat ini tetap aman.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={retryAuth}
              className="w-full py-3 rounded-xl bg-brand text-black font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} /> Coba Sambungkan Lagi
            </button>
            <button
              onClick={logout}
              className="w-full py-2.5 rounded-xl bg-elevated text-tsecondary font-medium text-xs hover:text-rose transition-colors"
            >
              Masuk dengan Akun Lain
            </button>
          </div>
        </div>
      ) : serverWaking ? (
        <div className="max-w-xs space-y-3">
          <Spinner size={32} className="text-brand mx-auto mb-2" />
          <h2 className="text-lg font-bold font-head text-tprimary">Menyambungkan ke Akun...</h2>
          <p className="text-xs text-tsecondary leading-relaxed">
            Server Tumara sedang bangun dari mode hemat daya gratis. Mohon tunggu sebentar...
          </p>
          {wakingAttempt > 1 && (
            <span className="inline-block text-[11px] font-mono font-semibold px-3 py-1 rounded-full bg-elevated text-tmuted border border-borderc">
              Percobaan {wakingAttempt} / 15
            </span>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <Spinner size={32} className="text-brand mx-auto" />
          <p className="text-xs text-tmuted font-medium">Memuat data Tumara...</p>
        </div>
      )}
    </div>
  );
}

function Protected({ children }) {
  const location = useLocation();
  const { user, loading } = useAuth();
  if (loading) return <FullLoader />;
  if (!user) return <Navigate to="/" replace state={{ from: location }} />;
  return children;
}

function Shell() {
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState("manual");
  const [scanOpen, setScanOpen] = useState(false);
  const { bump } = useRefresh();
  const { user } = useAuth();
  const location = useLocation();

  const openAdd = (mode = "manual") => { setAddMode(typeof mode === "string" ? mode : "manual"); setAddOpen(true); };

  // First-run: guide brand-new users. Invited users go to Household to accept.
  const skipped = (localStorage.getItem("tumara-skip-onboarding") || localStorage.getItem("nusa-skip-onboarding")) === "1";
  const pendingInvite = localStorage.getItem("tumara-invite") || localStorage.getItem("nusa-invite");
  if (user && !user.onboarded && !skipped) {
    if (pendingInvite && location.pathname !== "/household") {
      return <Navigate to="/household" replace />;
    }
    if (!pendingInvite && location.pathname !== "/onboarding") {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return (
    <Layout onAdd={() => openAdd("manual")} onScan={() => openAdd("scan")}>
      <Outlet context={{ openAdd, openScan: () => openAdd("scan") }} />
      <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={bump} initialMode={addMode} />
      <ScanReceiptModal open={scanOpen} onClose={() => setScanOpen(false)} onSaved={bump} />
      <InstallPrompt />
    </Layout>
  );
}

function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
      <Route element={<Protected><Shell /></Protected>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/wallets" element={<Wallets />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/advisor" element={<Advisor />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/bills" element={<Bills />} />
        <Route path="/household" element={<Household />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RefreshProvider>
          <Toaster position="top-center" theme="system" richColors closeButton />
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </RefreshProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
