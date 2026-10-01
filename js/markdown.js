/* ============================================================
   ROSÁRIO MEDITADO — conversor de Markdown (sem dependências)
   Usado pelo gerador (build.js, Node) e pelo editor (admin/).

   Suporta:
     ## Subtítulo / ### Subtítulo menor
     **negrito**, *itálico*, [texto](link), endereços soltos (https://...)
     > citação
     - lista   /   1. lista numerada
     ---  (linha divisória)
     ![descrição](/images2/foto.jpg)   imagem sozinha numa linha
     ::: imagem-direita /images2/foto.jpg | Descrição da imagem
     texto que fica ao lado da imagem
     :::
       (também: imagem-esquerda, imagem-topo)
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

  function inline(text) {
    var tokens = [];
    function keep(html) { tokens.push(html); return '\u0000' + (tokens.length - 1) + '\u0000'; }

    var s = escapeHtml(text);

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

    return s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return tokens[+i]; });
  }

  var LAYOUTS = { 'imagem-direita': 'right', 'imagem-esquerda': 'left', 'imagem-topo': 'top' };

  function render(md) {
    var lines = String(md).replace(/\r\n?/g, '\n').split('\n');
    var out = [];
    var i = 0;

    function isBlank(l) { return /^\s*$/.test(l); }
    function startsBlock(l) {
      return /^(#{1,4}\s|>\s?|[-*]\s|\d+[.)]\s|:::|---\s*$|!\[[^\]]*\]\([^)]+\)\s*$|<)/.test(l.trim());
    }

    while (i < lines.length) {
      var line = lines[i];
      var t = line.trim();

      if (isBlank(line)) { i++; continue; }

      // ::: bloco imagem + texto
      var box = t.match(/^:::\s*(imagem-direita|imagem-esquerda|imagem-topo)\s+(\S+)\s*(?:\|\s*(.*))?$/);
      if (box) {
        var inner = [];
        i++;
        while (i < lines.length && lines[i].trim() !== ':::') { inner.push(lines[i]); i++; }
        i++; // pula o :::
        var alt = escapeHtml(box[3] || '');
        out.push(
          '<div class="text-image ' + LAYOUTS[box[1]] + '">\n' +
          '  <div class="image"><img src="' + escapeHtml(box[2]) + '" alt="' + alt + '" loading="lazy"></div>\n' +
          '  <div class="text">\n' + render(inner.join('\n')) + '\n  </div>\n</div>');
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
        out.push('<h' + level + '>' + inline(h[2]) + '</h' + level + '>');
        i++;
        continue;
      }

      if (/^---\s*$/.test(t)) { out.push('<hr>'); i++; continue; }

      var img = t.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
      if (img) {
        out.push('<figure class="article-figure"><img src="' + escapeHtml(img[2]) + '" alt="' +
          escapeHtml(img[1]) + '" loading="lazy">' +
          (img[1] ? '<figcaption>' + inline(img[1]) + '</figcaption>' : '') + '</figure>');
        i++;
        continue;
      }

      if (/^>\s?/.test(t)) {
        var quote = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          quote.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        out.push('<blockquote>\n' + render(quote.join('\n')) + '\n</blockquote>');
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
      out.push('<p>' + inline(para.join(' ')) + '</p>');
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

  function slugify(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
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
    var words = String(md).replace(/[#>*_\[\]()!:|-]/g, ' ').split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }

  var api = {
    render: render,
    inline: inline,
    escapeHtml: escapeHtml,
    parseFrontMatter: parseFrontMatter,
    slugify: slugify,
    formatDate: formatDate,
    readingMinutes: readingMinutes
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RosarioMarkdown = api;
})(this);
