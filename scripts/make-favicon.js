const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

function markSvg(size) {
  if (size <= 32) {
    const font = Math.round(size * 0.5);
    const y = Math.round(size * 0.72);
    return Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0B0B0C"/>
  <text x="50%" y="${y}" text-anchor="middle" fill="#F2F2F0" font-family="Arial Black, Impact, Helvetica, sans-serif" font-size="${font}" font-weight="900">SB</text>
</svg>`,
    );
  }
  const skin = Math.round(size * 0.28);
  const bid = Math.round(size * 0.36);
  const skinY = Math.round(size * 0.42);
  const bidY = Math.round(size * 0.82);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0B0B0C"/>
  <text x="50%" y="${skinY}" text-anchor="middle" fill="#F2F2F0" font-family="Arial Black, Impact, Helvetica, sans-serif" font-size="${skin}" font-weight="900">SKIN</text>
  <text x="50%" y="${bidY}" text-anchor="middle" fill="#F2F2F0" font-family="Arial Black, Impact, Helvetica, sans-serif" font-size="${bid}" font-weight="900">BID</text>
</svg>`,
  );
}

function rgbaToBmpIco(images) {
  const entries = [];
  const blobs = [];
  let offset = 6 + 16 * images.length;
  for (const img of images) {
    const size = img.size;
    const header = Buffer.alloc(40);
    header.writeUInt32LE(40, 0);
    header.writeInt32LE(size, 4);
    header.writeInt32LE(size * 2, 8);
    header.writeUInt16LE(1, 12);
    header.writeUInt16LE(32, 14);
    const xor = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const src = ((size - 1 - y) * size + x) * 4;
        const dst = (y * size + x) * 4;
        xor[dst] = img.rgba[src + 2];
        xor[dst + 1] = img.rgba[src + 1];
        xor[dst + 2] = img.rgba[src];
        xor[dst + 3] = img.rgba[src + 3];
      }
    }
    const andRow = Math.ceil(size / 32) * 4;
    const blob = Buffer.concat([
      header,
      xor,
      Buffer.alloc(andRow * size),
    ]);
    blobs.push(blob);
    const entry = Buffer.alloc(16);
    entry[0] = size === 256 ? 0 : size;
    entry[1] = size === 256 ? 0 : size;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(blob.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += blob.length;
  }
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(1, 2);
  dir.writeUInt16LE(images.length, 4);
  return Buffer.concat([dir, ...entries, ...blobs]);
}

async function raster(size) {
  const png = await sharp(markSvg(size)).png().toBuffer();
  const { data } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { png, rgba: data, size };
}

async function main() {
  const s16 = await raster(16);
  const s32 = await raster(32);
  const s48 = await raster(48);

  const wordmark = await sharp(
    path.join(process.cwd(), "public/skinbid-wordmark.png"),
  )
    .resize(154, 154, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();
  await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: { r: 11, g: 11, b: 12, alpha: 255 },
    },
  })
    .composite([{ input: wordmark, gravity: "centre" }])
    .png()
    .toFile("app/apple-icon.png");

  fs.writeFileSync("app/icon.png", s32.png);
  const ico = rgbaToBmpIco([s16, s32, s48]);
  fs.writeFileSync("app/favicon.ico", ico);
  fs.writeFileSync("public/favicon.ico", ico);
  console.log("wrote", { ico: ico.length, icon: s32.png.length });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
