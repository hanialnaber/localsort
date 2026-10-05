// On-device model: laya-ts + onnxruntime-web (WebGPU, WASM fallback). Mail text never leaves this tab.
import { Agent, emailState } from "laya-ts";
import QUESTIONS from "./questions.json";
import { MODEL_SHA256, MODEL_URL } from "./config";

/** Weight sidecars laya-ts does not hash itself; verified here before the model is built. */
const SIDECAR_SHA256: Record<string, string> = {
  "encoder.onnx.data": "0cfaedae551ee8ea1b9c2ae9d224305d187d85013121a160554640b7f101588e",
  "head.onnx.data": "9f515f5f60ad415c148ece77767b28f9bda7179bc56a2c8296c472dfd31188e8",
};
const ALL_SHA256 = {
  ...MODEL_SHA256,
  "tokenizer.json": "609d8f4c067cd3950f88594c5a802616cea245823836ef5848ee4fc40aab5b6f",
  "rl_agent_config.json": "87619d3e20757fcf46d59ce17ac3725266fe2313adae763a4f7a349eb85d1e84",
};

export interface Verdict {
  folder: string;
  confidence: number;
  probabilities: Record<string, number>;
  scam: number; // model's phishing probability
  action: number; // needs-action probability
}

let agent: Agent | null = null;

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function verifySidecars(onStatus: (msg: string) => void) {
  for (const [name, want] of Object.entries(SIDECAR_SHA256)) {
    onStatus(`Checking ${name} fingerprint…`);
    const res = await fetch(`${MODEL_URL}/${name}`);
    if (!res.ok) throw new Error(`Model file missing: ${name}`);
    const got = hex(await crypto.subtle.digest("SHA-256", await res.arrayBuffer()));
    if (got !== want) throw new Error(`Model file ${name} failed its SHA-256 check — refusing to run it.`);
  }
}

export let backend: "GPU" | "CPU" = "CPU";

/** The fp16 encoder needs WebGPU's shader-f16; without it, hide WebGPU so onnxruntime picks WASM (CPU). */
async function chooseBackend() {
  const gpu = (navigator as any).gpu;
  const adapter = gpu ? await gpu.requestAdapter().catch(() => null) : null;
  if (adapter?.features?.has("shader-f16")) { backend = "GPU"; return; }
  backend = "CPU";
  if (gpu) Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true });
}

export async function loadModel(onStatus: (msg: string) => void): Promise<void> {
  if (agent) return;
  await chooseBackend();
  await verifySidecars(onStatus);
  onStatus("Starting the on-device model…");
  agent = await Agent.load(MODEL_URL, {
    expectedSha256: ALL_SHA256,
    onProgress: (done, total, file) => onStatus(`Loading ${file} (${done}/${total})…`),
  });
}

const toVerdict = (res: any): Verdict => {
  const a = res.answers;
  return {
    folder: a.category.choice,
    confidence: a.category.confidence,
    probabilities: a.category.probabilities,
    scam: a.phishing.noul,
    action: a.action.noul,
  };
};

export async function classify(subject: string, body: string, sender: string): Promise<Verdict> {
  if (!agent) throw new Error("model not loaded");
  return toVerdict(await agent.predict(emailState(subject, body, sender), QUESTIONS as any));
}

/** Several emails per encoder run: better CPU/GPU throughput than one at a time. */
export async function classifyBatch(items: { subject: string; body: string; sender: string }[]): Promise<Verdict[]> {
  if (!agent) throw new Error("model not loaded");
  const res = await agent.predictBatch(items.map((x) => emailState(x.subject, x.body, x.sender)), QUESTIONS as any);
  return res.map(toVerdict);
}
