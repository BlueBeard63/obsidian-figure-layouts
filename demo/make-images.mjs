// Generates the showcase vault's "photos": layered landscape scenes as SVG, deterministic, no dependencies.
//   node demo/make-images.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const out = resolve(dirname(fileURLToPath(import.meta.url)), "showcase");
mkdirSync(out, { recursive: true });

// Small seeded random so the scenes are the same every run.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** A ridge line across the width: midpoint displacement, returned as a closed polygon to the bottom. */
function ridge(rand, w, h, base, rough) {
  const n = 64;
  const pts = Array.from({ length: n + 1 }, () => 0);
  pts[0] = rand() - 0.5;
  pts[n] = rand() - 0.5;
  for (let step = n; step > 1; step /= 2) {
    for (let i = step / 2; i < n; i += step) {
      pts[i] = (pts[i - step / 2] + pts[i + step / 2]) / 2 + (rand() - 0.5) * (step / n) * 2;
    }
  }
  const line = pts.map((p, i) => `${((i / n) * w).toFixed(1)},${(base + p * rough * h).toFixed(1)}`);
  return `0,${h} ${line.join(" ")} ${w},${h}`;
}

function scene({ name, w, h, seed, sky, sun, layers, lake, stars }) {
  const rand = rng(seed);
  const parts = [
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${sky
      .map((c, i) => `<stop offset="${i / (sky.length - 1)}" stop-color="${c}"/>`)
      .join("")}</linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="${sun?.color ?? "#fff"}" stop-opacity="0.55"/><stop offset="1" stop-color="${sun?.color ?? "#fff"}" stop-opacity="0"/></radialGradient></defs>`,
    `<rect width="${w}" height="${h}" fill="url(#sky)"/>`,
  ];
  if (stars) {
    for (let i = 0; i < 140; i++) {
      parts.push(`<circle cx="${(rand() * w).toFixed(0)}" cy="${(rand() * h * 0.55).toFixed(0)}" r="${(rand() * 1.6 + 0.4).toFixed(1)}" fill="#fff" opacity="${(rand() * 0.7 + 0.2).toFixed(2)}"/>`);
    }
  }
  if (sun) {
    const [x, y, r] = [sun.x * w, sun.y * h, sun.r * Math.min(w, h)];
    parts.push(`<circle cx="${x}" cy="${y}" r="${r * 4}" fill="url(#glow)"/>`, `<circle cx="${x}" cy="${y}" r="${r}" fill="${sun.color}"/>`);
  }
  layers.forEach(([color, base, rough]) => parts.push(`<polygon points="${ridge(rand, w, h, base * h, rough)}" fill="${color}"/>`));
  if (lake) {
    parts.push(`<rect y="${lake.y * h}" width="${w}" height="${h - lake.y * h}" fill="${lake.color}"/>`);
    for (let i = 0; i < 26; i++) {
      const y = lake.y * h + (rand() ** 1.6) * (h - lake.y * h);
      const x = rand() * w;
      parts.push(`<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${(rand() * w * 0.12 + 20).toFixed(0)}" height="2" fill="#fff" opacity="${(rand() * 0.18 + 0.05).toFixed(2)}"/>`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n${parts.join("\n")}\n</svg>\n`;
  writeFileSync(resolve(out, `${name}.svg`), svg);
}

scene({
  name: "dawn-over-the-lake", w: 1800, h: 1000, seed: 3,
  sky: ["#2B2D5C", "#B7637A", "#F2B27A"], sun: { x: 0.62, y: 0.6, r: 0.05, color: "#FFE2B0" },
  layers: [["#6E4E6C", 0.52, 0.22], ["#4A3550", 0.6, 0.16], ["#2C2138", 0.68, 0.1]],
  lake: { y: 0.74, color: "#3B2E4A" },
});
scene({
  name: "ridge-at-noon", w: 1600, h: 1100, seed: 11,
  sky: ["#4E8FD0", "#A8D0EE"], sun: { x: 0.2, y: 0.18, r: 0.045, color: "#FFF8E0" },
  layers: [["#9DB6C8", 0.42, 0.3], ["#5F8A6E", 0.58, 0.2], ["#3E6A4E", 0.7, 0.14], ["#2A4A36", 0.82, 0.08]],
});
scene({
  name: "valley-in-fog", w: 1600, h: 1000, seed: 21,
  sky: ["#C9CED3", "#E6E8EA"],
  layers: [["#B3BAC0", 0.45, 0.2], ["#9AA3AA", 0.56, 0.16], ["#7D878F", 0.66, 0.12], ["#5E6870", 0.78, 0.08]],
});
scene({
  name: "dusk-pass", w: 1500, h: 1000, seed: 33,
  sky: ["#1D2847", "#8C4A5E", "#E8875A"], sun: { x: 0.45, y: 0.66, r: 0.06, color: "#FFC27A" },
  layers: [["#5A3046", 0.55, 0.26], ["#3A2236", 0.66, 0.14], ["#1F1524", 0.76, 0.08]],
});
scene({
  name: "night-camp", w: 1600, h: 1000, seed: 47, stars: true,
  sky: ["#070B1C", "#1A2448", "#2E3F6E"], sun: { x: 0.8, y: 0.2, r: 0.03, color: "#F3F0DE" },
  layers: [["#1E2A48", 0.6, 0.2], ["#121A30", 0.72, 0.12]],
  lake: { y: 0.8, color: "#0F1630" },
});
scene({
  name: "summit-portrait", w: 900, h: 1300, seed: 59,
  sky: ["#3D6FB0", "#9CC3E6", "#E8F0F6"], sun: { x: 0.7, y: 0.14, r: 0.07, color: "#FFFBEA" },
  layers: [["#D7E2EA", 0.36, 0.4], ["#8FA5B5", 0.55, 0.22], ["#4D6878", 0.7, 0.14], ["#2B3E4A", 0.84, 0.08]],
});
scene({
  name: "camp-below-the-col", w: 1000, h: 1250, seed: 71, stars: true,
  sky: ["#0D1430", "#3A3F6E", "#C27A6A"], sun: { x: 0.3, y: 0.62, r: 0.04, color: "#FFD3A0" },
  layers: [["#4A3E5E", 0.58, 0.22], ["#2E2840", 0.7, 0.12], ["#1A1626", 0.82, 0.06]],
});
console.log(`wrote 7 scenes to ${out}`);
