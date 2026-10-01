# Rosário Meditado

Site do Santo Rosário meditado com imagens — [rosariomeditado.com](https://rosariomeditado.com).

## Como publicar um artigo novo

### Jeito fácil (pelo navegador)

1. Abra **rosariomeditado.com/admin/novo-artigo.html**.
2. Preencha título, resumo, categoria, data, imagem de capa e o texto. A pré-visualização mostra como vai ficar.
3. Clique em **Publicar no GitHub** → na página que abrir, clique em **Commit changes**.
4. Em 1–2 minutos o artigo aparece no site.

O rascunho fica salvo no navegador enquanto você escreve.

### Imagens

Envie a imagem para a pasta [`images2`](https://github.com/leirbagfs29/rosariowebsite/upload/main/images2)
(no GitHub: *Add file → Upload files*). Use nomes sem acento e sem espaço, ex.: `primeiros-sabados.jpg`.
No artigo, a imagem é chamada como `/images2/primeiros-sabados.jpg`.

### Editar ou apagar

No editor, use **Editar artigo publicado…** no topo da página. Ou, direto no GitHub: os artigos ficam em [`conteudo/artigos/`](conteudo/artigos), um arquivo `.md` para cada.
Abra o arquivo no GitHub, clique no lápis ✏️ para editar (ou *⋯ → Delete file* para apagar) e salve.
O site se atualiza sozinho.

## Formato do arquivo `.md`

```markdown
---
titulo: A devoção dos Primeiros Sábados
resumo: Uma frase que aparece no card e no WhatsApp.
data: 2026-10-01
categoria: Devoções
capa: /images2/foto.jpg
autor: Seu nome
fonte: https://...
cor: azul
capitular: sim
sumario: sim
capa_topo: sim
---
```

Obrigatórios: `titulo`, `resumo`, `categoria`, `capa` (e `data` para ordenar). Os demais são opcionais:

- `autor`, `fonte` — aparecem abaixo do título.
- `cor` — `vermelho` (padrão), `azul`, `roxo`, `verde`, `dourado` ou `rosa`.
- `capitular: sim` — primeira letra grande e ornamentada.
- `sumario: sim` — lista dos subtítulos no início do artigo.
- `capa_topo: sim` — mostra a capa no topo do artigo.
- `rascunho: sim` — o arquivo fica salvo, mas o artigo não é publicado.

### Elementos do texto

| Elemento | Como escrever |
|---|---|
| Subtítulo | `## Subtítulo` ou `### Subtítulo menor` |
| Negrito / itálico / marcado | `**negrito**`, `*itálico*`, `==marcado==` |
| Link / botão | `[texto](https://...)` / `[[Texto do botão]](/index.html)` |
| Citação simples, listas | `> citação`, `- item`, `1. item` |
| Separador com cruz | `---` |
| Imagem (com tamanho) | `![Legenda](/images2/foto.jpg){media}` — `pequena`, `media`, `grande` |
| Vídeo do YouTube | `::: video https://youtube.com/... \| Legenda` (uma linha) |
| Tabela | `\| A \| B \|` + `\|---\|---\|` + linhas |

Blocos — abrem com `::: tipo` e fecham com `:::` (imagens: `imagem-direita`, `imagem-esquerda` ou `imagem-topo`):

```markdown
::: imagem-direita /images2/foto.jpg | Descrição
Texto ao lado da imagem.
:::

::: oracao Ave Maria
Cada linha da oração fica numa linha.
:::

::: citacao São Padre Pio
O Rosário é a arma para estes tempos.
:::

::: biblia Lc 1,28
Ave, cheia de graça, o Senhor é contigo.
:::

::: destaque Você sabia?
Texto da caixa dourada.
:::

::: aviso Importante
Texto da caixa de aviso.
:::

::: colunas
Primeira coluna.
|||
Segunda coluna.
:::

::: galeria
![Legenda](/images2/1.jpg)
![Legenda](/images2/2.jpg)
:::

::: centro
Texto centralizado.
:::
```

Uma categoria nova é criada automaticamente na primeira vez que for usada.

## Como funciona por trás

- `build.js` lê `conteudo/artigos/*.md` e gera `artigos/*.html`, `paginaartigos.html`,
  o bloco "Últimos artigos" do `index.html`, `sitemap.xml` e `admin/dados.json`.
  **Não edite esses arquivos gerados à mão** — edite o `.md`.
- A automação `.github/workflows/gerar-artigos.yml` roda o `build.js` sozinha a cada envio ao GitHub.
- Para gerar no seu computador (opcional): `node build.js`.
