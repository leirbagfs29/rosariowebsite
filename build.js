#!/usr/bin/env node
/* ============================================================
   ROSÁRIO MEDITADO — gerador de artigos
   Uso:  node build.js

   Lê   conteudo/artigos/*.md
   Gera artigos/<nome>.html, paginaartigos.html,
        bloco "Últimos artigos" no index.html,
        sitemap.xml, robots.txt e admin/dados.json

   Não precisa instalar nada além do Node.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const md = require('./js/markdown.js');

const SITE_URL = 'https://rosariomeditado.com';
const ROOT = __dirname;
const SRC_DIR = path.join(ROOT, 'conteudo', 'artigos');
const OUT_DIR = path.join(ROOT, 'artigos');
const GENERATOR_TAG = '<meta name="generator" content="rosario-build">';
const esc = md.escapeHtml;

const errors = [];
const warnings = [];

/* ── 1. Ler os artigos ── */
function loadArticles() {
  const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.md') && !f.startsWith('_'));
  const list = [];
  for (const file of files) {
    const text = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
    const { data, body } = md.parseFrontMatter(text);
    const slug = file.replace(/\.md$/, '');
    const where = 'conteudo/artigos/' + file;

    if (data.rascunho === true) { console.log('  (rascunho, não publicado) ' + where); continue; }

    for (const field of ['titulo', 'resumo', 'categoria', 'capa']) {
      if (!data[field]) errors.push(`${where}: falta o campo "${field}"`);
    }
    if (data.data && !/^\d{4}-\d{2}-\d{2}$/.test(data.data)) {
      errors.push(`${where}: a data deve estar no formato AAAA-MM-DD (ex.: 2026-01-15)`);
    }
    if (!data.link && !/^[A-Za-z0-9_-]+$/.test(slug)) {
      errors.push(`${where}: o nome do arquivo deve ter só letras sem acento, números e hífen`);
    }
    checkImage(data.capa, where);
    if (data.cor && !md.COLORS[data.cor]) {
      warnings.push(`${where}: cor "${data.cor}" desconhecida (use: ${Object.keys(md.COLORS).join(', ')})`);
    }
    for (const m of body.matchAll(/(?:!\[[^\]]*\]\(|^:::\s*imagem-\S+\s+)(\/[^)\s|]+)/gm)) checkImage(m[1], where);

    list.push({
      slug,
      title: data.titulo || slug,
      summary: data.resumo || '',
      date: data.data || '',
      category: data.categoria || 'Outros',
      categorySlug: md.slugify(data.categoria || 'Outros'),
      cover: data.capa || '',
      source: data.fonte || '',
      external: data.link || '',
      author: data.autor || '',
      data,
      body,
      minutes: md.readingMinutes(body)
    });
  }
  // Mais recentes primeiro; itens sem data vão para o fim
  list.sort((a, b) => (b.date || '0').localeCompare(a.date || '0') || a.title.localeCompare(b.title));
  return list;
}

function checkImage(src, where) {
  if (!src || /^https?:/.test(src)) return;
  if (!fs.existsSync(path.join(ROOT, decodeURI(src)))) warnings.push(`${where}: imagem não encontrada: ${src}`);
}

/* ── Pedaços comuns de HTML ── */
function head({ title, description, prefix, url, image, type, extra = '' }) {
  const img = image ? (/^https?:/.test(image) ? image : SITE_URL + image) : SITE_URL + '/favicon.png';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${GENERATOR_TAG}
<!-- Página gerada automaticamente por build.js. Edite conteudo/artigos/*.md em vez deste arquivo. -->
<title>${esc(title)} – Rosário Meditado</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta property="og:site_name" content="Rosário Meditado">
<meta property="og:type" content="${type || 'website'}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:locale" content="pt_BR">
<link rel="icon" href="${prefix}favicon.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=EB+Garamond:ital,wght@0,400;0,600;1,400&display=swap">
<link rel="stylesheet" href="${prefix}css/style.css">${extra}
</head>`;
}

function header(prefix, tagline) {
  return `<body>
<a class="skip-link" href="#conteudo">Pular para o conteúdo</a>

<header>
  <a class="brand" href="${prefix}index.html">Rosário Meditado</a>${tagline ? `\n  <p class="tagline">${tagline}</p>` : ''}
  <nav class="site-nav" aria-label="Principal">
    <a href="${prefix}index.html">Rezar o Rosário</a>
    <a href="${prefix}como-rezar-o-terco.html">Como rezar o Terço</a>
    <a href="${prefix}paginaartigos.html" aria-current="page">Artigos</a>
  </nav>
</header>
`;
}

function footer(prefix, scripts) {
  return `
<footer>
  <p class="motto">Ad maiorem Dei gloriam</p>
  <nav aria-label="Rodapé">
    <a href="${prefix}index.html">Rezar o Rosário</a>
    <a href="${prefix}como-rezar-o-terco.html">Como rezar o Terço</a>
    <a href="${prefix}paginaartigos.html">Artigos</a>
  </nav>
  <p>Contato: <a href="mailto:gabriel12258@outlook.com">gabriel12258@outlook.com</a></p>
</footer>
${scripts || ''}
</body>
</html>
`;
}

function href(a, prefix) {
  if (a.external) return a.external.replace(/^\//, prefix);
  return `${prefix}artigos/${a.slug}.html`;
}

function card(a, prefix, extraClass = '') {
  const meta = [a.date ? md.formatDate(a.date, true) : '', a.external ? '' : `${a.minutes} min de leitura`]
    .filter(Boolean).join(' · ');
  const search = md.slugify([a.title, a.summary, a.category].join(' ')).replace(/-/g, ' ');
  return `    <a href="${href(a, prefix)}" class="article-card${extraClass}" data-category="${a.categorySlug}" data-date="${a.date}" data-search="${search}">
      <img src="${a.cover}" alt="" loading="lazy">
      <div class="article-card-content">
        <span class="card-tag">${esc(a.category)}</span>
        <h2>${esc(a.title)}</h2>
        <p>${esc(a.summary)}</p>
        <span class="card-meta">${meta || '&nbsp;'}</span>
      </div>
    </a>`;
}

/* ── 2. Página de cada artigo ── */
function articlePage(a, all) {
  const url = `${SITE_URL}/artigos/${a.slug}.html`;
  const related = all
    .filter(o => o !== a)
    .sort((x, y) => (y.categorySlug === a.categorySlug) - (x.categorySlug === a.categorySlug))
    .slice(0, 3);
  const source = a.source
    ? `\n      <p class="article-source">Fonte: ${md.inline(a.source)}</p>` : '';
  const date = a.date ? `<time datetime="${a.date}">${md.formatDate(a.date)}</time> · ` : '';
  const author = a.author ? `Por ${esc(a.author)} · ` : '';
  const parts = md.articleParts(a.data, a.body);
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.summary,
    image: SITE_URL + a.cover,
    datePublished: a.date || undefined,
    inLanguage: 'pt-BR',
    author: a.author ? { '@type': 'Person', name: a.author } : undefined,
    mainEntityOfPage: url
  });

  return head({
    title: a.title, description: a.summary, prefix: '../', url, image: a.cover, type: 'article',
    extra: `\n<script type="application/ld+json">${jsonLd}</script>`
  }) + '\n\n' + header('../') + `
<main id="conteudo" class="article-container">
  <a class="back-link" href="../paginaartigos.html">❮ Todos os artigos</a>

  <article${parts.themeClass ? ` class="${parts.themeClass}"` : ''}>
    <div class="article-header">
      <a class="card-tag article-category" href="../paginaartigos.html?categoria=${a.categorySlug}">${esc(a.category)}</a>
      <h1>${esc(a.title)}</h1>
      <p class="article-meta">${author}${date}${a.minutes} min de leitura</p>${source}
    </div>
${parts.hero ? `\n    <img class="article-hero" src="${esc(parts.hero)}" alt="">\n` : ''}${parts.toc ? `\n${parts.toc}\n` : ''}
    <div class="article-content${parts.contentClass ? ' ' + parts.contentClass : ''}">
${parts.html}
    </div>

    <div class="article-footer">
      <p>✝ Ora pro nobis, Sancta Dei Genetrix</p>
      <div class="share">
        <span class="share-label">Compartilhe este artigo</span>
        <a class="btn" href="https://wa.me/?text=${encodeURIComponent(a.title + ' ' + url)}" target="_blank" rel="noopener" data-share="whatsapp">WhatsApp</a>
        <button class="btn btn-ghost" type="button" data-share="copy" data-url="${url}">Copiar link</button>
      </div>
    </div>
  </article>
${related.length ? `
  <section class="related" aria-labelledby="related-title">
    <h2 id="related-title" class="section-label">Leia também</h2>
    <div class="articles-grid related-grid">
${related.map(r => card(r, '../')).join('\n')}
    </div>
  </section>` : ''}
</main>
` + footer('../', '<script src="../js/artigos.js" defer></script>');
}

/* ── 3. Página de listagem ── */
function listPage(all) {
  const cats = new Map();
  for (const a of all) {
    const c = cats.get(a.categorySlug) || { name: a.category, count: 0 };
    c.count++;
    cats.set(a.categorySlug, c);
  }
  const chips = [...cats.entries()]
    .sort((x, y) => y[1].count - x[1].count || x[1].name.localeCompare(y[1].name))
    .map(([slug, c]) => `      <button type="button" class="chip" data-filter="${slug}" aria-pressed="false">${esc(c.name)} <span class="chip-count">${c.count}</span></button>`)
    .join('\n');

  return head({
    title: 'Artigos', prefix: '',
    description: 'Artigos para aprofundar na devoção mariana e na espiritualidade católica.',
    url: SITE_URL + '/paginaartigos.html'
  }) + '\n\n' + header('', 'Artigos para aprofundar na devoção mariana e espiritualidade católica') + `
<main id="conteudo" class="articles-container">

  <div class="articles-header">
    <h1>Artigos</h1>
    <p>Reflexões, ensinamentos e espiritualidade mariana</p>
  </div>

  <div class="articles-toolbar">
    <div class="chips" role="group" aria-label="Filtrar por categoria">
      <button type="button" class="chip" data-filter="" aria-pressed="true">Todos <span class="chip-count">${all.length}</span></button>
${chips}
    </div>
    <div class="toolbar-row">
      <label class="search">
        <span class="visually-hidden">Buscar artigos</span>
        <input type="search" id="busca" placeholder="Buscar artigos…" autocomplete="off">
      </label>
      <label class="sort">
        <span class="visually-hidden">Ordenar</span>
        <select id="ordem">
          <option value="recentes">Mais recentes</option>
          <option value="antigos">Mais antigos</option>
          <option value="az">Título (A–Z)</option>
        </select>
      </label>
    </div>
  </div>

  <p class="results-count" aria-live="polite"></p>

  <div class="articles-grid" id="lista-artigos">
${all.map((a, i) => card(a, '', i === 0 ? ' is-featured' : '')).join('\n')}
  </div>

  <div class="empty-state" hidden>
    <p>Nenhum artigo encontrado.</p>
    <button type="button" class="btn btn-ghost" data-clear>Limpar filtros</button>
  </div>

  <div class="load-more" hidden>
    <button type="button" class="btn btn-ghost">Ver mais artigos</button>
  </div>

</main>
` + footer('', '<script src="js/artigos.js" defer></script>');
}

/* ── 4. "Últimos artigos" no index.html ── */
function updateIndex(all) {
  const file = path.join(ROOT, 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  const start = '<!-- ULTIMOS-ARTIGOS:INICIO -->';
  const end = '<!-- ULTIMOS-ARTIGOS:FIM -->';
  if (!html.includes(start)) { warnings.push('index.html: marcador de últimos artigos não encontrado'); return; }
  const latest = all.filter(a => !a.external).slice(0, 3);
  const block = `${start}
<section class="latest" aria-labelledby="latest-title">
  <h2 id="latest-title" class="section-label">Últimos artigos</h2>
  <div class="articles-grid related-grid">
${latest.map(a => card(a, '')).join('\n')}
  </div>
  <p class="latest-more"><a href="paginaartigos.html">Ver todos os artigos ❯</a></p>
</section>
${end}`;
  const re = new RegExp(start + '[\\s\\S]*?' + end);
  write(file, html.replace(re, block));
}

/* ── 5. sitemap, robots, dados do editor ── */
function sitemap(all) {
  const urls = [
    ['/', ''], ['/como-rezar-o-terco.html', ''], ['/paginaartigos.html', all[0] && all[0].date],
    ...all.filter(a => !a.external).map(a => [`/artigos/${a.slug}.html`, a.date])
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, d]) => `  <url><loc>${SITE_URL}${u}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
}

function editorData(all) {
  const imgs = [];
  for (const dir of ['images2']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
      if (/\.(jpe?g|png|webp|gif)$/i.test(f)) imgs.push(`/${dir}/${f}`);
    }
  }
  imgs.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const categorias = [...new Set(all.map(a => a.category))].sort((a, b) => a.localeCompare(b));
  return JSON.stringify({
    categorias,
    imagens: imgs,
    artigos: all.filter(a => !a.external)
      .map(a => ({ arquivo: a.slug + '.md', titulo: a.title, data: a.date, categoria: a.category }))
  }, null, 2) + '\n';
}

/* ── Escrita (só grava se mudou, para não sujar o git) ── */
let changed = 0;
function write(file, content) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  changed++;
  console.log('  gerado: ' + path.relative(ROOT, file).replace(/\\/g, '/'));
}

/* ── Execução ── */
const articles = loadArticles();

if (errors.length) {
  console.error('\nCorrija antes de publicar:\n  - ' + errors.join('\n  - '));
  process.exit(1);
}

const produced = new Set();
for (const a of articles.filter(a => !a.external)) {
  const file = path.join(OUT_DIR, a.slug + '.html');
  produced.add(file);
  write(file, articlePage(a, articles));
}

// Remove páginas geradas de artigos que foram apagados
for (const f of fs.readdirSync(OUT_DIR)) {
  const file = path.join(OUT_DIR, f);
  if (f.endsWith('.html') && !produced.has(file) && fs.readFileSync(file, 'utf8').includes(GENERATOR_TAG)) {
    fs.unlinkSync(file);
    changed++;
    console.log('  removido: artigos/' + f);
  }
}

write(path.join(ROOT, 'paginaartigos.html'), listPage(articles));
updateIndex(articles);
write(path.join(ROOT, 'sitemap.xml'), sitemap(articles));
write(path.join(ROOT, 'robots.txt'), `User-agent: *\nDisallow: /admin/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
write(path.join(ROOT, 'admin', 'dados.json'), editorData(articles));

if (warnings.length) console.warn('\nAvisos:\n  - ' + warnings.join('\n  - '));
console.log(`\n✝ ${articles.length} artigos processados, ${changed} arquivo(s) atualizado(s).`);
