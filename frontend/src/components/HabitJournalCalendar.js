import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, CheckCircle2, Calendar, Sparkles, ChevronRight, Info } from "lucide-react";
import clsx from "clsx";
import { Card, Progress, Badge } from "./ui";

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export default function HabitJournalCalendar({ habitTracker, onDayClick }) {
  const [selectedDay, setSelectedDay] = useState(null);

  if (!habitTracker) return null;

  const {
    month,
    month_name,
    days_in_month = 31,
    today_day = 1,
    logged_today = false,
    active_days = [],
    day_counts = {},
    current_streak = 0,
    logged_days_count = 0,
    days_passed = 1,
    discipline_pct = 0,
    motivational_copy,
    motivation_tag,
  } = habitTracker;

  // Calculate day-of-week for 1st of the month (Monday = 0 ... Sunday = 6)
  const firstDayOfMonth = new Date(`${month}-01T00:00:00`).getDay();
  // JS getDay(): Sunday = 0, Monday = 1 ... Saturday = 6. Convert to Monday = 0:
  const startOffset = (firstDayOfMonth + 6) % 7;

  // Generate grid cells
  const blanks = Array.from({ length: startOffset }, (_, i) => i);
  const days = Array.from({ length: days_in_month }, (_, i) => i + 1);

  const handleCellClick = (d) => {
    const isLogged = active_days.includes(d);
    setSelectedDay(selectedDay === d ? null : d);
    if (onDayClick) {
      const dateStr = `${month}-${String(d).padStart(2, "0")}`;
      onDayClick(dateStr, isLogged);
    }
  };

  return (
    <Card className="p-5 sm:p-6 relative overflow-hidden">
      {/* Background glow decoration */}
      <div
        className="absolute top-0 right-0 w-64 h-64 opacity-5 pointer-events-none rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--brand), transparent 70%)" }}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-amber/15 text-amber flex items-center justify-center shrink-0">
            <Flame size={22} className={clsx(current_streak > 0 && "animate-pulse")} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-head font-bold text-base sm:text-lg text-tprimary">
                Jurnal & Kebiasaan Mencatat
              </h3>
              <Badge variant={current_streak >= 3 ? "brand" : "neutral"} className="text-[11px] px-2 py-0.5">
                {current_streak > 0 ? `🔥 ${current_streak} Hari Beruntun` : "✨ Siap Mulai"}
              </Badge>
            </div>
            <p className="text-xs text-tsecondary mt-0.5">
              Konsistensi finansial bulan {month_name || "ini"}
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {logged_today ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-brand/15 text-brand border border-brand/30">
              <CheckCircle2 size={14} /> Sudah Mencatat Hari Ini
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber/15 text-amber border border-amber/30">
              <Sparkles size={14} /> Belum Dicatat Hari Ini
            </span>
          )}
        </div>
      </div>

      {/* Motivational encouragement box */}
      <div className="bg-surface border border-borderc rounded-2xl p-3.5 mb-5 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand font-head">
              {motivation_tag || "Catatan Harian"}
            </span>
            <span className="text-xs font-mono font-semibold text-tsecondary">
              {logged_days_count} / {days_passed} hari aktif ({discipline_pct}%)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-tsecondary mt-1 leading-relaxed">
            &quot;{motivational_copy}&quot;
          </p>
          <div className="mt-2.5">
            <Progress value={discipline_pct} color="var(--brand)" />
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-elevated/40 border border-borderc/60 rounded-2xl p-3.5 sm:p-4">
        {/* Weekday labels */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="text-[11px] font-bold text-tmuted font-head">
              {wd}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {blanks.map((b) => (
            <div key={`blank-${b}`} className="aspect-square rounded-xl" />
          ))}

          {days.map((d) => {
            const isToday = d === today_day;
            const isFuture = d > today_day;
            const isLogged = active_days.includes(d);
            const count = day_counts[d] || 0;
            const isSelected = selectedDay === d;

            return (
              <button
                key={`day-${d}`}
                type="button"
                onClick={() => handleCellClick(d)}
                disabled={isFuture}
                className={clsx(
                  "relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all text-xs font-semibold select-none",
                  isToday && "ring-2 ring-brand font-extrabold",
                  isLogged
                    ? "bg-brand text-black shadow-sm shadow-[var(--glow)] hover:brightness-110"
                    : isFuture
                    ? "text-tmuted/40 cursor-not-allowed"
                    : "bg-surface/60 text-tsecondary hover:bg-surface border border-borderc/40",
                  isSelected && "ring-2 ring-tprimary scale-105"
                )}
                title={
                  isFuture
                    ? `Tanggal ${d}`
                    : isLogged
                    ? `Tanggal ${d}: ${count} transaksi tercatat`
                    : `Tanggal ${d}: Tidak ada catatan`
                }
              >
                <span>{d}</span>
                {isLogged && (
                  <span className="text-[9px] leading-none opacity-80 mt-0.5">
                    {count > 1 ? `${count}x` : "✓"}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-borderc/60 text-[11px] text-tsecondary">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-brand inline-block" /> Ada Catatan
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md border-2 border-brand inline-block" /> Hari Ini
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-surface border border-borderc/60 inline-block" /> Terlewat
            </span>
          </div>

          <span className="text-tmuted italic">
            Klik tanggal untuk info detail
          </span>
        </div>
      </div>
    </Card>
  );
}
