import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Send,
  User,
  RotateCcw,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import api, { API } from "../lib/api";
import { Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { getUserAvatar } from "../lib/avatars";
import FormattedMessage from "../components/FormattedMessage";

const SUGGESTIONS = [
  "Analisa pos pengeluaran terbesarku bulan ini",
  "Apakah alokasi budget bulanku masih aman?",
  "Berapa batas belanja harian yang disarankan?",
  "Bagaimana strategi mencapai target tabunganku?",
];

const SESSION_STORAGE_KEY = "tumara_advisor_session";

export default function Advisor() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef();
  const accRef = useRef("");

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

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] lg:h-[calc(100vh-7rem)]">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center shadow-lg shadow-[var(--glow)]">
            <Sparkles size={20} className="text-black" />
          </div>
          <div>
            <h1 className="font-head font-extrabold text-xl leading-tight">Tumara AI</h1>
            <p className="text-xs text-tsecondary">
              CFO pribadimu · Khusus analisis & perencanaan finansial
            </p>
          </div>
        </div>

        <button
          onClick={clearSession}
          data-testid="clear-chat-button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-elevated hover:bg-elevated/80 text-tsecondary hover:text-tprimary text-xs font-semibold transition-colors border border-borderc"
          title="Bersihkan obrolan dan mulai sesi baru"
        >
          <RotateCcw size={13} />
          <span>Sesi Baru</span>
        </button>
      </div>

      {/* Ephemeral Session & Privacy Banner */}
      <div className="rounded-xl p-2.5 sm:p-3 bg-elevated/60 border border-borderc flex items-start gap-2.5 text-xs mb-3 text-tsecondary">
        <ShieldCheck size={16} className="text-brand shrink-0 mt-0.5" />
        <div className="flex-1 leading-relaxed text-[11px] sm:text-xs">
          <span className="font-semibold text-tprimary">Sesi Privat & Sementara:</span> Obrolan
          ini tidak disimpan di database server demi menjaga privasi & efisiensi kuota. Percakapan
          hanya tersimpan di sesi browser aktif ini dan akan otomatis bersih saat tab ditutup atau
          sesi baru dimulai.
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-4 pr-1"
        data-testid="chat-messages"
      >
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="text-brand" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
            <div className="w-16 h-16 rounded-2xl bg-elevated flex items-center justify-center mb-4 pulse-ring">
              <Sparkles size={30} className="text-brand" />
            </div>
            <h2 className="font-head font-bold text-lg text-tprimary">
              Halo! Aku Tumara AI 👋
            </h2>
            <p className="text-sm text-tsecondary mt-1.5 max-w-sm leading-relaxed">
              Aku siap membantumu menganalisa pengeluaran, mengecek anggaran, dan merencanakan
              tujuan tabungan berdasarkan data keuanganmu.
            </p>

            <div className="grid sm:grid-cols-2 gap-2 mt-6 w-full max-w-md">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  data-testid="chat-suggestion"
                  className="text-left text-xs bg-surface border border-borderc rounded-xl px-3.5 py-3 hover:border-brand/60 text-tprimary hover:bg-elevated/40 transition-colors shadow-sm"
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
      <div className="mt-3 flex items-end gap-2 bg-surface border border-borderc rounded-2xl p-2 focus-within:border-brand transition-colors shadow-sm">
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
          className="flex-1 bg-transparent resize-none px-3 py-2.5 text-sm focus:outline-none max-h-32 text-tprimary placeholder:text-tmuted"
        />
        <button
          data-testid="ai-advisor-send-button"
          onClick={() => send()}
          disabled={streaming || !input.trim()}
          className="w-10 h-10 rounded-xl bg-brand text-black flex items-center justify-center disabled:opacity-40 hover:brightness-110 transition shrink-0"
        >
          {streaming ? <Spinner size={18} /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}

function Bubble({ m, user }) {
  const isUser = m.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <div
        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 overflow-hidden shadow-sm ${
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
          <Sparkles size={16} className="text-black" />
        )}
      </div>
      <div
        className={`max-w-[88%] sm:max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
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
