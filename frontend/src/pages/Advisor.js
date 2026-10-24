import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles,
  Send,
  User,
  RotateCcw,
  ShieldCheck,
  Lock,
  X,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import api, { API } from "../lib/api";
import { Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { getUserAvatar } from "../lib/avatars";
import FormattedMessage from "../components/FormattedMessage";
import AiQuotaModal from "../components/AiQuotaModal";

const SUGGESTIONS = [
  "Analisa pos pengeluaran terbesarku bulan ini",
  "Apakah alokasi budget bulanku masih aman?",
  "Berapa batas belanja harian yang disarankan?",
  "Bagaimana strategi mencapai target tabunganku?",
];

const SESSION_STORAGE_KEY = "tumara_advisor_session";

export default function Advisor() {
  const location = useLocation();
  const { user, aiUsage, refreshAiUsage } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quotaData, setQuotaData] = useState(null);
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [privacyDismissed, setPrivacyDismissed] = useState(() => {
    try {
      return localStorage.getItem("tumara_advisor_privacy_dismissed") === "1";
    } catch {
      return false;
    }
  });
  const scrollRef = useRef();
  const accRef = useRef("");
  const initialPromptHandled = useRef(false);

  // Load ephemeral session from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  // Auto-send initial prompt if routed from Budget or other pages
  useEffect(() => {
    if (!loading && location.state?.initialPrompt && !initialPromptHandled.current) {
      initialPromptHandled.current = true;
      send(location.state.initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, location.state]);

  const fetchQuota = async () => {
    try {
      const res = await api.get("/ai/usage");
      setQuotaData(res.data);
    } catch {}
  };

  useEffect(() => {
    fetchQuota();
  }, []);

  // Sync active session messages to sessionStorage
  useEffect(() => {
    if (!loading) {
      try {
        const persistable = messages.filter((m) => !m.pending && m.content);
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(persistable));
      } catch {}
    }
  }, [messages, loading]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streaming]);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || streaming) return;
    setInput("");

    const newHistory = [
      ...messages,
      { role: "user", content: msg, id: `u-${Date.now()}` },
    ];
    setMessages([
      ...newHistory,
      { role: "assistant", content: "", id: `a-${Date.now()}`, pending: true },
    ]);
    setStreaming(true);
    accRef.current = "";

    try {
      const token = localStorage.getItem("tumara_session_token");
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      // Pass previous 6 messages for context during this active session
      const historyPayload = messages
        .filter((m) => !m.pending && m.content)
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(`${API}/ai/chat`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ message: msg, history: historyPayload }),
      });

      if (res.status === 401) throw new Error("Sesi habis, silakan masuk lagi.");
      if (res.status === 429) {
        const errJson = await res.json().catch(() => ({}));
        setQuotaData(errJson.detail || null);
        setQuotaOpen(true);
        throw new Error(errJson.detail?.message || "Batas kuota AI bulanan (FUP) telah tercapai.");
      }
      if (!res.ok || !res.body) throw new Error("Gagal menerima respons dari Tumara AI");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accRef.current += decoder.decode(value, { stream: true });
        const snapshot = accRef.current;
        setMessages((m) => {
          const n = [...m];
          n[n.length - 1] = {
            ...n[n.length - 1],
            content: snapshot,
            pending: false,
          };
          return n;
        });
      }
      fetchQuota();
    } catch (e) {
      toast.error(e?.message || "Gagal terhubung ke Tumara AI");
      setMessages((m) => {
        const n = [...m];
        n[n.length - 1] = {
          ...n[n.length - 1],
          content: "Maaf, aku lagi ada kendala sejenak. Coba kirim ulang ya.",
          pending: false,
        };
        return n;
      });
    } finally {
      setStreaming(false);
      refreshAiUsage?.();
    }
  };

  const clearSession = () => {
    if (messages.length > 0) {
      if (!window.confirm("Mulai sesi baru? Riwayat obrolan sesi ini akan dibersihkan.")) {
        return;
      }
    }
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setMessages([]);
    api.delete("/ai/chat/history").catch(() => {});
    toast.success("Sesi obrolan baru dimulai ✨");
  };

  const dismissPrivacy = () => {
    setPrivacyDismissed(true);
    try {
      localStorage.setItem("tumara_advisor_privacy_dismissed", "1");
    } catch {}
  };

  const activeQuota = aiUsage || quotaData;

  return (
    <div className="flex flex-col flex-1 min-h-0 h-[calc(100dvh-7.5rem)] lg:h-[calc(100dvh-5.5rem)]">
      {/* Sleek Compact Header */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-brand flex items-center justify-center shadow-md shadow-[var(--glow)] shrink-0">
            <Sparkles size={18} className="text-black" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-head font-extrabold text-base sm:text-lg leading-tight truncate">Tumara AI</h1>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-brand/15 text-brand border border-brand/30 shrink-0">
                CFO Pribadi
              </span>
            </div>
            <p className="hidden sm:block text-[11px] text-tsecondary truncate">
              Khusus analisis pengeluaran & perencanaan finansial
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {activeQuota && (
            <button
              onClick={() => setQuotaOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand/10 hover:bg-brand/20 text-brand text-[11px] font-semibold border border-brand/25 transition-colors"
              title="Cek Kuota & Fair Usage Policy"
            >
              <Sparkles size={12} />
              <span>
                FUP: {activeQuota.chats_used || 0}/{activeQuota.chats_limit || 100}
              </span>
            </button>
          )}
          <button
            onClick={clearSession}
            data-testid="clear-chat-button"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-elevated hover:bg-elevated/80 text-tsecondary hover:text-tprimary text-[11px] font-medium transition-colors border border-borderc"
            title="Bersihkan obrolan dan mulai sesi baru"
          >
            <RotateCcw size={12} />
            <span className="hidden xs:inline sm:inline">Sesi Baru</span>
          </button>
        </div>
      </div>

      {/* Dismissible & Compact Ephemeral Privacy Banner */}
      {!privacyDismissed && (
        <div className="rounded-xl px-3 py-1.5 sm:py-2 bg-elevated/60 border border-borderc flex items-center justify-between gap-2 text-xs mb-2 text-tsecondary shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck size={14} className="text-brand shrink-0" />
            <span className="text-[11px] sm:text-xs truncate">
              <strong className="text-tprimary">Sesi Privat:</strong> Obrolan tidak disimpan di server demi privasi penuh & hemat kuota.
            </span>
          </div>
          <button
            onClick={dismissPrivacy}
            className="p-1 hover:bg-elevated rounded text-tmuted hover:text-tprimary transition-colors shrink-0"
            title="Tutup pemberitahuan"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 py-1"
        data-testid="chat-messages"
      >
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="text-brand" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-6">
            <div className="w-14 h-14 rounded-2xl bg-elevated flex items-center justify-center mb-3 pulse-ring">
              <Sparkles size={26} className="text-brand" />
            </div>
            <h2 className="font-head font-bold text-base sm:text-lg text-tprimary">
              Halo! Aku Tumara AI 👋
            </h2>
            <p className="text-xs sm:text-sm text-tsecondary mt-1 max-w-sm leading-relaxed">
              Aku siap membantumu menganalisa pengeluaran, mengecek anggaran, dan merencanakan
              tujuan tabungan berdasarkan data keuanganmu.
            </p>

            <div className="grid sm:grid-cols-2 gap-2 mt-5 w-full max-w-md">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  data-testid="chat-suggestion"
                  className="text-left text-xs bg-surface border border-borderc rounded-xl px-3 py-2.5 hover:border-brand/60 text-tprimary hover:bg-elevated/40 transition-colors shadow-sm"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} user={user} />)
        )}
      </div>

      {/* Input box */}
      <div className="mt-2 flex items-end gap-2 bg-surface border border-borderc rounded-2xl p-1.5 sm:p-2 focus-within:border-brand transition-colors shadow-sm shrink-0">
        <textarea
          data-testid="ai-advisor-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="Tanya seputar pengeluaran, anggaran, atau dompetmu..."
          className="flex-1 bg-transparent resize-none px-3 py-2 text-xs sm:text-sm focus:outline-none max-h-28 text-tprimary placeholder:text-tmuted leading-relaxed"
        />
        <button
          data-testid="ai-advisor-send-button"
          onClick={() => send()}
          disabled={streaming || !input.trim()}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand text-black flex items-center justify-center disabled:opacity-40 hover:brightness-110 transition shrink-0"
        >
          {streaming ? <Spinner size={16} /> : <Send size={16} />}
        </button>
      </div>

      <AiQuotaModal
        open={quotaOpen}
        onClose={() => setQuotaOpen(false)}
        quotaData={quotaData}
        onRedeemed={() => fetchQuota()}
      />
    </div>
  );
}

function Bubble({ m, user }) {
  const isUser = m.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-2.5 sm:gap-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <div
        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden shadow-sm ${
          isUser ? "bg-elevated" : "bg-brand shadow-emerald-500/20"
        }`}
      >
        {isUser ? (
          <img
            src={getUserAvatar(user)}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <Sparkles size={14} className="text-black" />
        )}
      </div>
      <div
        className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${
          isUser
            ? "bg-brand text-black rounded-tr-sm font-medium whitespace-pre-wrap shadow-sm"
            : "bg-surface border border-borderc rounded-tl-sm text-tprimary shadow-sm"
        }`}
      >
        {isUser ? (
          m.content
        ) : m.content ? (
          <div>
            <FormattedMessage content={m.content} />
            {m.pending && (
              <span className="inline-flex gap-1 pt-1.5 opacity-70">
                <Dot />
                <Dot d={0.15} />
                <Dot d={0.3} />
              </span>
            )}
          </div>
        ) : m.pending ? (
          <span className="inline-flex gap-1 py-1">
            <Dot />
            <Dot d={0.15} />
            <Dot d={0.3} />
          </span>
        ) : null}
      </div>
    </motion.div>
  );
}

function Dot({ d = 0 }) {
  return (
    <motion.span
      className="w-1.5 h-1.5 rounded-full bg-tmuted inline-block"
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ repeat: Infinity, duration: 1, delay: d }}
    />
  );
}
