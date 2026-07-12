import zlib from 'node:zlib';
import fs from 'node:fs';

// 生成背景视频 poster 兜底图：深色基底 + 顶部居中微光，匹配站点 --bg #0e0f13
const W = 1280, H = 720;
const raw = Buffer.alloc(H * (1 + W * 4)); // 每行前 1 字节 filter(0)

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

for (let y = 0; y < H; y++) {
  const rowStart = y * (1 + W * 4);
  raw[rowStart] = 0; // filter type 0
  for (let x = 0; x < W; x++) {
    // 顶部居中径向高光
    const dx = (x / W - 0.5);
    const dy = (y / H - 0.18);
    const dist = Math.sqrt(dx * dx + dy * dy);
    const glow = Math.max(0, 1 - dist * 1.9); // 0..1
    const base = 0.06 + 0.10 * (1 - y / H); // 上亮下暗
    const t = Math.min(1, base + glow * 0.22);

    // 基底色 #0e0f13 (14,15,19)，高光偏暖 accent #d9b382 (217,179,130)
    const r = lerp(14, 70, t);
    const g = lerp(15, 58, t);
    const b = lerp(19, 42, t);

    const o = rowStart + 1 + x * 4;
    raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
  }
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
const idat = zlib.deflateSync(raw, { level: 9 });
const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
fs.writeFileSync('public/background-poster.png', png);
console.log('poster written:', png.length, 'bytes', `${W}x${H}`);
