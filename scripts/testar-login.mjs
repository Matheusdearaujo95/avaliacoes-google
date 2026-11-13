#!/usr/bin/env node
// Testa o login do robô e diz se o Google já liberou a API. Não imprime nenhum segredo.
const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret, GBP_REFRESH_TOKEN_PRINCIPAL: rt } = process.env;
const falta = [["GOOGLE_CLIENT_ID", id], ["GOOGLE_CLIENT_SECRET", secret], ["GBP_REFRESH_TOKEN_PRINCIPAL", rt]].filter(([, v]) => !v).map(([n]) => n);
if (falta.length) { console.log("❌ Faltam estes segredos no GitHub:", falta.join(", ")); process.exit(1); }

const r = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: rt, grant_type: "refresh_token" }),
});
const tok = await r.json();
if (!tok.access_token) { console.log("❌ Login falhou:", tok.error, "-", tok.error_description || ""); process.exit(1); }
console.log("✅ Login OK: o robô consegue entrar na conta Google.");
if (!String(tok.scope || "").includes("business.manage")) console.log("⚠️ A permissão business.manage não veio no token. Gere o refresh token de novo com esse escopo.");

const c = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", { headers: { Authorization: `Bearer ${tok.access_token}` } });
const contas = await c.json();
if (c.ok) {
  console.log("✅ API liberada! Contas encontradas:");
  const cab = { Authorization: `Bearer ${tok.access_token}` };
  for (const a of contas.accounts || []) {
    console.log("   -", a.accountName, "|", a.name, "|", a.type);
    let pageToken = "";
    do {
      const u = `https://mybusinessbusinessinformation.googleapis.com/v1/${a.name}/locations?readMask=name,title,metadata&pageSize=100${pageToken ? `&pageToken=${pageToken}` : ""}`;
      const res = await (await fetch(u, { headers: cab })).json();
      if (res.error) { console.log("     (não consegui listar os perfis:", res.error.status, String(res.error.message).slice(0, 150) + ")"); break; }
      for (const loc of res.locations || []) {
        console.log("     PERFIL:", JSON.stringify({ nome: loc.title, accountId: a.name.replace("accounts/", ""), locationId: loc.name.replace("locations/", ""), placeId: loc.metadata?.placeId || null }));
      }
      pageToken = res.nextPageToken || "";
    } while (pageToken);
  }
} else {
  const msg = contas.error?.message || "";
  console.log("⏳ API ainda não liberada pelo Google (normal enquanto o pedido está em análise).");
  console.log("   Detalhe:", c.status, msg.slice(0, 200));
}
