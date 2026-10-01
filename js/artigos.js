/* ============================================================
   ROSÁRIO MEDITADO — página de artigos e compartilhamento
   ============================================================ */
(function () {
  'use strict';

  /* ── Compartilhar (páginas de artigo) ── */
  document.querySelectorAll('[data-share="copy"]').forEach(function (btn) {
    var url = btn.getAttribute('data-url');
    if (navigator.share) {
      btn.textContent = 'Compartilhar';
      btn.addEventListener('click', function () {
        navigator.share({ title: document.title, url: url }).catch(function () {});
      });
      return;
    }
    btn.addEventListener('click', function () {
      navigator.clipboard.writeText(url).then(function () {
        btn.textContent = 'Link copiado ✓';
        setTimeout(function () { btn.textContent = 'Copiar link'; }, 2000);
      });
    });
  });

  /* ── Listagem com filtros ── */
  var grid = document.getElementById('lista-artigos');
  if (!grid) return;

  var PAGE_SIZE = 9;
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.article-card'));
  var chips = document.querySelectorAll('.chip');
  var search = document.getElementById('busca');
  var sort = document.getElementById('ordem');
  var count = document.querySelector('.results-count');
  var empty = document.querySelector('.empty-state');
  var more = document.querySelector('.load-more');

  function normalize(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  var params = new URLSearchParams(location.search);
  var state = {
    category: params.get('categoria') || '',
    query: params.get('busca') || '',
    order: params.get('ordem') || 'recentes',
    limit: PAGE_SIZE
  };
  if (!document.querySelector('.chip[data-filter="' + state.category + '"]')) state.category = '';
  search.value = state.query;
  sort.value = state.order;

  var byOrder = {
    recentes: function (a, b) { return (b.dataset.date || '0').localeCompare(a.dataset.date || '0'); },
    antigos:  function (a, b) { return (a.dataset.date || '9').localeCompare(b.dataset.date || '9'); },
    az: function (a, b) {
      return a.querySelector('h2').textContent.localeCompare(b.querySelector('h2').textContent, 'pt-BR');
    }
  };

  function syncUrl() {
    var p = new URLSearchParams();
    if (state.category) p.set('categoria', state.category);
    if (state.query) p.set('busca', state.query);
    if (state.order !== 'recentes') p.set('ordem', state.order);
    var qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
  }

  function render() {
    var q = normalize(state.query);
    var words = q ? q.split(/\s+/) : [];

    var matches = cards.filter(function (c) {
      if (state.category && c.dataset.category !== state.category) return false;
      return words.every(function (w) { return c.dataset.search.indexOf(w) !== -1; });
    }).sort(byOrder[state.order] || byOrder.recentes);

    // reordena no DOM
    matches.forEach(function (c) { grid.appendChild(c); });
    cards.forEach(function (c) { c.hidden = true; c.classList.remove('is-featured'); });
    matches.slice(0, state.limit).forEach(function (c) { c.hidden = false; });

    // destaque: o mais recente, quando nada está filtrado
    if (!state.category && !q && state.order === 'recentes' && matches.length > 2) {
      matches[0].classList.add('is-featured');
    }

    chips.forEach(function (chip) {
      chip.setAttribute('aria-pressed', String(chip.dataset.filter === state.category));
    });

    count.textContent = matches.length === 1 ? '1 artigo' : matches.length + ' artigos';
    empty.hidden = matches.length > 0;
    more.hidden = matches.length <= state.limit;
    syncUrl();
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      state.category = chip.dataset.filter;
      state.limit = PAGE_SIZE;
      render();
    });
  });

  var timer;
  search.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      state.query = search.value;
      state.limit = PAGE_SIZE;
      render();
    }, 150);
  });

  sort.addEventListener('change', function () {
    state.order = sort.value;
    render();
  });

  more.querySelector('button').addEventListener('click', function () {
    state.limit += PAGE_SIZE;
    render();
  });

  empty.querySelector('[data-clear]').addEventListener('click', function () {
    state.category = '';
    state.query = '';
    search.value = '';
    render();
    search.focus();
  });

  render();
})();
