// Microsoft sign-in (MSAL, auth code + PKCE, no backend) and the few Graph calls localsort makes.
// Tokens stay in this browser's session storage; mail goes Graph -> this tab, nowhere else.
import { PublicClientApplication, type AccountInfo, InteractionRequiredAuthError } from "@azure/msal-browser";
import { MS_AUTHORITY, MS_CLIENT_ID, MS_SCOPES } from "./config";

export interface Mail {
  id: string;
  subject: string;
  preview: string;
  fromName: string;
  fromAddr: string;
  received: string;
  categories: string[];
  headers: { name: string; value: string }[];
  webLink?: string;
}

let pca: PublicClientApplication | null = null;
let account: AccountInfo | null = null;

export const msConfigured = () => MS_CLIENT_ID.length > 0;

export async function initAuth(): Promise<AccountInfo | null> {
  if (!msConfigured()) return null;
  pca = new PublicClientApplication({
    auth: { clientId: MS_CLIENT_ID, authority: MS_AUTHORITY, redirectUri: window.location.origin + window.location.pathname },
    cache: { cacheLocation: "sessionStorage" },
  });
  await pca.initialize();
  const res = await pca.handleRedirectPromise();
  account = res?.account ?? pca.getAllAccounts()[0] ?? null;
  return account;
}

export async function signIn() {
  if (!pca) throw new Error("Microsoft sign-in is not configured (VITE_MS_CLIENT_ID).");
  await pca.loginRedirect({ scopes: MS_SCOPES, prompt: "select_account" });
}

export async function signOut() {
  if (pca && account) await pca.logoutRedirect({ account });
}

async function token(): Promise<string> {
  if (!pca || !account) throw new Error("not signed in");
  try {
    return (await pca.acquireTokenSilent({ scopes: MS_SCOPES, account })).accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) { await pca.acquireTokenRedirect({ scopes: MS_SCOPES, account }); }
    throw e;
  }
}

async function graph(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Graph ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json();
}

/** Newest inbox messages. Headers come with $select so SPF/DKIM/DMARC results can be checked locally. */
export async function listInbox(top = 25): Promise<Mail[]> {
  const sel = "id,subject,bodyPreview,from,receivedDateTime,categories,internetMessageHeaders,webLink";
  const data = await graph(`/me/mailFolders/inbox/messages?$top=${top}&$orderby=receivedDateTime desc&$select=${sel}`);
  return data.value.map((m: any) => ({
    id: m.id,
    subject: m.subject ?? "",
    preview: m.bodyPreview ?? "",
    fromName: m.from?.emailAddress?.name ?? "",
    fromAddr: m.from?.emailAddress?.address ?? "",
    received: m.receivedDateTime,
    categories: m.categories ?? [],
    headers: m.internetMessageHeaders ?? [],
    webLink: m.webLink,
  }));
}

/** Writes localsort's categories, keeping any the user set themselves. */
export async function setCategories(m: Mail, add: string[]) {
  const keep = m.categories.filter((c) => !c.startsWith("localsort · "));
  const categories = [...new Set([...keep, ...add])];
  await graph(`/me/messages/${m.id}`, { method: "PATCH", body: JSON.stringify({ categories }) });
  m.categories = categories;
}

export const who = () => account?.username ?? "";
