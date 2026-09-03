import React, { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { RefreshProvider, useRefresh } from "./context/RefreshContext";
import api from "./lib/api";

import Layout from "./components/Layout";
import InstallPrompt from "./components/InstallPrompt";
import AddTransactionModal from "./components/AddTransactionModal";
import ScanReceiptModal from "./components/ScanReceiptModal";
import { Spinner } from "./components/ui";

import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Wallets from "./pages/Wallets";
import Transactions from "./pages/Transactions";
import Budget from "./pages/Budget";
import Goals from "./pages/Goals";
import Advisor from "./pages/Advisor";
import Reports from "./pages/Reports";

function FullLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <Spinner size={32} className="text-brand" />
    </div>
  );
}

function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = window.location.hash;
    const sid = new URLSearchParams(hash.replace("#", "")).get("session_id");
    (async () => {
      try {
        const res = await api.post("/auth/session", {}, { headers: { "X-Session-ID": sid } });
        setUser(res.data.user);
        window.history.replaceState(null, "", "/dashboard");
        navigate("/dashboard", { replace: true, state: { user: res.data.user } });
      } catch {
        navigate("/", { replace: true });
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-bg">
      <Spinner size={32} className="text-brand" />
      <p className="text-tsecondary text-sm">Menyiapkan dashboard kamu...</p>
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

  // First-run: guide brand-new users into the budget wizard
  const skipped = localStorage.getItem("nusa-skip-onboarding") === "1";
  if (user && !user.onboarded && !skipped && location.pathname !== "/budget") {
    return <Navigate to="/budget" replace state={{ onboarding: true }} />;
  }

  return (
    <Layout onAdd={() => openAdd("manual")} onScan={() => setScanOpen(true)}>
      <Outlet context={{ openAdd, openScan: () => setScanOpen(true) }} />
      <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={bump} initialMode={addMode} />
      <ScanReceiptModal open={scanOpen} onClose={() => setScanOpen(false)} onSaved={bump} />
      <InstallPrompt />
    </Layout>
  );
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route element={<Protected><Shell /></Protected>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/wallets" element={<Wallets />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/advisor" element={<Advisor />} />
        <Route path="/reports" element={<Reports />} />
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
