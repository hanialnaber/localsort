import { defineConfig } from "vite";
const ISOLATION = { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp" };
// onnxruntime-web is loaded at runtime from /ort via the import map, not bundled.
export default defineConfig({
  base: "./",
  build: { target: "es2022", rollupOptions: { external: ["onnxruntime-web", "onnxruntime-node"] } },
  optimizeDeps: { exclude: ["laya-ts", "onnxruntime-web", "onnxruntime-node"] },
  // Cross-origin isolation unlocks SharedArrayBuffer = multi-threaded WASM inference (several x faster on CPU).
  server: { port: 5173, strictPort: true, host: "127.0.0.1", headers: ISOLATION },
  preview: { headers: ISOLATION },
});
