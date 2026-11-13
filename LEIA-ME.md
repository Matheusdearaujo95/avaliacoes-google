# Avaliações do Google nos seus sites (custo zero)

Todo dia o GitHub roda um robô que busca as avaliações no Google e salva um arquivo `data/<negocio>.json` por negócio. O GitHub Pages hospeda esses arquivos e o widget de graça. O site só lê o arquivo, então visitas não custam nada e não têm limite.

```
Google (1x por dia) ──> GitHub Actions: scripts/buscar-avaliacoes.mjs ──> data/<negocio>.json
                                                                              │
Seus sites  <── widget/avaliacoes.js (GitHub Pages) ◄─────────────────────────┘
```

## De onde vêm as avaliações

| Caminho | Quantas avaliações | Custo | Para quais negócios |
|---|---|---|---|
| **Google Business Profile API** (principal) | **Todas**, com respostas do dono | Grátis | Perfis que a sua conta Google gerencia (seus, ou de clientes que adicionarem você como administrador) |
| Places API (opcional) | No máximo 5 | Grátis dentro da cota gratuita; exige cartão no Google Cloud | Qualquer negócio público |

Scraping do Google Maps não é usado: viola os termos do Google e quebra com frequência.

## Configuração (uma vez)
- **Segredos** (Settings > Secrets and variables > Actions): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GBP_REFRESH_TOKEN_PRINCIPAL` e, se usar Places, `GOOGLE_PLACES_API_KEY`.
- **Negócios**: em `config.json`, um item por negócio, com `"ativo": true`. O script `scripts/autorizar-conta.mjs` gera o refresh token e lista os perfis da conta já nesse formato.
- **Mais contas Google**: adicione em `contasGoogle` (ex.: `{ "id": "cliente2", "refreshTokenEnv": "GBP_REFRESH_TOKEN_CLIENTE2" }`) e crie o segredo correspondente no GitHub. Não precisa editar o workflow.
- **Atualizar agora**: aba Actions > "Atualizar avaliações" > Run workflow.

## Colocar no site
```html
<div class="avaliacoes-google"
     data-src="https://matheusdearaujo95.github.io/avaliacoes-google/data/meu-negocio.json"
     data-layout="carrossel"></div>
<script src="https://matheusdearaujo95.github.io/avaliacoes-google/widget/avaliacoes.js" defer></script>
```

Opções: `data-layout` (`carrossel`, `grade`, `lista`), `data-tema` (`claro`, `escuro`), `data-min-estrelas="4"`, `data-max="12"`, `data-so-com-texto="sim"`, `data-cor="#0b8043"`.

Construtores que só aceitam iframe (Wix, Hotmart, Kiwify…):
```html
<iframe src="https://matheusdearaujo95.github.io/avaliacoes-google/widget/iframe.html?id=meu-negocio&layout=grade&min=4"
        width="100%" height="560" style="border:0"></iframe>
```

Demonstração: https://matheusdearaujo95.github.io/avaliacoes-google/demo.html

Se uma busca falhar, o arquivo do dia anterior continua no ar.
