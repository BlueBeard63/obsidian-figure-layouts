import { test } from "node:test";
import assert from "node:assert/strict";
import { asideSide, captionFor, galleryColumns, isImageFile, parseCalloutHeader, parseImageLine, phoneColumns } from "../src/parse.ts";

test("captionFor drops size hints and repeated file names", () => {
  assert.equal(captionFor("The login page", "login.png"), "The login page");
  assert.equal(captionFor("400", "shot.png"), "");
  assert.equal(captionFor("300x200", "shot.png"), "");
  assert.equal(captionFor("shot.png", "shot.png"), "");
  assert.equal(captionFor("shot.png", "Assets/shot.png"), "");
  assert.equal(captionFor(undefined), "");
  assert.equal(captionFor("  "), "");
});

test("galleryColumns uses the metadata or the image count up to 3", () => {
  assert.equal(galleryColumns("2", 6), 2);
  assert.equal(galleryColumns("4", 2), 4);
  assert.equal(galleryColumns("", 2), 2);
  assert.equal(galleryColumns(null, 5), 3);
  assert.equal(galleryColumns("0", 5), 3);
  assert.equal(galleryColumns("wide", 1), 1);
  assert.equal(galleryColumns("", 0), 1);
});

test("phoneColumns caps at two", () => {
  assert.equal(phoneColumns(1), 1);
  assert.equal(phoneColumns(3), 2);
});

test("isImageFile", () => {
  assert.ok(isImageFile("a.PNG"));
  assert.ok(isImageFile("a.jpeg"));
  assert.ok(!isImageFile("Note"));
  assert.ok(!isImageFile("clip.mp4"));
});

test("parseImageLine: one figure", () => {
  assert.deepEqual(parseImageLine("![[login.png|The login page]]"), [
    { target: "login.png", caption: "The login page", from: 0, to: 29 },
  ]);
});

test("parseImageLine: a row", () => {
  const imgs = parseImageLine("![[a.png|One]] ![[b.png|Two]]  ![[c.png]]");
  assert.deepEqual(
    imgs?.map((i) => [i.target, i.caption]),
    [
      ["a.png", "One"],
      ["b.png", "Two"],
      ["c.png", ""],
    ],
  );
  assert.equal(imgs?.[2].to, 41);
});

test("parseImageLine: markdown images and size hints", () => {
  assert.deepEqual(
    parseImageLine('![A diagram](img/d.svg "t") ![[w.png|400]]')?.map((i) => [i.target, i.caption]),
    [
      ["img/d.svg", "A diagram"],
      ["w.png", ""],
    ],
  );
});

test("parseImageLine: anything else is not an image line", () => {
  assert.equal(parseImageLine("Some text ![[a.png]]"), null);
  assert.equal(parseImageLine("![[Other note]]"), null);
  assert.equal(parseImageLine("![[a.png]] and"), null);
  assert.equal(parseImageLine(""), null);
  assert.equal(parseImageLine("   "), null);
});

test("parseCalloutHeader", () => {
  assert.deepEqual(parseCalloutHeader("> [!gallery|2] Before and after"), { type: "gallery", meta: "2", title: "Before and after" });
  assert.deepEqual(parseCalloutHeader("> [!Gallery]"), { type: "gallery", meta: "", title: "" });
  assert.deepEqual(parseCalloutHeader("> [!note]- Folded"), { type: "note", meta: "", title: "Folded" });
  assert.equal(parseCalloutHeader("> just a quote"), null);
});

test("asideSide defaults to right", () => {
  assert.equal(asideSide("left"), "left");
  assert.equal(asideSide(" Left "), "left");
  assert.equal(asideSide("right"), "right");
  assert.equal(asideSide(""), "right");
  assert.equal(asideSide(null), "right");
});
