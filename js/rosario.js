/* ============================================================
   ROSÁRIO MEDITADO — interações
   - Destaca os mistérios do dia
   - Carrossel com contas do terço (Pai-Nosso + 10 Ave-Marias)
   - Fluxo guiado: orações iniciais → mistérios → orações finais
   ============================================================ */
(function () {
  'use strict';

  var DAY_NAMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
                   'quinta-feira', 'sexta-feira', 'sábado'];
  // Índice = dia da semana (0 = domingo)
  var SET_BY_DAY = ['gloriosos', 'gozosos', 'dolorosos', 'gloriosos',
                    'luminosos', 'dolorosos', 'gozosos'];
  var SET_NAMES = {
    gozosos: 'Mistérios Gozosos',
    dolorosos: 'Mistérios Dolorosos',
    gloriosos: 'Mistérios Gloriosos',
    luminosos: 'Mistérios Luminosos'
  };

  var today = new Date().getDay();
  var todaySet = SET_BY_DAY[today];

  /* ── Tabela de dias (como-rezar-o-terco.html) ── */
  document.querySelectorAll('.days-table tr[data-set]').forEach(function (row) {
    if (row.getAttribute('data-set') === todaySet &&
        row.getAttribute('data-days').split(',').indexOf(String(today)) !== -1) {
      row.classList.add('is-today');
    }
  });

  var todayBox = document.querySelector('.today');
  if (!todayBox) return; // demais páginas param aqui

  /* ── Mistério do dia ── */
  var todayGroup = document.getElementById(todaySet);
  todayBox.querySelector('[data-today-day]').textContent = 'Hoje · ' + DAY_NAMES[today];
  todayBox.querySelector('[data-today-set]').textContent = SET_NAMES[todaySet];
  todayGroup.classList.add('is-today');
  var badge = document.createElement('span');
  badge.className = 'badge-today';
  badge.textContent = 'Hoje';
  todayGroup.querySelector('summary').appendChild(badge);

  function openAndGo(details, instant) {
    details.open = true;
    var parent = details.parentElement.closest('details');
    if (parent) parent.open = true;
    details.querySelector('summary').scrollIntoView({ behavior: instant ? 'instant' : 'smooth', block: 'start' });
  }

  function firstMystery(group) {
    return group.querySelector('.mystery-toggle');
  }

  document.querySelectorAll('[data-go]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var target = btn.getAttribute('data-go');
      if (target === 'today') {
        openAndGo(firstMystery(todayGroup));
      } else {
        openAndGo(document.getElementById(target));
      }
    });
  });

  /* Link direto (ex.: index.html#dolorosos) abre o grupo */
  if (location.hash) {
    var fromHash = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (fromHash && fromHash.tagName === 'DETAILS') {
      fromHash.open = true;
      window.addEventListener('load', function () { openAndGo(fromHash, true); });
    }
  }

  /* "Seguir para os mistérios de hoje" ao fim das orações iniciais */
  var goToday = document.querySelector('[data-go="today"].flow-next-btn');
  if (goToday) goToday.textContent = 'Seguir para os ' + SET_NAMES[todaySet] + ' ❯';

  /* ── Acordeão: um mistério aberto por vez dentro do grupo ── */
  document.querySelectorAll('.mystery-toggle').forEach(function (m) {
    m.addEventListener('toggle', function () {
      if (!m.open) return;
      m.parentElement.querySelectorAll(':scope > .mystery-toggle[open]').forEach(function (other) {
        if (other !== m) other.open = false;
      });
      var carousel = m.querySelector('.carousel');
      if (carousel) carousel.focus({ preventScroll: true });
    });
  });

  /* ── Carrossel com contas ── */
  document.querySelectorAll('.carousel').forEach(function (carousel) {
    var slides = carousel.querySelectorAll('.slide');
    var total = slides.length;
    var current = 0;
    var mystery = carousel.closest('.mystery-toggle');
    var group = carousel.closest('.main-toggle');
    var nextMystery = mystery.nextElementSibling &&
      mystery.nextElementSibling.classList.contains('mystery-toggle') ? mystery.nextElementSibling : null;

    carousel.setAttribute('tabindex', '0');
    carousel.setAttribute('aria-roledescription', 'carrossel');

    var label = document.createElement('p');
    label.className = 'bead-label';
    label.setAttribute('aria-live', 'polite');

    var controls = document.createElement('div');
    controls.className = 'carousel-controls';

    var prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'prev';
    prev.setAttribute('aria-label', 'Conta anterior');
    prev.textContent = '❮';

    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'next';

    var beads = document.createElement('div');
    beads.className = 'beads';
    var beadEls = [];
    for (var i = 0; i < total; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'bead' + (i === 0 ? ' is-our-father' : '');
      b.setAttribute('aria-label', i === 0 ? 'Pai-Nosso' : 'Ave-Maria ' + i);
      b.addEventListener('click', go.bind(null, i));
      beads.appendChild(b);
      beadEls.push(b);
    }

    controls.appendChild(prev);
    controls.appendChild(beads);
    controls.appendChild(next);
    carousel.appendChild(label);
    carousel.appendChild(controls);

    function go(i) {
      current = Math.max(0, Math.min(total - 1, i));
      slides.forEach(function (s, idx) { s.classList.toggle('active', idx === current); });
      beadEls.forEach(function (b, idx) {
        b.classList.toggle('is-current', idx === current);
        b.classList.toggle('is-done', idx < current);
      });
      label.textContent = current === 0
        ? 'Pai-Nosso'
        : 'Ave-Maria ' + current + ' de ' + (total - 1);
      prev.disabled = current === 0;

      var last = current === total - 1;
      next.classList.toggle('is-continue', last);
      if (!last) {
        next.textContent = '❯';
        next.setAttribute('aria-label', 'Próxima conta');
      } else if (nextMystery) {
        next.textContent = 'Próximo mistério ❯';
        next.removeAttribute('aria-label');
      } else {
        next.textContent = 'Orações finais ❯';
        next.removeAttribute('aria-label');
      }
    }

    function forward() {
      if (current < total - 1) return go(current + 1);
      if (nextMystery) {
        openAndGo(nextMystery);
      } else {
        openAndGo(document.getElementById('oracoes-finais'));
      }
    }

    prev.addEventListener('click', function () { go(current - 1); });
    next.addEventListener('click', forward);

    carousel.addEventListener('keydown', function (e) {
      if (e.target !== carousel && !e.target.classList.contains('bead')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); forward(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); go(current - 1); }
    });

    // Deslizar no celular
    var startX = null, startY = null;
    carousel.addEventListener('touchstart', function (e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    carousel.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) { if (current < total - 1) go(current + 1); }
        else go(current - 1);
      }
      startX = null;
    });

    go(0);
  });
})();
