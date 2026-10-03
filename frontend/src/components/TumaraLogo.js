import React from "react";
import clsx from "clsx";

/**
 * Tumara Brand Logo
 * Filosofi: "Tumbuh dengan arah" (Tumbuh [stem bertunas] + Arah [vektor panah horizontal]).
 */
export default function TumaraLogo({
  size = 36,
  withText = false,
  withTagline = false,
  className,
}) {
  return (
    <div className={clsx("inline-flex items-center gap-2.5 select-none", className)}>
      {/* Glyph Icon */}
      <div
        className="relative flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-md shadow-emerald-500/20"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          width="100%"
          height="100%"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="tumaraBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#0B0F17" />
            </linearGradient>
            <linearGradient id="tumaraStem" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="60%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#34D399" />
            </linearGradient>
            <linearGradient id="tumaraArrow" x1="0%" y1="50%" x2="100%" y2="20%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="70%" stopColor="#00E676" />
              <stop offset="100%" stopColor="#22D3EE" />
            </linearGradient>
          </defs>

          {/* Background Rounded Squircle */}
          <rect width="100" height="100" rx="24" fill="url(#tumaraBg)" />
          <rect
            x="2"
            y="2"
            width="96"
            height="96"
            rx="22"
            stroke="#10B981"
            strokeWidth="1.5"
            strokeOpacity="0.3"
          />

          {/* Vertical Stem — Rooted Growth ("Tumbuh") */}
          <rect
            x="42"
            y="32"
            width="16"
            height="44"
            rx="8"
            fill="url(#tumaraStem)"
          />

          {/* Horizontal Bar with Directional Arrow Vector ("Arah") */}
          {/* Main Bar */}
          <path
            d="M 22 28 C 22 23.5 25.5 20 30 20 L 68 20 C 72.5 20 76 23.5 76 28 C 76 32.5 72.5 36 68 36 L 30 36 C 25.5 36 22 32.5 22 28 Z"
            fill="url(#tumaraArrow)"
          />

          {/* Dynamic Directional Tip (Arrow Head surging forward & upward) */}
          <path
            d="M 68 15 L 84 28 L 68 41 Z"
            fill="url(#tumaraArrow)"
          />

          {/* Core Growth Sprout Accent */}
          <circle cx="50" cy="70" r="4.5" fill="#A7F3D0" />
        </svg>
      </div>

      {/* Typography */}
      {withText && (
        <div className="flex flex-col">
          <span className="font-head font-extrabold text-xl tracking-tight leading-none text-tprimary">
            Tumara
          </span>
          {withTagline && (
            <span className="text-[10px] text-tmuted font-medium tracking-tight mt-0.5">
              Tumbuh dengan arah
            </span>
          )}
        </div>
      )}
    </div>
  );
}
