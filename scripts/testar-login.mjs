#!/usr/bin/env node
// Testa o login de cada conta Google do config.json e lista os perfis de empresa.
// Não imprime nenhum segredo.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.SEGREDOS) {
  try { for (const [k, v] of Object.entries(JSON.parse(process.env.SEGREDOS))) if (!process.env[k]) process.env[k] = v; } catch {}
}
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(path.join(RAIZ, "config.json"), "utf8"));
const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) { console.log("❌ Faltam GOOGLE_CLIENT_ID e/ou GOOGLE_CLIENT_SECRET nos segredos do GitHub."); process.exit(1); }

let falhas = 0;
for (const conta of config.contasGoogle) {
  console.log(`\n===== Conta "${conta.id}" (segredo ${conta.refreshTokenEnv}) =====`);
  const rt = process.env[conta.refreshTokenEnv];
  if (!rt) { console.log(`❌ Falta o segredo ${conta.refreshTokenEnv} no GitHub.`); falhas++; continue; }
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: rt, grant_type: "refresh_token" }),
  });
  const tok = await r.json();
  if (!tok.access_token) { console.log("❌ Login falhou:", tok.error, "-", tok.error_description || ""); falhas++; continue; }
  console.log("✅ Login OK.");
  const cab = { Authorization: `Bearer ${tok.access_token}` };
  const c = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", { headers: cab });
  const contas = await c.json();
  if (!c.ok) { console.log("⏳ API não liberada:", c.status, String(contas.error?.message || "").slice(0, 200)); falhas++; continue; }
  for (const a of contas.accounts || []) {
    console.log("   -", a.accountName, "|", a.name, "|", a.type);
    let pageToken = "";
    do {
      const u = `https://mybusinessbusinessinformation.googleapis.com/v1/${a.name}/locations?readMask=name,title,metadata&pageSize=100${pageToken ? `&pageToken=${pageToken}` : ""}`;
      const res = await (await fetch(u, { headers: cab })).json();
      if (res.error) { console.log("     (não consegui listar os perfis:", res.error.status, String(res.error.message).slice(0, 150) + ")"); break; }
      for (const loc of res.locations || []) {
        console.log("     PERFIL:", JSON.stringify({ nome: loc.title, conta: conta.id, accountId: a.name.replace("accounts/", ""), locationId: loc.name.replace("locations/", ""), placeId: loc.metadata?.placeId || null }));
      }
      pageToken = res.nextPageToken || "";
    } while (pageToken);
  }
}
if (falhas) process.exitCode = 1;
