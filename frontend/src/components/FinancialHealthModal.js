import React from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  SlidersHorizontal,
  Target,
  Bot,
} from "lucide-react";
import { Modal, Button, Badge, Progress } from "./ui";

const PILLAR_ICONS = {
  net_worth: ShieldCheck,
  savings_rate: TrendingUp,
  budget: SlidersHorizontal,
  goals: Target,
};

export default function FinancialHealthModal({ open, onClose, data, onAction }) {
  if (!data) return null;

  const { score, status_label, summary, pillars = [], recommendations = [] } = data;

  const scoreColor =
    score >= 70 ? "var(--brand)" : score >= 45 ? "var(--amber)" : "var(--rose)";

  const getPillarBadge = (status) => {
    switch (status) {
      case "good":
        return { label: "Bagus", color: "var(--brand)", icon: CheckCircle2 };
      case "warning":
        return { label: "Perlu Dicek", color: "var(--amber)", icon: AlertTriangle };
      case "danger":
        return { label: "Kurang", color: "var(--rose)", icon: AlertTriangle };
      default:
        return { label: "Netral", color: "var(--cyan)", icon: Info };
    }
  };

  const getRecBadgeColor = (badge) => {
    switch (badge) {
      case "Prioritas":
        return "var(--rose)";
      case "Peringatan":
        return "var(--rose)";
      case "Penting":
        return "var(--amber)";
      case "AI Advisor":
        return "var(--cyan)";
      default:
        return "var(--brand)";
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Diagnosis Kesehatan Finansial"
      testid="financial-health-modal"
      size="md"
    >
      <div className="space-y-6">
        {/* Diagnostic Score Card */}
        <div className="rounded-2xl bg-elevated/70 border border-borderc p-5 sm:p-6 text-center relative overflow-hidden">
          <div
            className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-15 blur-2xl pointer-events-none"
            style={{ background: scoreColor }}
          />
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-28 h-28 mb-3">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 50}
                  strokeDashoffset={2 * Math.PI * 50 * (1 - score / 100)}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-head font-extrabold font-mono tracking-tight">{score}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-tmuted">/ 100</span>
              </div>
            </div>

            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-2"
              style={{ backgroundColor: `${scoreColor}20`, color: scoreColor }}
            >
              <Activity size={14} />
              Kondisi: {status_label}
            </div>

            <p className="text-sm text-tsecondary leading-relaxed max-w-md mx-auto">
              {summary}
            </p>
          </div>
        </div>

        {/* 4 Pillars Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-brand" />
            <h4 className="font-head font-bold text-sm text-tprimary uppercase tracking-wider">
              Rincian 4 Pilar Penilaian
            </h4>
          </div>

          <div className="space-y-2.5">
            {pillars.map((p, i) => {
              const Icon = PILLAR_ICONS[p.id] || ShieldCheck;
              const badge = getPillarBadge(p.status);
              const BadgeIcon = badge.icon;
              const pct = p.max > 0 ? (p.score / p.max) * 100 : 0;

              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-elevated/40 border border-borderc/80 rounded-xl p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-surface border border-borderc flex items-center justify-center shrink-0">
                        <Icon size={14} style={{ color: badge.color }} />
                      </div>
                      <span className="font-semibold text-xs sm:text-sm text-tprimary truncate">
                        {p.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge color={badge.color}>
                        <BadgeIcon size={10} />
                        {badge.label}
                      </Badge>
                      <span className="font-mono text-xs font-bold text-tprimary">
                        {p.score} <span className="text-tmuted font-normal">/ {p.max}</span>
                      </span>
                    </div>
                  </div>

                  <Progress value={pct} color={badge.color} className="h-1.5" />

                  <p className="text-xs text-tsecondary leading-relaxed">{p.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Actionable Recommendations */}
        {recommendations.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-borderc">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber" />
              <h4 className="font-head font-bold text-sm text-tprimary uppercase tracking-wider">
                Rekomendasi Tindakan Nyata
              </h4>
            </div>

            <div className="space-y-2.5">
              {recommendations.map((rec, i) => (
                <div
                  key={rec.action_id || i}
                  className="bg-elevated/50 border border-borderc rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors hover:border-brand/40"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge color={getRecBadgeColor(rec.badge)}>{rec.badge}</Badge>
                      <span className="font-semibold text-sm text-tprimary">{rec.title}</span>
                    </div>
                    <p className="text-xs text-tsecondary leading-relaxed">{rec.desc}</p>
                  </div>

                  <Button
                    size="sm"
                    variant={rec.action_id === "ask_ai" ? "secondary" : "primary"}
                    onClick={() => onAction?.(rec)}
                    className="shrink-0 w-full sm:w-auto"
                  >
                    {rec.action_id === "ask_ai" && <Bot size={14} className="text-brand" />}
                    {rec.btn_label}
                    <ArrowRight size={13} />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2">
          <Button variant="secondary" onClick={onClose} className="w-full">
            Tutup
          </Button>
        </div>
      </div>
    </Modal>
  );
}
