/** Bounded header validation before trusted decoding. Never execute or render original uploads. */
export function inspectCommunityImage(bytes: Uint8Array) {
  if (bytes.length < 12 || bytes.length > 8388608)
    throw new Error("Use an image up to 8 MB");
  const text = (start: number, end: number) =>
    new TextDecoder("latin1").decode(bytes.subarray(start, end));
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0,
    height = 0,
    type = "";
  if (
    bytes[0] === 0x89 &&
    text(1, 8) === "PNG\r\n\x1a\n" &&
    text(12, 16) === "IHDR" &&
    bytes.length >= 24
  ) {
    type = "image/png";
    width = dv.getUint32(16);
    height = dv.getUint32(20);
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    type = "image/jpeg";
    let pos = 2;
    while (pos + 4 < bytes.length) {
      if (bytes[pos] !== 0xff) break;
      const marker = bytes[pos + 1]!;
      if (marker === 0xda || marker === 0xd9) break;
      const length = dv.getUint16(pos + 2);
      if (length < 2 || pos + length + 2 > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 7) {
        height = dv.getUint16(pos + 5);
        width = dv.getUint16(pos + 7);
        break;
      }
      pos += length + 2;
    }
  } else if (
    text(0, 4) === "RIFF" &&
    text(8, 12) === "WEBP" &&
    bytes.length >= 30 &&
    dv.getUint32(4, true) === bytes.length - 8
  ) {
    type = "image/webp";
    const chunk = text(12, 16);
    if (chunk === "VP8X") {
      width = 1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16);
      height = 1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16);
    } else if (
      chunk === "VP8 " &&
      bytes[23] === 0x9d &&
      bytes[24] === 0x01 &&
      bytes[25] === 0x2a
    ) {
      width = dv.getUint16(26, true) & 0x3fff;
      height = dv.getUint16(28, true) & 0x3fff;
    } else if (chunk === "VP8L" && bytes[20] === 0x2f) {
      const bits = dv.getUint32(21, true);
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
    }
  }
  if (
    !type ||
    width < 1 ||
    height < 1 ||
    width > 8192 ||
    height > 8192 ||
    width * height > 20000000
  )
    throw new Error(
      "Use a valid JPEG, PNG or WebP up to 8192 pixels per side and 20 megapixels",
    );
  return { type, width, height };
}
/** Remove EXIF/XMP after trusted WebP re-encoding, regardless of provider metadata defaults. */
export function stripWebpMetadata(bytes: Uint8Array) {
  if (
    new TextDecoder().decode(bytes.subarray(0, 4)) !== "RIFF" ||
    new TextDecoder().decode(bytes.subarray(8, 12)) !== "WEBP"
  )
    throw new Error("Processor must return WebP");
  const chunks: Uint8Array[] = [];
  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const name = new TextDecoder().decode(bytes.subarray(pos, pos + 4)),
      size = new DataView(
        bytes.buffer,
        bytes.byteOffset + pos + 4,
        4,
      ).getUint32(0, true),
      end = pos + 8 + size + (size % 2);
    if (end > bytes.length) throw new Error("Invalid processed WebP");
    if (name === "ANIM" || name === "ANMF")
      throw new Error("Use a still image");
    if (name !== "EXIF" && name !== "XMP ") {
      const chunk = bytes.slice(pos, end);
      if (name === "VP8X") chunk[8] = chunk[8]! & ~0x0c;
      chunks.push(chunk);
    }
    pos = end;
  }
  if (pos !== bytes.length) throw new Error("Invalid processed image");
  const result = new Uint8Array(12 + chunks.reduce((n, c) => n + c.length, 0));
  result.set(bytes.subarray(0, 12));
  new DataView(result.buffer).setUint32(4, result.length - 8, true);
  pos = 12;
  for (const c of chunks) {
    result.set(c, pos);
    pos += c.length;
  }
  inspectCommunityImage(result);
  return result;
}
