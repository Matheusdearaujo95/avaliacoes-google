/*!
 * Widget de Avaliações do Google — leve, sem dependências, isolado em Shadow DOM.
 *
 * Uso no site:
 *   <div class="avaliacoes-google"
 *        data-src="https://SEU-DOMINIO/avaliacoes/data/meu-negocio.json"
 *        data-layout="carrossel"      (carrossel | grade | lista)
 *        data-tema="claro"            (claro | escuro)
 *        data-min-estrelas="4"        (esconde notas abaixo disso)
 *        data-max="20"                (quantas mostrar)
 *        data-so-com-texto="sim"      (esconde avaliações só com estrelas)
 *        data-cor="#1a73e8"></div>
 *   <script src="https://SEU-DOMINIO/avaliacoes/widget/avaliacoes.js" defer></script>
 */
(function () {
  "use strict";
  if (window.__avaliacoesGoogle) return;
  window.__avaliacoesGoogle = true;

  var CSS = [
    ":host{all:initial;display:block;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:var(--tx);",
    "--fd:#fff;--cd:#fff;--tx:#202124;--tx2:#5f6368;--bd:#e3e5e8;--estrela:#fbbc04;--cor:#1a73e8}",
    ":host([data-tema=escuro]){--fd:#151719;--cd:#202326;--tx:#e8eaed;--tx2:#9aa0a6;--bd:#33373b}",
    "*{box-sizing:border-box}",
    ".w{background:var(--fd);padding:16px 0}",
    ".topo{display:flex;flex-wrap:wrap;align-items:center;gap:12px 20px;justify-content:space-between;padding:0 4px 16px}",
    ".resumo{display:flex;align-items:center;gap:12px}",
    ".g{font-weight:700;font-size:20px;letter-spacing:-.5px}",
    ".g b:nth-child(1){color:#4285f4}.g b:nth-child(2){color:#ea4335}.g b:nth-child(3){color:#fbbc05}.g b:nth-child(4){color:#4285f4}.g b:nth-child(5){color:#34a853}.g b:nth-child(6){color:#ea4335}",
    ".nota{font-size:28px;font-weight:700;line-height:1}",
    ".sub{font-size:13px;color:var(--tx2);margin-top:2px}",
    ".est{color:var(--estrela);font-size:16px;letter-spacing:1px;white-space:nowrap}",
    ".est i{font-style:normal;color:var(--bd)}",
    ".btn{display:inline-block;background:var(--cor);color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:9px 16px;border-radius:999px}",
    ".btn:hover{filter:brightness(1.08)}",
    ".lista{display:grid;gap:14px}",
    ".grade{grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}",
    ".carrossel{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding:2px}",
    ".carrossel::-webkit-scrollbar{display:none}",
    ".carrossel .card{flex:0 0 min(320px,85%);scroll-snap-align:start}",
    ".card{background:var(--cd);border:1px solid var(--bd);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px}",
    ".autor{display:flex;align-items:center;gap:10px;min-width:0}",
    ".av{width:40px;height:40px;border-radius:50%;flex:none;object-fit:cover;background:var(--cor);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}",
    ".nome{font-weight:600;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--tx);text-decoration:none}",
    ".data{font-size:12px;color:var(--tx2)}",
    ".txt{font-size:14px;line-height:1.5;margin:0;white-space:pre-line}",
    ".txt.corte{display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}",
    ".mais{background:none;border:0;padding:0;color:var(--cor);font:inherit;font-size:13px;cursor:pointer;align-self:flex-start}",
    ".resp{font-size:13px;color:var(--tx2);border-left:3px solid var(--bd);padding-left:10px}",
    ".resp strong{color:var(--tx)}",
    ".nav{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}",
    ".nav button{width:36px;height:36px;border-radius:50%;border:1px solid var(--bd);background:var(--cd);color:var(--tx);cursor:pointer;font-size:16px}",
    ".rodape{font-size:11px;color:var(--tx2);text-align:right;margin-top:10px}",
    ".rodape a{color:inherit}"
  ].join("");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function urlSegura(u) { return /^https:\/\//i.test(u || "") ? esc(u) : ""; }
  function estrelas(n) {
    var r = Math.round(n || 0), s = "";
    for (var i = 1; i <= 5; i++) s += i <= r ? "★" : "<i>★</i>";
    return '<span class="est" aria-label="' + r + ' de 5 estrelas">' + s + "</span>";
  }
  function quando(iso) {
    var d = new Date(iso); if (isNaN(d)) return "";
    var dias = Math.floor((Date.now() - d) / 864e5);
    if (dias < 1) return "hoje";
    if (dias < 2) return "ontem";
    if (dias < 7) return "há " + dias + " dias";
    if (dias < 30) { var s = Math.floor(dias / 7); return "há " + s + (s > 1 ? " semanas" : " semana"); }
    if (dias < 365) { var m = Math.floor(dias / 30); return "há " + m + (m > 1 ? " meses" : " mês"); }
    var a = Math.floor(dias / 365); return "há " + a + (a > 1 ? " anos" : " ano");
  }

  function card(a) {
    var foto = urlSegura(a.foto);
    var ini = esc((a.autor || "?").trim().charAt(0).toUpperCase());
    var av = foto
      ? '<img class="av" src="' + foto + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML=\'<span class=av>' + ini + '</span>\'">'
      : '<span class="av">' + ini + "</span>";
    var link = urlSegura(a.linkAutor);
    var nome = link
      ? '<a class="nome" href="' + link + '" target="_blank" rel="noopener nofollow">' + esc(a.autor) + "</a>"
      : '<span class="nome">' + esc(a.autor) + "</span>";
    var longo = (a.texto || "").length > 260;
    return '<article class="card">' +
      '<div class="autor">' + av + '<div style="min-width:0">' + nome + '<div class="data">' + quando(a.data) + "</div></div></div>" +
      estrelas(a.estrelas) +
      (a.texto ? '<p class="txt' + (longo ? " corte" : "") + '">' + esc(a.texto) + "</p>" + (longo ? '<button class="mais" type="button">Ler mais</button>' : "") : "") +
      (a.resposta && a.resposta.texto ? '<div class="resp"><strong>Resposta do proprietário:</strong> ' + esc(a.resposta.texto) + "</div>" : "") +
      "</article>";
  }

  function montar(el, dados) {
    var ds = el.dataset;
    var min = +ds.minEstrelas || 0;
    var max = +ds.max || 20;
    var layout = ["grade", "lista", "carrossel"].indexOf(ds.layout) >= 0 ? ds.layout : "carrossel";
    var lista = (dados.avaliacoes || []).filter(function (a) {
      return a.estrelas >= min && (ds.soComTexto !== "sim" || (a.texto || "").trim());
    }).slice(0, max);

    var raiz = el.shadowRoot || el.attachShadow({ mode: "open" });
    if (ds.cor) el.style.setProperty("--cor", ds.cor);
    var avaliar = urlSegura(dados.linkAvaliar);
    var maps = urlSegura(dados.linkMaps);
    var media = dados.media != null ? Number(dados.media).toFixed(1).replace(".", ",") : "–";

    raiz.innerHTML = "<style>" + CSS + "</style>" +
      '<section class="w" aria-label="Avaliações no Google">' +
        '<div class="topo"><div class="resumo">' +
          '<span class="g" aria-label="Google"><b>G</b><b>o</b><b>o</b><b>g</b><b>l</b><b>e</b></span>' +
          '<div><div style="display:flex;align-items:center;gap:8px"><span class="nota">' + media + "</span>" + estrelas(dados.media) + "</div>" +
          '<div class="sub">' + (dados.total != null ? dados.total.toLocaleString("pt-BR") + " avaliações" : "") + "</div></div>" +
        "</div>" + (avaliar ? '<a class="btn" href="' + avaliar + '" target="_blank" rel="noopener">Avaliar no Google</a>' : "") + "</div>" +
        '<div class="lista ' + layout + '">' + lista.map(card).join("") + "</div>" +
        (layout === "carrossel" && lista.length > 1 ? '<div class="nav"><button type="button" data-d="-1" aria-label="Anterior">‹</button><button type="button" data-d="1" aria-label="Próxima">›</button></div>' : "") +
        '<div class="rodape">Avaliações reais do ' + (maps ? '<a href="' + maps + '" target="_blank" rel="noopener">Google</a>' : "Google") + "</div>" +
      "</section>";

    raiz.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.classList.contains("mais")) {
        var t = b.previousElementSibling; var aberto = t.classList.toggle("corte");
        b.textContent = aberto ? "Ler mais" : "Ler menos";
      } else if (b.dataset.d) {
        var trilho = raiz.querySelector(".carrossel");
        trilho.scrollBy({ left: b.dataset.d * trilho.clientWidth * 0.9, behavior: "smooth" });
      }
    });
  }

  function iniciar(el) {
    if (el.__ok) return; el.__ok = true;
    var src = el.dataset.src; if (!src) return;
    fetch(src, { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { montar(el, d); })
      .catch(function (e) { console.warn("[avaliacoes-google] não carregou", src, e); });
  }

  function varrer() { document.querySelectorAll(".avaliacoes-google[data-src]").forEach(iniciar); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", varrer); else varrer();
  window.AvaliacoesGoogle = { atualizar: varrer };
})();
