import { describe, it, expect } from "vitest";
import { inspectCommunityImage, stripWebpMetadata } from "./community-images";
const png = () => {
  const b = new Uint8Array(24);
  b.set([137, 80, 78, 71, 13, 10, 26, 10]);
  b.set(new TextEncoder().encode("IHDR"), 12);
  const d = new DataView(b.buffer);
  d.setUint32(16, 640);
  d.setUint32(20, 480);
  return b;
};
export function webp() {
  const b = new Uint8Array(30);
  b.set(new TextEncoder().encode("RIFF"), 0);
  new DataView(b.buffer).setUint32(4, 22, true);
  b.set(new TextEncoder().encode("WEBPVP8X"), 8);
  new DataView(b.buffer).setUint32(16, 10, true);
  b[24] = 1;
  b[27] = 1;
  return b;
}
describe("untrusted community image bounds and metadata removal", () => {
  it("uses actual binary headers rather than names, MIME strings or SVG scripts", () => {
    expect(inspectCommunityImage(png())).toEqual({
      type: "image/png",
      width: 640,
      height: 480,
    });
    expect(() =>
      inspectCommunityImage(
        new TextEncoder().encode('<svg onload="alert(1)"></svg>'),
      ),
    ).toThrow("valid JPEG");
    expect(() =>
      inspectCommunityImage(new TextEncoder().encode("%PDF-1.7 script")),
    ).toThrow("valid JPEG");
  });
  it("rejects oversized uploads and decompression-bomb dimensions before decoding", () => {
    expect(() => inspectCommunityImage(new Uint8Array(8388609))).toThrow(
      "8 MB",
    );
    const b = png();
    new DataView(b.buffer).setUint32(16, 100000);
    expect(() => inspectCommunityImage(b)).toThrow("20 megapixels");
    expect(() => inspectCommunityImage(new Uint8Array(2))).toThrow();
  });
  it("removes EXIF/location and XMP chunks from re-encoded derivatives and clears metadata flags", () => {
    const image = webp();
    image[20] = 0x0c;
    const exif = new Uint8Array(12);
    exif.set(new TextEncoder().encode("EXIF"));
    new DataView(exif.buffer).setUint32(4, 4, true);
    exif.set(new TextEncoder().encode("GPS!"), 8);
    const b = new Uint8Array(image.length + exif.length);
    b.set(image);
    b.set(exif, image.length);
    new DataView(b.buffer).setUint32(4, b.length - 8, true);
    const cleaned = stripWebpMetadata(b);
    expect(new TextDecoder().decode(cleaned)).not.toContain("GPS");
    expect(new TextDecoder().decode(cleaned)).not.toContain("EXIF");
    expect(cleaned.length).toBe(30);
    expect(cleaned[20]! & 0x0c).toBe(0);
  });
  it("rejects non-WebP output, broken chunk lengths and animation", () => {
    expect(() => stripWebpMetadata(png())).toThrow("WebP");
    const b = webp();
    new DataView(b.buffer).setUint32(16, 999999, true);
    expect(() => stripWebpMetadata(b)).toThrow("Invalid");
    const animated = webp();
    animated.set(new TextEncoder().encode("ANIM"), 12);
    expect(() => stripWebpMetadata(animated)).toThrow("still image");
  });
});
