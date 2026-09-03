import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Send, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import api, { API } from "../lib/api";
import { Spinner } from "../components/ui";

const SUGGESTIONS = [
  "Analisa kondisi keuanganku bulan ini",
  "Gimana caraku kurangi pengeluaran?",
  "Berapa idealnya aku nabung tiap bulan?",
  "Kasih tips capai tujuan menabungku",
];

export default function Advisor() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef();

  useEffect(() => {
    api.get("/ai/chat/history").then((r) => setMessages(r.data)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg, id: `u-${Date.now()}` }, { role: "assistant", content: "", id: `a-${Date.now()}`, pending: true }]);
    setStreaming(true);
    try {
      const res = await fetch(`${API}/ai/chat`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      if (!res.ok || !res.body) throw new Error("bad response");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const cur = acc;
        setMessages((m) => { const n = [...m]; n[n.length - 1] = { ...n[n.length - 1], content: cur, pending: false }; return n; });
      }
    } catch {
      toast.error("Gagal terhubung ke Nusa AI");
      setMessages((m) => { const n = [...m]; n[n.length - 1] = { ...n[n.length - 1], content: "Maaf, aku lagi ada kendala. Coba lagi ya.", pending: false }; return n; });
    } finally {
      setStreaming(false);
    }
  };

  const clear = async () => {
    if (!window.confirm("Hapus semua riwayat chat?")) return;
    await api.delete("/ai/chat/history"); setMessages([]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] lg:h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center shadow-lg shadow-[var(--glow)]"><Sparkles size={20} className="text-black" /></div>
          <div>
            <h1 className="font-head font-extrabold text-xl leading-tight">Nusa AI</h1>
            <p className="text-xs text-tsecondary">CFO pribadimu · paham kondisimu</p>
          </div>
        </div>
        {messages.length > 0 && <button onClick={clear} data-testid="clear-chat-button" className="p-2 rounded-lg hover:bg-elevated text-tmuted hover:text-rose"><Trash2 size={17} /></button>}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-1" data-testid="chat-messages">
        {loading ? <div className="flex justify-center py-10"><Spinner className="text-brand" /></div> : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-elevated flex items-center justify-center mb-4 pulse-ring"><Sparkles size={30} className="text-brand" /></div>
            <h2 className="font-head font-bold text-lg">Halo! Aku Nusa 👋</h2>
            <p className="text-sm text-tsecondary mt-1 max-w-sm">Aku tahu kondisi keuanganmu. Tanya apa aja, aku kasih saran yang personal.</p>
            <div className="grid sm:grid-cols-2 gap-2 mt-6 w-full max-w-md">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} data-testid="chat-suggestion"
                  className="text-left text-sm bg-surface border border-borderc rounded-xl px-4 py-3 hover:border-brand transition-colors">{s}</button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} />)
        )}
      </div>

      <div className="mt-4 flex items-end gap-2 bg-surface border border-borderc rounded-2xl p-2 focus-within:border-brand transition-colors">
        <textarea data-testid="ai-advisor-chat-input" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1} placeholder="Tanya soal keuanganmu..."
          className="flex-1 bg-transparent resize-none px-3 py-2.5 text-sm focus:outline-none max-h-32 text-tprimary placeholder:text-tmuted" />
        <button data-testid="ai-advisor-send-button" onClick={() => send()} disabled={streaming || !input.trim()}
          className="w-10 h-10 rounded-xl bg-brand text-black flex items-center justify-center disabled:opacity-40 hover:brightness-110 transition shrink-0">
          {streaming ? <Spinner size={18} /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}

function Bubble({ m }) {
  const isUser = m.role === "user";
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isUser ? "bg-elevated" : "bg-brand"}`}>
        {isUser ? <User size={16} className="text-tsecondary" /> : <Sparkles size={16} className="text-black" />}
      </div>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${isUser ? "bg-brand text-black rounded-tr-sm" : "bg-surface border border-borderc rounded-tl-sm"}`}>
        {m.content || (m.pending && <span className="inline-flex gap-1"><Dot /><Dot d={0.15} /><Dot d={0.3} /></span>)}
      </div>
    </motion.div>
  );
}

function Dot({ d = 0 }) {
  return <motion.span className="w-1.5 h-1.5 rounded-full bg-tmuted inline-block" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: d }} />;
}
