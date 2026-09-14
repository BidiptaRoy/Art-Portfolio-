import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildImagePath,
  cleanMultiline,
  cleanSingleLine,
  describeFileProblem,
  detectImageType,
  isValidImagePath,
  slugify,
  validateDesignInput,
} from "../src/lib/designs/rules.ts";

const DESIGN_ID = "3f2a9c1e-8b7d-4e6f-a5c4-1b2d3e4f5a6b";
const FILE_ID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const bytes = (text: string) => new TextEncoder().encode(text);
const BELL = String.fromCharCode(7);
const NUL = String.fromCharCode(0);

test("identifies PNG, JPEG, and WebP files by their contents", () => {
  assert.equal(
    detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])),
    "image/png",
  );
  assert.equal(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(
    detectImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])),
    "image/webp",
  );
  assert.equal(detectImageType(bytes("GIF89a......")), null);
  assert.equal(detectImageType(bytes("<svg xmlns='http://www.w3.org/2000/svg'>")), null);
  assert.equal(detectImageType(bytes("%PDF-1.7")), null);
  assert.equal(detectImageType(new Uint8Array([])), null);
});

test("explains unsupported, empty, and oversized files", () => {
  assert.equal(describeFileProblem({ name: "art.png", type: "image/png", size: 1000 }), null);
  assert.match(
    describeFileProblem({ name: "art.gif", type: "image/gif", size: 1000 }) ?? "",
    /isn't a PNG, JPEG, or WebP/,
  );
  assert.match(
    describeFileProblem({ name: "art.svg", type: "image/svg+xml", size: 1000 }) ?? "",
    /isn't a PNG, JPEG, or WebP/,
  );
  assert.match(
    describeFileProblem({ name: "notes.pdf", type: "application/pdf", size: 1000 }) ?? "",
    /isn't a PNG, JPEG, or WebP/,
  );
  assert.match(describeFileProblem({ name: "e.png", type: "image/png", size: 0 }) ?? "", /empty/);
  assert.match(
    describeFileProblem({ name: "big.png", type: "image/png", size: 11 * 1024 * 1024 }) ?? "",
    /The limit is 10 MB/,
  );
});

test("keeps image paths inside the design's own folder", () => {
  const path = buildImagePath(DESIGN_ID, "design", "image/png", FILE_ID);
  assert.equal(path, `${DESIGN_ID}/design-${FILE_ID}.png`);
  assert.ok(isValidImagePath(path, DESIGN_ID, "design"));
  assert.ok(!isValidImagePath(path, DESIGN_ID, "mockup"));
  assert.ok(!isValidImagePath(path, "00000000-0000-4000-8000-000000000000", "design"));
  assert.ok(!isValidImagePath(`../${path}`, DESIGN_ID, "design"));
  assert.ok(!isValidImagePath(`${DESIGN_ID}/design-${FILE_ID}.svg`, DESIGN_ID, "design"));
  assert.ok(!isValidImagePath(42, DESIGN_ID, "design"));
});

test("creates readable web addresses from titles", () => {
  assert.equal(
    slugify("How Vaccines Train Your Immune System"),
    "how-vaccines-train-your-immune-system",
  );
  assert.equal(slugify("  Café & Neurons!! ".normalize("NFC")), "cafe-and-neurons");
  assert.equal(slugify("???"), "design");
  assert.ok(slugify(`${"a".repeat(30)} ${"b".repeat(40)}`).length <= 60);
});

test("cleans pasted text", () => {
  assert.equal(
    cleanMultiline(`Line one  \r\n\r\n\r\n\r\nLine two${BELL}`),
    "Line one\n\nLine two",
  );
  assert.equal(cleanSingleLine(`  The${NUL}  Neuron\n `), "The Neuron");
});

test("validates design details", () => {
  const valid = {
    id: DESIGN_ID,
    title: "  The   Neuron ",
    subject: "Neuroscience",
    description: "",
    altText: "Labeled diagram of a neuron",
    productType: "",
    status: "draft",
    image: { path: `${DESIGN_ID}/design-${FILE_ID}.png`, width: 4500, height: 5400 },
    mockup: null,
    mockupAltText: "",
  };

  const ok = validateDesignInput(valid);
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.value.title, "The Neuron");
    assert.equal(ok.value.productType, "T-shirt");
    assert.equal(ok.value.image.width, 4500);
  }

  const bad = validateDesignInput({
    ...valid,
    title: "",
    altText: "   ",
    status: "archived",
    image: { path: "somewhere-else/design.png" },
  });
  assert.ok(!bad.ok);
  if (!bad.ok) {
    assert.ok(bad.errors.title);
    assert.ok(bad.errors.altText);
    assert.ok(bad.errors.status);
    assert.ok(bad.errors.image);
  }

  assert.ok(!validateDesignInput({ ...valid, description: "x".repeat(1001) }).ok);
  assert.ok(!validateDesignInput({ ...valid, id: "not-a-uuid" }).ok);
  assert.ok(
    !validateDesignInput({ ...valid, mockup: { path: `${DESIGN_ID}/design-${FILE_ID}.png` } }).ok,
    "a mockup must use a mockup path",
  );
  assert.ok(!validateDesignInput(null).ok);
});
