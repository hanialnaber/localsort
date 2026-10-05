# localsort

**Email sorting that never sees your mail.** localsort sorts Outlook / Microsoft 365 mail into folders and flags scams with an AI model that runs **inside your browser**. There is no localsort server in the path of your mail: messages go from Microsoft Graph straight to your device, are classified there, and the result is written back to your own mailbox.

This repository is the complete client. Read it to verify the claim.

## What it does
- Sorts mail into 10 folders: Personal, Work, Money, Orders, Security, Jobs, Home, Newsletters, Promotions, Social. English and Arabic.
- **Leaves mail in the Inbox when it isn't sure** (confidence below 70%).
- Flags possible scams and says why: the model's own read, look-alike domains (`paypa1-support.com`), a display name that doesn't match the sending domain, and failed SPF / DKIM / DMARC in the message's own headers.
- Remembers your corrections per sender, on this device only.
- Optionally writes `localsort · <Folder>` categories to Outlook so the sorting shows on every device.

## Privacy, verifiable
| Data | Where it goes |
|---|---|
| Message subject, sender, preview | Microsoft Graph → this browser tab. Nowhere else. |
| Sign-in tokens | `sessionStorage` in this tab (MSAL, auth code + PKCE). No backend. |
| Your corrections | `localStorage` on this device. Never synced. |
| Model files | Downloaded once, then cached. Every file is checked against a pinned SHA-256 before it runs (`src/config.ts`, `src/model.ts`). |
| Telemetry / analytics | None. |

Network requests the app makes: `login.microsoftonline.com` (sign-in), `graph.microsoft.com` (your mail), and its own origin (app + model files). You can confirm this in your browser's DevTools → Network tab.

## Run it locally
Requires Node 20+.
```bash
npm install
npm run dev     # http://localhost:5173
```
Place the model package (`encoder.onnx`, `encoder.onnx.data`, `head.onnx`, `head.onnx.data`, `tokenizer.json`, `rl_agent_config.json`) in `public/model/`. Without Microsoft sign-in configured, **Try with sample emails** still works.

### Microsoft sign-in
1. https://entra.microsoft.com → App registrations → New registration. Accounts in any organizational directory **and** personal Microsoft accounts. Redirect URI: **Single-page application**, `http://localhost:5173/`.
2. API permissions → Microsoft Graph → Delegated: `User.Read`, `Mail.ReadWrite`.
3. `cp .env.example .env.local` and set `VITE_MS_CLIENT_ID`.

Company deployments: an admin grants consent once for the whole tenant (Entra → Enterprise applications → localsort → Permissions → Grant admin consent).

## How it runs
- Model: localsort, a fine-tuned [Laya](https://github.com/NandhaKishorM/laya) decision model (mmBERT encoder), vocabulary-pruned to English + Arabic, fp16 ONNX.
- Runtime: [laya-ts](vendor/laya-ts) on [ONNX Runtime Web](https://onnxruntime.ai/) — WebGPU when the GPU supports fp16 shaders, otherwise multi-threaded WebAssembly.
- Hosting must send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (multi-threaded WASM). The dev server already does.

## License
Apache-2.0. Includes laya-ts by Convai Innovations (Apache-2.0); see `NOTICE`. The trained localsort model weights are distributed separately under their own terms.
