import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Copy,
  Check,
  UserPlus,
  Crown,
  LogIn,
  Trash2,
  Link2,
  Pencil,
  LogOut,
  Share2,
  Activity,
  Users,
  PieChart,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
} from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { formatRp, formatDate } from "../lib/format";
import { catMeta } from "../lib/constants";
import { Card, Button, Input, Spinner, Badge, Modal } from "../components/ui";

const EMOJI_OPTIONS = ["🏠", "🏡", "🏰", "🌴", "⛺", "⛵", "🛋️", "🍲", "☕", "🌺", "🐾", "🪴"];

export default function Household() {
  const { user, checkAuth } = useAuth();
  const { privacy } = useTheme();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState(null);
  const [copied, setCopied] = useState(false);
  const [joinCode, setJoinCode] = useState(
    localStorage.getItem("tumara-invite") || localStorage.getItem("nusa-invite") || ""
  );
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Edit Household Identity state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("🏠");
  const [savingEdit, setSavingEdit] = useState(false);

  const load = () =>
    api
      .get("/household")
      .then((r) => {
        setData(r.data);
        if (r.data.invites?.[0]) setInvite(r.data.invites[0]);
        if (r.data.household) {
          setEditName(r.data.household.name || "");
          setEditEmoji(r.data.household.emoji_icon || "🏠");
        }
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const createInvite = async () => {
    try {
      const { data: inv } = await api.post("/household/invite", {});
      setInvite(inv);
      toast.success("Undangan berhasil dibuat!");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal membuat undangan");
    }
  };

  const inviteLink = invite ? `${window.location.origin}/household?code=${invite.code}` : "";

  const copy = () => {
    navigator.clipboard?.writeText(inviteLink);
    setCopied(true);
    toast.success("Link undangan disalin ke clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const text = encodeURI(
      `Hai! Yuk gabung ke rumah tangga "${data?.household?.name || "Keluarga"}" di Tumara untuk kelola keuangan bareng:\n\n${inviteLink}\n\nKode: ${invite?.code}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const join = async () => {
    if (!joinCode.trim()) return toast.error("Masukkan kode undangan");
    setJoining(true);
    try {
      await api.post("/household/join", { code: joinCode.trim() });
      localStorage.removeItem("tumara-invite");
      localStorage.removeItem("nusa-invite");
      toast.success("Berhasil bergabung ke rumah tangga! 🏠");
      await checkAuth();
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal bergabung");
    } finally {
      setJoining(false);
    }
  };

  const removeMember = async (uid) => {
    if (!window.confirm("Keluarkan anggota ini dari rumah tangga?")) return;
    try {
      await api.delete(`/household/members/${uid}`);
      toast.success("Anggota berhasil dikeluarkan");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal mengeluarkan anggota");
    }
  };

  const leaveHousehold = async () => {
    if (!window.confirm("Apakah kamu yakin ingin keluar dari rumah tangga ini? Kamu akan kembali memiliki ruang keuangan mandiri.")) return;
    setLeaving(true);
    try {
      await api.post("/household/leave");
      toast.success("Kamu telah keluar dari rumah tangga.");
      await checkAuth();
      navigate("/dashboard");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal keluar");
    } finally {
      setLeaving(false);
    }
  };

  const saveIdentity = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return toast.error("Nama rumah tangga tidak boleh kosong");
    setSavingEdit(true);
    try {
      await api.put("/household", { name: editName.trim(), emoji_icon: editEmoji });
      toast.success("Identitas rumah tangga berhasil diperbarui!");
      setEditOpen(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal memperbarui");
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} className="text-brand" />
      </div>
    );
  }

  const isAdmin = data?.role === "admin";
  const members = data?.members || [];
  const analytics = data?.analytics || { total_spent: 0, total_income: 0 };
  const activities = data?.activity_feed || [];
  const totalSpent = analytics.total_spent || 0;

  // Find partner member
  const me = members.find((m) => m.user_id === user?.user_id) || user;
  const partner = members.find((m) => m.user_id !== user?.user_id);

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-head font-extrabold flex items-center gap-2.5">
            <span>{data?.household?.emoji_icon || "🏠"}</span>
            <span>{data?.household?.name || "Rumah Tangga"}</span>
          </h1>
          <p className="text-tsecondary text-sm mt-1">
            Kelola keuangan bersama pasangan — arus kas, dompet, dan wawasan digabung secara transparan.
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setEditName(data?.household?.name || "");
              setEditEmoji(data?.household?.emoji_icon || "🏠");
              setEditOpen(true);
            }}
            className="self-start sm:self-auto"
          >
            <Pencil size={15} /> Edit Identitas
          </Button>
        )}
      </div>

      {/* Hero Overview & Partner Split */}
      {members.length > 1 ? (
        <Card className="relative overflow-hidden border-brand/20 bg-gradient-to-br from-surface via-surface to-elevated/40">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
                <PieChart size={18} />
              </div>
              <div>
                <h2 className="font-head font-bold text-base">Pembagian Belanja Bulan Ini</h2>
                <p className="text-xs text-tmuted">Perbandingan kontribusi pengeluaran pasangan</p>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-elevated text-tsecondary border border-borderc">
              Total {formatRp(totalSpent, privacy)}
            </span>
          </div>

          {/* Visual Split Ratio Bar */}
          {totalSpent > 0 ? (
            <div className="space-y-2 mb-6">
              <div className="h-3.5 w-full bg-elevated rounded-full overflow-hidden flex p-0.5 border border-borderc">
                {members.map((m, idx) => {
                  const pct = m.spent_percentage || 0;
                  if (pct <= 0) return null;
                  const color = idx === 0 ? "bg-brand" : "bg-cyan";
                  return (
                    <div
                      key={m.user_id}
                      style={{ width: `${pct}%` }}
                      className={`${color} h-full rounded-full transition-all duration-500`}
                      title={`${m.name}: ${pct}%`}
                    />
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-xs font-semibold px-1">
                {members.map((m, idx) => {
                  const color = idx === 0 ? "text-brand" : "text-cyan";
                  return (
                    <span key={m.user_id} className={`flex items-center gap-1.5 ${color}`}>
                      <span className="w-2 h-2 rounded-full bg-current" />
                      {m.name}: {m.spent_percentage || 0}%
                    </span>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-tmuted bg-elevated/40 rounded-xl mb-6">
              Belum ada transaksi pengeluaran bersama yang tercatat bulan ini.
            </div>
          )}

          {/* Side-by-side Member Contribution Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {members.map((m, idx) => {
              const isUserMe = m.user_id === user?.user_id;
              const accentColor = idx === 0 ? "border-brand/30" : "border-cyan/30";
              const tagColor = idx === 0 ? "var(--brand)" : "var(--cyan)";

              return (
                <div
                  key={m.user_id}
                  className={`bg-elevated/80 rounded-2xl p-4 border ${accentColor} flex flex-col justify-between`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <img
                      src={m.picture || `https://api.dicebear.com/7.x/notionists/svg?seed=${m.name}`}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover bg-surface border border-borderc"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate flex items-center gap-1.5">
                        {m.name} {isUserMe && <span className="text-[11px] font-normal text-tmuted">(Kamu)</span>}
                        {m.role === "admin" && <Crown size={13} className="text-amber shrink-0" />}
                      </p>
                      <p className="text-xs text-tmuted truncate">{m.email}</p>
                    </div>
                    <Badge color={tagColor}>
                      {m.spent_percentage || 0}%
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-borderc/40 text-xs">
                    <div>
                      <p className="text-[11px] text-tmuted">Belanja Dicatat</p>
                      <p className={`font-mono font-bold text-tprimary mt-0.5 ${privacy ? "privacy-blur" : ""}`}>
                        {formatRp(m.total_spent || 0, privacy)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-tmuted">Jumlah Transaksi</p>
                      <p className="font-mono font-bold text-tprimary mt-0.5">
                        {m.tx_count || 0} transaksi
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card className="bg-gradient-to-r from-brand/10 via-elevated to-surface border-brand/20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-brand/20 text-brand">
                <Sparkles size={13} /> Pasangan Belum Bergabung
              </span>
              <h2 className="text-lg font-bold font-head text-tprimary pt-1">Kelola Keuangan Jadi 2x Lebih Rapi Bareng Pasangan</h2>
              <p className="text-xs text-tsecondary max-w-lg leading-relaxed">
                Undang pasanganmu ke rumah tangga ini. Kalian dapat mencatat belanja bersama, memantau batas anggaran bersama, dan melihat arus kas tanpa rahasia.
              </p>
            </div>
            {isAdmin && data.can_invite && !invite && (
              <Button onClick={createInvite} size="sm" className="whitespace-nowrap shrink-0">
                <UserPlus size={16} /> Undang Pasangan
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Member Management List */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-head font-bold flex items-center gap-2">
            <Users size={18} className="text-brand" /> Anggota Rumah Tangga ({members.length}/{data.max_members})
          </h2>
          <span className="text-xs text-tmuted">Maksimal 2 orang (Partner)</span>
        </div>

        <div className="space-y-2.5">
          {members.map((m) => {
            const isUserMe = m.user_id === user?.user_id;

            return (
              <div
                key={m.user_id}
                className="flex items-center gap-3 bg-elevated rounded-xl p-3 sm:p-3.5 border border-borderc/40"
              >
                <img
                  src={m.picture || `https://api.dicebear.com/7.x/notionists/svg?seed=${m.name}`}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover bg-surface border border-borderc"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                    {m.name} {isUserMe && <span className="text-xs font-normal text-tmuted">(Kamu)</span>}
                    {m.role === "admin" && <Crown size={14} className="text-amber shrink-0" />}
                  </p>
                  <p className="text-xs text-tmuted truncate">{m.email}</p>
                </div>

                <Badge color={m.role === "admin" ? "var(--amber)" : "var(--cyan)"}>
                  {m.role === "admin" ? "Admin" : "Partner"}
                </Badge>

                {isAdmin && m.role !== "admin" && (
                  <button
                    onClick={() => removeMember(m.user_id)}
                    title="Keluarkan anggota"
                    className="p-2 rounded-lg hover:bg-surface text-tmuted hover:text-rose transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}

                {!isAdmin && isUserMe && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={leaveHousehold}
                    disabled={leaving}
                    className="text-rose hover:text-rose hover:bg-rose/10 text-xs px-2.5"
                  >
                    {leaving ? <Spinner size={14} /> : <LogOut size={14} />} Keluar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Invite Partner Section */}
      {isAdmin && data.can_invite && (
        <Card className="border-brand/20">
          <h2 className="font-head font-bold flex items-center gap-2 mb-1">
            <UserPlus size={18} className="text-brand" /> Undang Pasangan
          </h2>
          <p className="text-sm text-tsecondary mb-4">
            Bagikan link atau kode undangan ini. Pasanganmu cukup mendaftar atau login dengan Google untuk langsung bergabung.
          </p>

          {!invite ? (
            <Button onClick={createInvite} size="sm">
              <Link2 size={16} /> Buat Tautan Undangan
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-elevated rounded-xl p-2.5 sm:pl-4 border border-borderc">
                <span className="flex-1 text-xs sm:text-sm font-mono truncate text-tsecondary">
                  {inviteLink}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="secondary" onClick={copy}>
                    {copied ? <Check size={14} className="text-brand" /> : <Copy size={14} />}
                    {copied ? "Tersalin" : "Salin Link"}
                  </Button>
                  <Button size="sm" onClick={shareWhatsApp} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                    <Share2 size={14} /> WhatsApp
                  </Button>
                </div>
              </div>
              <p className="text-xs text-tmuted">
                Atau masukkan kode ini saat registrasi:{" "}
                <span className="font-mono font-bold text-tprimary bg-elevated px-2 py-0.5 rounded border border-borderc">
                  {invite.code}
                </span>
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Recent Household Activity Stream */}
      {activities.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="font-head font-bold flex items-center gap-2">
              <Activity size={18} className="text-brand" /> Aktivitas Finansial Terakhir
            </h2>
            <span className="text-xs text-tmuted">Riwayat mutasi bersama</span>
          </div>

          <div className="space-y-2">
            {activities.map((act) => {
              const actMember = members.find((m) => m.user_id === act.member_id);
              const mMeta = catMeta(act.category);
              const isIncome = act.type === "income";
              const isTransfer = act.type === "transfer";

              return (
                <div
                  key={act.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-elevated/50 hover:bg-elevated transition-colors border border-borderc/30 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={
                        actMember?.picture ||
                        `https://api.dicebear.com/7.x/notionists/svg?seed=${actMember?.name || "user"}`
                      }
                      alt=""
                      className="w-7 h-7 rounded-full object-cover bg-surface border border-borderc shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-tprimary truncate">
                        {act.note || act.category}{" "}
                        <span className="text-[11px] font-normal text-tmuted">
                          oleh {actMember?.name || "Anggota"}
                        </span>
                      </p>
                      <p className="text-[10px] text-tmuted">
                        {formatDate(act.date || act.created_at)} · {act.category}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`font-mono font-bold shrink-0 ${privacy ? "privacy-blur" : ""} ${
                      isIncome ? "text-brand" : isTransfer ? "text-cyan" : "text-rose"
                    }`}
                  >
                    {isIncome ? "+" : isTransfer ? "" : "-"}
                    {formatRp(act.amount, privacy)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Join Another Household */}
      <Card className="bg-surface/60">
        <h2 className="font-head font-bold flex items-center gap-2 mb-1 text-sm sm:text-base">
          <LogIn size={17} className="text-cyan" /> Punya Kode Undangan Lain?
        </h2>
        <p className="text-xs text-tsecondary mb-3.5 leading-relaxed">
          Pindah atau gabung ke rumah tangga pasanganmu menggunakan kode undangan.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Masukkan kode 6 digit"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            className="flex-1 font-mono text-sm"
          />
          <Button onClick={join} disabled={joining} size="sm">
            {joining ? <Spinner size={16} /> : "Gabung Rumah Tangga"}
          </Button>
        </div>
      </Card>

      {/* Edit Household Identity Modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Identitas Rumah Tangga"
        size="sm"
      >
        <form onSubmit={saveIdentity} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-tsecondary block mb-2">
              Pilih Ikon Emoji
            </label>
            <div className="grid grid-cols-6 gap-2">
              {EMOJI_OPTIONS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setEditEmoji(em)}
                  className={`h-11 rounded-xl flex items-center justify-center text-xl transition-all ${
                    editEmoji === em
                      ? "bg-brand/20 border-2 border-brand scale-105"
                      : "bg-elevated hover:bg-elevated/80 border border-borderc"
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Nama Rumah Tangga"
            placeholder="Contoh: Keluarga Budi & Sarah"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEditOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" size="sm" disabled={savingEdit}>
              {savingEdit ? <Spinner size={16} /> : "Simpan Perubahan"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
