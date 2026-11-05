/**
 * Demo color palettes. Ancient Egypt palettes from
 * https://www.media.io/color-palette/ancient-egypt-color-palette.html
 *
 * Each palette is five raw colors. applyPalette() maps them onto the CSS
 * tokens in style.css (--bg, --surface, --accent, ...) for both light and
 * dark scheme, so switching is instant: one <style> element is rewritten,
 * nothing re-renders.
 *
 * The mapping is by luminance, not by position: the lightest color becomes
 * the paper, the darkest the ink, and the most saturated of the others the
 * accent. Accents are then pushed toward ink (light) or paper (dark) until
 * they reach 4.5:1 contrast, so every palette stays readable.
 */

export interface Palette {
  id: string;
  name: string;
  colors: readonly string[];
}

export const DEFAULT_PALETTE = "default";

export const PALETTES: readonly Palette[] = [
  {
    id: "temple-sandstone",
    name: "Temple Sandstone",
    colors: ["#D8C7A2", "#C2A36B", "#8C6B3E", "#F2E7D0", "#3B2B20"],
  },
  {
    id: "papyrus-scroll",
    name: "Papyrus Scroll",
    colors: ["#F7F1E1", "#E6D6B8", "#C9B18A", "#A68B62", "#5B4A36"],
  },
  {
    id: "lapis-and-gold",
    name: "Lapis and Gold",
    colors: ["#1C3F95", "#0E1F4F", "#D4AF37", "#F1E3B0", "#2B2B2B"],
  },
  {
    id: "malachite-garden",
    name: "Malachite Garden",
    colors: ["#1F6B4A", "#2F8F68", "#8BC5A0", "#DDE7D5", "#4A3B2A"],
  },
  {
    id: "karnak-sunset",
    name: "Karnak Sunset",
    colors: ["#E07A3F", "#C24E2C", "#F2C14E", "#F7E6C6", "#2F2A26"],
  },
  {
    id: "nile-midnight",
    name: "Nile Midnight",
    colors: ["#0B1D2A", "#123A5A", "#2A6F97", "#A9D6E5", "#EAE2D6"],
  },
  {
    id: "desert-dusk",
    name: "Desert Dusk",
    colors: ["#B58E72", "#8F6A55", "#6E4A3A", "#E6D7C3", "#2D2420"],
  },
  {
    id: "lotus-blossom",
    name: "Lotus Blossom",
    colors: ["#E9B7C2", "#C97C8B", "#7A3E52", "#F6E8EB", "#BFA18A"],
  },
  {
    id: "pharaoh-jewel-box",
    name: "Pharaoh Jewel Box",
    colors: ["#0E7C7B", "#1A2A6C", "#D7263D", "#F9D65C", "#1B1B1E"],
  },
  {
    id: "obsidian-relief",
    name: "Obsidian Relief",
    colors: ["#111111", "#2B2B2B", "#6B5B4D", "#C7B299", "#F3E9D2"],
  },
  {
    id: "copper-hieroglyphs",
    name: "Copper Hieroglyphs",
    colors: ["#B66A3C", "#8F3B2E", "#E3B46B", "#F5E2C8", "#2E2A28"],
  },
  {
    id: "oasis-mint",
    name: "Oasis Mint",
    colors: ["#4DB6A3", "#1E7F76", "#BFE8D8", "#F3F0E5", "#8C7B5A"],
  },
  {
    id: "royal-linen",
    name: "Royal Linen",
    colors: ["#F8F3E8", "#E9DFCF", "#CBBFA6", "#9C8C72", "#4E453B"],
  },
  {
    id: "sun-disk-gold",
    name: "Sun Disk Gold",
    colors: ["#F2C14E", "#D4A017", "#8A6A12", "#FFF1C1", "#3A2A14"],
  },
  {
    id: "clay-shabti",
    name: "Clay Shabti",
    colors: ["#B65C4C", "#8C3B2F", "#E0AFA0", "#F4E8E1", "#3B2F2B"],
  },
  {
    id: "sphinx-stone",
    name: "Sphinx Stone",
    colors: ["#CFC7BC", "#A89F93", "#7C736B", "#EDE7DF", "#2E2B28"],
  },
  {
    id: "river-reed",
    name: "River Reed",
    colors: ["#7D8F5B", "#556B2F", "#B7C58B", "#EFE9D6", "#4A3F2F"],
  },
  {
    id: "sacred-ink",
    name: "Sacred Ink",
    colors: ["#2A2F36", "#4E5D6C", "#C2B6A6", "#F2ECE3", "#9A7B4F"],
  },
  {
    id: "turquoise-amulet",
    name: "Turquoise Amulet",
    colors: ["#2BB3B1", "#0F6F73", "#D9B26E", "#F5F0E6", "#1D2B2A"],
  },
  {
    id: "pyramid-nightfire",
    name: "Pyramid Nightfire",
    colors: ["#1A1A24", "#3D2C45", "#B84A3A", "#E1B86A", "#F2E6D8"],
  },
];

type Rgb = [number, number, number];

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

const parse = (hex: string): Rgb => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const hex = (c: Rgb): string =>
  `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** Linear sRGB mix: t = 0 gives a, t = 1 gives b. */
const mix = (a: Rgb, b: Rgb, t: number): Rgb => a.map((v, i) => v + (b[i] - v) * t) as Rgb;

/** WCAG relative luminance. */
const luminance = (c: Rgb): number => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: Rgb, b: Rgb): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const chroma = (c: Rgb): number => (Math.max(...c) - Math.min(...c)) / 255;

/** Moves color toward target in small steps until it reaches ratio against bg. */
const ensureContrast = (color: Rgb, bg: Rgb, target: Rgb, ratio: number): Rgb => {
  let out = color;
  for (let i = 0; i < 20 && contrast(out, bg) < ratio; i++) out = mix(out, target, 0.1);
  return out;
};

const onColor = (bg: Rgb): string => (contrast(bg, WHITE) >= contrast(bg, BLACK) ? "#fff" : "#111");

type Tokens = Record<string, string>;

function derive(colors: readonly string[]): {light: Tokens; dark: Tokens} {
  const rgb = colors.map(parse).sort((a, b) => luminance(b) - luminance(a));
  const paper = rgb[0];
  const ink = rgb[rgb.length - 1];
  const middle = rgb.slice(1, -1);
  const pick = (score: (c: Rgb) => number): Rgb =>
    middle.reduce((best, c) => (score(c) > score(best) ? c : best));

  // Light: paper background, ink text, a saturated darker accent.
  const lSurface = mix(paper, WHITE, 0.8);
  const lBg = mix(paper, WHITE, 0.45);
  const lText = ensureContrast(ink, lBg, BLACK, 10);
  const lAccent = ensureContrast(
    pick((c) => chroma(c) * (1.2 - luminance(c))),
    lSurface,
    lText,
    4.5,
  );

  // Dark: ink pushed almost to black, paper text, a saturated lighter accent.
  let dBg = ink;
  for (let i = 0; i < 20 && luminance(dBg) > 0.01; i++) dBg = mix(dBg, BLACK, 0.15);
  const dSurface = mix(dBg, paper, 0.06);
  const dText = mix(paper, WHITE, 0.3);
  const dAccent = ensureContrast(
    pick((c) => chroma(c) * (0.4 + luminance(c))),
    dSurface,
    dText,
    4.5,
  );

  return {
    light: {
      bg: hex(lBg),
      surface: hex(lSurface),
      "surface-2": hex(mix(paper, ink, 0.04)),
      text: hex(lText),
      muted: hex(ensureContrast(mix(lText, paper, 0.4), lBg, lText, 4.5)),
      border: hex(mix(paper, ink, 0.14)),
      accent: hex(lAccent),
      "accent-soft": hex(mix(lSurface, lAccent, 0.15)),
      "on-accent": onColor(lAccent),
    },
    dark: {
      bg: hex(dBg),
      surface: hex(dSurface),
      "surface-2": hex(mix(dBg, paper, 0.11)),
      text: hex(dText),
      muted: hex(ensureContrast(mix(dText, dBg, 0.38), dBg, dText, 4.5)),
      border: hex(mix(dBg, paper, 0.18)),
      accent: hex(dAccent),
      "accent-soft": hex(mix(dBg, dAccent, 0.2)),
      "on-accent": onColor(dAccent),
    },
  };
}

const declarations = (tokens: Tokens): string =>
  Object.entries(tokens)
    .map(([key, value]) => `--${key}: ${value};`)
    .join(" ");

let styleEl: HTMLStyleElement | undefined;

/** Applies a palette by id; unknown ids and "default" restore style.css. */
export function applyPalette(id: string): void {
  const palette = PALETTES.find((p) => p.id === id);
  const root = document.documentElement;
  if (!palette) {
    root.removeAttribute("data-palette");
    styleEl?.remove();
    styleEl = undefined;
    return;
  }
  const {light, dark} = derive(palette.colors);
  styleEl ??= document.head.appendChild(document.createElement("style"));
  styleEl.id = "demo-palette";
  styleEl.textContent =
    `:root[data-palette] { ${declarations(light)} }\n`
    + `@media (prefers-color-scheme: dark) { :root[data-palette] { ${declarations(dark)} } }`;
  root.dataset.palette = palette.id;
}
