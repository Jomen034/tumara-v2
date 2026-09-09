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

import Landing from "./pages/Landing";
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
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <Spinner size={32} className="text-brand" />
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
    if (!pendingInvite && location.pathname !== "/budget") {
      return <Navigate to="/budget" replace state={{ onboarding: true }} />;
    }
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
