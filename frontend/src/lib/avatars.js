/**
 * Tumara Modern Avatar System
 * Karakter avatar baru: Menarik, simpel, ceria, dan modern tanpa bergantung pada API eksternal.
 */

export const AVATAR_CHARACTERS = [
  {
    id: "aria",
    name: "Aria",
    title: "Mint & Fresh",
    bg: "#10B981",
    bgGrad: ["#059669", "#34D399"],
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ariaBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#059669" />
          <stop offset="100%" stop-color="#34D399" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#ariaBg)" />
      <!-- Body/Shoulders -->
      <path d="M 22 92 C 22 72 35 68 50 68 C 65 68 78 72 78 92 Z" fill="#E2E8F0" />
      <path d="M 40 68 L 50 78 L 60 68 Z" fill="#CBD5E1" />
      <!-- Head -->
      <ellipse cx="50" cy="46" rx="20" ry="23" fill="#FDE047" opacity="0.9" />
      <ellipse cx="50" cy="47" rx="19" ry="22" fill="#FED7AA" />
      <!-- Hair (Short modern) -->
      <path d="M 30 42 C 28 26 42 20 50 20 C 62 20 72 26 70 42 C 67 33 60 27 50 27 C 39 27 33 34 30 42 Z" fill="#1E293B" />
      <!-- Glasses -->
      <rect x="35" y="42" width="11" height="8" rx="3" stroke="#0F172A" stroke-width="2.5" fill="rgba(255,255,255,0.4)" />
      <rect x="54" y="42" width="11" height="8" rx="3" stroke="#0F172A" stroke-width="2.5" fill="rgba(255,255,255,0.4)" />
      <path d="M 46 45 L 54 45" stroke="#0F172A" stroke-width="2.5" />
      <!-- Eyes inside glasses -->
      <circle cx="40.5" cy="46" r="1.8" fill="#0F172A" />
      <circle cx="59.5" cy="46" r="1.8" fill="#0F172A" />
      <!-- Smile -->
      <path d="M 44 58 C 47 62 53 62 56 58" stroke="#EA580C" stroke-width="2.2" stroke-linecap="round" fill="none" />
      <!-- Cheeks -->
      <circle cx="36" cy="54" r="3" fill="#FCA5A5" opacity="0.6" />
      <circle cx="64" cy="54" r="3" fill="#FCA5A5" opacity="0.6" />
    </svg>`,
  },
  {
    id: "bima",
    name: "Bima",
    title: "Warm & Confident",
    bg: "#EA580C",
    bgGrad: ["#C2410C", "#FB923C"],
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bimaBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#C2410C" />
          <stop offset="100%" stop-color="#FB923C" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#bimaBg)" />
      <!-- Body -->
      <path d="M 22 92 C 22 72 35 68 50 68 C 65 68 78 72 78 92 Z" fill="#334155" />
      <!-- Head -->
      <ellipse cx="50" cy="47" rx="19" ry="22" fill="#FDBA74" />
      <!-- Hair (Clean side part) -->
      <path d="M 29 40 C 29 24 40 18 53 18 C 66 18 72 26 71 38 C 65 30 54 26 44 26 C 36 26 31 32 29 40 Z" fill="#0F172A" />
      <!-- Eyes -->
      <circle cx="41" cy="45" r="2.2" fill="#0F172A" />
      <circle cx="59" cy="45" r="2.2" fill="#0F172A" />
      <!-- Eyebrows -->
      <path d="M 37 39 C 40 37 45 38 46 40" stroke="#0F172A" stroke-width="2" stroke-linecap="round" fill="none" />
      <path d="M 63 39 C 60 37 55 38 54 40" stroke="#0F172A" stroke-width="2" stroke-linecap="round" fill="none" />
      <!-- Confident Smile -->
      <path d="M 44 57 C 47 62 53 62 56 57" stroke="#9A3412" stroke-width="2.5" stroke-linecap="round" fill="none" />
    </svg>`,
  },
  {
    id: "citra",
    name: "Citra",
    title: "Bright & Cheerful",
    bg: "#EAB308",
    bgGrad: ["#CA8A04", "#FDE047"],
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="citraBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#CA8A04" />
          <stop offset="100%" stop-color="#FDE047" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#citraBg)" />
      <!-- Topknot Bun -->
      <circle cx="50" cy="18" r="10" fill="#3B2516" />
      <!-- Body -->
      <path d="M 22 92 C 22 72 35 68 50 68 C 65 68 78 72 78 92 Z" fill="#047857" />
      <!-- Head -->
      <ellipse cx="50" cy="48" rx="19" ry="22" fill="#FED7AA" />
      <!-- Hair frame -->
      <path d="M 29 45 C 28 30 38 23 50 23 C 62 23 72 30 71 45 C 67 36 60 30 50 30 C 40 30 33 36 29 45 Z" fill="#3B2516" />
      <!-- Eyes (Happy arch) -->
      <path d="M 38 44 C 40 41 43 41 45 44" stroke="#1E293B" stroke-width="2.5" stroke-linecap="round" fill="none" />
      <path d="M 55 44 C 57 41 60 41 62 44" stroke="#1E293B" stroke-width="2.5" stroke-linecap="round" fill="none" />
      <!-- Cheeks -->
      <circle cx="36" cy="52" r="3.5" fill="#FB7185" opacity="0.7" />
      <circle cx="64" cy="52" r="3.5" fill="#FB7185" opacity="0.7" />
      <!-- Joyful smile -->
      <path d="M 43 56 C 46 62 54 62 57 56" stroke="#9A3412" stroke-width="2.4" stroke-linecap="round" fill="none" />
    </svg>`,
  },
  {
    id: "daffa",
    name: "Daffa",
    title: "Calm & Dynamic",
    bg: "#2563EB",
    bgGrad: ["#1D4ED8", "#60A5FA"],
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="daffaBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1D4ED8" />
          <stop offset="100%" stop-color="#60A5FA" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#daffaBg)" />
      <!-- Body -->
      <path d="M 22 92 C 22 72 35 68 50 68 C 65 68 78 72 78 92 Z" fill="#0F172A" />
      <circle cx="50" cy="74" r="4" fill="#38BDF8" />
      <!-- Head -->
      <ellipse cx="50" cy="46" rx="19" ry="22" fill="#FCD34D" opacity="0.85" />
      <ellipse cx="50" cy="47" rx="18.5" ry="21" fill="#FDBA74" />
      <!-- Hair (Short fade & modern quiff) -->
      <path d="M 29 38 C 29 22 41 16 52 16 C 65 16 71 22 71 36 C 66 28 58 24 50 24 C 40 24 33 29 29 38 Z" fill="#18181B" />
      <!-- Eyes -->
      <circle cx="41.5" cy="45" r="2.2" fill="#18181B" />
      <circle cx="58.5" cy="45" r="2.2" fill="#18181B" />
      <!-- Smile -->
      <path d="M 44 56 C 47 60 53 60 56 56" stroke="#C2410C" stroke-width="2.3" stroke-linecap="round" fill="none" />
    </svg>`,
  },
  {
    id: "elena",
    name: "Elena",
    title: "Chic & Elegant",
    bg: "#7C3AED",
    bgGrad: ["#6D28D9", "#A78BFA"],
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="elenaBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#6D28D9" />
          <stop offset="100%" stop-color="#A78BFA" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#elenaBg)" />
      <!-- Body -->
      <path d="M 22 92 C 22 72 35 68 50 68 C 65 68 78 72 78 92 Z" fill="#F1F5F9" />
      <!-- Bob Hair (Back layer) -->
      <path d="M 26 40 C 24 60 30 68 33 70 L 67 70 C 70 68 76 60 74 40 Z" fill="#262626" />
      <!-- Head -->
      <ellipse cx="50" cy="46" rx="19" ry="22" fill="#FED7AA" />
      <!-- Bob Hair Front -->
      <path d="M 28 42 C 28 24 40 19 50 19 C 62 19 72 24 72 42 C 67 31 59 26 50 26 C 40 26 33 32 28 42 Z" fill="#262626" />
      <!-- Eyes with delicate lashes -->
      <circle cx="41" cy="45" r="2.2" fill="#171717" />
      <circle cx="59" cy="45" r="2.2" fill="#171717" />
      <!-- Blush -->
      <circle cx="35" cy="52" r="3" fill="#F43F5E" opacity="0.6" />
      <circle cx="65" cy="52" r="3" fill="#F43F5E" opacity="0.6" />
      <!-- Gentle smile -->
      <path d="M 45 56 C 47 59 53 59 55 56" stroke="#BE123C" stroke-width="2.2" stroke-linecap="round" fill="none" />
    </svg>`,
  },
  {
    id: "fajar",
    name: "Fajar",
    title: "Energetic & Modern",
    bg: "#0891B2",
    bgGrad: ["#0E7490", "#22D3EE"],
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fajarBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0E7490" />
          <stop offset="100%" stop-color="#22D3EE" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#fajarBg)" />
      <!-- Body -->
      <path d="M 22 92 C 22 72 35 68 50 68 C 65 68 78 72 78 92 Z" fill="#1E293B" />
      <!-- Head -->
      <ellipse cx="50" cy="47" rx="19" ry="22" fill="#FDBA74" />
      <!-- Curly Top Hair -->
      <circle cx="40" cy="24" r="7" fill="#292524" />
      <circle cx="50" cy="21" r="8" fill="#292524" />
      <circle cx="60" cy="24" r="7" fill="#292524" />
      <circle cx="34" cy="30" r="6" fill="#292524" />
      <circle cx="66" cy="30" r="6" fill="#292524" />
      <!-- Eyes (Blinking/Winking friendly) -->
      <circle cx="41" cy="45" r="2.2" fill="#0F172A" />
      <path d="M 56 45 C 58 42 61 42 63 45" stroke="#0F172A" stroke-width="2.5" stroke-linecap="round" fill="none" />
      <!-- Big cheerful smile -->
      <path d="M 43 56 C 47 62 53 62 57 56 Z" fill="#991B1B" />
    </svg>`,
  },
  {
    id: "gita",
    name: "Gita",
    title: "Warm & Friendly",
    bg: "#E11D48",
    bgGrad: ["#BE123C", "#FB7185"],
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gitaBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#BE123C" />
          <stop offset="100%" stop-color="#FB7185" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#gitaBg)" />
      <!-- Body -->
      <path d="M 22 92 C 22 72 35 68 50 68 C 65 68 78 72 78 92 Z" fill="#3B82F6" />
      <!-- Side braid / Long hair -->
      <path d="M 28 42 C 26 65 30 76 34 82" stroke="#451A03" stroke-width="7" stroke-linecap="round" />
      <!-- Head -->
      <ellipse cx="50" cy="46" rx="19" ry="22" fill="#FED7AA" />
      <!-- Hair Bangs -->
      <path d="M 29 40 C 31 25 42 20 50 20 C 62 20 71 26 71 42 C 65 31 56 26 48 26 C 39 26 33 32 29 40 Z" fill="#451A03" />
      <!-- Eyes -->
      <circle cx="41" cy="44" r="2.2" fill="#1C1917" />
      <circle cx="59" cy="44" r="2.2" fill="#1C1917" />
      <!-- Cheeks -->
      <circle cx="36" cy="51" r="3.5" fill="#FDA4AF" opacity="0.75" />
      <circle cx="64" cy="51" r="3.5" fill="#FDA4AF" opacity="0.75" />
      <!-- Sweet smile -->
      <path d="M 44 56 C 47 60 53 60 56 56" stroke="#9F1239" stroke-width="2.3" stroke-linecap="round" fill="none" />
    </svg>`,
  },
  {
    id: "hadi",
    name: "Hadi",
    title: "Wise & Mature",
    bg: "#0D9488",
    bgGrad: ["#0F766E", "#2DD4BF"],
    svg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hadiBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0F766E" />
          <stop offset="100%" stop-color="#2DD4BF" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#hadiBg)" />
      <!-- Body -->
      <path d="M 22 92 C 22 72 35 68 50 68 C 65 68 78 72 78 92 Z" fill="#1E293B" />
      <!-- Head -->
      <ellipse cx="50" cy="46" rx="19" ry="22" fill="#FDBA74" />
      <!-- Hair with neat salt & pepper texture -->
      <path d="M 29 38 C 29 23 40 18 50 18 C 62 18 71 23 71 38 C 65 28 56 24 50 24 C 40 24 33 30 29 38 Z" fill="#334155" />
      <!-- Round Glasses -->
      <circle cx="41" cy="45" r="6.5" stroke="#0F172A" stroke-width="2.2" fill="rgba(255,255,255,0.35)" />
      <circle cx="59" cy="45" r="6.5" stroke="#0F172A" stroke-width="2.2" fill="rgba(255,255,255,0.35)" />
      <path d="M 47.5 45 L 52.5 45" stroke="#0F172A" stroke-width="2.2" />
      <!-- Eyes inside glasses -->
      <circle cx="41" cy="45" r="1.8" fill="#0F172A" />
      <circle cx="59" cy="45" r="1.8" fill="#0F172A" />
      <!-- Warm smile -->
      <path d="M 44 57 C 47 61 53 61 56 57" stroke="#9A3412" stroke-width="2.3" stroke-linecap="round" fill="none" />
    </svg>`,
  },
];

/**
 * Mengubah string SVG menjadi data URI aman
 */
export function svgToDataUri(svgString) {
  const cleaned = svgString
    .replace(/\n/g, "")
    .replace(/\s+/g, " ")
    .replace(/"/g, "'");
  return `data:image/svg+xml;utf8,${encodeURIComponent(cleaned)}`;
}

// Map per character ID
export const AVATAR_MAP = Object.fromEntries(
  AVATAR_CHARACTERS.map((a) => [a.id, a])
);

// Precomputed data URIs
export const AVATAR_DATA_URIS = Object.fromEntries(
  AVATAR_CHARACTERS.map((a) => [a.id, svgToDataUri(a.svg)])
);

/**
 * Mengambil avatar URL yang tepat untuk user.
 * Menghilangkan avatar sketchy 'notionists' lama secara otomatis!
 */
export function getUserAvatar(user, fallbackSeed = "aria") {
  if (!user) {
    return AVATAR_DATA_URIS.aria;
  }

  const pic = user.picture || "";

  // Jika user sudah memiliki foto profil asli (misal Google Auth), pertahankan
  if (
    pic &&
    !pic.includes("dicebear.com/7.x/notionists") &&
    !pic.includes("via.placeholder") &&
    (pic.startsWith("http://") || pic.startsWith("https://") || pic.startsWith("data:image"))
  ) {
    return pic;
  }

  // Jika memilih ID avatar baru langsung
  if (pic.startsWith("avatar:") || AVATAR_MAP[pic]) {
    const id = pic.replace("avatar:", "");
    if (AVATAR_DATA_URIS[id]) return AVATAR_DATA_URIS[id];
  }

  // Pemetaan dari seed nama atau fallback
  const seed = (user.name || fallbackSeed || "aria").toLowerCase();
  if (seed.includes("bima") || seed.includes("jasper")) return AVATAR_DATA_URIS.bima;
  if (seed.includes("citra") || seed.includes("luna")) return AVATAR_DATA_URIS.citra;
  if (seed.includes("daffa") || seed.includes("leo")) return AVATAR_DATA_URIS.daffa;
  if (seed.includes("elena") || seed.includes("aneka")) return AVATAR_DATA_URIS.elena;
  if (seed.includes("fajar") || seed.includes("milo")) return AVATAR_DATA_URIS.fajar;
  if (seed.includes("gita") || seed.includes("maya")) return AVATAR_DATA_URIS.gita;
  if (seed.includes("hadi") || seed.includes("felix")) return AVATAR_DATA_URIS.hadi;

  // Hash nama ke salah satu dari 8 avatar
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
  }
  const idx = Math.abs(hash) % AVATAR_CHARACTERS.length;
  return AVATAR_DATA_URIS[AVATAR_CHARACTERS[idx].id];
}
