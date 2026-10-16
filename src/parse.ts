// Pure helpers (no Obsidian or DOM imports) so they can be unit tested with node --test.
// The rules mirror the portfolio site build (internal/site/markdown.go) so the editor and the site agree.

/** File extensions a ![[wiki embed]] must have to count as an image. */
export const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

/** Obsidian's ![[img.png|300]] or |300x200 size hint: a display width, not a caption. */
const SIZE_HINT = /^\d+(x\d+)?$/;

export function isImageFile(name: string): boolean {
  return IMAGE_EXT.test(name.split("#")[0].trim());
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/**
 * The caption for an image, from the text after its bar (wiki embed) or its alt text (Markdown
 * image). Empty when there is none, when it is only a size hint, or when it just repeats the file
 * name (Obsidian fills alt with the link text when there is no bar).
 */
export function captionFor(label: string | null | undefined, target = ""): string {
  const text = (label ?? "").trim();
  if (!text || SIZE_HINT.test(text)) return "";
  if (target && (text === target || text === basename(target))) return "";
  return text;
}

/** Columns for a > [!gallery|N] callout: N when it is a positive number, else the image count, up to 3. */
export function galleryColumns(meta: string | null | undefined, count: number): number {
  const n = Number.parseInt((meta ?? "").trim(), 10);
  if (Number.isFinite(n) && n >= 1 && String(n) === (meta ?? "").trim()) return n;
  return Math.max(Math.min(3, count), 1);
}

/** Which side a > [!aside|left] callout puts its image on: right unless the metadata says left. */
export function asideSide(meta: string | null | undefined): "left" | "right" {
  return (meta ?? "").trim().toLowerCase() === "left" ? "left" : "right";
}

/** Phones show at most two images across. */
export function phoneColumns(cols: number): number {
  return Math.min(cols, 2);
}

export interface LineImage {
  /** File name or URL. */
  target: string;
  caption: string;
  /** Offsets of the whole ![[...]] or ![...](...) within the line. */
  from: number;
  to: number;
}

const WIKI_IMAGE = /!\[\[([^\]|]+?)(?:\|((?:\\\||[^\]])*))?\]\]/y;
const MD_IMAGE = /!\[((?:\\.|[^\]\\])*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/y;

/**
 * The images on a line that holds nothing but images and whitespace, or null for any other line.
 * Wiki embeds count only for image files; Markdown images always count (as on the site).
 */
export function parseImageLine(text: string): LineImage[] | null {
  const images: LineImage[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === " " || text[i] === "\t") {
      i++;
      continue;
    }
    WIKI_IMAGE.lastIndex = i;
    const wiki = WIKI_IMAGE.exec(text);
    if (wiki) {
      const target = wiki[1].trim();
      if (!isImageFile(target)) return null;
      // A bar escaped as \| (Obsidian writes that inside tables) is still a bar.
      images.push({ target, caption: captionFor(wiki[2]?.replace(/\\\|/g, "|"), target), from: i, to: i + wiki[0].length });
      i += wiki[0].length;
      continue;
    }
    MD_IMAGE.lastIndex = i;
    const md = MD_IMAGE.exec(text);
    if (md) {
      images.push({ target: md[2], caption: captionFor(md[1].replace(/\\(.)/g, "$1")), from: i, to: i + md[0].length });
      i += md[0].length;
      continue;
    }
    return null;
  }
  return images.length ? images : null;
}

export interface CalloutHeader {
  type: string;
  meta: string;
  title: string;
}

/** Parses a callout's first line, "> [!gallery|2] Title", or returns null. */
export function parseCalloutHeader(line: string): CalloutHeader | null {
  const m = /^\s*(?:>\s*)+\[!([^\]|]+)(?:\|([^\]]*))?\][+-]?\s*(.*)$/.exec(line);
  if (!m) return null;
  return { type: m[1].trim().toLowerCase(), meta: (m[2] ?? "").trim(), title: m[3].trim() };
}
