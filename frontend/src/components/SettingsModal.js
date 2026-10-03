import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  User,
  SlidersHorizontal,
  HardDrive,
  AlertTriangle,
  Moon,
  Sun,
  Eye,
  EyeOff,
  Download,
  Trash2,
  RefreshCw,
  Check,
  Crown,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Modal, Button, Input, Spinner, Badge } from "./ui";
import { AVATAR_CHARACTERS, AVATAR_DATA_URIS, getUserAvatar } from "../lib/avatars";

export default function SettingsModal({ open, onClose }) {
  const { user, checkAuth, logout } = useAuth();
  const { theme, toggleTheme, privacy, togglePrivacy } = useTheme();

  const [activeTab, setActiveTab] = useState("profil"); // 'profil' | 'preferensi' | 'data' | 'danger'

  // Profile state
  const [displayName, setDisplayName] = useState(user?.display_name || user?.name || "");
  const [avatarUrl, setAvatarUrl] = useState(getUserAvatar(user));
  const [savingProfile, setSavingProfile] = useState(false);

  // Backup state
  const [exporting, setExporting] = useState(false);

  // Danger Zone state
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || user.name || "");
      setAvatarUrl(getUserAvatar(user));
    }
  }, [user]);

  const selectAvatar = (char) => {
    setAvatarUrl(AVATAR_DATA_URIS[char.id]);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) return toast.error("Nama tampilan tidak boleh kosong");
    setSavingProfile(true);
    try {
      await api.put("/auth/profile", {
        display_name: displayName.trim(),
        picture: avatarUrl,
      });
      toast.success("Profil berhasil diperbarui!");
      await checkAuth();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal memperbarui profil");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const res = await api.get("/auth/export-all");
      const jsonStr = JSON.stringify(res.data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `tumara-backup-${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Cadangan data lengkap berhasil diunduh! 📦");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal mengunduh cadangan data");
    } finally {
      setExporting(false);
    }
  };

  const handleResetData = async () => {
    if (resetConfirmText.trim().toUpperCase() !== "RESET") {
      return toast.error("Ketik 'RESET' untuk mengonfirmasi");
    }
    if (!window.confirm("PERINGATAN: Seluruh riwayat transaksi, anggaran, tagihan, dan tujuan akan dihapus permanen. Lanjutkan?")) {
      return;
    }

    setIsResetting(true);
    try {
      await api.post("/auth/reset-data", { confirm_text: "RESET" });
      toast.success("Seluruh data finansial berhasil direset ke nol!");
      setResetConfirmText("");
      onClose();
      window.location.reload();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal mereset data");
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== "HAPUS") {
      return toast.error("Ketik 'HAPUS' untuk mengonfirmasi");
    }
    if (!window.confirm("PERINGATAN TERAKHIR: Akunmu akan dihapus selamanya dari sistem. Tindakan ini tidak dapat dibatalkan!")) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.delete("/auth/account", { data: { confirm_text: "HAPUS" } });
      toast.success("Akun berhasil dihapus. Sampai jumpa!");
      logout();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menghapus akun");
    } finally {
      setIsDeleting(false);
    }
  };

  const TABS = [
    { id: "profil", label: "Profil", icon: User },
    { id: "preferensi", label: "Tampilan", icon: SlidersHorizontal },
    { id: "data", label: "Cadangan", icon: HardDrive },
    { id: "danger", label: "Zona Bahaya", icon: AlertTriangle, danger: true },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pengaturan Akun"
      testid="settings-modal"
      size="md"
    >
      <div className="space-y-5">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-elevated rounded-2xl overflow-x-auto border border-borderc/40">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? t.danger
                      ? "bg-rose text-white shadow-md shadow-rose/20"
                      : "bg-surface text-brand shadow-md shadow-brand/10 border border-borderc"
                    : t.danger
                    ? "text-rose/80 hover:text-rose hover:bg-rose/10"
                    : "text-tsecondary hover:text-tprimary hover:bg-surface/50"
                }`}
              >
                <Icon size={14} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Profile */}
        {activeTab === "profil" && (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="flex items-center gap-4 bg-elevated/60 p-4 rounded-2xl border border-borderc/40">
              <img
                src={avatarUrl || getUserAvatar(user)}
                alt=""
                className="w-16 h-16 rounded-full object-cover bg-surface border-2 border-brand/30 shrink-0 shadow-md"
              />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-tprimary flex items-center gap-1.5">
                  {displayName || user?.name} {user?.role === "admin" && <Crown size={14} className="text-amber" />}
                </p>
                <p className="text-xs text-tmuted truncate">{user?.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge color={user?.role === "admin" ? "var(--amber)" : "var(--cyan)"}>
                    {user?.role === "admin" ? "Admin Rumah Tangga" : "Partner"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Avatar Character Chooser */}
            <div>
              <label className="text-xs font-semibold text-tsecondary block mb-2">
                Pilih Karakter Avatar (8 Pilihan Menarik & Simpel)
              </label>
              <div className="grid grid-cols-4 gap-2.5">
                {AVATAR_CHARACTERS.map((char) => {
                  const isSelected = avatarUrl === AVATAR_DATA_URIS[char.id];
                  return (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() => selectAvatar(char)}
                      className={`p-2 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${
                        isSelected
                          ? "border-brand bg-brand/10 shadow-sm ring-2 ring-brand/40"
                          : "border-borderc bg-elevated/40 hover:bg-elevated hover:border-brand/40"
                      }`}
                    >
                      <img
                        src={AVATAR_DATA_URIS[char.id]}
                        alt={char.name}
                        className="w-11 h-11 rounded-full shadow-sm"
                      />
                      <span className="text-[11px] font-semibold text-tprimary truncate">
                        {char.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Input
              label="Nama Tampilan (Display Name)"
              placeholder="Masukkan nama panggilanmu"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />

            <div className="flex justify-end pt-2">
              <Button type="submit" size="sm" disabled={savingProfile}>
                {savingProfile ? <Spinner size={16} /> : "Simpan Profil"}
              </Button>
            </div>
          </form>
        )}

        {/* Tab 2: Preferences */}
        {activeTab === "preferensi" && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-elevated/60 border border-borderc/40">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface border border-borderc flex items-center justify-center text-tsecondary">
                  {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
                </div>
                <div>
                  <p className="font-semibold text-sm text-tprimary">Tema Tampilan</p>
                  <p className="text-xs text-tmuted">Pilih antara tema gelap atau terang</p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={toggleTheme}
                className="text-xs"
              >
                {theme === "dark" ? "Mode Gelap" : "Mode Terang"}
              </Button>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-elevated/60 border border-borderc/40">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface border border-borderc flex items-center justify-center text-tsecondary">
                  {privacy ? <EyeOff size={18} /> : <Eye size={18} />}
                </div>
                <div>
                  <p className="font-semibold text-sm text-tprimary">Mode Privasi Saldo</p>
                  <p className="text-xs text-tmuted">Samarkan nominal uang saat berada di tempat umum</p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={togglePrivacy}
                className="text-xs"
              >
                {privacy ? "Privasi Aktif" : "Privasi Nonaktif"}
              </Button>
            </div>

            <div className="p-3.5 rounded-2xl bg-elevated/30 border border-borderc/30 text-center">
              <p className="text-xs font-semibold text-tprimary">Tumara Financial v2.0</p>
              <p className="text-[11px] text-tmuted mt-0.5">
                Dikembangkan dengan presisi dan keamanan data berbasis enkripsi sesi.
              </p>
            </div>
          </div>
        )}

        {/* Tab 3: Backup & Export */}
        {activeTab === "data" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-brand/5 border border-brand/20">
              <h3 className="font-bold text-sm text-tprimary flex items-center gap-2 mb-1">
                <HardDrive size={16} className="text-brand" /> Cadangan Mandiri (JSON)
              </h3>
              <p className="text-xs text-tsecondary leading-relaxed">
                Unduh salinan lengkap seluruh data rumah tanggamu (seluruh dompet, riwayat transaksi, alokasi anggaran, tagihan, dan tujuan keuangan) dalam format JSON terstruktur.
              </p>
              <div className="mt-4">
                <Button
                  onClick={handleExportBackup}
                  disabled={exporting}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  {exporting ? <Spinner size={16} /> : <Download size={16} />}
                  {exporting ? "Menyiapkan File..." : "Unduh Cadangan Lengkap (.json)"}
                </Button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-elevated/40 border border-borderc/40 text-xs text-tmuted">
              🔒 <strong className="text-tprimary">Jaminan Privasi:</strong> Data kamu 100% milikmu. File cadangan ini dapat kamu simpan di penyimpanan pribadi atau Google Drive sebagai arsip keamanan.
            </div>
          </div>
        )}

        {/* Tab 4: Danger Zone */}
        {activeTab === "danger" && (
          <div className="space-y-4">
            {/* Reset Data */}
            <div className="p-4 rounded-2xl border border-rose/30 bg-rose/5 space-y-3">
              <div className="flex items-center gap-2 text-rose font-bold text-sm">
                <RefreshCw size={16} />
                <span>Reset Seluruh Data Finansial</span>
              </div>
              <p className="text-xs text-tsecondary leading-relaxed">
                Menghapus seluruh riwayat transaksi, anggaran, tagihan, tujuan, dan mengembalikan saldo seluruh dompet ke Rp 0. Akun dan rumah tanggamu akan tetap aktif.
              </p>
              <div className="space-y-2 pt-1">
                <Input
                  label="Ketik 'RESET' untuk konfirmasi"
                  placeholder="RESET"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleResetData}
                  disabled={resetConfirmText.trim().toUpperCase() !== "RESET" || isResetting}
                  className="w-full sm:w-auto"
                >
                  {isResetting ? <Spinner size={16} /> : <Trash2 size={15} />}
                  Reset Data Finansial
                </Button>
              </div>
            </div>

            {/* Delete Account */}
            <div className="p-4 rounded-2xl border border-rose/50 bg-rose/10 space-y-3">
              <div className="flex items-center gap-2 text-rose font-bold text-sm">
                <ShieldAlert size={16} />
                <span>Hapus Akun Permanen</span>
              </div>
              <p className="text-xs text-tsecondary leading-relaxed">
                Menghapus akunmu secara permanen beserta sesi aktif dari server Tumara. Jika kamu adalah admin tunggal, seluruh data rumah tangga juga akan dihapus tuntas.
              </p>
              <div className="space-y-2 pt-1">
                <Input
                  label="Ketik 'HAPUS' untuk konfirmasi"
                  placeholder="HAPUS"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText.trim().toUpperCase() !== "HAPUS" || isDeleting}
                  className="w-full sm:w-auto bg-rose hover:bg-rose/90"
                >
                  {isDeleting ? <Spinner size={16} /> : <Trash2 size={15} />}
                  Hapus Akun Selamanya
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
