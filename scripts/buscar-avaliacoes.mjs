#!/usr/bin/env node
// Busca avaliações do Google para todos os negócios de config.json
// e grava um JSON estático por negócio em data/<id>.json (+ data/index.json).
//
// Fontes suportadas:
//   "business_profile" -> Google Business Profile API (TODAS as avaliações,
//                         só para perfis que a conta Google gerencia)
//   "places"           -> Places API (New) (qualquer negócio público,
//                         mas o Google devolve no máximo 5 avaliações)
//
// Sem dependências: Node 18+ (usa fetch nativo).
// Uso: node scripts/buscar-avaliacoes.mjs            (todos)
//      node scripts/buscar-avaliacoes.mjs meu-negocio (só um id)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PASTA_DADOS = path.join(RAIZ, "data");
const ESTRELAS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

// Carrega .env (sem dependências)
if (existsSync(path.join(RAIZ, ".env"))) {
  for (const linha of (await readFile(path.join(RAIZ, ".env"), "utf8")).split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// No GitHub Actions, todos os segredos chegam juntos em SEGREDOS (assim basta criar
// um segredo novo para conectar outra conta, sem editar o workflow).
if (process.env.SEGREDOS) {
  try { for (const [k, v] of Object.entries(JSON.parse(process.env.SEGREDOS))) if (!process.env[k]) process.env[k] = v; } catch {}
}

const config = JSON.parse(await readFile(path.join(RAIZ, "config.json"), "utf8"));
const filtroId = process.argv[2];

// ---------------------------------------------------------------- utilidades
async function pedir(url, opcoes = {}, tentativas = 3) {
  for (let i = 1; ; i++) {
    const r = await fetch(url, opcoes);
    if (r.ok) return r.json();
    const corpo = await r.text();
    if ((r.status === 429 || r.status >= 500) && i < tentativas) {
      await new Promise((ok) => setTimeout(ok, 1500 * i));
      continue;
    }
    throw new Error(`HTTP ${r.status} em ${url.split("?")[0]}: ${corpo.slice(0, 400)}`);
  }
}

const tokensEmCache = new Map();
async function tokenDeAcesso(nomeVariavel) {
  if (tokensEmCache.has(nomeVariavel)) return tokensEmCache.get(nomeVariavel);
  const refreshToken = process.env[nomeVariavel];
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret } = process.env;
  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error(`Faltam GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET ou ${nomeVariavel} nas variáveis de ambiente.`);
  }
  const dados = await pedir("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  tokensEmCache.set(nomeVariavel, dados.access_token);
  return dados.access_token;
}

// ------------------------------------------------- Google Business Profile API
async function buscarBusinessProfile(negocio) {
  const conta = config.contasGoogle.find((c) => c.id === (negocio.conta || "principal"));
  if (!conta) throw new Error(`Conta "${negocio.conta}" não existe em contasGoogle.`);
  const token = await tokenDeAcesso(conta.refreshTokenEnv);
  const cab = { Authorization: `Bearer ${token}` };

  const accountId = String(negocio.accountId).replace(/^accounts\//, "");
  const locationId = String(negocio.locationId).replace(/^locations\//, "");
  const base = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`;

  const avaliacoes = [];
  let pageToken = "";
  let media = null;
  let total = null;
  do {
    const url = `${base}?pageSize=50&orderBy=updateTime%20desc${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const pagina = await pedir(url, { headers: cab });
    media = pagina.averageRating ?? media;
    total = pagina.totalReviewCount ?? total;
    for (const a of pagina.reviews || []) {
      avaliacoes.push({
        id: a.reviewId,
        autor: a.reviewer?.isAnonymous ? "Usuário do Google" : a.reviewer?.displayName || "Usuário do Google",
        foto: a.reviewer?.profilePhotoUrl || null,
        linkAutor: null,
        estrelas: ESTRELAS[a.starRating] || 0,
        texto: limparTextoTraduzido(a.comment || ""),
        data: a.createTime,
        atualizada: a.updateTime,
        resposta: a.reviewReply ? { texto: a.reviewReply.comment, data: a.reviewReply.updateTime } : null,
      });
    }
    pageToken = pagina.nextPageToken || "";
  } while (pageToken);

  return {
    nome: negocio.nome,
    media: media ?? calcularMedia(avaliacoes),
    total: total ?? avaliacoes.length,
    linkAvaliar: negocio.placeId ? `https://search.google.com/local/writereview?placeid=${negocio.placeId}` : null,
    linkMaps: negocio.placeId ? `https://www.google.com/maps/place/?q=place_id:${negocio.placeId}` : null,
    avaliacoes,
  };
}

// O Business Profile às vezes manda "texto (Translated by Google) ... (Original) ..."
function limparTextoTraduzido(t) {
  const m = t.match(/\(Original\)\s*([\s\S]*)$/);
  return (m ? m[1] : t.replace(/\(Translated by Google\)[\s\S]*$/, "")).trim();
}

// ------------------------------------------------------------ Places API (New)
async function buscarPlaces(negocio) {
  const chave = process.env.GOOGLE_PLACES_API_KEY;
  if (!chave) throw new Error("Falta GOOGLE_PLACES_API_KEY nas variáveis de ambiente.");
  const idioma = negocio.idioma || config.idioma || "pt-BR";
  const url = `https://places.googleapis.com/v1/places/${negocio.placeId}?languageCode=${idioma}`;
  const p = await pedir(url, {
    headers: {
      "X-Goog-Api-Key": chave,
      "X-Goog-FieldMask": "displayName,rating,userRatingCount,reviews,googleMapsUri",
    },
  });
  return {
    nome: negocio.nome || p.displayName?.text,
    media: p.rating ?? null,
    total: p.userRatingCount ?? null,
    linkAvaliar: `https://search.google.com/local/writereview?placeid=${negocio.placeId}`,
    linkMaps: p.googleMapsUri || null,
    avaliacoes: (p.reviews || []).map((a) => ({
      id: a.name,
      autor: a.authorAttribution?.displayName || "Usuário do Google",
      foto: a.authorAttribution?.photoUri || null,
      linkAutor: a.authorAttribution?.uri || null,
      estrelas: a.rating || 0,
      texto: (a.originalText?.text || a.text?.text || "").trim(),
      data: a.publishTime,
      atualizada: a.publishTime,
      resposta: null,
    })),
  };
}

// ----------------------------------------------------------------- principal
function calcularMedia(lista) {
  if (!lista.length) return null;
  return Math.round((lista.reduce((s, a) => s + a.estrelas, 0) / lista.length) * 10) / 10;
}

async function lerAnterior(arquivo) {
  if (!existsSync(arquivo)) return null;
  try { return JSON.parse(await readFile(arquivo, "utf8")); } catch { return null; }
}

await mkdir(PASTA_DADOS, { recursive: true });
const indice = [];
let falhas = 0;

for (const negocio of config.negocios) {
  if (filtroId && negocio.id !== filtroId) continue;
  if (negocio.ativo === false) continue;
  const arquivo = path.join(PASTA_DADOS, `${negocio.id}.json`);
  try {
    const resultado =
      negocio.fonte === "business_profile" ? await buscarBusinessProfile(negocio)
      : negocio.fonte === "places" ? await buscarPlaces(negocio)
      : (() => { throw new Error(`fonte desconhecida: ${negocio.fonte}`); })();

    resultado.avaliacoes.sort((a, b) => new Date(b.data) - new Date(a.data));
    const saida = {
      id: negocio.id,
      fonte: negocio.fonte,
      atualizadoEm: new Date().toISOString(),
      ...resultado,
    };
    await writeFile(arquivo, JSON.stringify(saida, null, 2));
    indice.push({ id: negocio.id, nome: saida.nome, media: saida.media, total: saida.total, guardadas: saida.avaliacoes.length, atualizadoEm: saida.atualizadoEm });
    console.log(`✔ ${negocio.id}: ${saida.avaliacoes.length} avaliações (média ${saida.media}, total no Google ${saida.total})`);
  } catch (erro) {
    falhas++;
    // Mantém o arquivo anterior para o widget continuar funcionando.
    const anterior = await lerAnterior(arquivo);
    if (anterior) indice.push({ id: negocio.id, nome: anterior.nome, media: anterior.media, total: anterior.total, guardadas: anterior.avaliacoes.length, atualizadoEm: anterior.atualizadoEm, erro: erro.message });
    console.error(`✖ ${negocio.id}: ${erro.message}`);
  }
}

if (!filtroId) await writeFile(path.join(PASTA_DADOS, "index.json"), JSON.stringify(indice, null, 2));
if (falhas) process.exitCode = 1;
