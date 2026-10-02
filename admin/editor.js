/* ============================================================
   ROSÁRIO MEDITADO — editor de artigos em blocos (estilo Notion)

   O editor guarda o artigo como uma lista de blocos e converte
   para o Markdown de conteudo/artigos/*.md (o mesmo que o
   build.js transforma em página). Ida e volta:
       Markdown  →  mdToBlocks()  →  blocos  →  blocksToMd()  →  Markdown
   ============================================================ */
(function () {
  'use strict';

  const M = window.RosarioMarkdown;
  const REPO = 'leirbagfs29/rosariowebsite';
  const BRANCH = 'main';
  const DIR = 'conteudo/artigos';
  const DRAFT_KEY = 'rosario-editor-v2';
  const MAX_URL = 7000;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = M.escapeHtml;

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    (children || []).forEach(c => c && e.append(c));
    return e;
  }

  /* ============================================================
     ESTADO
     ============================================================ */
  const DEFAULT_PROPS = {
    titulo: '', resumo: '', data: '', categoria: '', capa: '', autor: '', fonte: '',
    cor: 'vermelho', capitular: false, sumario: false, capa_topo: false, rascunho: false
  };
  const state = {
    props: Object.assign({}, DEFAULT_PROPS),
    blocks: [],
    arquivo: '',
    slugTouched: false,
    editing: '',
    mode: 'edit'
  };
  let site = { categorias: [], imagens: [], artigos: [] };
  let uid = 0;
  const newId = () => 'b' + (++uid) + Math.random().toString(36).slice(2, 6);

  /* ============================================================
     TIPOS DE BLOCO
     ============================================================ */
  const TEXT_TYPES = ['p', 'h2', 'h3', 'bullet', 'numbered', 'quote'];
  const TRANSFORMABLE = TEXT_TYPES.concat(['center', 'callout', 'toggle']);

  const TYPES = {
    p:        { label: 'Texto', icon: '¶', desc: 'Parágrafo comum.', group: 'Básico', keys: 'texto paragrafo' },
    h2:       { label: 'Subtítulo', icon: 'H2', desc: 'Título de uma seção.', group: 'Básico', keys: 'titulo cabecalho heading' },
    h3:       { label: 'Subtítulo menor', icon: 'H3', desc: 'Título dentro de uma seção.', group: 'Básico', keys: 'titulo heading' },
    bullet:   { label: 'Lista', icon: '•', desc: 'Lista com marcadores.', group: 'Básico', keys: 'lista marcadores topicos' },
    numbered: { label: 'Lista numerada', icon: '1.', desc: 'Lista com números.', group: 'Básico', keys: 'lista numeros ordenada' },
    quote:    { label: 'Citação simples', icon: '❝', desc: 'Trecho citado.', group: 'Básico', keys: 'citacao quote' },
    divider:  { label: 'Separador', icon: '✝', desc: 'Linha com cruz entre seções.', group: 'Básico', keys: 'divisor linha hr' },

    callout:  { label: 'Caixa', icon: '💡', desc: 'Destaque com emoji e cor.', group: 'Destaques', keys: 'callout destaque aviso nota dica' },
    toggle:   { label: 'Recolhível', icon: '▸', desc: 'Conteúdo que abre ao clicar.', group: 'Destaques', keys: 'toggle recolher expandir sanfona' },
    center:   { label: 'Texto centralizado', icon: '≡', desc: 'Jaculatórias, dedicatórias.', group: 'Destaques', keys: 'centro centralizar' },

    prayer:   { label: 'Oração', icon: '🙏', desc: 'Caixa de oração, um verso por linha.', group: 'Católico', keys: 'oracao reza prece' },
    saint:    { label: 'Citação de santo', icon: '“', desc: 'Frase grande com o autor.', group: 'Católico', keys: 'santo citacao frase' },
    bible:    { label: 'Versículo bíblico', icon: '📖', desc: 'Texto da Escritura com referência.', group: 'Católico', keys: 'biblia versiculo escritura evangelho' },

    image:    { label: 'Imagem', icon: '🖼', desc: 'Escolha posição e tamanho.', group: 'Mídia', keys: 'imagem foto figura' },
    gallery:  { label: 'Galeria', icon: '▦', desc: 'Várias imagens lado a lado.', group: 'Mídia', keys: 'galeria fotos imagens' },
    video:    { label: 'Vídeo do YouTube', icon: '▶', desc: 'Cole o link do vídeo.', group: 'Mídia', keys: 'video youtube' },

    columns:  { label: 'Colunas', icon: '▥', desc: 'Texto em 2 ou 3 colunas.', group: 'Layout', keys: 'colunas layout' },
    table:    { label: 'Tabela', icon: '▤', desc: 'Linhas e colunas.', group: 'Layout', keys: 'tabela grade' },
    button:   { label: 'Botão', icon: '➜', desc: 'Chamada para outra página.', group: 'Layout', keys: 'botao link chamada' },

    raw:      { label: 'HTML', icon: '</>', desc: 'Código HTML (avançado).', group: 'Layout', keys: 'html codigo' }
  };

  function defaultData(type) {
    switch (type) {
      case 'center': return { text: '' };
      case 'callout': return { icon: '💡', color: 'dourado', text: '' };
      case 'toggle': return { title: '', text: '' };
      case 'prayer': return { title: '', text: '' };
      case 'saint': return { author: '', text: '' };
      case 'bible': return { ref: '', text: '' };
      case 'image': return { src: '', caption: '', size: '', align: '' };
      case 'gallery': return { items: [] };
      case 'video': return { url: '', caption: '' };
      case 'columns': return { cols: ['', ''] };
      case 'table': return { rows: [['Coluna 1', 'Coluna 2'], ['', ''], ['', '']] };
      case 'button': return { label: 'Rezar o Rosário', href: '/index.html' };
      case 'divider': return {};
      case 'raw': return { text: '' };
      default: return { md: '' };
    }
  }

  const mk = (type, data) => ({ id: newId(), type, data: Object.assign(defaultData(type), data || {}) });

  /* ============================================================
     TEXTO: Markdown da linha  ⇄  HTML editável
     ============================================================ */
  function mdInlineToHtml(md) {
    let s = esc(md || '');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<i>$2</i>');
    s = s.replace(/==(.+?)==/g, '<mark>$1</mark>');
    return s;
  }

  function linesToHtml(text) {
    if (!text) return '';
    return text.split('\n').map(l => '<div>' + (mdInlineToHtml(l) || '<br>') + '</div>').join('');
  }

  function wrapMd(inner, mark) {
    if (!inner.trim()) return inner;
    const lead = inner.match(/^\s*/)[0];
    const trail = inner.match(/\s*$/)[0];
    return lead + mark + inner.trim() + mark + trail;
  }

  function toMd(node) {
    let s = '';
    node.childNodes.forEach(c => {
      if (c.nodeType === 3) { s += c.nodeValue.replace(/ /g, ' ').replace(/\n/g, ' '); return; }
      if (c.nodeType !== 1) return;
      const tag = c.tagName;
      if (tag === 'BR') { s += '\n'; return; }
      if (tag === 'DIV' || tag === 'P') {
        if (s && !/\n$/.test(s)) s += '\n';
        let inner = toMd(c);
        if (inner === '\n') inner = '';
        s += inner + '\n';
        return;
      }
      const inner = toMd(c);
      if (tag === 'B' || tag === 'STRONG') s += wrapMd(inner, '**');
      else if (tag === 'I' || tag === 'EM') s += wrapMd(inner, '*');
      else if (tag === 'MARK') s += wrapMd(inner, '==');
      else if (tag === 'A') s += inner.trim() ? '[' + inner + '](' + (c.getAttribute('href') || '') + ')' : inner;
      else if (tag === 'SPAN' && /font-weight:\s*(bold|[6-9]00)/.test(c.getAttribute('style') || '')) s += wrapMd(inner, '**');
      else s += inner;
    });
    return s;
  }

  function htmlToMd(node, multi) {
    let s = toMd(node).replace(/\n+$/, '');
    if (!multi) s = s.replace(/\s*\n\s*/g, ' ');
    return s.replace(/[ \t]+$/gm, '');
  }

  /* ============================================================
     MARKDOWN  →  BLOCOS
     ============================================================ */
  const CONTAINERS = ['imagem-direita', 'imagem-esquerda', 'imagem-topo', 'oracao', 'citacao', 'biblia',
                      'destaque', 'aviso', 'centro', 'colunas', 'galeria', 'caixa', 'recolher'];

  function splitRow(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
  }

  function startsBlock(l) {
    return /^(#{1,4}\s|>\s?|[-*]\s|\d+[.)]\s|:::|\||---\s*$|\*\*\*\s*$|!\[[^\]]*\]\([^)]+\)(\{[^}]*\})?\s*$|\[\[|<)/.test(l.trim());
  }

  function mdToBlocks(md) {
    const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0, m;

    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t) { i++; continue; }

      if ((m = t.match(/^:::\s*video\s+(.+)$/))) {
        const p = m[1].split('|');
        out.push(mk('video', { url: p[0].trim(), caption: (p[1] || '').trim() }));
        i++;
        continue;
      }

      if ((m = t.match(/^:::\s*([a-z-]+)\s*(.*)$/)) && CONTAINERS.includes(m[1])) {
        const inner = [];
        let depth = 1;
        i++;
        while (i < lines.length) {
          const lt = lines[i].trim();
          const o = lt.match(/^:::\s*([a-z-]+)/);
          if (o && CONTAINERS.includes(o[1])) depth++;
          else if (lt === ':::' && --depth === 0) break;
          inner.push(lines[i]);
          i++;
        }
        i++;
        out.push.apply(out, fromContainer(m[1], m[2].trim(), inner.join('\n').replace(/^\n+/, '').replace(/\s+$/, '')));
        continue;
      }

      if (t.charAt(0) === '<') {
        const raw = [];
        while (i < lines.length && lines[i].trim()) { raw.push(lines[i]); i++; }
        out.push(mk('raw', { text: raw.join('\n') }));
        continue;
      }

      if ((m = t.match(/^(#{1,4})\s+(.*)$/))) { out.push(mk(m[1].length >= 3 ? 'h3' : 'h2', { md: m[2] })); i++; continue; }
      if (/^(---|\*\*\*)\s*$/.test(t)) { out.push(mk('divider')); i++; continue; }

      if (t.charAt(0) === '|' && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        const rows = [splitRow(t)];
        i += 2;
        while (i < lines.length && lines[i].trim().charAt(0) === '|') { rows.push(splitRow(lines[i])); i++; }
        const w = Math.max.apply(null, rows.map(r => r.length));
        rows.forEach(r => { while (r.length < w) r.push(''); });
        out.push(mk('table', { rows }));
        continue;
      }

      if ((m = t.match(/^!\[([^\]]*)\]\(([^)\s]+)\)(?:\{([^}]*)\})?$/))) {
        const o = M.imageOptions(m[3]);
        out.push(mk('image', { src: m[2], caption: m[1], size: o.size, align: o.align }));
        i++;
        continue;
      }

      if ((m = t.match(/^\[\[([^\]]+)\]\]\(([^)\s]+)\)$/))) { out.push(mk('button', { label: m[1], href: m[2] })); i++; continue; }

      if (/^>\s?/.test(t)) {
        const q = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, '').trim()); i++; }
        out.push(mk('quote', { md: q.filter(Boolean).join(' ') }));
        continue;
      }

      if ((m = t.match(/^([-*]|\d+[.)])\s+/))) {
        const ordered = /\d/.test(m[1]);
        const re = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/;
        while (i < lines.length && re.test(lines[i])) {
          let item = lines[i].replace(re, '');
          i++;
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !re.test(lines[i])) { item += ' ' + lines[i].trim(); i++; }
          out.push(mk(ordered ? 'numbered' : 'bullet', { md: item.trim() }));
        }
        continue;
      }

      const para = [];
      while (i < lines.length && lines[i].trim() && !(para.length && startsBlock(lines[i]))) { para.push(lines[i].trim()); i++; }
      out.push(mk('p', { md: para.join(' ') }));
    }
    return out;
  }

  function fromContainer(type, args, inner) {
    switch (type) {
      case 'imagem-direita':
      case 'imagem-esquerda':
      case 'imagem-topo': {
        const p = args.split('|');
        const align = type === 'imagem-direita' ? 'direita' : type === 'imagem-esquerda' ? 'esquerda' : '';
        return [mk('image', { src: p[0].trim(), caption: (p[1] || '').trim(), size: align ? 'media' : 'grande', align })]
          .concat(mdToBlocks(inner));
      }
      case 'oracao': return [mk('prayer', { title: args, text: inner })];
      case 'citacao': return [mk('saint', { author: args, text: inner })];
      case 'biblia': return [mk('bible', { ref: args, text: inner })];
      case 'destaque': return [mk('callout', { icon: '💡', color: 'dourado', text: (args ? '**' + args + '**\n' : '') + inner })];
      case 'aviso': return [mk('callout', { icon: '⚠️', color: 'vermelho', text: (args ? '**' + args + '**\n' : '') + inner })];
      case 'caixa': { const c = M.calloutArgs(args); return [mk('callout', { icon: c.icon, color: c.color, text: inner })]; }
      case 'recolher': return [mk('toggle', { title: args, text: inner })];
      case 'centro': return [mk('center', { text: inner })];
      case 'colunas': return [mk('columns', { cols: inner.split(/^\s*\|\|\|\s*$/m).map(s => s.trim()).slice(0, 3) })];
      case 'galeria': {
        const items = [];
        inner.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, s) => { items.push({ src: s, caption: a }); });
        return [mk('gallery', { items })];
      }
    }
    return [];
  }

  /* ============================================================
     BLOCOS  →  MARKDOWN
     ============================================================ */
  const clean1 = s => String(s || '').replace(/\s*\n\s*/g, ' ').trim();
  const container = (type, args, text) => '::: ' + type + (args ? ' ' + clean1(args) : '') + '\n' + String(text || '').trim() + '\n:::';

  function serialize(b, n) {
    const d = b.data;
    switch (b.type) {
      case 'p': return d.md.trim();
      case 'h2': return d.md.trim() ? '## ' + d.md.trim() : '';
      case 'h3': return d.md.trim() ? '### ' + d.md.trim() : '';
      case 'bullet': return d.md.trim() ? '- ' + d.md.trim() : '';
      case 'numbered': return d.md.trim() ? n + '. ' + d.md.trim() : '';
      case 'quote': return d.md.trim() ? '> ' + d.md.trim() : '';
      case 'divider': return '---';
      case 'center': return d.text.trim() ? container('centro', '', d.text) : '';
      case 'callout': return d.text.trim() ? container('caixa', [d.icon, d.color].filter(Boolean).join(' '), d.text) : '';
      case 'toggle': return d.title.trim() || d.text.trim() ? container('recolher', d.title, d.text) : '';
      case 'prayer': return d.title.trim() || d.text.trim() ? container('oracao', d.title, d.text) : '';
      case 'saint': return d.text.trim() ? container('citacao', d.author, d.text) : '';
      case 'bible': return d.text.trim() ? container('biblia', d.ref, d.text) : '';
      case 'columns': return d.cols.some(c => c.trim()) ? '::: colunas\n' + d.cols.map(c => c.trim()).join('\n|||\n') + '\n:::' : '';
      case 'image': {
        if (!d.src) return '';
        const opts = [d.size, d.align === 'centro' ? '' : d.align].filter(Boolean).join(' ');
        return '![' + clean1(d.caption).replace(/\]/g, ')') + '](' + d.src + ')' + (opts ? '{' + opts + '}' : '');
      }
      case 'gallery':
        return d.items.length ? '::: galeria\n' + d.items.map(it => '![' + clean1(it.caption).replace(/\]/g, ')') + '](' + it.src + ')').join('\n') + '\n:::' : '';
      case 'video': return d.url ? '::: video ' + d.url.trim() + (clean1(d.caption) ? ' | ' + clean1(d.caption) : '') : '';
      case 'table': {
        const rows = d.rows.map(r => '| ' + r.map(c => clean1(c).replace(/\|/g, '/') || ' ').join(' | ') + ' |');
        rows.splice(1, 0, '|' + d.rows[0].map(() => '---').join('|') + '|');
        return rows.join('\n');
      }
      case 'button': return clean1(d.label) ? '[[' + clean1(d.label) + ']](' + (d.href || '/') + ')' : '';
      case 'raw': return d.text.trim();
    }
    return '';
  }

  function blocksToMd(blocks) {
    let out = '', prev = null, n = 0;
    blocks.forEach(b => {
      n = b.type === 'numbered' && prev === 'numbered' ? n + 1 : 1;
      const s = serialize(b, n);
      if (!s) return;
      const sameList = (b.type === 'bullet' || b.type === 'numbered') && b.type === prev;
      out += out ? (sameList ? '\n' : '\n\n') + s : s;
      prev = b.type;
    });
    return out;
  }

  function buildMarkdown() {
    const p = state.props;
    const lines = ['---'];
    ['titulo', 'resumo', 'data', 'categoria', 'capa', 'autor', 'fonte'].forEach(k => {
      const v = clean1(p[k]);
      if (v) lines.push(k + ': ' + v);
    });
    if (p.cor && p.cor !== 'vermelho') lines.push('cor: ' + p.cor);
    ['capitular', 'sumario', 'capa_topo', 'rascunho'].forEach(k => { if (p[k]) lines.push(k + ': sim'); });
    lines.push('---', '', blocksToMd(state.blocks), '');
    return lines.join('\n');
  }

  function loadFromMarkdown(text) {
    const parsed = M.parseFrontMatter(text);
    const d = parsed.data;
    state.props = Object.assign({}, DEFAULT_PROPS);
    Object.keys(DEFAULT_PROPS).forEach(k => {
      if (d[k] === undefined) return;
      state.props[k] = typeof DEFAULT_PROPS[k] === 'boolean' ? d[k] === true : String(d[k]);
    });
    if (!M.COLORS[state.props.cor]) state.props.cor = 'vermelho';
    state.blocks = mdToBlocks(parsed.body);
    ensureBlock();
  }

  function ensureBlock() {
    if (!state.blocks.length) state.blocks.push(mk('p'));
  }

  /* ============================================================
     DESENHO DOS BLOCOS
     ============================================================ */
  const blocksEl = $('#ed-blocks');
  const idx = id => state.blocks.findIndex(b => b.id === id);
  const byId = id => state.blocks[idx(id)];

  function rt(tag, b, field, opts) {
    opts = opts || {};
    const e = el(tag, {
      class: 'rt' + (opts.cls ? ' ' + opts.cls : ''),
      contenteditable: 'true',
      'data-f': field,
      'data-ph': opts.ph || '',
      'data-multi': opts.multi ? '1' : null,
      spellcheck: 'true'
    });
    const v = getPath(b.data, field) || '';
    e.innerHTML = opts.multi ? linesToHtml(v) : mdInlineToHtml(v);
    return e;
  }

  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  }
  function setPath(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => o[k], obj);
    target[last] = value;
  }

  function tools(buttons) {
    const bar = el('div', { class: 'blk-tools', contenteditable: 'false' });
    buttons.forEach(t => {
      if (t === '|') { bar.append(el('span', { class: 'sep' })); return; }
      const btn = el('button', {
        type: 'button', title: t.title || t.label, 'aria-pressed': t.pressed == null ? null : String(!!t.pressed),
        class: t.cls || null, style: t.style || null
      });
      btn.textContent = t.label || '';
      btn.addEventListener('mousedown', e => e.preventDefault());
      btn.addEventListener('click', e => { e.stopPropagation(); t.run(); });
      bar.append(btn);
    });
    return bar;
  }

  const CALLOUT_SWATCH = { dourado: '#c9a94a', vermelho: '#701919', azul: '#24476f', verde: '#2f5e3a', roxo: '#5b2a6e', rosa: '#a3466b', cinza: '#8a7a60' };

  const RENDER = {
    p: (b, body) => body.append(rt('p', b, 'md', { ph: 'Escreva, ou digite “/” para inserir um elemento…' })),
    h2: (b, body) => body.append(rt('h2', b, 'md', { ph: 'Subtítulo' })),
    h3: (b, body) => body.append(rt('h3', b, 'md', { ph: 'Subtítulo menor' })),
    bullet: (b, body) => body.append(el('ul', {}, [rt('li', b, 'md', { ph: 'Item da lista' })])),
    numbered: (b, body, ctx) => body.append(el('ol', { start: ctx.num }, [rt('li', b, 'md', { ph: 'Item da lista' })])),
    quote: (b, body) => body.append(el('blockquote', {}, [rt('p', b, 'md', { ph: 'Citação' })])),
    divider: (b, body) => body.append(el('hr', { contenteditable: 'false' })),

    center: (b, body) => body.append(el('div', { class: 'text-center' }, [rt('div', b, 'text', { multi: true, ph: 'Texto centralizado' })])),

    callout: (b, body) => {
      const d = b.data;
      const icon = el('button', { type: 'button', class: 'callout-icon-btn', title: 'Trocar emoji', contenteditable: 'false', text: d.icon || '＋' });
      icon.addEventListener('click', () => openEmoji(icon, e => { d.icon = e; commit(true); render({ id: b.id }); }));
      body.append(el('aside', { class: 'callout callout-' + d.color + ' has-icon' }, [
        icon,
        el('div', { class: 'callout-body' }, [rt('div', b, 'text', { multi: true, ph: 'Escreva algo em destaque…' })])
      ]));
      body.append(tools(Object.keys(CALLOUT_SWATCH).map(c => ({
        cls: 'dot', title: c, style: '--c:' + CALLOUT_SWATCH[c], pressed: d.color === c,
        run: () => { d.color = c; commit(true); render({ id: b.id, keep: true }); }
      })).concat(['|', { label: 'Sem emoji', run: () => { d.icon = ''; commit(true); render({ id: b.id, keep: true }); } }])));
    },

    toggle: (b, body) => body.append(el('div', { class: 'toggle-block' }, [
      rt('div', b, 'title', { cls: 'ed-toggle-summary', ph: 'Título (sempre visível)' }),
      el('div', { class: 'toggle-body' }, [rt('div', b, 'text', { multi: true, ph: 'Conteúdo que aparece ao clicar' })])
    ])),

    prayer: (b, body) => body.append(el('div', { class: 'prayer-box' }, [
      rt('p', b, 'title', { cls: 'prayer-box-title', ph: 'Título da oração' }),
      rt('div', b, 'text', { multi: true, cls: 'ed-prayer-text', ph: 'Texto da oração — um verso por linha' })
    ])),

    saint: (b, body) => body.append(el('figure', { class: 'saint-quote' }, [
      el('blockquote', {}, [rt('div', b, 'text', { multi: true, cls: 'ed-saint-text', ph: 'Frase do santo' })]),
      rt('figcaption', b, 'author', { ph: 'Nome do santo' })
    ])),

    bible: (b, body) => body.append(el('figure', { class: 'bible-verse' }, [
      el('blockquote', {}, [rt('div', b, 'text', { multi: true, cls: 'ed-bible-text', ph: 'Texto do versículo' })]),
      rt('figcaption', b, 'ref', { ph: 'Referência (ex.: Lc 1,28)' })
    ])),

    image: (b, body) => {
      const d = b.data;
      if (!d.src) {
        body.append(el('div', { class: 'ed-img-empty', contenteditable: 'false' }, [
          el('span', { text: '🖼  Nenhuma imagem escolhida' }),
          el('button', { type: 'button', class: 'ed-btn', text: 'Escolher imagem', onclick: () => pickImage(b) })
        ]));
        return;
      }
      const cls = 'article-figure' + (d.size ? ' size-' + d.size : '') +
        (d.align === 'esquerda' ? ' align-left' : d.align === 'direita' ? ' align-right' : '');
      const fig = el('figure', { class: cls }, [
        el('img', { src: d.src, alt: '', draggable: 'false' }),
        rt('figcaption', b, 'caption', { ph: 'Legenda (opcional)' })
      ]);
      const set = (k, v) => () => { d[k] = v; commit(true); render({ id: b.id, keep: true }); };
      fig.append(tools([
        { label: '⇤ Esquerda', title: 'Imagem à esquerda, texto contorna à direita', pressed: d.align === 'esquerda', run: set('align', 'esquerda') },
        { label: 'Centro', pressed: !d.align || d.align === 'centro', run: set('align', '') },
        { label: 'Direita ⇥', title: 'Imagem à direita, texto contorna à esquerda', pressed: d.align === 'direita', run: set('align', 'direita') },
        '|',
        { label: 'P', title: 'Pequena', pressed: d.size === 'pequena', run: set('size', 'pequena') },
        { label: 'M', title: 'Média', pressed: d.size === 'media', run: set('size', 'media') },
        { label: 'G', title: 'Grande', pressed: d.size === 'grande', run: set('size', 'grande') },
        { label: 'Total', title: 'Largura total', pressed: !d.size || d.size === 'total', run: set('size', '') },
        '|',
        { label: 'Trocar', run: () => pickImage(b) }
      ]));
      body.append(fig);
    },

    gallery: (b, body) => {
      const d = b.data;
      const g = el('div', { class: 'gallery' });
      d.items.forEach((it, i) => {
        const rm = el('button', { type: 'button', class: 'ed-remove', title: 'Remover', contenteditable: 'false', text: '×' });
        rm.addEventListener('click', () => { d.items.splice(i, 1); commit(true); render({ id: b.id, keep: true }); });
        g.append(el('figure', {}, [el('img', { src: it.src, alt: '', draggable: 'false' }), rm, rt('figcaption', b, 'items.' + i + '.caption', { ph: 'Legenda' })]));
      });
      g.append(el('button', {
        type: 'button', class: 'ed-gallery-add', contenteditable: 'false', text: '＋ Adicionar imagens',
        onclick: () => openPicker(true, list => { list.forEach(src => d.items.push({ src, caption: '' })); commit(true); render({ id: b.id, keep: true }); })
      }));
      body.append(g);
    },

    video: (b, body) => {
      const d = b.data;
      if (!d.url) {
        const input = el('input', { type: 'url', placeholder: 'Cole aqui o link do YouTube' });
        const go = () => { if (input.value.trim()) { d.url = input.value.trim(); commit(true); render({ id: b.id }); } };
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
        body.append(el('div', { class: 'ed-video-empty', contenteditable: 'false' }, [
          el('span', { text: '▶' }), input, el('button', { type: 'button', class: 'ed-btn', text: 'Inserir', onclick: go })
        ]));
        return;
      }
      const html = M.render('::: video ' + d.url);
      const fig = el('figure', { class: 'video' }, [
        el('div', { class: 'video-frame', html: (html.match(/<div class="video-frame">([\s\S]*?)<\/div>/) || [, '<p style="color:#fff;padding:20px">Link de vídeo não reconhecido.</p>'])[1] }),
        rt('figcaption', b, 'caption', { ph: 'Legenda do vídeo (opcional)' })
      ]);
      body.append(fig);
      body.append(tools([{ label: 'Trocar link', run: () => { const u = prompt('Link do YouTube:', d.url); if (u) { d.url = u.trim(); commit(true); render({ id: b.id, keep: true }); } } }]));
    },

    columns: (b, body) => {
      const d = b.data;
      body.append(el('div', { class: 'columns columns-' + d.cols.length },
        d.cols.map((c, i) => el('div', {}, [rt('div', b, 'cols.' + i, { multi: true, ph: 'Coluna ' + (i + 1) })]))));
      const setCols = n => () => {
        while (d.cols.length < n) d.cols.push('');
        if (d.cols.length > n) d.cols[n - 1] = d.cols.slice(n - 1).filter(Boolean).join('\n\n');
        d.cols.length = n;
        commit(true);
        render({ id: b.id, keep: true });
      };
      body.append(tools([
        { label: '2 colunas', pressed: d.cols.length === 2, run: setCols(2) },
        { label: '3 colunas', pressed: d.cols.length === 3, run: setCols(3) }
      ]));
    },

    table: (b, body) => {
      const d = b.data;
      const head = el('tr', {}, d.rows[0].map((c, j) => el('th', {}, [rt('div', b, 'rows.0.' + j, { ph: 'Título' })])));
      const rows = d.rows.slice(1).map((r, i) => el('tr', {}, r.map((c, j) => el('td', {}, [rt('div', b, 'rows.' + (i + 1) + '.' + j, { ph: ' ' })]))));
      body.append(el('div', { class: 'table-wrap' }, [el('table', {}, [el('thead', {}, [head]), el('tbody', {}, rows)])]));
      const op = fn => () => { fn(); commit(true); render({ id: b.id, keep: true }); };
      body.append(tools([
        { label: '+ Linha', run: op(() => d.rows.push(d.rows[0].map(() => ''))) },
        { label: '+ Coluna', run: op(() => d.rows.forEach((r, i) => r.push(i ? '' : 'Coluna ' + (r.length + 1)))) },
        '|',
        { label: '− Linha', run: op(() => { if (d.rows.length > 2) d.rows.pop(); }) },
        { label: '− Coluna', run: op(() => { if (d.rows[0].length > 1) d.rows.forEach(r => r.pop()); }) }
      ]));
    },

    button: (b, body) => {
      const d = b.data;
      const link = el('input', { value: d.href, placeholder: '/index.html ou https://…' });
      link.addEventListener('input', () => { d.href = link.value.trim(); commit(false); });
      body.append(el('p', { class: 'button-line' }, [el('span', { class: 'btn' }, [rt('span', b, 'label', { ph: 'Texto do botão' })])]));
      body.append(el('label', { class: 'ed-button-link', contenteditable: 'false' }, [document.createTextNode('Link do botão: '), link]));
    },

    raw: (b, body) => {
      const ta = el('textarea', { class: 'ed-raw', spellcheck: 'false' });
      ta.value = b.data.text;
      ta.addEventListener('input', () => { b.data.text = ta.value; commit(false); });
      body.append(ta);
    }
  };

  function render(opts) {
    opts = opts || {};
    const scrollY = window.scrollY;
    blocksEl.innerHTML = '';
    let num = 0, prevType = null, firstP = true;
    state.blocks.forEach((b, i) => {
      num = b.type === 'numbered' && prevType === 'numbered' ? num + 1 : 1;
      const next = state.blocks[i + 1];
      const wrap = el('div', {
        class: 'blk' + ((b.type === 'bullet' || b.type === 'numbered') && (!next || next.type !== b.type) ? ' run-end' : '') +
          (b.type === 'p' && firstP ? ' is-first-p' : ''),
        'data-id': b.id,
        'data-type': b.type
      });
      if (b.type === 'p' && b.data.md.trim()) firstP = false;
      const gutter = el('div', { class: 'blk-gutter', contenteditable: 'false' }, [
        el('button', { type: 'button', class: 'blk-add', title: 'Inserir bloco abaixo', text: '+' }),
        el('button', { type: 'button', class: 'blk-handle', title: 'Arraste para mover · clique para opções', text: '⋮⋮' })
      ]);
      const body = el('div', { class: 'blk-body' });
      RENDER[b.type](b, body, { num });
      wrap.append(gutter, body);
      blocksEl.append(wrap);
      prevType = b.type;
    });
    blocksEl.classList.toggle('is-empty', state.blocks.length === 1 && state.blocks[0].type === 'p' && !state.blocks[0].data.md);
    applyAppearance();
    if (opts.id) {
      const w = blocksEl.querySelector('.blk[data-id="' + opts.id + '"]');
      if (w) {
        if (opts.keep) { setSelected(w); window.scrollTo(0, scrollY); }
        else if (opts.where != null || opts.field) focusBlock(opts.id, opts.where == null ? 'end' : opts.where, opts.field);
        else { setSelected(w); }
      }
    } else {
      window.scrollTo(0, scrollY);
    }
  }

  function applyAppearance() {
    const p = state.props;
    $('#ed-article').className = 'ed-article' + (p.cor && p.cor !== 'vermelho' ? ' tema-' + p.cor : '');
    blocksEl.classList.toggle('capitular', !!p.capitular);
  }

  /* ── Foco e cursor ── */
  function textOffset(elm) {
    const sel = getSelection();
    if (!sel.rangeCount) return 0;
    const r = sel.getRangeAt(0);
    if (!elm.contains(r.startContainer)) return 0;
    const pre = document.createRange();
    pre.selectNodeContents(elm);
    pre.setEnd(r.startContainer, r.startOffset);
    return pre.toString().length;
  }
  const isCollapsed = () => { const s = getSelection(); return s.rangeCount && s.isCollapsed; };
  const atStart = elm => isCollapsed() && textOffset(elm) === 0;
  const atEnd = elm => isCollapsed() && textOffset(elm) >= elm.textContent.length;

  function placeCaret(elm, where) {
    elm.focus({ preventScroll: true });
    const sel = getSelection();
    const r = document.createRange();
    if (typeof where === 'number') {
      let left = where, node = null, off = 0;
      const walker = document.createTreeWalker(elm, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const len = walker.currentNode.nodeValue.length;
        if (left <= len) { node = walker.currentNode; off = left; break; }
        left -= len;
      }
      if (node) { r.setStart(node, off); r.collapse(true); }
      else { r.selectNodeContents(elm); r.collapse(false); }
    } else {
      r.selectNodeContents(elm);
      r.collapse(where === 'start');
    }
    sel.removeAllRanges();
    sel.addRange(r);
    const rect = elm.getBoundingClientRect();
    if (rect.top < 70 || rect.bottom > window.innerHeight - 40) elm.scrollIntoView({ block: 'center' });
  }

  function focusBlock(id, where, field) {
    const w = blocksEl.querySelector('.blk[data-id="' + id + '"]');
    if (!w) return;
    const target = (field && w.querySelector('.rt[data-f="' + field + '"]')) || w.querySelector('.rt');
    if (target) placeCaret(target, where);
    else setSelected(w);
  }

  function setActive(w) {
    $$('.blk.is-active', blocksEl).forEach(x => x !== w && x.classList.remove('is-active'));
    $$('.blk.is-selected', blocksEl).forEach(x => x.classList.remove('is-selected'));
    if (w) w.classList.add('is-active');
  }

  function setSelected(w) {
    $$('.blk.is-selected, .blk.is-active', blocksEl).forEach(x => x.classList.remove('is-selected', 'is-active'));
    if (document.activeElement && blocksEl.contains(document.activeElement)) document.activeElement.blur();
    if (w) w.classList.add('is-selected');
  }

  const selectedBlock = () => { const w = $('.blk.is-selected', blocksEl); return w ? byId(w.dataset.id) : null; };

  /* ============================================================
     OPERAÇÕES COM BLOCOS
     ============================================================ */
  function insertAt(i, b, focus) {
    state.blocks.splice(i, 0, b);
    commit(true);
    render(focus === false ? {} : { id: b.id, where: 'start' });
    afterInsert(b);
  }

  function insertBlockAfter(id, type, data) {
    const ref = byId(id);
    const b = mk(type, data);
    if (ref && ref.type === 'p' && !ref.data.md.trim()) {
      state.blocks[idx(id)] = b;          // bloco vazio vira o novo elemento
      commit(true);
      render({ id: b.id, where: 'start' });
      afterInsert(b);
    } else {
      insertAt(ref ? idx(id) + 1 : state.blocks.length, b);
    }
  }

  function afterInsert(b) {
    if (b.type === 'image' && !b.data.src) pickImage(b);
    if (b.type === 'gallery' && !b.data.items.length) {
      openPicker(true, list => { list.forEach(src => b.data.items.push({ src, caption: '' })); commit(true); render({ id: b.id, keep: true }); });
    }
    if (b.type === 'video' && !b.data.url) {
      const inp = $('.blk[data-id="' + b.id + '"] input');
      if (inp) inp.focus();
    }
    if (b.type === 'divider') {
      const i = idx(b.id);
      const next = state.blocks[i + 1];
      if (!next) insertAt(i + 1, mk('p'));
      else focusBlock(next.id, 'start');
    }
  }

  function removeBlock(id, focusPrev) {
    const i = idx(id);
    if (i === -1) return;
    state.blocks.splice(i, 1);
    ensureBlock();
    commit(true);
    const target = state.blocks[Math.max(0, i - 1)];
    render(focusPrev === false ? {} : { id: target.id, where: 'end' });
  }

  function moveBlock(id, to) {
    const from = idx(id);
    if (from === -1) return;
    const [b] = state.blocks.splice(from, 1);
    if (to > from) to--;
    to = Math.max(0, Math.min(state.blocks.length, to));
    state.blocks.splice(to, 0, b);
    commit(true);
    render({ id: b.id, keep: true });
  }

  function duplicateBlock(id) {
    const b = byId(id);
    const copy = { id: newId(), type: b.type, data: JSON.parse(JSON.stringify(b.data)) };
    state.blocks.splice(idx(id) + 1, 0, copy);
    commit(true);
    render({ id: copy.id, keep: true });
  }

  function mainText(b) {
    const d = b.data;
    if (TEXT_TYPES.includes(b.type)) return d.md;
    if (b.type === 'toggle') return [d.title, d.text].filter(Boolean).join('\n');
    return d.text || '';
  }

  function transformBlock(id, type) {
    const b = byId(id);
    if (!b || b.type === type) return;
    const text = mainText(b);
    const nb = mk(type);
    if (TEXT_TYPES.includes(type)) nb.data.md = text.replace(/\s*\n\s*/g, ' ');
    else if (type === 'toggle') { const lines = text.split('\n'); nb.data.title = lines.shift(); nb.data.text = lines.join('\n'); }
    else nb.data.text = text;
    nb.id = b.id;
    state.blocks[idx(id)] = nb;
    commit(true);
    render({ id: nb.id, where: 'end' });
  }

  /* ============================================================
     DIGITAÇÃO
     ============================================================ */
  function blockOf(node) {
    const w = node && node.closest && node.closest('.blk');
    return w ? { w, b: byId(w.dataset.id) } : {};
  }

  function syncField(rtEl) {
    const { b } = blockOf(rtEl);
    if (!b) return;
    if (rtEl.innerHTML === '<br>' || rtEl.innerHTML === '<div><br></div>') rtEl.innerHTML = '';
    setPath(b.data, rtEl.dataset.f, htmlToMd(rtEl, !!rtEl.dataset.multi));
    blocksEl.classList.remove('is-empty');
    commit(false);
  }

  function deleteBackward(n) {
    const sel = getSelection();
    for (let k = 0; k < n; k++) sel.modify('extend', 'backward', 'character');
    document.execCommand('delete');
  }

  function removeLeadingChars(elm, n) {
    const walker = document.createTreeWalker(elm, NodeFilter.SHOW_TEXT);
    while (n > 0 && walker.nextNode()) {
      const node = walker.currentNode;
      const take = Math.min(n, node.nodeValue.length);
      node.nodeValue = node.nodeValue.slice(take);
      n -= take;
    }
  }

  // Atalhos de Markdown no início de um parágrafo
  const SHORTCUTS = { '#': 'h2', '##': 'h2', '###': 'h3', '-': 'bullet', '*': 'bullet', '+': 'bullet', '>': 'quote', '"': 'quote' };

  blocksEl.addEventListener('input', e => {
    const rtEl = e.target.closest('.rt');
    if (!rtEl) return;
    const { b } = blockOf(rtEl);
    syncField(rtEl);

    if (slash.open) updateSlash();
    else if (TEXT_TYPES.includes(b.type) && rtEl.dataset.f === 'md' && e.data && e.data.indexOf('/') !== -1) startSlash(rtEl, b);

    if (b.type === 'p' && rtEl.dataset.f === 'md' && /^insert/.test(e.inputType || '')) {
      // "## ", "- ", "1. ", "> " no começo do parágrafo viram o bloco correspondente
      const text = rtEl.textContent.replace(/ /g, ' ');
      const m = text.match(/^(#{1,3}|[-*+]|>|"|\d+[.)]) /);
      if (m && !slash.open) {
        const type = SHORTCUTS[m[1]] || 'numbered';
        removeLeadingChars(rtEl, m[0].length);
        syncField(rtEl);
        transformBlock(b.id, type);
        return;
      }
      if (text.trim() === '---' || text.trim() === '***') {
        b.data.md = '';
        const i = idx(b.id);
        state.blocks[i] = mk('divider');
        state.blocks.splice(i + 1, 0, mk('p'));
        commit(true);
        render({ id: state.blocks[i + 1].id, where: 'start' });
      }
    }
  });

  blocksEl.addEventListener('keydown', e => {
    const rtEl = e.target.closest && e.target.closest('.rt');
    if (!rtEl) return;
    const { b } = blockOf(rtEl);
    const field = rtEl.dataset.f;
    const multi = !!rtEl.dataset.multi;
    const isMain = TEXT_TYPES.includes(b.type) && field === 'md';

    if (slash.open && slashKeys(e)) return;

    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') { e.preventDefault(); inlineCmd('bold'); return; }
      if (k === 'i') { e.preventDefault(); inlineCmd('italic'); return; }
      if (k === 'k') { e.preventDefault(); inlineCmd('link'); return; }
      if (k === 'e') { e.preventDefault(); inlineCmd('mark'); return; }
      if (k === 'd') { e.preventDefault(); duplicateBlock(b.id); return; }
    }

    if (e.key === 'Escape') { e.preventDefault(); setSelected(rtEl.closest('.blk')); return; }

    if (e.key === 'Enter' && !e.shiftKey) {
      if (isMain) { e.preventDefault(); splitBlock(rtEl, b); return; }
      if (multi) {
        const lines = toMd(rtEl).replace(/\n$/, '').split('\n');
        if (atEnd(rtEl) && lines.length > 1 && lines[lines.length - 1].trim() === '') {
          e.preventDefault();
          setPath(b.data, field, lines.slice(0, -1).join('\n').replace(/\s+$/, ''));
          insertAt(idx(b.id) + 1, mk('p'));
        }
        return;
      }
      // campo de uma linha (título, legenda, célula): vai para o próximo campo
      e.preventDefault();
      const fields = $$('.rt', rtEl.closest('.blk'));
      const next = fields[fields.indexOf(rtEl) + 1];
      if (next) placeCaret(next, 'end');
      else insertAt(idx(b.id) + 1, mk('p'));
      return;
    }
    if (e.key === 'Enter' && e.shiftKey && !multi) { e.preventDefault(); return; }

    if (e.key === 'Backspace' && atStart(rtEl)) {
      if (isMain) {
        if (b.type !== 'p') { e.preventDefault(); transformBlock(b.id, 'p'); focusBlock(b.id, 'start'); return; }
        const i = idx(b.id);
        const prev = state.blocks[i - 1];
        if (!prev) return;
        e.preventDefault();
        if (TEXT_TYPES.includes(prev.type)) {
          const prevEl = $('.blk[data-id="' + prev.id + '"] .rt');
          const offset = prevEl ? prevEl.textContent.length : 0;
          prev.data.md = (prev.data.md + b.data.md);
          state.blocks.splice(i, 1);
          commit(true);
          render();
          const pe = $('.blk[data-id="' + prev.id + '"] .rt');
          if (pe) placeCaret(pe, offset);
        } else if (!b.data.md.trim()) {
          state.blocks.splice(i, 1);
          commit(true);
          render({ id: prev.id, where: 'end' });
        } else {
          setSelected($('.blk[data-id="' + prev.id + '"]'));
        }
        return;
      }
      const all = $$('.rt', rtEl.closest('.blk'));
      if (all.every(x => !x.textContent.trim()) && rtEl === all[0] && !['image', 'gallery', 'video', 'table'].includes(b.type)) {
        e.preventDefault();
        removeBlock(b.id);
      }
      return;
    }

    if (e.key === 'ArrowUp' && textOffset(rtEl) === 0 && isCollapsed()) {
      const fields = $$('.rt', blocksEl);
      const prev = fields[fields.indexOf(rtEl) - 1];
      if (prev) { e.preventDefault(); placeCaret(prev, 'end'); }
    }
    if (e.key === 'ArrowDown' && atEnd(rtEl)) {
      const fields = $$('.rt', blocksEl);
      const next = fields[fields.indexOf(rtEl) + 1];
      if (next) { e.preventDefault(); placeCaret(next, 'start'); }
    }
  });

  // Teclados de celular às vezes não enviam "keydown Enter"
  blocksEl.addEventListener('beforeinput', e => {
    if (e.inputType !== 'insertParagraph') return;
    const rtEl = e.target.closest && e.target.closest('.rt');
    if (!rtEl) return;
    const { b } = blockOf(rtEl);
    if (TEXT_TYPES.includes(b.type) && rtEl.dataset.f === 'md') { e.preventDefault(); splitBlock(rtEl, b); }
    else if (!rtEl.dataset.multi) e.preventDefault();
  });

  function splitBlock(rtEl, b) {
    const isList = b.type === 'bullet' || b.type === 'numbered';
    if (isList && !rtEl.textContent.trim()) { transformBlock(b.id, 'p'); focusBlock(b.id, 'start'); return; }
    const i = idx(b.id);
    if (textOffset(rtEl) === 0 && rtEl.textContent.length) {
      insertAt(i, mk(isList ? b.type : 'p'), false);
      focusBlock(b.id, 'start');
      return;
    }
    const sel = getSelection();
    const r = sel.getRangeAt(0);
    r.deleteContents();
    const tail = document.createRange();
    tail.setStart(r.endContainer, r.endOffset);
    tail.setEnd(rtEl, rtEl.childNodes.length);
    const holder = document.createElement('div');
    holder.append(tail.extractContents());
    b.data.md = htmlToMd(rtEl, false);
    insertAt(i + 1, mk(isList ? b.type : 'p', { md: htmlToMd(holder, false) }));
  }

  blocksEl.addEventListener('paste', e => {
    const rtEl = e.target.closest('.rt');
    if (!rtEl) return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    const { b } = blockOf(rtEl);
    const isMain = TEXT_TYPES.includes(b.type) && rtEl.dataset.f === 'md';
    if (isMain && /\n/.test(text.trim())) {
      const nbs = mdToBlocks(text);
      if (nbs.length) {
        let i = idx(b.id);
        if (b.type === 'p' && !b.data.md.trim()) state.blocks.splice(i, 1); else i++;
        state.blocks.splice.apply(state.blocks, [i, 0].concat(nbs));
        commit(true);
        render({ id: nbs[nbs.length - 1].id, where: 'end' });
        return;
      }
    }
    document.execCommand('insertText', false, rtEl.dataset.multi ? text : text.replace(/\s*\n\s*/g, ' '));
  });

  blocksEl.addEventListener('focusin', e => {
    const w = e.target.closest('.blk');
    if (w) setActive(w);
  });

  blocksEl.addEventListener('click', e => {
    const w = e.target.closest('.blk');
    if (!w) return;
    if (e.target.closest('.rt, input, textarea, button, .blk-tools')) return;
    setSelected(w);
  });

  document.addEventListener('mousedown', e => {
    if (!e.target.closest('.blk, .ed-pop, .ed-inline, dialog')) {
      $$('.blk.is-selected', blocksEl).forEach(x => x.classList.remove('is-selected'));
    }
  });

  // Teclas com um bloco selecionado (sem cursor de texto)
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'y')) {
      if (state.mode !== 'edit') return;
      if (e.target.closest && e.target.closest('.ed-props input, .ed-props textarea, .ed-raw, .ed-video-empty input')) return;
      e.preventDefault();
      if (k === 'y' || e.shiftKey) redo(); else undo();
      return;
    }
    const sb = selectedBlock();
    if (!sb || (e.target.closest && e.target.closest('input, textarea, [contenteditable="true"]'))) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeBlock(sb.id); }
    if (e.key === 'Enter') { e.preventDefault(); insertAt(idx(sb.id) + 1, mk('p')); }
    if (e.key === 'ArrowUp' && e.altKey) { e.preventDefault(); moveBlock(sb.id, idx(sb.id) - 1); }
    if (e.key === 'ArrowDown' && e.altKey) { e.preventDefault(); moveBlock(sb.id, idx(sb.id) + 2); }
  });

  // Clique abaixo do último bloco: continua escrevendo
  $('#ed-add-below').addEventListener('click', () => {
    const last = state.blocks[state.blocks.length - 1];
    if (last && last.type === 'p' && !last.data.md.trim()) focusBlock(last.id, 'end');
    else insertAt(state.blocks.length, mk('p'));
  });

  /* ============================================================
     MENUS ( "/" , "+" , opções do bloco )
     ============================================================ */
  const menuEl = $('#ed-menu');
  const menu = { items: [], hover: 0, onPick: null, filter: '' };

  function normalize(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  function blockMenuItems() {
    return Object.keys(TYPES).map(t => ({
      group: TYPES[t].group, icon: TYPES[t].icon, label: TYPES[t].label, desc: TYPES[t].desc,
      keys: normalize(TYPES[t].label + ' ' + TYPES[t].keys), type: t
    }));
  }

  function positionPop(pop, rect) {
    pop.hidden = false;
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left = Math.min(rect.left, window.innerWidth - w - 12);
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - 12) top = Math.max(12, rect.top - h - 6);
    pop.style.left = Math.max(12, left) + 'px';
    pop.style.top = top + 'px';
  }

  function openMenu(rect, items, onPick, withSearch) {
    menu.items = items;
    menu.all = items;
    menu.onPick = onPick;
    menu.hover = 0;
    menu.withSearch = withSearch;
    drawMenu();
    positionPop(menuEl, rect);
    if (withSearch) { const s = $('.ed-menu-search', menuEl); s.focus(); }
  }

  function drawMenu() {
    const list = menu.items;
    let html = menu.withSearch ? '<input class="ed-menu-search" placeholder="Buscar elemento…" value="' + esc(menu.filter || '') + '">' : '';
    if (!list.length) html += '<div class="ed-menu-empty">Nenhum elemento encontrado</div>';
    let group = null;
    list.forEach((it, i) => {
      if (it.group && it.group !== group) { group = it.group; html += '<div class="ed-menu-group">' + esc(group) + '</div>'; }
      html += '<button type="button" class="ed-menu-item' + (i === menu.hover ? ' is-hover' : '') + (it.danger ? ' ed-menu-danger' : '') +
        '" data-i="' + i + '"><span class="ed-menu-icon">' + esc(it.icon || '') + '</span><span><b>' + esc(it.label) + '</b>' +
        (it.desc ? '<small>' + esc(it.desc) + '</small>' : '') + '</span></button>';
    });
    menuEl.innerHTML = html;
    const s = $('.ed-menu-search', menuEl);
    if (s) {
      s.addEventListener('input', () => { menu.filter = s.value; filterMenu(s.value); });
      s.addEventListener('keydown', e => { if (!menuKeys(e) && e.key === 'Escape') closeMenu(); });
    }
    const h = $('.is-hover', menuEl);
    if (h) h.scrollIntoView({ block: 'nearest' });
  }

  function filterMenu(q) {
    const nq = normalize(q.trim());
    menu.items = menu.all.filter(it => !nq || (it.keys || normalize(it.label)).indexOf(nq) !== -1);
    menu.hover = 0;
    const had = document.activeElement && document.activeElement.classList.contains('ed-menu-search');
    drawMenu();
    if (had) { const s = $('.ed-menu-search', menuEl); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
  }

  function menuKeys(e) {
    if (menuEl.hidden) return false;
    if (e.key === 'ArrowDown') { e.preventDefault(); menu.hover = (menu.hover + 1) % Math.max(1, menu.items.length); redrawHover(); return true; }
    if (e.key === 'ArrowUp') { e.preventDefault(); menu.hover = (menu.hover - 1 + menu.items.length) % Math.max(1, menu.items.length); redrawHover(); return true; }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (menu.items[menu.hover]) pickMenu(menu.hover);
      return true;
    }
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return true; }
    return false;
  }

  function redrawHover() {
    $$('.ed-menu-item', menuEl).forEach((b, i) => b.classList.toggle('is-hover', i === menu.hover));
    const h = $('.is-hover', menuEl);
    if (h) h.scrollIntoView({ block: 'nearest' });
  }

  function pickMenu(i) {
    const it = menu.items[i];
    const cb = menu.onPick;
    closeMenu();
    if (it && cb) cb(it);
  }

  function closeMenu() {
    menuEl.hidden = true;
    menu.filter = '';
    slash.open = false;
  }

  menuEl.addEventListener('mousedown', e => { if (!e.target.closest('.ed-menu-search')) e.preventDefault(); });
  menuEl.addEventListener('click', e => {
    const b = e.target.closest('.ed-menu-item');
    if (b) pickMenu(+b.dataset.i);
  });
  menuEl.addEventListener('mousemove', e => {
    const b = e.target.closest('.ed-menu-item');
    if (b && +b.dataset.i !== menu.hover) { menu.hover = +b.dataset.i; redrawHover(); }
  });
  document.addEventListener('mousedown', e => {
    if (!menuEl.hidden && !e.target.closest('#ed-menu') && !e.target.closest('.blk-add')) closeMenu();
    if (!emojiEl.hidden && !e.target.closest('#ed-emoji') && !e.target.closest('.callout-icon-btn')) emojiEl.hidden = true;
  });
  window.addEventListener('scroll', () => { if (!menuEl.hidden && !slash.open && !menu.withSearch) closeMenu(); }, { passive: true });

  /* Comando "/" */
  const slash = { open: false, el: null, b: null, start: 0 };

  function caretRect() {
    const sel = getSelection();
    if (!sel.rangeCount) return null;
    const r = sel.getRangeAt(0).cloneRange();
    r.collapse(true);
    let rect = r.getBoundingClientRect();
    if (!rect.width && !rect.height) rect = sel.focusNode.parentElement.getBoundingClientRect();
    return rect;
  }

  function startSlash(rtEl, b) {
    const off = textOffset(rtEl);
    const text = rtEl.textContent.replace(/ /g, ' ');
    const start = text.lastIndexOf('/', off - 1);
    // só abre se a barra estiver no começo ou depois de um espaço (não em "e/ou", links etc.)
    if (start === -1 || (start > 0 && text.charAt(start - 1) !== ' ') || /\s/.test(text.slice(start + 1, off))) return;
    slash.el = rtEl;
    slash.b = b;
    slash.start = start;
    openMenu(caretRect() || rtEl.getBoundingClientRect(), blockMenuItems(), it => chooseFromSlash(it.type), false);
    slash.open = true;
    if (off - start > 1) updateSlash();
  }

  function updateSlash() {
    const off = textOffset(slash.el);
    const text = slash.el.textContent.replace(/ /g, ' ');
    if (off <= slash.start || text.charAt(slash.start) !== '/') { closeMenu(); return; }
    const q = text.slice(slash.start + 1, off);
    if (q.length > 24 || /^\s/.test(q)) { closeMenu(); return; }
    filterMenu(q);
    if (!menu.items.length && / $/.test(q)) closeMenu();
  }

  function slashKeys(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return true; }
    return menuKeys(e);
  }

  function chooseFromSlash(type) {
    const rtEl = slash.el, b = slash.b;
    const len = textOffset(rtEl) - slash.start;
    placeCaret(rtEl, textOffset(rtEl));
    deleteBackward(len);
    syncField(rtEl);
    insertBlockAfter(b.id, type);
  }

  /* Botão "+" e alça "⋮⋮" */
  blocksEl.addEventListener('click', e => {
    const add = e.target.closest('.blk-add');
    if (!add) return;
    const id = add.closest('.blk').dataset.id;
    menu.filter = '';
    openMenu(add.getBoundingClientRect(), blockMenuItems(), it => insertBlockAfter(id, it.type), true);
  });

  function openBlockMenu(id, anchor) {
    const b = byId(id);
    const items = [];
    if (TRANSFORMABLE.includes(b.type)) {
      TRANSFORMABLE.filter(t => t !== b.type).forEach(t => items.push({
        group: 'Transformar em', icon: TYPES[t].icon, label: TYPES[t].label, run: () => transformBlock(id, t)
      }));
    }
    const i = idx(id);
    items.push(
      { group: 'Ações', icon: '⧉', label: 'Duplicar', desc: 'Ctrl+D', run: () => duplicateBlock(id) },
      { group: 'Ações', icon: '↑', label: 'Mover para cima', desc: 'Alt+↑', run: () => moveBlock(id, i - 1) },
      { group: 'Ações', icon: '↓', label: 'Mover para baixo', desc: 'Alt+↓', run: () => moveBlock(id, i + 2) },
      { group: 'Ações', icon: '🗑', label: 'Excluir', desc: 'Delete', danger: true, run: () => removeBlock(id) }
    );
    setSelected($('.blk[data-id="' + id + '"]'));
    openMenu(anchor.getBoundingClientRect(), items, it => it.run(), false);
  }

  /* ── Arrastar para mover ── */
  let drag = null;
  const dropLine = el('div', { class: 'ed-drop-line', hidden: true });
  blocksEl.after(dropLine);

  blocksEl.addEventListener('pointerdown', e => {
    const h = e.target.closest('.blk-handle');
    if (!h) return;
    e.preventDefault();
    drag = { id: h.closest('.blk').dataset.id, y: e.clientY, moved: false, handle: h, to: null };
    try { h.setPointerCapture(e.pointerId); } catch (err) { /* alguns navegadores não permitem */ }
  });

  blocksEl.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.moved && Math.abs(e.clientY - drag.y) < 5) return;
    if (!drag.moved) {
      drag.moved = true;
      document.body.classList.add('is-dragging');
      $('.blk[data-id="' + drag.id + '"]').classList.add('is-drag-source');
      closeMenu();
    }
    const blks = $$('.blk', blocksEl);
    let to = blks.length;
    for (let i = 0; i < blks.length; i++) {
      const r = blks[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { to = i; break; }
    }
    drag.to = to;
    const host = blocksEl.getBoundingClientRect();
    const ref = blks[to] ? blks[to].getBoundingClientRect().top : blks[blks.length - 1].getBoundingClientRect().bottom;
    dropLine.hidden = false;
    dropLine.style.top = (ref - 2) + 'px';
    dropLine.style.left = host.left + 'px';
    dropLine.style.width = host.width + 'px';
    if (e.clientY < 80) window.scrollBy(0, -12);
    if (e.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
  });

  function endDrag(e) {
    if (!drag) return;
    const d = drag;
    drag = null;
    document.body.classList.remove('is-dragging');
    dropLine.hidden = true;
    $$('.is-drag-source', blocksEl).forEach(x => x.classList.remove('is-drag-source'));
    if (d.moved) { if (d.to != null) moveBlock(d.id, d.to); }
    else if (e.type === 'pointerup') openBlockMenu(d.id, d.handle);
  }
  blocksEl.addEventListener('pointerup', endDrag);
  blocksEl.addEventListener('pointercancel', endDrag);

  /* ── Emojis da caixa ── */
  const emojiEl = $('#ed-emoji');
  const EMOJIS = ['💡', '✝️', '🙏', '📖', '⚠️', '❗', '🕊️', '🌹', '⭐', '❤️', '🔥', '📿', '⛪', '👑', '🕯️', '🍷', '🍞', '💧', '☀️', '🌙', '✨', '📌', '✅', '❓'];
  function openEmoji(anchor, onPick) {
    emojiEl.innerHTML = '<div class="ed-emoji">' + EMOJIS.map(e => '<button type="button">' + e + '</button>').join('') + '</div>';
    $$('button', emojiEl).forEach(b => b.addEventListener('click', () => { emojiEl.hidden = true; onPick(b.textContent); }));
    positionPop(emojiEl, anchor.getBoundingClientRect());
  }

  /* ── Barra ao selecionar texto ── */
  const inlineEl = $('#ed-inline');

  function inlineCmd(cmd) {
    const sel = getSelection();
    if (!sel.rangeCount) return;
    const node = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    const rtEl = node && node.closest('.rt');
    if (!rtEl) return;
    if (cmd === 'bold' || cmd === 'italic') document.execCommand(cmd);
    if (cmd === 'mark') {
      const m = node.closest('mark');
      if (m && rtEl.contains(m)) {
        m.replaceWith.apply(m, Array.from(m.childNodes));
      } else if (!sel.isCollapsed) {
        const r = sel.getRangeAt(0);
        const mark = document.createElement('mark');
        mark.append(r.extractContents());
        r.insertNode(mark);
        sel.removeAllRanges();
        const nr = document.createRange();
        nr.selectNodeContents(mark);
        sel.addRange(nr);
      }
    }
    if (cmd === 'link') {
      const a = node.closest('a');
      if (a) { document.execCommand('unlink'); }
      else {
        if (sel.isCollapsed) { toast('Selecione o texto que vai virar link.'); return; }
        const saved = sel.getRangeAt(0).cloneRange();
        const url = prompt('Endereço do link (https://… ou /pagina.html):');
        if (!url) return;
        sel.removeAllRanges();
        sel.addRange(saved);
        document.execCommand('createLink', false, url.trim());
      }
    }
    if (cmd === 'clear') {
      document.execCommand('removeFormat');
      document.execCommand('unlink');
      $$('mark', rtEl).forEach(m => { if (sel.containsNode(m, true)) m.replaceWith.apply(m, Array.from(m.childNodes)); });
    }
    syncField(rtEl);
    commit(true);
    updateInline();
  }

  function updateInline() {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed || state.mode !== 'edit') { inlineEl.hidden = true; return; }
    const node = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    if (!node || !node.closest('#ed-blocks .rt')) { inlineEl.hidden = true; return; }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    inlineEl.hidden = false;
    $$('[data-cmd]', inlineEl).forEach(b => {
      const c = b.dataset.cmd;
      let on = false;
      if (c === 'bold' || c === 'italic') on = document.queryCommandState(c);
      if (c === 'mark') on = !!node.closest('mark');
      if (c === 'link') on = !!node.closest('a');
      b.setAttribute('aria-pressed', String(on));
    });
    const w = inlineEl.offsetWidth;
    inlineEl.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, rect.left + rect.width / 2 - w / 2)) + 'px';
    inlineEl.style.top = Math.max(60, rect.top - inlineEl.offsetHeight - 8) + 'px';
  }

  document.addEventListener('selectionchange', () => requestAnimationFrame(updateInline));
  inlineEl.addEventListener('mousedown', e => e.preventDefault());
  inlineEl.addEventListener('click', e => { const b = e.target.closest('[data-cmd]'); if (b) inlineCmd(b.dataset.cmd); });

  /* ============================================================
     IMAGENS
     ============================================================ */
  const picker = $('#ed-picker');
  let pick = null, picked = [];

  function openPicker(multi, onDone) {
    pick = { multi, onDone };
    picked = [];
    $('[data-picker-title]', picker).textContent = multi ? 'Escolha as imagens' : 'Escolha uma imagem';
    $('[data-multi]', picker).hidden = !multi;
    $('#ed-image-path').value = '';
    $('.image-grid', picker).innerHTML = site.imagens.length ? site.imagens.map(src =>
      '<button type="button" data-src="' + esc(src) + '" aria-pressed="false"><img src="' + esc(src) + '" alt="" loading="lazy"><small>' + esc(src.split('/').pop()) + '</small></button>'
    ).join('') : '<p>Nenhuma imagem encontrada.</p>';
    updatePickButton();
    picker.showModal();
  }

  function pickImage(b) {
    openPicker(false, src => { b.data.src = src; commit(true); render({ id: b.id, keep: true }); });
  }

  function updatePickButton() {
    const btn = $('[data-insert]', picker);
    btn.textContent = picked.length ? 'Inserir ' + picked.length + (picked.length > 1 ? ' imagens' : ' imagem') : 'Selecione as imagens';
    btn.disabled = !picked.length;
  }

  function finishPick(v) {
    picker.close();
    const p = pick;
    pick = null;
    if (p) p.onDone(v);
  }

  picker.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { picker.close(); pick = null; return; }
    const btn = e.target.closest('[data-src]');
    if (btn && pick) {
      if (!pick.multi) return finishPick(btn.dataset.src);
      const i = picked.indexOf(btn.dataset.src);
      if (i === -1) picked.push(btn.dataset.src); else picked.splice(i, 1);
      btn.setAttribute('aria-pressed', String(i === -1));
      updatePickButton();
      return;
    }
    if (e.target.closest('[data-insert]') && picked.length) finishPick(picked.slice());
    if (e.target.closest('[data-use-path]')) {
      let path = $('#ed-image-path').value.trim();
      if (!path) return;
      if (path.charAt(0) !== '/' && !/^https?:/.test(path)) path = '/images2/' + path;
      if (pick && pick.multi) { picked.push(path); updatePickButton(); $('#ed-image-path').value = ''; }
      else finishPick(path);
    }
  });

  /* ============================================================
     PROPRIEDADES DO ARTIGO
     ============================================================ */
  const titleEl = $('#ed-title');
  const propInputs = $$('[data-prop]');

  function renderProps() {
    const p = state.props;
    titleEl.textContent = p.titulo;
    propInputs.forEach(inp => { inp.value = p[inp.dataset.prop] || ''; });
    $('#ed-arquivo').value = state.arquivo;
    $('#ed-arquivo').readOnly = !!state.editing;
    $$('#ed-swatches button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cor === p.cor)));
    $$('#ed-options button').forEach(b => b.setAttribute('aria-pressed', String(!!p[b.dataset.opt])));
    renderCover();
    updateCounters();
    updateMode();
  }

  function renderCover() {
    const c = $('#ed-cover');
    const src = state.props.capa;
    c.classList.toggle('is-empty', !src);
    $('#ed-cover-img').innerHTML = src ? '<img src="' + esc(src) + '" alt="">' : '<div class="ed-cover-empty">Escolha uma imagem de capa (aparece no card do artigo)</div>';
    $('#ed-cover-change').textContent = src ? 'Trocar capa' : 'Escolher capa';
  }

  function updateCounters() {
    const len = (state.props.resumo || '').length;
    $('#ed-resumo-count').textContent = len + '/160' + (len > 160 ? ' — longo para o WhatsApp' : '');
    $('#ed-url').textContent = 'rosariomeditado.com/artigos/' + (state.arquivo || '…') + '.html';
  }

  function autoSlug() {
    if (!state.slugTouched && !state.editing) {
      state.arquivo = M.slugify(state.props.titulo).slice(0, 60);
      $('#ed-arquivo').value = state.arquivo;
    }
  }

  titleEl.addEventListener('input', () => {
    if (titleEl.innerHTML === '<br>') titleEl.innerHTML = '';
    state.props.titulo = titleEl.textContent.replace(/\s+/g, ' ');
    autoSlug();
    updateCounters();
    commit(false);
  });
  titleEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); focusBlock(state.blocks[0].id, 'start'); }
  });
  titleEl.addEventListener('paste', e => {
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s+/g, ' '));
  });

  propInputs.forEach(inp => inp.addEventListener('input', () => {
    state.props[inp.dataset.prop] = inp.value;
    inp.classList.remove('is-invalid');
    if (inp.dataset.prop === 'capa') renderCover();
    updateCounters();
    commit(false);
  }));

  $('#ed-arquivo').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/[^A-Za-z0-9-]/g, '-');
    state.arquivo = e.target.value;
    state.slugTouched = !!e.target.value;
    updateCounters();
    commit(false);
  });

  $$('#ed-swatches button').forEach(b => b.addEventListener('click', () => {
    state.props.cor = b.dataset.cor;
    renderProps();
    applyAppearance();
    commit(true);
  }));
  $$('#ed-options button').forEach(b => b.addEventListener('click', () => {
    state.props[b.dataset.opt] = !state.props[b.dataset.opt];
    renderProps();
    applyAppearance();
    commit(true);
  }));
  $('#ed-cover-change').addEventListener('click', () => openPicker(false, src => {
    state.props.capa = src;
    renderProps();
    commit(true);
  }));

  /* ============================================================
     HISTÓRICO (desfazer / refazer) E RASCUNHO
     ============================================================ */
  let history = [], hIndex = -1, hTimer = null, saveTimer = null;

  const snapshot = () => JSON.stringify({ props: state.props, blocks: state.blocks, arquivo: state.arquivo });

  function pushHistory() {
    clearTimeout(hTimer);
    hTimer = null;
    const s = snapshot();
    if (history[hIndex] === s) return;
    history = history.slice(0, hIndex + 1);
    history.push(s);
    if (history.length > 150) history.shift();
    hIndex = history.length - 1;
  }

  function commit(structural) {
    if (structural) pushHistory();
    else { clearTimeout(hTimer); hTimer = setTimeout(pushHistory, 700); }
    clearTimeout(saveTimer);
    $('#ed-saved').textContent = 'Salvando…';
    saveTimer = setTimeout(saveDraft, 400);
  }

  function restore(s) {
    const d = JSON.parse(s);
    state.props = d.props;
    state.blocks = d.blocks;
    state.arquivo = d.arquivo;
    renderProps();
    render();
    saveDraft();
  }

  function undo() {
    if (hTimer) pushHistory();
    if (hIndex > 0) { hIndex--; restore(history[hIndex]); toast('Desfeito', false, 900); }
  }
  function redo() {
    if (hIndex < history.length - 1) { hIndex++; restore(history[hIndex]); toast('Refeito', false, 900); }
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        md: buildMarkdown(), arquivo: state.arquivo, slugTouched: state.slugTouched, editing: state.editing
      }));
      $('#ed-saved').textContent = 'Rascunho salvo neste navegador';
    } catch (e) {
      $('#ed-saved').textContent = '';
    }
  }

  function newDocument() {
    state.props = Object.assign({}, DEFAULT_PROPS, { data: new Date().toLocaleDateString('sv-SE') });
    state.blocks = [mk('p')];
    state.arquivo = '';
    state.slugTouched = false;
    state.editing = '';
  }

  function restoreDraft() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch (e) {}
    if (d && d.md) {
      loadFromMarkdown(d.md);
      state.arquivo = d.arquivo || '';
      state.slugTouched = !!d.slugTouched;
      state.editing = d.editing || '';
    } else {
      newDocument();
    }
    if (!state.props.data) state.props.data = new Date().toLocaleDateString('sv-SE');
  }

  /* ============================================================
     MODOS: Editar / Markdown / Visualizar
     ============================================================ */
  const mdArea = $('#ed-markdown');
  let mdOnEnter = '';

  function setMode(mode) {
    if (state.mode === mode) return;
    if (state.mode === 'markdown' && mdArea.value !== mdOnEnter) {
      const keep = { arquivo: state.arquivo, slugTouched: state.slugTouched, editing: state.editing };
      loadFromMarkdown(mdArea.value);
      Object.assign(state, keep);
      commit(true);
    }
    state.mode = mode;
    $$('#ed-modes button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    $('#ed-doc').hidden = mode !== 'edit';
    mdArea.hidden = mode !== 'markdown';
    $('#ed-preview').hidden = mode !== 'preview';
    inlineEl.hidden = true;
    closeMenu();
    if (mode === 'edit') { renderProps(); render(); }
    if (mode === 'markdown') { mdArea.value = mdOnEnter = buildMarkdown(); mdArea.focus(); }
    if (mode === 'preview') renderPreview();
    window.scrollTo(0, 0);
  }

  $$('#ed-modes button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

  function renderPreview() {
    const p = state.props;
    const body = blocksToMd(state.blocks);
    const parts = M.articleParts(p, body);
    const meta = (p.autor ? 'Por ' + esc(p.autor) + ' · ' : '') + (p.data ? esc(M.formatDate(p.data)) + ' · ' : '') + M.readingMinutes(body) + ' min de leitura';
    $('#ed-preview').innerHTML =
      '<div class="article-container"><article class="' + parts.themeClass + '">' +
      '<div class="article-header"><span class="card-tag">' + esc(p.categoria) + '</span><h1>' + esc(p.titulo || 'Sem título') + '</h1>' +
      '<p class="article-meta">' + meta + '</p>' + (p.fonte ? '<p class="article-source">Fonte: ' + M.inline(p.fonte) + '</p>' : '') + '</div>' +
      (parts.hero ? '<img class="article-hero" src="' + esc(parts.hero) + '" alt="">' : '') + parts.toc +
      '<div class="article-content ' + parts.contentClass + '">' + parts.html + '</div>' +
      '<div class="article-footer"><p>✝ Ora pro nobis, Sancta Dei Genetrix</p></div></article></div>';
  }

  /* ============================================================
     ABRIR, NOVO, PUBLICAR
     ============================================================ */
  const openSelect = $('#ed-open');

  function updateMode() {
    $('#ed-mode-label').textContent = state.editing ? 'Editando: ' + state.editing : 'Novo artigo';
    $('#ed-publish').textContent = state.editing ? 'Salvar no GitHub' : 'Publicar';
  }

  function hasContent() { return !!(state.props.titulo || blocksToMd(state.blocks).trim()); }

  openSelect.addEventListener('change', () => {
    const file = openSelect.value;
    openSelect.value = '';
    if (!file) return;
    if (hasContent() && !confirm('Abrir este artigo substitui o que está no editor agora. Continuar?')) return;
    toast('Carregando…', false, 1500);
    const raw = 'https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/' + DIR + '/' + file + '?t=' + Date.now();
    fetch(raw).then(r => { if (!r.ok) throw 0; return r.text(); })
      .catch(() => fetch('../' + DIR + '/' + file).then(r => { if (!r.ok) throw 0; return r.text(); }))
      .then(text => {
        loadFromMarkdown(text);
        state.editing = file;
        state.arquivo = file.replace(/\.md$/, '');
        state.slugTouched = true;
        setMode('edit');
        renderProps();
        render();
        history = []; hIndex = -1; pushHistory();
        saveDraft();
        toast('Artigo carregado. Ao terminar, clique em <b>Salvar no GitHub</b>.');
      })
      .catch(() => toast('Não foi possível carregar o artigo.', true));
  });

  $('#ed-new').addEventListener('click', () => {
    if (hasContent() && !confirm('Começar um novo artigo? O que está no editor será apagado.')) return;
    newDocument();
    setMode('edit');
    renderProps();
    render();
    history = []; hIndex = -1; pushHistory();
    saveDraft();
    titleEl.focus();
  });

  function validate() {
    const p = state.props;
    const missing = [];
    const need = [['titulo', 'título'], ['resumo', 'resumo'], ['categoria', 'categoria'], ['data', 'data'], ['capa', 'capa']];
    need.forEach(([k, label]) => {
      const ok = !!clean1(p[k]);
      const inp = $('[data-prop="' + k + '"]');
      if (inp) inp.classList.toggle('is-invalid', !ok);
      if (!ok) missing.push(label);
    });
    if (!state.arquivo) { missing.push('endereço'); $('#ed-arquivo').classList.add('is-invalid'); }
    if (!blocksToMd(state.blocks).trim()) missing.push('texto');
    if (missing.length) {
      if (state.mode !== 'edit') setMode('edit');
      toast('Falta preencher: <b>' + missing.join(', ') + '</b>.', true, 5000);
      const first = $('.is-invalid');
      if (!p.titulo) titleEl.focus(); else if (first) first.focus();
      return false;
    }
    if (!state.editing && site.artigos.some(a => a.arquivo === state.arquivo + '.md') &&
        !confirm('Já existe um artigo com o endereço "' + state.arquivo + '". Deseja substituí-lo?')) return false;
    return true;
  }

  const copy = text => navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject();

  $('#ed-publish').addEventListener('click', () => {
    if (state.mode === 'markdown') setMode('edit');
    if (!validate()) return;
    const md = buildMarkdown();
    if (state.editing) {
      copy(md).then(() => {
        window.open('https://github.com/' + REPO + '/edit/' + BRANCH + '/' + DIR + '/' + state.editing, '_blank', 'noopener');
        toast('<b>Texto copiado!</b> No GitHub: clique na caixa de texto → <b>Ctrl+A</b> → <b>Ctrl+V</b> → botão verde <b>Commit changes</b>.', false, 12000);
      }, () => toast('Não foi possível copiar. Use o modo Markdown e copie o texto manualmente.', true));
      return;
    }
    const base = 'https://github.com/' + REPO + '/new/' + BRANCH + '/' + DIR + '?filename=' + encodeURIComponent(state.arquivo + '.md');
    const full = base + '&value=' + encodeURIComponent(md);
    if (full.length <= MAX_URL) {
      window.open(full, '_blank', 'noopener');
      toast('Abrimos o GitHub em outra aba. Confira e clique no botão verde <b>Commit changes</b>.', false, 10000);
    } else {
      copy(md).then(() => {
        window.open(base, '_blank', 'noopener');
        toast('<b>Artigo longo: o texto foi copiado.</b> No GitHub, clique na caixa de texto → <b>Ctrl+V</b> → <b>Commit changes</b>.', false, 12000);
      }, () => toast('Não foi possível copiar. Use o modo Markdown e copie o texto manualmente.', true));
    }
  });

  $('#ed-download').addEventListener('click', () => {
    if (!state.arquivo) { toast('Defina o endereço do artigo antes de baixar.', true); return; }
    const blob = new Blob([buildMarkdown()], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = state.arquivo + '.md';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  /* ── Avisos ── */
  const toastEl = $('#ed-toast');
  let toastTimer;
  function toast(html, isError, ms) {
    toastEl.innerHTML = html;
    toastEl.classList.toggle('is-error', !!isError);
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms || 4000);
  }
  toastEl.addEventListener('click', () => { toastEl.hidden = true; });

  $('#ed-help-open').addEventListener('click', () => $('#ed-help').showModal());

  // Menu "⋯" (celular): reúne as ações que não cabem na barra
  $('#ed-more').addEventListener('click', e => {
    const items = [
      { group: 'Artigo', icon: '+', label: 'Novo artigo', run: () => $('#ed-new').click() },
      { group: 'Artigo', icon: '⤓', label: 'Baixar arquivo .md', run: () => $('#ed-download').click() },
      { group: 'Artigo', icon: '?', label: 'Ajuda e atalhos', run: () => $('#ed-help').showModal() }
    ].concat(site.artigos.map(a => ({
      group: 'Editar publicado', icon: '✎', label: a.titulo, run: () => { openSelect.value = a.arquivo; openSelect.dispatchEvent(new Event('change')); }
    })));
    openMenu(e.currentTarget.getBoundingClientRect(), items, it => it.run(), false);
  });
  $('#ed-help').addEventListener('click', e => { if (e.target.closest('[data-close]')) $('#ed-help').close(); });

  /* ============================================================
     INÍCIO
     ============================================================ */
  function start() {
    restoreDraft();
    renderProps();
    render();
    pushHistory();
    if (!state.props.titulo) titleEl.focus();
  }

  fetch('dados.json').then(r => r.json()).then(d => {
    site = d;
    $('#ed-categorias').innerHTML = site.categorias.map(c => '<option value="' + esc(c) + '">').join('');
    openSelect.innerHTML = '<option value="">Editar publicado…</option>' +
      site.artigos.map(a => '<option value="' + esc(a.arquivo) + '">' + esc(a.titulo) + '</option>').join('');
  }).catch(() => {}).then(start);

  // Para testes e depuração no console
  window.RosarioEditor = { state, mdToBlocks, blocksToMd, buildMarkdown, loadFromMarkdown, render, renderProps };
})();
