// Genereert de native iOS AppIcon- en Splash-assets uit de bestaande MAIRFM-branding.
//
// Bewust zonder externe beeldbibliotheek: de repo heeft er geen en een nieuwe
// dependency toevoegen voor drie PNG's is het niet waard. Dit bestand doet
// precies genoeg PNG: 8-bit RGBA/RGB decoderen, over een dekkende achtergrond
// leggen, met een geheel getal opschalen en terugschrijven als RGB zonder alpha.
//
// Waarom zonder alpha: Apple weigert een AppIcon met alfakanaal.
//
// Gebruik:  node scripts/make-ios-assets.mjs
import fs from 'node:fs';
import zlib from 'node:zlib';

const BG = [0x07, 0x07, 0x07];        // #070707, gelijk aan de web-app achtergrond
const ICON_SRC = 'mair-icon-512.png';
const ICON_OUT = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png';
const SPLASH_OUT = [
  'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png',
  'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png',
  'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png',
];
const SPLASH_SIZE = 2732;
const SPLASH_LOGO = 1024;

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

// Decodeert 8-bit PNG's met kleurtype 2 (RGB) of 6 (RGBA), zonder interlace.
// Dat is wat de MAIRFM-assets zijn; alles daarbuiten weigeren we expliciet.
function decodePng(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file} is geen PNG`);
  const width = buf.readUInt32BE(16), height = buf.readUInt32BE(20);
  const depth = buf[24], colorType = buf[25], interlace = buf[28];
  if (depth !== 8 || ![2, 6].includes(colorType) || interlace !== 0)
    throw new Error(`${file}: alleen 8-bit RGB/RGBA zonder interlace, kreeg depth=${depth} type=${colorType} interlace=${interlace}`);

  const parts = [];
  let offset = 8;
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') parts.push(buf.subarray(offset + 8, offset + 8 + length));
    if (type === 'IEND') break;
    offset += length + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(parts));

  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const pixels = Buffer.alloc(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const row = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let value = line[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`${file}: onbekend filtertype ${filter}`);
      row[x] = value & 0xff;
    }
  }
  return { width, height, bpp, pixels };
}

// Schrijft RGB zonder alfakanaal (kleurtype 2), filter 0 per scanline.
function encodeRgb(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Legt de bron over een dekkende achtergrond en schaalt met een geheel getal op.
// Nearest-neighbour is hier exact: bij 2x wordt elke bronpixel een blok van 2x2,
// dus er ontstaat geen interpolatieonscherpte.
function flattenAndScale(src, scale) {
  const w = src.width * scale, h = src.height * scale;
  const out = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    const sy = (y / scale) | 0;
    for (let x = 0; x < w; x++) {
      const sx = (x / scale) | 0;
      const si = (sy * src.width + sx) * src.bpp;
      const alpha = src.bpp === 4 ? src.pixels[si + 3] / 255 : 1;
      const di = (y * w + x) * 3;
      for (let c = 0; c < 3; c++) out[di + c] = Math.round(src.pixels[si + c] * alpha + BG[c] * (1 - alpha));
    }
  }
  return { width: w, height: h, rgb: out };
}

// Dekkend vlak in de merkachtergrond met het logo gecentreerd.
function splash(src, size, logoSize) {
  const out = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) { out[i * 3] = BG[0]; out[i * 3 + 1] = BG[1]; out[i * 3 + 2] = BG[2] }
  const scale = logoSize / src.width, offset = ((size - logoSize) / 2) | 0;
  for (let y = 0; y < logoSize; y++) {
    const sy = Math.min(src.height - 1, (y / scale) | 0);
    for (let x = 0; x < logoSize; x++) {
      const sx = Math.min(src.width - 1, (x / scale) | 0);
      const si = (sy * src.width + sx) * src.bpp;
      const alpha = src.bpp === 4 ? src.pixels[si + 3] / 255 : 1;
      if (!alpha) continue;
      const di = ((y + offset) * size + (x + offset)) * 3;
      for (let c = 0; c < 3; c++) out[di + c] = Math.round(src.pixels[si + c] * alpha + BG[c] * (1 - alpha));
    }
  }
  return out;
}

const src = decodePng(ICON_SRC);
console.log(`bron ${ICON_SRC}: ${src.width}x${src.height}, ${src.bpp === 4 ? 'RGBA' : 'RGB'}`);
if (src.bpp === 4) {
  let transparent = 0;
  for (let i = 3; i < src.pixels.length; i += 4) if (src.pixels[i] < 255) transparent++;
  console.log(`transparante pixels: ${transparent} van ${src.width * src.height}`);
}

const icon = flattenAndScale(src, 1024 / src.width);
fs.writeFileSync(ICON_OUT, encodeRgb(icon.width, icon.height, icon.rgb));
console.log(`geschreven ${ICON_OUT}: ${icon.width}x${icon.height} RGB, ${(fs.statSync(ICON_OUT).size / 1024).toFixed(1)}KB`);

const splashPng = encodeRgb(SPLASH_SIZE, SPLASH_SIZE, splash(src, SPLASH_SIZE, SPLASH_LOGO));
for (const out of SPLASH_OUT) {
  fs.writeFileSync(out, splashPng);
  console.log(`geschreven ${out}: ${SPLASH_SIZE}x${SPLASH_SIZE} RGB, ${(fs.statSync(out).size / 1024).toFixed(1)}KB`);
}
