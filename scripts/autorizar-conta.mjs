#!/usr/bin/env node
// Autoriza uma conta Google (que gerencia perfis de empresa) e mostra:
//  1) o refresh token para colocar no .env
//  2) os accountId / locationId de todos os perfis dessa conta (para o config.json)
//
// Uso:  node scripts/autorizar-conta.mjs
// Repita para cada conta Google que você quiser conectar (não há limite de contas).

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(path.join(RAIZ, ".env"))) {
  for (const linha of (await readFile(path.join(RAIZ, ".env"), "utf8")).split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) {
  console.error("Preencha GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env primeiro.");
  process.exit(1);
}

const REDIRECT = "http://localhost:8080";
const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
url.search = new URLSearchParams({
  client_id: id,
  redirect_uri: REDIRECT,
  response_type: "code",
  scope: "https://www.googleapis.com/auth/business.manage",
  access_type: "offline",
  prompt: "consent",
}).toString();

console.log("\n1) Abra este link no navegador do seu computador e entre com a conta Google que gerencia os perfis:\n");
console.log(url.toString());
console.log("\n2) No fim, o navegador vai para uma página 'localhost' que não abre. Isso é normal.");
console.log("   Copie o endereço inteiro da barra do navegador e cole aqui.\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const colado = (await rl.question("Endereço colado: ")).trim();
rl.close();
const code = colado.startsWith("http") ? new URL(colado).searchParams.get("code") : colado;

const r = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: REDIRECT, grant_type: "authorization_code" }),
});
const tok = await r.json();
if (!tok.refresh_token) {
  console.error("Não veio refresh token:", tok);
  process.exit(1);
}
console.log("\n✔ Refresh token (coloque no .env, ex.: GBP_REFRESH_TOKEN_PRINCIPAL=...):\n");
console.log(tok.refresh_token);

const cab = { Authorization: `Bearer ${tok.access_token}` };
const contas = await (await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", { headers: cab })).json();
if (contas.error) {
  console.error("\nNão consegui listar as contas. Seu projeto já foi aprovado para a Business Profile API?\n", contas.error.message);
  process.exit(1);
}
console.log("\nPerfis encontrados (copie para o config.json):\n");
for (const conta of contas.accounts || []) {
  let pageToken = "";
  do {
    const u = `https://mybusinessbusinessinformation.googleapis.com/v1/${conta.name}/locations?readMask=name,title,metadata&pageSize=100${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await (await fetch(u, { headers: cab })).json();
    for (const loc of res.locations || []) {
      console.log(JSON.stringify({
        id: loc.title.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        nome: loc.title,
        fonte: "business_profile",
        conta: "principal",
        accountId: conta.name.replace("accounts/", ""),
        locationId: loc.name.replace("locations/", ""),
        placeId: loc.metadata?.placeId || null,
      }) + ",");
    }
    pageToken = res.nextPageToken || "";
  } while (pageToken);
}
