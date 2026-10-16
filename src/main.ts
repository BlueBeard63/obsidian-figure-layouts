import { Plugin } from "obsidian";
import { registerReadingView } from "./reading";
import { liveExtension } from "./live";

export default class FigureLayoutsPlugin extends Plugin {
  override async onload(): Promise<void> {
    registerReadingView(this);
    this.registerEditorExtension(liveExtension());
  }
}
