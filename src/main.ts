import { CONFIDENCE_GATE, FOLDERS, SUSPICIOUS_CATEGORY, SCAM_GATE, categoryName } from "./config";
import { initAuth, listInbox, msConfigured, setCategories, signIn, signOut, who, type Mail } from "./graph";
import { backend, classifyBatch, loadModel } from "./model";
import { baseDomain, decide, domainOf, forgetAll, rememberCorrection, ruleCount, scamChecks, type Decision } from "./rules";
import { demoInbox } from "./demo";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
type Row = { mail: Mail; d?: Decision; conf?: number; modelFolder?: string };
let rows: Row[] = [];
let mode: "demo" | "outlook" = "demo";

function status(text: string, state: "idle" | "busy" | "ok" | "err" = "busy") {
  $("status-text").textContent = text;
  $("status").dataset.state = state;
}

const isArabic = (s: string) => /[؀-ۿ]/.test(s);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function chip(folder: string | null) {
  if (!folder) return `<span class="chip unsure">Unsure · stays in Inbox</span>`;
  const f = FOLDERS[folder];
  return `<span class="chip" style="--c:${f.color}">${f.label} <span class="ar">${f.ar}</span></span>`;
}

function render() {
  const list = $("mail");
  list.innerHTML = rows.map((r, i) => {
    const m = r.mail, d = r.d;
    const dir = isArabic(m.subject + m.preview) ? ' dir="auto"' : "";
    const scam = d && d.scam >= SCAM_GATE
      ? `<div class="scam"><b>⚠ Possible scam</b><ul>${d.scamReasons.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "";
    const meta = d ? `<div class="meta">${chip(d.folder)}
        ${d.source === "your rule" ? `<span class="tag">your rule</span>` : r.conf !== undefined ? `<span class="tag">${Math.round(r.conf * 100)}% sure</span>` : ""}
        ${d.needsAction ? `<span class="tag act">needs action</span>` : ""}
        <select data-i="${i}" class="fix" aria-label="Correct folder"><option value="">Correct…</option>
          ${Object.entries(FOLDERS).map(([k, f]) => `<option value="${k}">${f.label}</option>`).join("")}</select></div>`
      : `<div class="meta"><span class="chip pending">Not sorted yet</span></div>`;
    return `<li class="${d && d.scam >= SCAM_GATE ? "is-scam" : ""}">
      <div class="from"><b>${esc(m.fromName || m.fromAddr)}</b> <span>${esc(m.fromAddr)}</span></div>
      <div class="subj"${dir}>${esc(m.subject)}</div>
      <div class="prev"${dir}>${esc(m.preview.slice(0, 180))}</div>${scam}${meta}</li>`;
  }).join("");
  list.querySelectorAll<HTMLSelectElement>("select.fix").forEach((s) => s.addEventListener("change", () => correct(+s.dataset.i!, s.value)));
  summarize();
}

function summarize() {
  const sorted = rows.filter((r) => r.d);
  if (!sorted.length) { $("summary").textContent = `${rows.length} emails`; $("chips").innerHTML = ""; return; }
  const counts: Record<string, number> = {};
  sorted.forEach((r) => { const k = r.d!.folder ?? "unsure"; counts[k] = (counts[k] ?? 0) + 1; });
  const scams = sorted.filter((r) => r.d!.scam >= SCAM_GATE).length;
  $("summary").textContent = `${sorted.length} sorted · ${counts.unsure ?? 0} left in Inbox · ${scams} flagged as possible scams`;
  $("chips").innerHTML = Object.entries(counts).filter(([k]) => k !== "unsure")
    .sort((a, b) => b[1] - a[1]).map(([k, n]) => `${chip(k)}<span class="n">${n}</span>`).join("");
  $("rules-info").textContent = ruleCount() ? `${ruleCount()} sender corrections remembered on this device.` : "";
}

async function writeBack(r: Row) {
  if (mode !== "outlook" || !$<HTMLInputElement>("write-back").checked || !r.d) return;
  const cats: string[] = [];
  if (r.d.folder) cats.push(categoryName(r.d.folder));
  if (r.d.scam >= SCAM_GATE) cats.push(SUSPICIOUS_CATEGORY);
  if (cats.length) await setCategories(r.mail, cats);
}

async function sortAll() {
  $<HTMLButtonElement>("btn-sort").disabled = true;
  try {
    await loadModel((m) => status(m));
    status("Sorting on this device…");
    const t0 = performance.now();
    const BATCH = 4;
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const verdicts = await classifyBatch(chunk.map(({ mail: m }) => ({
        subject: m.subject, body: m.preview, sender: m.fromName ? `${m.fromName} <${m.fromAddr}>` : m.fromAddr })));
      for (const [j, r] of chunk.entries()) {
        const v = verdicts[j], m = r.mail;
        r.conf = v.confidence; r.modelFolder = v.folder;
        r.d = decide(m.fromAddr, v, scamChecks(m.fromName, m.fromAddr, m.headers));
        await writeBack(r);
      }
      status(`Sorting on this device… ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
      render();
    }
    const ms = (performance.now() - t0) / Math.max(rows.length, 1);
    status(`Ready · ${Math.round(ms)} ms per email on this device (${backend})`, "ok");
  } catch (e) {
    console.error(e);
    status(String((e as Error).message ?? e), "err");
  } finally {
    $<HTMLButtonElement>("btn-sort").disabled = false;
  }
}

async function correct(i: number, folder: string) {
  if (!folder) return;
  const r = rows[i];
  rememberCorrection(r.mail.fromAddr, folder);
  rows.forEach((x) => {  // the rule applies to everything from this sender right away
    if (x.d && baseDomain(domainOf(x.mail.fromAddr)) === baseDomain(domainOf(r.mail.fromAddr))) x.d = { ...x.d, folder, source: "your rule" };
  });
  render();
  try { await writeBack(r); } catch (e) { status(String((e as Error).message), "err"); }
}

async function openWorkspace(newMode: "demo" | "outlook") {
  mode = newMode;
  $("hero").hidden = true;
  $("workspace").hidden = false;
  $("write-wrap").hidden = mode !== "outlook";
  $("btn-signout").textContent = mode === "outlook" ? "Sign out" : "Back";
  $("who").textContent = mode === "outlook" ? who() : "Sample inbox (synthetic emails, no account)";
  if (mode === "outlook") {
    status("Reading your inbox from Microsoft…");
    rows = (await listInbox(25)).map((mail) => ({ mail }));
  } else rows = demoInbox().map((mail) => ({ mail }));
  status(`Model not loaded · gate ${Math.round(CONFIDENCE_GATE * 100)}%`, "idle");
  render();
}

async function boot() {
  $("btn-demo").addEventListener("click", () => openWorkspace("demo"));
  $("btn-sort").addEventListener("click", sortAll);
  $("btn-forget").addEventListener("click", () => { forgetAll(); summarize(); });
  $("btn-signout").addEventListener("click", () => mode === "outlook" ? signOut() : location.reload());
  if (!msConfigured()) {
    $<HTMLButtonElement>("btn-signin").disabled = true;
    $("signin-note").textContent = "Microsoft sign-in needs an app registration (VITE_MS_CLIENT_ID). Sample mode works now.";
  } else {
    $("btn-signin").addEventListener("click", () => signIn());
    try {
      if (await initAuth()) await openWorkspace("outlook");
    } catch (e) { status(String((e as Error).message), "err"); }
  }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}
boot();
