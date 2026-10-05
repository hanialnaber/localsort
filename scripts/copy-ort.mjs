// Copies the pinned onnxruntime-web runtime into public/ort so it is served from our own origin (no CDN).
import { cpSync, mkdirSync, readdirSync } from "node:fs";
const src = "node_modules/onnxruntime-web/dist", dst = "public/ort";
mkdirSync(dst, { recursive: true });
for (const f of readdirSync(src)) if (f === "ort.webgpu.bundle.min.mjs" || /^ort-wasm-simd-threaded.*\.(wasm|mjs)$/.test(f)) cpSync(`${src}/${f}`, `${dst}/${f}`);
