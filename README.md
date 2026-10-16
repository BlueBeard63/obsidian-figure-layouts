# Figure Layouts

An Obsidian plugin that lays out images the way a write-up or portfolio page would, in reading view and Live Preview.

| You write | You get |
| --- | --- |
| One image on its own line: `![[login.png\|The login page]]` | a figure: the image at its natural shape, the text after the bar underneath as a caption |
| Several on the same line: `![[a.png\|One]] ![[b.png\|Two]] ![[c.png]]` | a row: equal 4:3 cells side by side, each with its own caption |
| A gallery callout (below) | a grid: you choose the columns, one caption for the whole set |
| An aside callout (below) | an image next to text: the image in a column on one side, the text on the other |

```md
> [!gallery|2] Before and after the redesign
> ![[before.png]]
> ![[after.png]]
> ![[before-mobile.png]]
> ![[after-mobile.png]]
```

```md
> [!aside|right] The login page
> ![[login.png]]
> The form keeps the email field focused on load, and errors appear inline under each field.
>
> More paragraphs stay in the text column.
```

- In an aside, `right` or `left` is the image's side (right if you leave it out). The title is the image's caption. The text can start on the very next line. On phones the image sits above the text.

- The number after `gallery|` is the column count. Leave it out and it uses the number of images, up to 3.
- A number after an image's bar, like `![[shot.png|400]]`, is a display width (Obsidian's own syntax), not a caption.
- Markdown images work too: `![The caption](shot.png)`.
- Videos (`.mp4`, `.webm`, `.m4v`, `.mov`) get the same layouts and captions as images.
- Row and gallery cells are cropped to 4:3.
- On phones, rows and galleries show at most two images across (reading view).
- In Live Preview, the line the cursor is on shows its source as usual.

It is plain Markdown underneath. Without the plugin the images just show one after another.

## Development

```sh
npm install
npm test                                   # parser tests (node --test)
npm run build                              # typecheck + main.js
npm run demo                               # build into demo/, then open demo/ as a vault
node demo/make-images.mjs                  # regenerate the showcase "photos" in demo/showcase/
OBSIDIAN_VAULT="D:/path/to/vault" npm run dev   # watch, and install into a vault's .obsidian/plugins
```

Release: `npm version <x.y.z>`, then push the tag; the workflow publishes `main.js`, `manifest.json` and `styles.css`.

The demo vault has two notes: **Figure layouts test** (every layout and edge case, each saying what to expect) and
**Three days in the fells** (a short write-up using every layout, for the README and listing screenshots).
