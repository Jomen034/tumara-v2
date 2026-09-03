import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Copy, Check, UserPlus, Crown, LogIn, Trash2, Link2 } from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Card, Button, Input, Spinner, Badge } from "../components/ui";

export default function Household() {
  const { checkAuth } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState(null);
  const [copied, setCopied] = useState(false);
  const [joinCode, setJoinCode] = useState(localStorage.getItem("nusa-invite") || "");
  const [joining, setJoining] = useState(false);

  const load = () => api.get("/household").then((r) => {
    setData(r.data);
    if (r.data.invites?.[0]) setInvite(r.data.invites[0]);
  }).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const createInvite = async () => {
    try {
      const { data } = await api.post("/household/invite", {});
      setInvite(data);
      toast.success("Undangan dibuat!");
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal membuat undangan"); }
  };

  const inviteLink = invite ? `${window.location.origin}/household?code=${invite.code}` : "";
  const copy = () => {
    navigator.clipboard?.writeText(inviteLink);
    setCopied(true); toast.success("Link disalin!");
    setTimeout(() => setCopied(false), 1800);
  };

  const join = async () => {
    if (!joinCode.trim()) return toast.error("Masukkan kode undangan");
    setJoining(true);
    try {
      await api.post("/household/join", { code: joinCode.trim() });
      localStorage.removeItem("nusa-invite");
      toast.success("Berhasil gabung rumah tangga! 🏠");
      await checkAuth();
      navigate("/dashboard");
    } catch (e) { toast.error(e?.response?.data?.detail || "Gagal bergabung"); }
    finally { setJoining(false); }
  };

  const removeMember = async (uid) => {
    if (!window.confirm("Keluarkan anggota ini dari rumah tangga?")) return;
    try { await api.delete(`/household/members/${uid}`); toast.success("Anggota dikeluarkan"); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Gagal"); }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size={30} className="text-brand" /></div>;

  const isAdmin = data?.role === "admin";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-head font-extrabold">Rumah Tangga</h1>
        <p className="text-tsecondary text-sm mt-1">Kelola keuangan bareng pasangan — data & laporan digabung.</p>
      </div>

      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-elevated flex items-center justify-center text-2xl">{data?.household?.emoji_icon || "🏠"}</div>
          <div>
            <p className="font-head font-bold text-lg">{data?.household?.name}</p>
            <p className="text-xs text-tmuted">{data.members.length} dari {data.max_members} anggota</p>
          </div>
        </div>
        <div className="space-y-2" data-testid="members-list">
          {data.members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3 bg-elevated rounded-xl p-3">
              <img src={m.picture || `https://api.dicebear.com/7.x/notionists/svg?seed=${m.name}`} alt="" className="w-9 h-9 rounded-full object-cover bg-surface" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                  {m.name} {m.role === "admin" && <Crown size={13} className="text-amber" />}
                </p>
                <p className="text-xs text-tmuted truncate">{m.email}</p>
              </div>
              <Badge color={m.role === "admin" ? "var(--amber)" : "var(--cyan)"}>{m.role === "admin" ? "Admin" : "Partner"}</Badge>
              {isAdmin && m.role !== "admin" && (
                <button onClick={() => removeMember(m.user_id)} data-testid={`remove-member-${m.user_id}`} className="p-1.5 rounded-lg hover:bg-surface text-tmuted hover:text-rose"><Trash2 size={15} /></button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Invite */}
      {isAdmin && data.can_invite && (
        <Card>
          <h2 className="font-head font-bold flex items-center gap-2 mb-1"><UserPlus size={18} className="text-brand" /> Undang Pasangan</h2>
          <p className="text-sm text-tsecondary mb-4">Bagikan link ini. Mereka cukup login dengan Google untuk gabung.</p>
          {!invite ? (
            <Button onClick={createInvite} data-testid="create-invite-button"><Link2 size={16} /> Buat Link Undangan</Button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-elevated rounded-xl p-2 pl-4">
                <span className="flex-1 text-sm font-mono truncate text-tsecondary">{inviteLink}</span>
                <Button size="sm" onClick={copy} data-testid="copy-invite-button">{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Tersalin" : "Salin"}</Button>
              </div>
              <p className="text-xs text-tmuted">Kode: <span className="font-mono font-semibold text-tprimary">{invite.code}</span></p>
            </div>
          )}
        </Card>
      )}

      {isAdmin && !data.can_invite && data.members.length >= data.max_members && (
        <Card className="text-sm text-tsecondary">Rumah tangga sudah penuh (maks {data.max_members} anggota di paket gratis).</Card>
      )}

      {/* Join another household */}
      <Card>
        <h2 className="font-head font-bold flex items-center gap-2 mb-1"><LogIn size={18} className="text-cyan" /> Punya Kode Undangan?</h2>
        <p className="text-sm text-tsecondary mb-4">Gabung ke rumah tangga pasanganmu. Data pribadimu saat ini akan digantikan oleh data bersama.</p>
        <div className="flex gap-2">
          <Input placeholder="Masukkan kode" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} data-testid="join-code-input" className="flex-1" />
          <Button onClick={join} disabled={joining} data-testid="join-household-button">{joining ? <Spinner size={16} /> : "Gabung"}</Button>
        </div>
      </Card>
    </div>
  );
}
