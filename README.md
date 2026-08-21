# RedeToons Stremio Addon

Addon comunitário para o Stremio que organiza títulos públicos do RedeToons em catálogos de filmes e séries. O projeto foi preparado para ser colocado em um repositório GitHub e executado como Web Service no Render.

## Recursos

O manifesto inclui catálogos de animes, séries e filmes, além de categorias de ação, aventura, animação, comédia, crime, drama, fantasia, infantil, mistério, ficção científica, terror e novidades. Todos os catálogos declaram suporte a pesquisa e paginação.

As séries são expostas como `type: series`. O addon consulta a lista pública de episódios em `/api/series-playable/{tmdbId}` e cria um vídeo individual para cada combinação de temporada e episódio, usando IDs no formato `rt:tv:{tmdbId}:s{temporada}:e{episódio}`. Isso evita que todos os episódios sejam tratados como um único filme.

Na reprodução, o addon consulta `/api/play-link` com `contract=3`, `tmdbId`, temporada e episódio. Cada variante retornada pela fonte é exposta como stream separado; quando a fonte informa qualidade, o título identifica a variante e diferencia Dublado de Legendado quando essa informação está disponível.

> Use este projeto somente com conteúdo que você tenha autorização para acessar e redistribuir. O addon não contorna login, DRM, CAPTCHA, paywall ou qualquer outro mecanismo de proteção.

## Deploy no Render

Envie a pasta deste projeto para um repositório GitHub. No Render, escolha **New Web Service**, conecte o repositório e mantenha a configuração indicada abaixo.

| Campo | Valor |
|---|---|
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/health` |

Após o deploy, o manifesto estará disponível em:

```text
https://SEU-SERVICO.onrender.com/manifest.json
```

Abra esse endereço no navegador ou use a opção de instalação de addon do Stremio/Nuvio. Se houver cache do cliente, remova o addon antigo, reinicie o aplicativo e instale novamente.

## Rotas principais

| Rota | Função |
|---|---|
| `/manifest.json` | Manifesto do addon |
| `/catalog/series/animes.json` | Catálogo de animes |
| `/catalog/series/series.json` | Catálogo de séries |
| `/catalog/movie/filmes.json` | Catálogo de filmes |
| `/catalog/series/acao.json` | Catálogo por gênero |
| `/catalog/series/animes/search=bleach.json` | Pesquisa no catálogo |
| `/meta/series/rt:tv:30984.json` | Metadados e episódios de uma série |
| `/stream/series/rt:tv:30984:s1:e1.json` | Stream do episódio 1 da temporada 1 |
| `/health` | Verificação de saúde |

## Teste local

```bash
npm install
npm start
```

Depois, abra `http://localhost:7000/manifest.json` e teste as rotas de catálogo e metadados. O servidor usa apenas APIs públicas do RedeToons e não armazena os vídeos.
