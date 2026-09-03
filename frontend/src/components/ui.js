import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import clsx from "clsx";

export function Button({ children, variant = "primary", size = "md", className, ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none";
  const variants = {
    primary: "bg-brand text-black hover:brightness-110 shadow-lg shadow-[var(--glow)]",
    secondary: "bg-elevated text-tprimary hover:bg-[var(--border)]",
    ghost: "bg-transparent text-tsecondary hover:text-tprimary hover:bg-elevated",
    outline: "border border-borderc text-tprimary hover:bg-elevated",
    danger: "bg-rose text-white hover:brightness-110",
  };
  const sizes = {
    sm: "text-xs px-3 py-2",
    md: "text-sm px-5 py-2.5",
    lg: "text-base px-7 py-3.5",
    icon: "p-2.5",
  };
  return (
    <button className={clsx(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}

export function Card({ children, className, hover = false, ...props }) {
  return (
    <div
      className={clsx(
        "bg-surface border border-borderc rounded-2xl p-5 sm:p-6",
        hover && "transition-colors duration-200 hover:border-[color:var(--brand)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Badge({ children, color, className }) {
  return (
    <span
      className={clsx("inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full", className)}
      style={color ? { backgroundColor: `${color}22`, color } : undefined}
    >
      {children}
    </span>
  );
}

export function Input({ label, className, prefix, ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-semibold text-tsecondary uppercase tracking-wider mb-2">{label}</span>}
      <div className="relative">
        {prefix && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-tmuted font-mono text-sm">{prefix}</span>}
        <input
          className={clsx(
            "w-full bg-elevated border border-borderc rounded-xl px-4 py-3 text-tprimary placeholder:text-tmuted focus:border-brand focus:outline-none transition-colors",
            prefix && "pl-11",
            className
          )}
          {...props}
        />
      </div>
    </label>
  );
}

export function Select({ label, children, className, ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-semibold text-tsecondary uppercase tracking-wider mb-2">{label}</span>}
      <select
        className={clsx(
          "w-full bg-elevated border border-borderc rounded-xl px-4 py-3 text-tprimary focus:border-brand focus:outline-none transition-colors appearance-none",
          className
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Progress({ value, color = "var(--brand)", className, track }) {
  return (
    <div className={clsx("w-full h-2.5 rounded-full overflow-hidden", track || "bg-elevated", className)}>
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
    </div>
  );
}

export function Modal({ open, onClose, title, children, testid, size = "md" }) {
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            data-testid={testid}
            className={clsx("relative bg-surface border border-borderc rounded-t-3xl sm:rounded-3xl w-full p-6 max-h-[92vh] overflow-y-auto", widths[size])}
            initial={{ y: 60, opacity: 0.5, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold font-head">{title}</h3>
              <button onClick={onClose} data-testid="modal-close-button" className="p-2 rounded-full hover:bg-elevated text-tsecondary transition-colors">
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Spinner({ size = 20, className }) {
  return <Loader2 size={size} className={clsx("animate-spin", className)} />;
}

export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-elevated flex items-center justify-center mb-4">
          <Icon size={28} className="text-tmuted" />
        </div>
      )}
      <p className="font-semibold text-tprimary">{title}</p>
      {subtitle && <p className="text-sm text-tsecondary mt-1 max-w-xs">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatPill({ label, children }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-tmuted uppercase tracking-wider font-semibold">{label}</span>
      <span className="font-mono font-semibold text-tprimary">{children}</span>
    </div>
  );
}
