import { syntaxTree } from "@codemirror/language";
import { type EditorState, type Extension, type Range, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";
import { parseImageLine, phoneColumns } from "./parse";

/** The caption under each image of a row. Every image gets one (empty when it has no caption) so the
 *  row's grid can pair each image with the cell below it. */
class CaptionWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  override eq(other: CaptionWidget): boolean {
    return other.text === this.text;
  }
  override toDOM(): HTMLElement {
    return createSpan({ cls: "figl-caption figl-lp-caption", text: this.text });
  }
}

/** The caption under a single image or video, as a block below its line. Obsidian draws some media
 *  (videos) as a block that replaces the line, which would hide a caption placed inside the line. */
class BlockCaptionWidget extends CaptionWidget {
  override toDOM(): HTMLElement {
    return createDiv({ cls: "figl-caption figl-lp-caption figl-lp-block-caption", text: this.text });
  }
}

/** Code blocks, front matter and the like keep their source; Obsidian names their lines' tokens. */
function inCodeOrMeta(state: EditorState, pos: number): boolean {
  const name = syntaxTree(state).resolveInner(pos, 1).name;
  return /codeblock|frontmatter|math|comment/i.test(name);
}

function isLivePreview(state: EditorState): boolean {
  return state.field(editorLivePreviewField, false) ?? false;
}

/** Obsidian shows the source of the line the cursor is on, so the layout would not fit it. */
function touchesSelection(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((r) => r.from <= to && r.to >= from);
}

/** Row layout: a line class and an inline caption after each image, for the visible lines only. */
function buildRows(view: EditorView): DecorationSet {
  const { state } = view;
  if (!isLivePreview(state)) return Decoration.none;
  const decos: Range<Decoration>[] = [];
  // A replaced region (like an image widget) can split one line across two visible ranges, so a line
  // must only be decorated once or it gets every caption twice.
  let lastLine = 0;
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = state.doc.lineAt(pos);
      pos = line.to + 1;
      if (line.number <= lastLine) continue;
      lastLine = line.number;
      if (touchesSelection(state, line.from, line.to)) continue;
      const images = parseImageLine(line.text);
      if (!images || inCodeOrMeta(state, line.from)) continue;
      const cols = images.length;
      decos.push(
        Decoration.line({
          class: cols === 1 ? "figl-lp-figure" : "figl-lp-row",
          attributes: { style: `--figl-cols: ${cols}; --figl-cols-phone: ${phoneColumns(cols)}` },
        }).range(line.from),
      );
      if (cols === 1) continue; // its caption is a block below the line (figureCaptions)
      for (const img of images) {
        decos.push(Decoration.widget({ widget: new CaptionWidget(img.caption), side: 1 }).range(line.from + img.to));
      }
    }
  }
  return Decoration.set(decos, true);
}

/** Single-figure captions as blocks below their lines. CodeMirror only takes block decorations from a
 *  state field, which sees the whole document, so code fences and front matter are tracked here by hand. */
function buildFigureCaptions(state: EditorState): DecorationSet {
  if (!isLivePreview(state)) return Decoration.none;
  const decos: Range<Decoration>[] = [];
  let fence = "";
  for (let n = 1; n <= state.doc.lines; n++) {
    const line = state.doc.line(n);
    const text = line.text;
    if (n === 1 && text.trim() === "---") {
      // front matter: skip to its closing ---
      while (n < state.doc.lines && state.doc.line(n + 1).text.trim() !== "---") n++;
      n++;
      continue;
    }
    const marker = /^\s*(`{3,}|~{3,})/.exec(text)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = "";
      continue;
    }
    if (fence || !text.includes("![")) continue;
    if (touchesSelection(state, line.from, line.to)) continue;
    const images = parseImageLine(text);
    if (images?.length !== 1 || !images[0].caption) continue;
    decos.push(Decoration.widget({ widget: new BlockCaptionWidget(images[0].caption), block: true, side: 1 }).range(line.to));
  }
  return Decoration.set(decos);
}

const figureCaptions = StateField.define<DecorationSet>({
  create: buildFigureCaptions,
  update(decos, tr) {
    const modeChanged = isLivePreview(tr.startState) !== isLivePreview(tr.state);
    return tr.docChanged || tr.selection || modeChanged ? buildFigureCaptions(tr.state) : decos;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export function liveExtension(): Extension {
  return [
    figureCaptions,
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
          this.decorations = buildRows(view);
        }
        update(u: ViewUpdate): void {
          const modeChanged = isLivePreview(u.startState) !== isLivePreview(u.state);
          if (u.docChanged || u.viewportChanged || u.selectionSet || modeChanged) this.decorations = buildRows(u.view);
        }
      },
      { decorations: (v) => v.decorations },
    ),
  ];
}
