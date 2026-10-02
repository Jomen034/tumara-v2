import React, { useEffect, useState } from "react";
import * as Icons from "lucide-react";
import {
  Target,
  Sparkles,
  PartyPopper,
  Pencil,
  Plus,
  Clock,
  Calendar,
  History,
  TrendingUp,
  Receipt,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import clsx from "clsx";
import api from "../lib/api";
import { formatRp, formatDate } from "../lib/format";
import { useTheme } from "../context/ThemeContext";
import { Modal, Button, Badge, Progress, Spinner } from "./ui";

export default function GoalDetailModal({
  goal,
  open,
  onClose,
  onEdit,
  onDeposit,
}) {
  const { privacy } = useTheme();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !goal?.id) return;
    setLoading(true);
    api
      .get(`/goals/${goal.id}/detail`)
      .then((res) => setDetail(res.data))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [open, goal?.id]);

  if (!goal) return null;

  const currentGoal = detail?.goal || goal;
  const metrics = detail?.metrics || {
    saved_amount: currentGoal.saved_amount || 0,
    target_amount: currentGoal.target_amount || 0,
    remaining_amount: Math.max(
      0,
      (currentGoal.target_amount || 0) - (currentGoal.saved_amount || 0)
    ),
    progress_pct:
      currentGoal.target_amount > 0
        ? Math.round(
            ((currentGoal.saved_amount || 0) / currentGoal.target_amount) * 100
          )
        : 0,
    months_left: null,
    monthly_recommendation: null,
    deposit_count: 0,
  };
  const txns = detail?.transactions || [];
  const isDone = metrics.progress_pct >= 100;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={currentGoal.title}
      testid="goal-detail-modal"
      size="md"
    >
      <div className="space-y-5">
        {/* Hero Goal Header */}
        <div className="rounded-2xl bg-elevated/60 border border-borderc p-4 sm:p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="text-4xl sm:text-5xl shrink-0 p-2 rounded-2xl bg-surface border border-borderc">
              {currentGoal.emoji || "🎯"}
            </span>
            <div className="min-w-0">
              <h3 className="font-bold text-lg sm:text-xl text-tprimary truncate">
                {currentGoal.title}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge color={isDone ? "var(--brand)" : "var(--cyan)"}>
                  {isDone ? (
                    <span className="flex items-center gap-1">
                      <PartyPopper size={12} /> Target Tercapai!
                    </span>
                  ) : (
                    "🎯 Dalam Progress"
                  )}
                </Badge>
                {currentGoal.deadline && (
                  <span className="text-xs text-tmuted flex items-center gap-1">
                    <Calendar size={12} /> Target: {formatDate(currentGoal.deadline)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              onEdit?.(currentGoal);
            }}
            className="p-2.5 rounded-xl bg-surface border border-borderc hover:bg-elevated text-tsecondary hover:text-tprimary transition-colors shrink-0"
            title="Edit Tujuan"
          >
            <Pencil size={16} />
          </button>
        </div>

        {/* Progress & Trio Metrics */}
        <div className="rounded-2xl bg-surface border border-borderc p-4 sm:p-5 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-semibold text-tmuted uppercase tracking-wider">
                Progress Tabungan
              </span>
              <span
                className="font-mono font-bold text-sm"
                style={{ color: isDone ? "var(--brand)" : currentGoal.color || "var(--cyan)" }}
              >
                {metrics.progress_pct}% Tercapai
              </span>
            </div>
            <Progress
              value={metrics.progress_pct}
              color={isDone ? "var(--brand)" : currentGoal.color || "var(--cyan)"}
              className="h-2.5"
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-borderc/40 text-xs">
            <div className="bg-elevated/60 rounded-xl p-2.5">
              <span className="text-tmuted text-[10px] uppercase font-semibold block">
                Terkumpul
              </span>
              <p
                className={`font-mono font-bold text-sm text-brand mt-0.5 truncate ${
                  privacy ? "privacy-blur" : ""
                }`}
              >
                {formatRp(metrics.saved_amount, privacy)}
              </p>
            </div>

            <div className="bg-elevated/60 rounded-xl p-2.5">
              <span className="text-tmuted text-[10px] uppercase font-semibold block">
                Target
              </span>
              <p
                className={`font-mono font-bold text-sm text-tprimary mt-0.5 truncate ${
                  privacy ? "privacy-blur" : ""
                }`}
              >
                {formatRp(metrics.target_amount, privacy)}
              </p>
            </div>

            <div className="bg-elevated/60 rounded-xl p-2.5">
              <span className="text-tmuted text-[10px] uppercase font-semibold block">
                Sisa Kurang
              </span>
              <p
                className={`font-mono font-bold text-sm ${
                  isDone ? "text-brand" : "text-rose"
                } mt-0.5 truncate ${privacy ? "privacy-blur" : ""}`}
              >
                {isDone ? "Lunas" : formatRp(metrics.remaining_amount, privacy)}
              </p>
            </div>
          </div>
        </div>

        {/* Smart Monthly Recommendation Box */}
        {metrics.monthly_recommendation && !isDone && (
          <div className="rounded-2xl bg-cyan/10 border border-cyan/25 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-cyan">
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} /> Rekomendasi Nabung Cerdas
              </span>
              {metrics.months_left != null && (
                <span className="font-mono">{metrics.months_left} bulan lagi</span>
              )}
            </div>
            <p className="text-sm text-tprimary leading-relaxed">
              Nabung rutin{" "}
              <strong className="text-cyan font-mono font-bold">
                ~{formatRp(metrics.monthly_recommendation, privacy)} / bulan
              </strong>{" "}
              untuk mencapai target tepat waktu sebelum deadline{" "}
              <span className="font-semibold">{formatDate(currentGoal.deadline)}</span>.
            </p>
          </div>
        )}

        {isDone && (
          <div className="rounded-2xl bg-brand/10 border border-brand/30 p-4 text-center space-y-1">
            <p className="text-sm font-bold text-brand flex items-center justify-center gap-1.5">
              <PartyPopper size={16} /> Selamat! Target telah tercapai sepenuhnya!
            </p>
            <p className="text-xs text-tmuted">
              Dana tujuan ini sudah siap digunakan sesuai rencana impianmu.
            </p>
          </div>
        )}

        {/* Riwayat Setoran */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-tmuted uppercase tracking-wider flex items-center gap-1.5">
              <History size={13} className="text-brand" /> Riwayat Setoran (
              {metrics.deposit_count || txns.length})
            </h4>
          </div>

          {loading ? (
            <div className="flex justify-center py-6">
              <Spinner className="text-brand" size={24} />
            </div>
          ) : txns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-borderc py-6 text-center bg-elevated/20">
              <Receipt size={24} className="text-tmuted mx-auto mb-1.5" />
              <p className="font-semibold text-xs text-tprimary">Belum ada setoran tercatat</p>
              <p className="text-[11px] text-tmuted mt-0.5">
                Tekan tombol Setor untuk mulai menabung ke tujuan ini.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-borderc bg-surface divide-y divide-borderc/40 max-h-56 overflow-y-auto">
              {txns.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 text-xs hover:bg-elevated/40 transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-tprimary truncate">
                      {tx.note || "Setoran Nabung"}
                    </p>
                    <p className="text-[10px] text-tmuted mt-0.5">
                      {formatDate(tx.date || tx.created_at)}
                    </p>
                  </div>
                  <span
                    className={`font-mono font-bold text-brand shrink-0 ${
                      privacy ? "privacy-blur" : ""
                    }`}
                  >
                    +{formatRp(tx.amount, privacy)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={() => {
              onClose();
              onEdit?.(currentGoal);
            }}
            className="w-full text-xs sm:text-sm py-2.5 sm:py-3 px-3 sm:px-4 whitespace-nowrap justify-center"
          >
            <Pencil size={14} className="shrink-0" /> Edit Tujuan
          </Button>

          <Button
            onClick={() => {
              onClose();
              onDeposit?.(currentGoal);
            }}
            className="w-full text-xs sm:text-sm py-2.5 sm:py-3 px-3 sm:px-4 whitespace-nowrap justify-center"
          >
            <Plus size={15} className="shrink-0" /> Setor Dana
          </Button>
        </div>
      </div>
    </Modal>
  );
}
