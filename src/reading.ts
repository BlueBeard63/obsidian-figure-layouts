import type { MarkdownPostProcessorContext, Plugin } from "obsidian";
import { asideSide, captionFor, embedCaptions, galleryColumns, isMediaFile, parseCalloutHeader, phoneColumns } from "./parse";

const DONE = "figl-done";
const LAID_OUT = '.callout[data-callout="gallery"], .callout[data-callout="aside"]';

export function registerReadingView(plugin: Plugin): void {
  plugin.registerMarkdownPostProcessor((el, ctx) => {
    const captions = sourceCaptions(ctx, el);
    for (const callout of Array.from(el.querySelectorAll<HTMLElement>('.callout[data-callout="gallery"]'))) {
      layoutGallery(callout, ctx, el, captions);
    }
    for (const callout of Array.from(el.querySelectorAll<HTMLElement>('.callout[data-callout="aside"]'))) {
      layoutAside(callout, ctx, el, captions);
    }
    const paras = el.tagName === "P" ? [el] : Array.from(el.querySelectorAll<HTMLElement>("p"));
    for (const p of paras) {
      if (!p.closest(LAID_OUT)) layoutParagraph(p, captions);
    }
  });
}

/** True for a Markdown <img> or an embed of an image file. Post-processors run before embeds load, and
 *  Obsidian only adds "image-embed" once one has, so embeds are judged by their file name. */
function isImage(node: Node): node is HTMLElement {
  if (!(node instanceof HTMLElement)) return false;
  if (node.tagName === "IMG") return true;
  return node.hasClass("internal-embed") && (node.hasClass("image-embed") || node.hasClass("video-embed") || isMediaFile(node.getAttribute("src") ?? ""));
}

/** Whitespace and line breaks between images. */
function isFiller(node: Node): boolean {
  if (node.nodeType === Node.TEXT_NODE) return !(node.textContent ?? "").trim();
  return node instanceof HTMLElement && node.tagName === "BR";
}

/** The images of a paragraph that holds only images (and whitespace or line breaks), else null. */
function imageChildren(p: HTMLElement): HTMLElement[] | null {
  const images: HTMLElement[] = [];
  for (const node of Array.from(p.childNodes)) {
    if (isImage(node)) images.push(node);
    else if (!isFiller(node)) return null;
  }
  return images.length ? images : null;
}

/** Captions from the section's source text, by file name; each one is used up as its embed is laid out. */
type Captions = Map<string, string[]>;

function sourceCaptions(ctx: MarkdownPostProcessorContext, el: HTMLElement): Captions {
  const info = ctx.getSectionInfo(el);
  if (!info) return new Map();
  return embedCaptions(info.text.split("\n").slice(info.lineStart, info.lineEnd + 1).join("\n"));
}

function captionOf(img: HTMLElement, captions: Captions): string {
  if (img.tagName === "IMG") return captionFor(img.getAttribute("alt"));
  const src = img.getAttribute("src") ?? "";
  // The source wins: Obsidian leaves alt empty on video embeds. alt is the fallback when the section's
  // source isn't available (a callout drawn in Live Preview).
  return captions.get(src)?.shift() ?? captionFor(img.getAttribute("alt"), src);
}

/** Wraps one image in a figure with its caption underneath (when it has one). */
function wrapItem(img: HTMLElement, captions: Captions): HTMLElement {
  const item = createEl("figure", { cls: "figl-item" });
  img.replaceWith(item);
  item.appendChild(img);
  const caption = captionOf(img, captions);
  if (caption) item.createEl("figcaption", { cls: "figl-caption", text: caption });
  return item;
}

function setColumns(el: HTMLElement, cols: number): void {
  el.style.setProperty("--figl-cols", String(cols));
  el.style.setProperty("--figl-cols-phone", String(phoneColumns(cols)));
}

/** One image on its own: a figure at its natural shape. Several: a row of equal 4:3 cells. */
function layoutParagraph(p: HTMLElement, captions: Captions): void {
  if (p.hasClass(DONE)) return;
  const images = imageChildren(p);
  if (!images) return;
  p.addClass(DONE, images.length === 1 ? "figl-figure" : "figl-row");
  if (images.length > 1) setColumns(p, images.length);
  images.forEach((img) => wrapItem(img, captions));
}

/** > [!gallery|N] Caption: every image inside, in an N-column grid, the title as the caption below. */
function layoutGallery(callout: HTMLElement, ctx: MarkdownPostProcessorContext, root: HTMLElement, captions: Captions): void {
  if (callout.hasClass(DONE)) return;
  const content = callout.querySelector<HTMLElement>(".callout-content");
  if (!content) return;
  const images: HTMLElement[] = [];
  for (const p of Array.from(content.querySelectorAll<HTMLElement>("p"))) {
    images.push(...(imageChildren(p) ?? []));
  }
  callout.addClass(DONE, "figl-gallery");
  content.addClass("figl-grid");
  setColumns(content, galleryColumns(callout.getAttribute("data-callout-metadata"), images.length));
  images.forEach((img) => wrapItem(img, captions));
  if (!hasTitle(callout, "gallery", ctx, root)) callout.addClass("figl-untitled");
}

/**
 * > [!aside|right] Caption: the images at the start of the callout in a column beside the rest of it
 * (right by default, |left for the other side), the title as their caption.
 */
function layoutAside(callout: HTMLElement, ctx: MarkdownPostProcessorContext, root: HTMLElement, captions: Captions): void {
  if (callout.hasClass(DONE)) return;
  const content = callout.querySelector<HTMLElement>(".callout-content");
  if (!content) return;
  callout.addClass(DONE, "figl-aside");
  content.addClass("figl-aside-grid", `figl-${asideSide(callout.getAttribute("data-callout-metadata"))}`);

  // The leading images of the first paragraph, even when text follows on the next line (same paragraph).
  const media = createEl("figure", { cls: "figl-aside-media" });
  const first = content.firstElementChild;
  if (first instanceof HTMLElement && first.tagName === "P") {
    for (const node of Array.from(first.childNodes)) {
      if (isImage(node)) media.appendChild(node);
      else if (isFiller(node)) node.remove();
      else break;
    }
    if (!first.hasChildNodes()) first.remove();
  }
  Array.from(media.children).forEach((img) => wrapItem(img as HTMLElement, captions));

  const text = createDiv({ cls: "figl-aside-text" });
  while (content.firstChild) text.appendChild(content.firstChild);
  if (media.hasChildNodes()) {
    if (hasTitle(callout, "aside", ctx, root)) {
      const title = callout.querySelector(".callout-title-inner")?.textContent?.trim() ?? "";
      media.createEl("figcaption", { cls: "figl-caption", text: title });
    }
    content.appendChild(media);
  }
  content.appendChild(text);
}

/** Obsidian shows the callout type ("Gallery") when there is no title; the site shows no caption. */
function hasTitle(callout: HTMLElement, type: string, ctx: MarkdownPostProcessorContext, root: HTMLElement): boolean {
  const info = ctx.getSectionInfo(root);
  if (info) {
    const header = parseCalloutHeader(info.text.split("\n")[info.lineStart] ?? "");
    if (header?.type === type) return header.title !== "";
  }
  const title = callout.querySelector(".callout-title-inner")?.textContent?.trim() ?? "";
  return title !== "" && title.toLowerCase() !== type;
}
