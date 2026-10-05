// localsort configuration. Nothing here is secret: a SPA client id is public by design.

/** Entra (Azure AD) app registration — "Single-page application", redirect URI = this app's origin. */
export const MS_CLIENT_ID: string = import.meta.env.VITE_MS_CLIENT_ID ?? "";
/** "common" = personal Outlook/Hotmail + any work/school tenant. A company can pin its tenant id. */
export const MS_AUTHORITY = `https://login.microsoftonline.com/${import.meta.env.VITE_MS_TENANT ?? "common"}`;
/** Read mail + set categories/move. Nothing else; no offline_access needed for a session app. */
export const MS_SCOPES = ["User.Read", "Mail.ReadWrite"];

export const MODEL_URL = new URL("model", document.baseURI).href;
/** Pinned SHA-256 of the shipped model graphs: a swapped or tampered model is refused before it runs. */
export const MODEL_SHA256: Record<string, string> = {
  "encoder.onnx": "b9f22d04e9dafc9f207a8bdcbe91dc2c20085aa7dbae5a770518f61145c27215",
  "head.onnx": "658cc074f13d9408524403a65944ea10911749fa73aad1425178c2add396a384",
};

/** Below this the email stays in the inbox, unsorted (v3: ≥0.7 → 91–93% right on held-out real mail). */
export const CONFIDENCE_GATE = 0.7;
/** Scam score at or above this gets the warning and the Suspicious category. */
export const SCAM_GATE = 0.5;

export const FOLDERS: Record<string, { label: string; ar: string; color: string }> = {
  personal: { label: "Personal", ar: "شخصي", color: "#7c3aed" },
  work: { label: "Work", ar: "عمل", color: "#2563eb" },
  money: { label: "Money", ar: "مال", color: "#059669" },
  orders: { label: "Orders", ar: "طلبات", color: "#d97706" },
  security: { label: "Security", ar: "أمان", color: "#dc2626" },
  jobs: { label: "Jobs", ar: "وظائف", color: "#0891b2" },
  home: { label: "Home", ar: "السكن", color: "#65a30d" },
  newsletters: { label: "Newsletters", ar: "نشرات", color: "#64748b" },
  promotions: { label: "Promotions", ar: "عروض", color: "#db2777" },
  social: { label: "Social", ar: "اجتماعي", color: "#9333ea" },
};
/** Outlook category names written back to the mailbox. */
export const categoryName = (folder: string) => `localsort · ${FOLDERS[folder]?.label ?? folder}`;
export const SUSPICIOUS_CATEGORY = "localsort · Suspicious";
