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

Os artigos ficam em [`conteudo/artigos/`](conteudo/artigos), um arquivo `.md` para cada.
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
fonte: https://... (opcional)
rascunho: sim   (opcional — o artigo não é publicado)
---

## Subtítulo

Parágrafo com **negrito**, *itálico* e [link](https://exemplo.com).

> Citação

- item de lista

![Descrição](/images2/foto.jpg)

::: imagem-direita /images2/foto.jpg | Descrição da imagem
Texto ao lado da imagem (também: imagem-esquerda, imagem-topo).
:::
```

Uma categoria nova é criada automaticamente na primeira vez que for usada.

## Como funciona por trás

- `build.js` lê `conteudo/artigos/*.md` e gera `artigos/*.html`, `paginaartigos.html`,
  o bloco "Últimos artigos" do `index.html`, `sitemap.xml` e `admin/dados.json`.
  **Não edite esses arquivos gerados à mão** — edite o `.md`.
- A automação `.github/workflows/gerar-artigos.yml` roda o `build.js` sozinha a cada envio ao GitHub.
- Para gerar no seu computador (opcional): `node build.js`.
