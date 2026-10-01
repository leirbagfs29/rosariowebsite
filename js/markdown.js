/* ============================================================
   ROSÁRIO MEDITADO — conversor de Markdown (sem dependências)
   Usado pelo gerador (build.js, Node) e pelo editor (admin/).

   Texto
     ## Subtítulo / ### Subtítulo menor
     **negrito**, *itálico*, ==texto marcado==
     [texto](link), endereços soltos (https://...)
     [[Texto do botão]](/link)
     > citação simples
     - lista   /   1. lista numerada
     | tabela | simples |
     ---  (separador com cruz)

   Imagens
     ![descrição](/images2/foto.jpg)            imagem sozinha
     ![descrição](/images2/foto.jpg){pequena}   tamanhos: pequena, media, grande

   Blocos  (abrem com  ::: tipo  e fecham com  :::)
     ::: imagem-direita /images2/foto.jpg | Descrição    (imagem-esquerda, imagem-topo)
     ::: oracao Título da oração
     ::: citacao Nome do santo
     ::: biblia Lc 1,28
     ::: destaque Título opcional
     ::: aviso Título opcional
     ::: centro
     ::: colunas        (separe as colunas com uma linha  |||)
     ::: galeria        (uma imagem por linha)
     ::: video https://youtube.com/... | Legenda      (uma linha só, sem fechar)
   ============================================================ */
(function (root) {
  'use strict';

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isExternal(url) { return /^https?:\/\//i.test(url); }

  function slugify(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  /* ── Formatação dentro da linha ── */
  function inline(text) {
    var tokens = [];
    function keep(html) { tokens.push(html); return '\u0000' + (tokens.length - 1) + '\u0000'; }

    var s = escapeHtml(text);

    // [[botão]](url)
    s = s.replace(/\[\[([^\]]+)\]\]\(([^)\s]+)\)/g, function (_, label, url) {
      var ext = isExternal(url) ? ' target="_blank" rel="noopener"' : '';
      return keep('<a class="btn" href="' + url + '"' + ext + '>' + label + '</a>');
    });
    // ![alt](src)
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, alt, src) {
      return keep('<img src="' + src + '" alt="' + alt + '" loading="lazy">');
    });
    // [texto](url)
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, label, url) {
      var ext = isExternal(url) ? ' target="_blank" rel="noopener"' : '';
      return keep('<a href="' + url + '"' + ext + '>' + label + '</a>');
    });
    // endereços soltos
    s = s.replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)"']/g, function (url) {
      var label = url.replace(/^https?:\/\/(www\.)?/, '');
      if (label.length > 60) label = label.slice(0, 57) + '…';
      return keep('<a href="' + url + '" target="_blank" rel="noopener">' + label + '</a>');
    });
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
    s = s.replace(/(^|\W)_([^_\s][^_]*?)_(?=\W|$)/g, '$1<em>$2</em>');
    s = s.replace(/==(.+?)==/g, '<mark>$1</mark>');

    return s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return tokens[+i]; });
  }

  /* ── Vídeo do YouTube ── */
  function youtubeId(url) {
    var m = String(url).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  function video(args) {
    var parts = args.split('|');
    var url = parts[0].trim();
    var caption = (parts[1] || '').trim();
    var id = youtubeId(url);
    if (!id) return '<p><a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' + (inline(caption) || 'Assistir ao vídeo') + '</a></p>';
    return '<figure class="video">\n  <div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/' + id +
      '" title="' + escapeHtml(caption || 'Vídeo') + '" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>' +
      (caption ? '\n  <figcaption>' + inline(caption) + '</figcaption>' : '') + '\n</figure>';
  }

  /* ── Blocos ::: ── */
  var IMAGE_LAYOUTS = { 'imagem-direita': 'right', 'imagem-esquerda': 'left', 'imagem-topo': 'top' };
  var BLOCKS = ['imagem-direita', 'imagem-esquerda', 'imagem-topo', 'oracao', 'citacao', 'biblia',
                'destaque', 'aviso', 'centro', 'colunas', 'galeria'];

  function renderBlock(type, args, inner, opts) {
    if (IMAGE_LAYOUTS[type]) {
      var p = args.split('|');
      var src = escapeHtml(p[0].trim());
      var alt = escapeHtml((p[1] || '').trim());
      return '<div class="text-image ' + IMAGE_LAYOUTS[type] + '">\n' +
        '  <div class="image"><img src="' + src + '" alt="' + alt + '" loading="lazy"></div>\n' +
        '  <div class="text">\n' + render(inner, opts) + '\n  </div>\n</div>';
    }
    switch (type) {
      case 'oracao':
        return '<div class="prayer-box">\n' +
          (args ? '  <p class="prayer-box-title">' + inline(args) + '</p>\n' : '') +
          render(inner, { ids: opts.ids, breaks: true }) + '\n</div>';
      case 'citacao':
        return '<figure class="saint-quote">\n  <blockquote>\n' + render(inner, opts) + '\n  </blockquote>' +
          (args ? '\n  <figcaption>' + inline(args) + '</figcaption>' : '') + '\n</figure>';
      case 'biblia':
        return '<figure class="bible-verse">\n  <blockquote>\n' + render(inner, { ids: opts.ids, breaks: true }) +
          '\n  </blockquote>' + (args ? '\n  <figcaption>' + inline(args) + '</figcaption>' : '') + '\n</figure>';
      case 'destaque':
      case 'aviso':
        return '<aside class="callout callout-' + type + '">\n' +
          (args ? '  <p class="callout-title">' + inline(args) + '</p>\n' : '') +
          render(inner, opts) + '\n</aside>';
      case 'centro':
        return '<div class="text-center">\n' + render(inner, opts) + '\n</div>';
      case 'colunas':
        var cols = inner.split(/^\s*\|\|\|\s*$/m);
        return '<div class="columns columns-' + Math.min(cols.length, 3) + '">\n' + cols.map(function (c) {
          return '  <div>\n' + render(c, opts) + '\n  </div>';
        }).join('\n') + '\n</div>';
      case 'galeria':
        var items = [];
        inner.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, a, s) {
          items.push('  <figure><img src="' + escapeHtml(s) + '" alt="' + escapeHtml(a) + '" loading="lazy">' +
            (a ? '<figcaption>' + inline(a) + '</figcaption>' : '') + '</figure>');
        });
        return '<div class="gallery">\n' + items.join('\n') + '\n</div>';
    }
    return '';
  }

  /* ── Tabela ── */
  function splitRow(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
  }

  /* ── Blocos de texto ── */
  function render(md, opts) {
    opts = opts || {};
    if (!opts.ids) opts.ids = {};
    var lines = String(md).replace(/\r\n?/g, '\n').split('\n');
    var out = [];
    var i = 0;

    function isBlank(l) { return /^\s*$/.test(l); }
    function startsBlock(l) {
      return /^(#{1,4}\s|>\s?|[-*]\s|\d+[.)]\s|:::|\||---\s*$|\*\*\*\s*$|!\[[^\]]*\]\([^)]+\)(\{\w+\})?\s*$|<)/.test(l.trim());
    }
    function headingId(text) {
      var base = slugify(text.replace(/<[^>]+>/g, '')) || 'secao';
      var id = base, n = 2;
      while (opts.ids[id]) id = base + '-' + n++;
      opts.ids[id] = true;
      return id;
    }

    while (i < lines.length) {
      var line = lines[i];
      var t = line.trim();

      if (isBlank(line)) { i++; continue; }

      // ::: video (uma linha)
      var vid = t.match(/^:::\s*video\s+(.+)$/);
      if (vid) { out.push(video(vid[1])); i++; continue; }

      // ::: bloco ... :::  (aceita blocos dentro de blocos)
      var box = t.match(/^:::\s*([a-z-]+)\s*(.*)$/);
      if (box && BLOCKS.indexOf(box[1]) !== -1) {
        var inner = [];
        var depth = 1;
        i++;
        while (i < lines.length) {
          var lt = lines[i].trim();
          var open = lt.match(/^:::\s*([a-z-]+)/);
          if (open && BLOCKS.indexOf(open[1]) !== -1) depth++;
          else if (lt === ':::' && --depth === 0) break;
          inner.push(lines[i]);
          i++;
        }
        i++; // pula o ::: de fechamento
        out.push(renderBlock(box[1], box[2].trim(), inner.join('\n'), opts));
        continue;
      }

      // HTML cru (para quem quiser)
      if (t.charAt(0) === '<') {
        var raw = [];
        while (i < lines.length && !isBlank(lines[i])) { raw.push(lines[i]); i++; }
        out.push(raw.join('\n'));
        continue;
      }

      var h = t.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        var level = Math.max(2, h[1].length); // # vira h2: o h1 é o título do artigo
        var content = inline(h[2]);
        out.push('<h' + level + ' id="' + headingId(h[2]) + '">' + content + '</h' + level + '>');
        i++;
        continue;
      }

      if (/^(---|\*\*\*)\s*$/.test(t)) { out.push('<hr>'); i++; continue; }

      // tabela: | a | b |  seguida de |---|---|
      if (t.charAt(0) === '|' && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        var headCells = splitRow(t);
        i += 2;
        var rows = [];
        while (i < lines.length && lines[i].trim().charAt(0) === '|') { rows.push(splitRow(lines[i])); i++; }
        out.push('<div class="table-wrap"><table>\n<thead><tr>' +
          headCells.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead>\n<tbody>\n' +
          rows.map(function (r) {
            return '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>';
          }).join('\n') + '\n</tbody>\n</table></div>');
        continue;
      }

      var img = t.match(/^!\[([^\]]*)\]\(([^)\s]+)\)(?:\{(pequena|media|média|grande)\})?$/);
      if (img) {
        var size = img[3] ? ' size-' + img[3].replace('é', 'e') : '';
        out.push('<figure class="article-figure' + size + '"><img src="' + escapeHtml(img[2]) + '" alt="' +
          escapeHtml(img[1]) + '" loading="lazy">' +
          (img[1] ? '<figcaption>' + inline(img[1]) + '</figcaption>' : '') + '</figure>');
        i++;
        continue;
      }

      // [[botão]](url) sozinho na linha
      if (/^\[\[[^\]]+\]\]\([^)\s]+\)$/.test(t)) {
        out.push('<p class="button-line">' + inline(t) + '</p>');
        i++;
        continue;
      }

      if (/^>\s?/.test(t)) {
        var quote = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          quote.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        out.push('<blockquote>\n' + render(quote.join('\n'), opts) + '\n</blockquote>');
        continue;
      }

      var listMatch = t.match(/^([-*]|\d+[.)])\s+/);
      if (listMatch) {
        var ordered = /\d/.test(listMatch[1]);
        var re = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/;
        var items = [];
        while (i < lines.length && re.test(lines[i])) {
          var item = lines[i].replace(re, '');
          i++;
          // continuação da mesma linha (recuada)
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !re.test(lines[i])) {
            item += ' ' + lines[i].trim();
            i++;
          }
          items.push('<li>' + inline(item) + '</li>');
        }
        var tag = ordered ? 'ol' : 'ul';
        out.push('<' + tag + '>\n' + items.join('\n') + '\n</' + tag + '>');
        continue;
      }

      // parágrafo
      var para = [];
      while (i < lines.length && !isBlank(lines[i]) && !(para.length && startsBlock(lines[i]))) {
        para.push(lines[i].trim());
        i++;
      }
      out.push('<p>' + para.map(inline).join(opts.breaks ? '<br>\n' : ' ') + '</p>');
    }

    return out.join('\n');
  }

  /* Cabeçalho do arquivo:  ---\nchave: valor\n---  */
  function parseFrontMatter(text) {
    var src = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    var m = src.match(/^---\n([\s\S]*?)\n---\n?/);
    var data = {};
    if (!m) return { data: data, body: src };
    m[1].split('\n').forEach(function (line) {
      var kv = line.match(/^([A-Za-zÀ-ú_]+)\s*:\s*(.*)$/);
      if (!kv) return;
      var v = kv[2].trim().replace(/^["'](.*)["']$/, '$1');
      if (v === 'sim' || v === 'true') v = true;
      else if (v === 'não' || v === 'nao' || v === 'false') v = false;
      data[kv[1].toLowerCase()] = v;
    });
    return { data: data, body: src.slice(m[0].length) };
  }

  /* ── Opções de aparência do artigo ── */
  var COLORS = {
    vermelho: 'Vermelho',
    roxo: 'Roxo',
    verde: 'Verde',
    azul: 'Azul mariano',
    dourado: 'Dourado',
    rosa: 'Rosa'
  };

  function articleParts(data, body) {
    var ids = {};
    var html = render(body, { ids: ids });
    var toc = '';
    if (data.sumario === true) {
      var items = [];
      html.replace(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g, function (_, id, text) {
        items.push('<li><a href="#' + id + '">' + text.replace(/<a [^>]*>|<\/a>/g, '') + '</a></li>');
      });
      if (items.length >= 2) {
        toc = '<nav class="toc" aria-label="Sumário">\n  <p class="toc-title">Neste artigo</p>\n  <ol>\n    ' +
          items.join('\n    ') + '\n  </ol>\n</nav>';
      }
    }
    var color = data.cor && COLORS[data.cor] && data.cor !== 'vermelho' ? data.cor : '';
    return {
      html: html,
      toc: toc,
      themeClass: color ? 'tema-' + color : '',
      contentClass: data.capitular === true ? 'capitular' : '',
      hero: data.capa_topo === true && data.capa ? data.capa : ''
    };
  }

  var MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
                'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  function formatDate(iso, short) {
    var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    var month = MONTHS[+m[2] - 1];
    return short
      ? (+m[3]) + ' ' + month.slice(0, 3) + ' ' + m[1]
      : (+m[3]) + ' de ' + month + ' de ' + m[1];
  }

  function readingMinutes(md) {
    var words = String(md).replace(/[#>*_\[\]()!:|=-]/g, ' ').split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }

  var api = {
    render: render,
    inline: inline,
    escapeHtml: escapeHtml,
    parseFrontMatter: parseFrontMatter,
    articleParts: articleParts,
    COLORS: COLORS,
    slugify: slugify,
    formatDate: formatDate,
    readingMinutes: readingMinutes
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RosarioMarkdown = api;
})(this);
