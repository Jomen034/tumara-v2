import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";
import { formatRp, formatShort } from "../lib/format";
import { Badge } from "./ui";

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const DAY_NAMES = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export default function BillCalendar({
  bills = [],
  selectedDate = null,
  onSelectDate,
  privacy = false,
  walletMap = {},
}) {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [today]);

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Month navigation
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const resetToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  const isCurrentMonthActive =
    currentYear === today.getFullYear() && currentMonth === today.getMonth();

  // Compute calendar grid data
  const calendarData = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    // 0 = Monday, 6 = Sunday (Indonesian calendar convention)
    const firstDayOfWeek = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;

    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

    // Map bills to dates for this month
    const map = {};
    let totalMonthlyAmount = 0;
    let paidMonthlyAmount = 0;
    let unpaidMonthlyAmount = 0;
    let billCountThisMonth = 0;

    bills.forEach((b) => {
      let billDay = null;
      let isProjected = false;

      // Direct match with next_due_date in current viewed month
      if (b.next_due_date && b.next_due_date.startsWith(monthPrefix)) {
        billDay = parseInt(b.next_due_date.slice(8, 10), 10);
      } else if (b.recurrence === "monthly" && b.next_due_date && !b.is_completed) {
        // Project monthly bills if viewing next month or past month
        const origDay = parseInt(b.next_due_date.slice(8, 10), 10);
        if (!isNaN(origDay)) {
          billDay = Math.min(origDay, daysInMonth);
          isProjected = true;
        }
      }

      if (billDay && billDay >= 1 && billDay <= daysInMonth) {
        const dateKey = `${monthPrefix}-${String(billDay).padStart(2, "0")}`;
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push({ ...b, isProjected });

        totalMonthlyAmount += Number(b.amount) || 0;
        if (b.is_completed) {
          paidMonthlyAmount += Number(b.amount) || 0;
        } else {
          unpaidMonthlyAmount += Number(b.amount) || 0;
        }
        billCountThisMonth += 1;
      }
    });

    return {
      daysInMonth,
      firstDayOfWeek,
      billsByDate: map,
      totalMonthlyAmount,
      paidMonthlyAmount,
      unpaidMonthlyAmount,
      billCountThisMonth,
      monthPrefix,
    };
  }, [currentYear, currentMonth, bills]);

  // Helper to determine day severity & colors
  const getDayStatus = (billsOnDay = []) => {
    if (billsOnDay.length === 0) return null;

    let hasOverdue = false;
    let hasUrgent = false;
    let allCompleted = true;

    billsOnDay.forEach((b) => {
      if (!b.is_completed) {
        allCompleted = false;
        if (b.days_until < 0) hasOverdue = true;
        else if (b.days_until <= 3) hasUrgent = true;
      }
    });

    if (allCompleted) return { label: "Lunas", color: "var(--cyan)", tone: "cyan" };
    if (hasOverdue) return { label: "Telat", color: "var(--rose)", tone: "rose" };
    if (hasUrgent) return { label: "Mendesak", color: "var(--amber)", tone: "amber" };
    return { label: "Aman", color: "var(--brand)", tone: "brand" };
  };

  // Selected date info
  const selectedBills = useMemo(() => {
    if (!selectedDate) return [];
    return calendarData.billsByDate[selectedDate] || [];
  }, [selectedDate, calendarData.billsByDate]);

  const selectedTotal = useMemo(() => {
    return selectedBills.reduce((acc, b) => acc + (Number(b.amount) || 0), 0);
  }, [selectedBills]);

  return (
    <div className="bg-card border border-borderc rounded-2xl p-4 sm:p-5 shadow-sm transition-all space-y-4">
      {/* Header: Title, Navigation & Collapse Toggle */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
            <CalendarIcon size={17} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-head font-bold text-base sm:text-lg text-tprimary">
                Jadwal Kalender Tagihan
              </h2>
              {!isCurrentMonthActive && (
                <button
                  onClick={resetToToday}
                  className="text-[11px] font-semibold text-brand hover:underline flex items-center gap-1 bg-brand/10 px-2 py-0.5 rounded-full"
                  title="Kembali ke bulan berjalan"
                >
                  <RotateCcw size={10} /> Bulan Ini
                </button>
              )}
            </div>
            <p className="text-xs text-tmuted">
              Peta jatuh tempo bulanan & deteksi konsentrasi pengeluaran
            </p>
          </div>
        </div>

        {/* Month Selector Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg border border-borderc bg-elevated hover:bg-hover text-tsecondary hover:text-tprimary transition-colors"
            title="Bulan sebelumnya"
            data-testid="prev-month-btn"
          >
            <ChevronLeft size={16} />
          </button>

          <span className="font-semibold text-sm sm:text-base text-tprimary min-w-[125px] sm:min-w-[145px] text-center font-mono">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </span>

          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg border border-borderc bg-elevated hover:bg-hover text-tsecondary hover:text-tprimary transition-colors"
            title="Bulan berikutnya"
            data-testid="next-month-btn"
          >
            <ChevronRight size={16} />
          </button>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 ml-1 rounded-lg text-tmuted hover:text-tprimary hover:bg-elevated transition-colors"
            title={isCollapsed ? "Buka Kalender" : "Tutup Kalender"}
          >
            {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>
      </div>

      {/* Monthly Summary Barometer Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-borderc/40 text-xs font-mono">
        <div className="bg-elevated/70 border border-borderc/50 rounded-xl p-2.5">
          <span className="text-[11px] text-tmuted block">Total Kewajiban</span>
          <span className={`text-sm sm:text-base font-bold text-tprimary block mt-0.5 ${privacy ? "privacy-blur" : ""}`}>
            {formatRp(calendarData.totalMonthlyAmount, privacy)}
          </span>
          <span className="text-[10px] text-tmuted mt-0.5 block">
            {calendarData.billCountThisMonth} tagihan di bulan ini
          </span>
        </div>

        <div className="bg-elevated/70 border border-borderc/50 rounded-xl p-2.5">
          <span className="text-[11px] text-tmuted block">Sisa Belum Bayar</span>
          <span className={`text-sm sm:text-base font-bold ${calendarData.unpaidMonthlyAmount > 0 ? "text-amber" : "text-brand"} block mt-0.5 ${privacy ? "privacy-blur" : ""}`}>
            {formatRp(calendarData.unpaidMonthlyAmount, privacy)}
          </span>
          <span className="text-[10px] text-tmuted mt-0.5 block">
            Kewajiban aktif
          </span>
        </div>

        <div className="bg-elevated/70 border border-borderc/50 rounded-xl p-2.5">
          <span className="text-[11px] text-tmuted block">Sudah Lunas</span>
          <span className={`text-sm sm:text-base font-bold text-brand block mt-0.5 ${privacy ? "privacy-blur" : ""}`}>
            {formatRp(calendarData.paidMonthlyAmount, privacy)}
          </span>
          <span className="text-[10px] text-tmuted mt-0.5 block">
            Terselesaikan
          </span>
        </div>

        <div className="bg-elevated/70 border border-borderc/50 rounded-xl p-2.5">
          <span className="text-[11px] text-tmuted block">Hari Terpadat</span>
          {(() => {
            const dateEntries = Object.entries(calendarData.billsByDate);
            if (dateEntries.length === 0) {
              return <span className="text-xs text-tmuted font-sans block mt-1">Tidak ada</span>;
            }
            const busiest = dateEntries.reduce((max, curr) =>
              curr[1].length > max[1].length ? curr : max
            );
            const d = busiest[0].slice(8, 10);
            return (
              <>
                <span className="text-sm sm:text-base font-bold text-cyan block mt-0.5">
                  Tgl {parseInt(d, 10)} ({busiest[1].length} tagihan)
                </span>
                <span className="text-[10px] text-tmuted block truncate">
                  {formatRp(busiest[1].reduce((sum, item) => sum + (Number(item.amount) || 0), 0), privacy)}
                </span>
              </>
            );
          })()}
        </div>
      </div>

      {/* Calendar Grid (Collapsible) */}
      {!isCollapsed && (
        <div className="space-y-3 pt-2">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-semibold text-tmuted">
            {DAY_NAMES.map((name, i) => (
              <div
                key={name}
                className={clsx(
                  "py-1",
                  i >= 5 ? "text-rose/70 font-medium" : "text-tmuted"
                )}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Day Cells Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {/* Blank padding cells before day 1 */}
            {Array.from({ length: calendarData.firstDayOfWeek }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="min-h-[50px] sm:min-h-[64px] rounded-xl bg-elevated/20 border border-transparent opacity-30 pointer-events-none"
              />
            ))}

            {/* Actual day cells */}
            {Array.from({ length: calendarData.daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateStr = `${calendarData.monthPrefix}-${String(dayNum).padStart(2, "0")}`;
              const billsOnDay = calendarData.billsByDate[dateStr] || [];
              const count = billsOnDay.length;
              const isToday = dateStr === todayStr;
              const isSelected = selectedDate === dateStr;
              const status = getDayStatus(billsOnDay);

              const totalAmount = billsOnDay.reduce(
                (sum, item) => sum + (Number(item.amount) || 0),
                0
              );

              return (
                <div
                  key={dateStr}
                  onClick={() => {
                    if (onSelectDate) {
                      onSelectDate(isSelected ? null : dateStr);
                    }
                  }}
                  className={clsx(
                    "min-h-[52px] sm:min-h-[68px] rounded-xl p-1.5 sm:p-2 transition-all flex flex-col justify-between select-none relative group border",
                    // Interactive cursor
                    count > 0 ? "cursor-pointer" : "cursor-pointer opacity-80 hover:opacity-100",
                    // Selection state
                    isSelected
                      ? "ring-2 ring-brand border-brand bg-brand/20 shadow-md z-10"
                      : count > 0
                      ? status?.tone === "rose"
                        ? "bg-rose-500/10 border-rose-500/30 hover:border-rose-500 hover:bg-rose-500/15"
                        : status?.tone === "amber"
                        ? "bg-amber-500/10 border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/15"
                        : status?.tone === "cyan"
                        ? "bg-cyan-500/10 border-cyan-500/30 hover:border-cyan-500 hover:bg-cyan-500/15"
                        : "bg-brand/10 border-brand/30 hover:border-brand hover:bg-brand/15"
                      : "bg-elevated/40 border-borderc/40 hover:border-borderc hover:bg-elevated"
                  )}
                  title={
                    count > 0
                      ? `${dateStr}: ${count} tagihan (${formatRp(totalAmount)})`
                      : dateStr
                  }
                >
                  {/* Top Bar inside cell: Day Number & Multi-Bill Count Badge */}
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={clsx(
                        "text-xs font-mono font-bold inline-flex items-center justify-center w-5 h-5 rounded-full transition-all",
                        isToday
                          ? "bg-brand text-black font-extrabold shadow-sm"
                          : isSelected
                          ? "text-brand"
                          : count > 0
                          ? "text-tprimary"
                          : "text-tmuted"
                      )}
                    >
                      {dayNum}
                    </span>

                    {/* Multi-Bill Badge if > 1 bill on the same date */}
                    {count > 1 && (
                      <span
                        className={clsx(
                          "px-1 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-tight shrink-0 shadow-sm leading-none",
                          status?.tone === "rose"
                            ? "bg-rose text-white"
                            : status?.tone === "amber"
                            ? "bg-amber text-black"
                            : "bg-brand text-black"
                        )}
                        title={`${count} tagihan jatuh tempo di tanggal ini`}
                      >
                        {count}
                      </span>
                    )}
                  </div>

                  {/* Bottom info inside cell: Dots & Mini Total Nominal */}
                  {count > 0 ? (
                    <div className="mt-1 space-y-0.5">
                      {/* Colored Dots per bill (up to 3 dots) */}
                      <div className="flex items-center gap-1 flex-wrap">
                        {billsOnDay.slice(0, 3).map((b, bi) => {
                          const dotColor = b.is_completed
                            ? "bg-cyan"
                            : b.days_until < 0
                            ? "bg-rose"
                            : b.days_until <= 3
                            ? "bg-amber"
                            : "bg-brand";
                          return (
                            <span
                              key={bi}
                              className={clsx(
                                "w-1.5 h-1.5 rounded-full shrink-0 shadow-xs",
                                dotColor
                              )}
                            />
                          );
                        })}
                        {count > 3 && (
                          <span className="text-[9px] font-mono text-tmuted leading-none">
                            +{count - 3}
                          </span>
                        )}
                      </div>

                      {/* Desktop price indicator */}
                      <div className="hidden sm:block">
                        <span
                          className={clsx(
                            "text-[10px] font-mono font-medium truncate block leading-tight",
                            status?.tone === "rose"
                              ? "text-rose font-semibold"
                              : status?.tone === "amber"
                              ? "text-amber font-semibold"
                              : "text-tsecondary",
                            privacy && "privacy-blur"
                          )}
                        >
                          {formatShort(totalAmount, privacy)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-3" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Color Legend & Guide */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-borderc/40 text-[11px] text-tmuted">
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose shrink-0" />
                <span>Lewat Tempo / Hari Ini</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber shrink-0" />
                <span>≤ 3 Hari Lagi</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-brand shrink-0" />
                <span>Aman (&gt; 3 Hari)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan shrink-0" />
                <span>Lunas</span>
              </span>
            </div>

            <span className="text-[10px] text-tmuted italic">
              Klik tanggal untuk menyaring tagihan
            </span>
          </div>
        </div>
      )}

      {/* Selected Date Filter Strip Notification */}
      {selectedDate && (
        <div className="p-3 sm:p-3.5 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-between gap-3 text-xs sm:text-sm animate-fadeIn">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarIcon size={16} className="text-brand shrink-0" />
            <div className="min-w-0 truncate">
              <span className="text-tprimary font-semibold">
                Tanggal {parseInt(selectedDate.slice(8, 10), 10)} {MONTH_NAMES[parseInt(selectedDate.slice(5, 7), 10) - 1]} {selectedDate.slice(0, 4)}:
              </span>{" "}
              {selectedBills.length > 0 ? (
                <span className="text-tsecondary">
                  <strong>{selectedBills.length} tagihan</strong> terdaftar (Total:{" "}
                  <strong className={`font-mono text-brand ${privacy ? "privacy-blur" : ""}`}>
                    {formatRp(selectedTotal, privacy)}
                  </strong>
                  )
                </span>
              ) : (
                <span className="text-tmuted">Tidak ada tagihan yang jatuh tempo pada tanggal ini.</span>
              )}
            </div>
          </div>

          <button
            onClick={() => onSelectDate(null)}
            className="text-xs font-semibold text-brand hover:underline shrink-0 bg-brand/10 hover:bg-brand/20 px-2.5 py-1 rounded-lg transition-colors"
          >
            Tampilkan Semua
          </button>
        </div>
      )}
    </div>
  );
}
