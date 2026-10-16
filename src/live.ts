import { syntaxTree } from "@codemirror/language";
import type { EditorState, Extension, Range } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";
import { parseImageLine, phoneColumns } from "./parse";

/** The caption under an image. Every image gets one (empty when it has no caption) so a row's grid
 *  can pair each image with the cell below it. */
class CaptionWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  override eq(other: CaptionWidget): boolean {
    return other.text === this.text;
  }
  override toDOM(): HTMLElement {
    return createSpan({ cls: "imgl-caption imgl-lp-caption", text: this.text });
  }
}

/** Code blocks, front matter and the like keep their source; Obsidian names their lines' tokens. */
function inCodeOrMeta(state: EditorState, pos: number): boolean {
  const name = syntaxTree(state).resolveInner(pos, 1).name;
  return /codeblock|frontmatter|math|comment/i.test(name);
}

function build(view: EditorView): DecorationSet {
  const { state } = view;
  if (!(state.field(editorLivePreviewField, false) ?? false)) return Decoration.none;
  const ranges = state.selection.ranges;
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
      // Obsidian shows the source of the line the cursor is on, so the layout would not fit it.
      if (ranges.some((r) => r.from <= line.to && r.to >= line.from)) continue;
      const images = parseImageLine(line.text);
      if (!images || inCodeOrMeta(state, line.from)) continue;
      const cols = images.length;
      decos.push(
        Decoration.line({
          class: cols === 1 ? "imgl-lp-figure" : "imgl-lp-row",
          attributes: { style: `--imgl-cols: ${cols}; --imgl-cols-phone: ${phoneColumns(cols)}` },
        }).range(line.from),
      );
      for (const img of images) {
        decos.push(Decoration.widget({ widget: new CaptionWidget(img.caption), side: 1 }).range(line.from + img.to));
      }
    }
  }
  return Decoration.set(decos, true);
}

export function liveExtension(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(u: ViewUpdate): void {
        const modeChanged = u.startState.field(editorLivePreviewField, false) !== u.state.field(editorLivePreviewField, false);
        if (u.docChanged || u.viewportChanged || u.selectionSet || modeChanged) this.decorations = build(u.view);
      }
    },
    { decorations: (v) => v.decorations },
  );
}
