// Deterministic layers around the model: sender memory, scam checks, and the final decision.
import { CONFIDENCE_GATE, SCAM_GATE } from "./config";
import type { Verdict } from "./model";

// ---------- sender memory (per device, never synced) ----------
const MEM_KEY = "localsort.senderRules.v1";
type Rules = Record<string, string>; // sender address or @domain -> folder

function loadRules(): Rules {
  try { return JSON.parse(localStorage.getItem(MEM_KEY) ?? "{}"); } catch { return {}; }
}
function saveRules(r: Rules) {
  try { localStorage.setItem(MEM_KEY, JSON.stringify(r)); } catch { /* storage blocked: rule lasts this session */ }
}
let rules = loadRules();

export const domainOf = (addr: string) => (addr.split("@")[1] ?? "").toLowerCase().replace(/>$/, "");
/** Registrable-ish domain: last two labels (good enough for sender memory; e.g. e.usa.experian.com -> experian.com). */
export const baseDomain = (d: string) => d.split(".").slice(-2).join(".");

export function rememberCorrection(sender: string, folder: string) {
  rules[sender.toLowerCase()] = folder;
  rules["@" + baseDomain(domainOf(sender))] = folder;
  saveRules(rules);
}
export function ruleFor(sender: string): string | null {
  const s = sender.toLowerCase();
  return rules[s] ?? rules["@" + baseDomain(domainOf(s))] ?? null;
}
export function forgetAll() { rules = {}; saveRules(rules); }
export const ruleCount = () => Object.keys(rules).filter((k) => !k.startsWith("@")).length;

// ---------- scam checks ----------
/** Brands scammers impersonate, with the domains they really send from. */
const BRANDS: Record<string, string[]> = {
  paypal: ["paypal.com"], microsoft: ["microsoft.com", "office.com", "outlook.com", "live.com", "microsoftonline.com"],
  apple: ["apple.com", "icloud.com"], amazon: ["amazon.com", "amazon.ae", "amazon.sa", "amazon.co.uk"],
  netflix: ["netflix.com"], dhl: ["dhl.com"], fedex: ["fedex.com"], aramex: ["aramex.com"], usps: ["usps.com"],
  google: ["google.com", "gmail.com"], wellsfargo: ["wellsfargo.com"], chase: ["chase.com"],
  arabbank: ["arabbank.com", "arabbank.jo"], emiratesnbd: ["emiratesnbd.com"], alrajhi: ["alrajhibank.com.sa"],
  dewa: ["dewa.gov.ae"], uaepass: ["uaepass.ae"], sanad: ["modee.gov.jo", "sanad.gov.jo"],
};
const LEET: Record<string, string> = { "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "rn": "m", "vv": "w" };
const unleet = (s: string) => Object.entries(LEET).reduce((acc, [k, v]) => acc.split(k).join(v), s.toLowerCase());

export interface ScamSignal { score: number; reasons: string[] }

/** headers: raw internetMessageHeaders from Graph (may be empty in demo mode). */
export function scamChecks(senderName: string, senderAddr: string, headers: { name: string; value: string }[] = []): ScamSignal {
  const reasons: string[] = [];
  let score = 0;
  const dom = domainOf(senderAddr);
  const base = baseDomain(dom);
  // Whole labels only ("paypa1-support.com" -> paypa1, support, com), so "applebees" is not "apple".
  const labels = dom.split(/[.-]/).filter(Boolean);
  const nameWords = senderName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

  for (const [brand, real] of Object.entries(BRANDS)) {
    if (real.some((r) => dom === r || dom.endsWith("." + r))) continue;
    if (labels.some((l) => l !== brand && unleet(l) === brand)) {
      reasons.push(`Look-alike domain: “${dom}” imitates ${brand}`); score = Math.max(score, 0.95);
    } else if (labels.includes(brand)) {
      reasons.push(`“${dom}” uses the name ${brand} but is not ${brand}'s real domain`); score = Math.max(score, 0.8);
    } else if (nameWords.includes(brand) || nameWords.join("") === brand) {
      reasons.push(`Display name says ${brand}, but it was sent from ${base}`); score = Math.max(score, 0.75);
    }
  }

  const auth = headers.filter((h) => /^authentication-results$/i.test(h.name)).map((h) => h.value.toLowerCase()).join(" ");
  if (auth) {
    if (/dmarc=fail/.test(auth)) { reasons.push("The sender's domain failed DMARC (it did not authorise this message)"); score = Math.max(score, 0.9); }
    else if (/spf=fail/.test(auth) && /dkim=(fail|none)/.test(auth)) { reasons.push("SPF and DKIM both failed: the sending server is not authorised"); score = Math.max(score, 0.85); }
  }
  return { score, reasons };
}

// ---------- final decision ----------
export interface Decision {
  folder: string | null; // null = stays in Inbox (unsure)
  source: "your rule" | "model" | "unsure";
  scam: number;
  scamReasons: string[];
  needsAction: boolean;
}

export function decide(sender: string, v: Verdict, sig: ScamSignal): Decision {
  const scam = Math.max(v.scam, sig.score);
  const scamReasons = [...sig.reasons];
  if (v.scam >= SCAM_GATE) scamReasons.unshift(`The model reads it as a scam (${Math.round(v.scam * 100)}%)`);
  const rule = ruleFor(sender);
  if (rule) return { folder: rule, source: "your rule", scam, scamReasons, needsAction: v.action >= 0.5 };
  if (v.confidence >= CONFIDENCE_GATE) return { folder: v.folder, source: "model", scam, scamReasons, needsAction: v.action >= 0.5 };
  return { folder: null, source: "unsure", scam, scamReasons, needsAction: v.action >= 0.5 };
}
