/* ─────────────────────────────────────────────────────────────────────────────
   «Хочу игру под свой трек» — ОБЩИЙ модуль экрана заказа для всех игр и
   страниц lamopad.ru. Все тексты и контакты живут в одном месте — LAMOPAD_ORDER
   ниже. Правишь здесь — меняется на всём сайте сразу.

   Подключение (обычный <script>, без сборки; путь относительный от страницы):
     <script src="../../lib/order-widget.js"></script>

   Два способа использовать:

   1) Готовый оверлей — полноэкранный экран заказа, темизируется под игру:
        LamopadOrder.open({          // все поля необязательны
          bg:        '#0b0b10',      // фон оверлея (любой CSS background)
          ink:       '#fff',         // основной текст
          accent:    '#ee3333',      // акцент: заголовок, ссылка на github, хаверы
          mailColor: '#ffcf3f',      // цвет пилюли почты
          tgColor:   '#6ec9ff',      // цвет пилюли телеграма
          titleFont: "'Arial Black',Arial,sans-serif",
          bodyFont:  'Arial,sans-serif',
          emoji:     '🎮',           // анимированный символ сверху
          radius:    '14px',         // скругление пилюль
          gamesUrl:  '/games/',      // путь до раздела игр (можно относительный)
          zIndex:    10050,
        });
        LamopadOrder.close();        // закрыть (также: «← назад», Esc, клик мимо)

   2) Своя разметка (как в игре про очки) — модуль заполняет её текстами:
        LamopadOrder.fill({          // любые поля можно опустить
          openBtn: el,               // кнопка «🎮 ХОЧУ ИГРУ ПОД СВОЙ ТРЕК»
          title:   el,               // заголовок «Игра под ваш трек»
          text:    el,               // абзац описания (innerHTML)
          mail:    el,               // <a> почты — подставится href и текст
          tg:      el,               // <a> телеграма — подставится href и текст
          games:   el,               // ссылка «а какие ещё игры у тебя есть?»
        }, { ghClass: 'order-gh' }); // класс для ссылки на github внутри текста
        LamopadOrder.bindMailCopy(mailEl); // клик по почте копирует адрес

   В тексте описания маркер %GH%слово%/GH% превращается в ссылку на GitHub.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

// ─── ЕДИНЫЙ ИСТОЧНИК ТЕКСТОВ И КОНТАКТОВ ─────────────────────────────────────
window.LAMOPAD_ORDER = {
  btnLabel:    '🎮 ХОЧУ ИГРУ ПОД СВОЙ ТРЕК',
  title:       'Игра под ваш трек',
  // в тексте есть неразрывные пробелы: «7+ лет», «С помощью», «демо —»
  text:        'Я в коммерческой %GH%разработке%/GH% 7+ лет. Закончил ИТМО. ' +
               'С помощью нейронок и своих знаний сделаю игру для вашего трека ' +
               'всего за несколько дней. Разгон идеи и демо — бесплатно.',
  github:      'https://github.com/ArtOshchepkov',
  email:       'tim.oshchepkov@gmail.com',
  copiedLabel: '✓ адрес скопирован!',
  telegram:    'https://t.me/art_oshk',
  tgLabel:     '✈️ Телеграм · @art_oshk',
  gamesLabel:  'а какие ещё игры у тебя есть?',
  gamesUrl:    '/games/',
  backLabel:   '← назад',
};

window.LamopadOrder = (function () {
  const C = window.LAMOPAD_ORDER;
  const mailLabel = () => '✉️ ' + C.email;

  // %GH%…%/GH% → ссылка на github
  function textHtml(ghClass) {
    return C.text
      .replace('%GH%', '<a class="' + (ghClass || '') + '" target="_blank" rel="noopener" href="' + C.github + '">')
      .replace('%/GH%', '</a>');
  }

  // Клик по почте копирует адрес с уведомлением; без clipboard API — mailto
  function bindMailCopy(el) {
    el.addEventListener('click', (e) => {
      if (!navigator.clipboard) return; // сработает href=mailto
      e.preventDefault();
      navigator.clipboard.writeText(C.email).then(() => {
        el.textContent = C.copiedLabel;
        clearTimeout(el._lmpT);
        el._lmpT = setTimeout(() => { el.textContent = mailLabel(); }, 1600);
      }).catch(() => { window.location.href = 'mailto:' + C.email; });
    });
  }

  // Заполнить СВОЮ разметку экрана заказа текстами из конфига
  function fill(els, opts) {
    if (els.openBtn) els.openBtn.textContent = C.btnLabel;
    if (els.title)   els.title.textContent   = C.title;
    if (els.text)    els.text.innerHTML      = textHtml(opts && opts.ghClass);
    if (els.mail) { els.mail.href = 'mailto:' + C.email; els.mail.textContent = mailLabel(); }
    if (els.tg)   { els.tg.href = C.telegram; els.tg.textContent = C.tgLabel; }
    if (els.games)   els.games.textContent   = C.gamesLabel;
  }

  // ─── Готовый оверлей ────────────────────────────────────────────────────────
  const CSS =
    '.lmp-order{position:fixed;inset:0;display:flex;overflow-y:auto;padding:24px;' +
      'text-align:center;background:var(--lmp-bg);color:var(--lmp-ink);' +
      'font-family:var(--lmp-body);opacity:1;transition:opacity .3s ease}' +
    '.lmp-order.lmp-hidden{opacity:0;pointer-events:none}' +
    // margin:auto — центр, когда влезает, и скролл, когда нет (низкие экраны)
    '.lmp-order-inner{display:flex;flex-direction:column;align-items:center;gap:14px;' +
      'width:100%;max-width:360px;margin:auto}' +
    '.lmp-order-emoji{font-size:clamp(36px,10vmin,56px);' +
      'animation:lmp-hop .7s cubic-bezier(.36,0,.64,1) infinite alternate}' +
    '@keyframes lmp-hop{from{transform:translateY(0)}to{transform:translateY(-10px)}}' +
    '.lmp-order-title{font-family:var(--lmp-title);font-weight:900;' +
      'font-size:clamp(17px,5vmin,23px);line-height:1.45;margin:0 0 8px}' +
    '.lmp-order-text{font-size:15.5px;line-height:1.65;opacity:.92;margin:0 0 8px}' +
    '.lmp-order-gh{color:var(--lmp-accent);text-decoration:underline;text-underline-offset:3px}' +
    '.lmp-order-gh:hover{text-shadow:0 0 12px var(--lmp-accent)}' +
    '.lmp-order-links{display:flex;flex-direction:column;gap:12px;width:100%}' +
    '.lmp-order-pill{--c:var(--lmp-ink);display:block;font-weight:700;font-size:15.5px;' +
      'color:var(--c);background:transparent;border:1.5px solid var(--c);' +
      'border-radius:var(--lmp-radius);padding:16px;text-decoration:none;' +
      'transition:transform .18s,box-shadow .25s}' +
    '.lmp-order-pill:hover{transform:translateY(-3px) scale(1.02);box-shadow:0 0 22px var(--c)}' +
    '.lmp-order-pill:active{transform:translateY(1px) scale(.98)}' +
    '.lmp-order-mail{--c:var(--lmp-mail)}.lmp-order-tg{--c:var(--lmp-tg)}' +
    '.lmp-order-games{font-size:13.5px;color:var(--lmp-ink);opacity:.55;' +
      'text-decoration:underline dotted;text-underline-offset:3px;transition:opacity .2s,color .2s}' +
    '.lmp-order-games:hover{opacity:1;color:var(--lmp-accent)}' +
    '.lmp-order-close{font-family:var(--lmp-body);font-weight:700;font-size:14px;' +
      'color:var(--lmp-ink);opacity:.7;background:none;border:1px solid currentColor;' +
      'border-radius:20px;padding:9px 22px;margin-top:6px;cursor:pointer;transition:opacity .2s}' +
    '.lmp-order-close:hover{opacity:1}' +
    // низкие экраны (телефон лёжа) — компактнее
    '@media (max-height:480px){.lmp-order{padding:12px}' +
      '.lmp-order-inner{gap:8px}.lmp-order-emoji{font-size:28px}' +
      '.lmp-order-pill{padding:9px}.lmp-order-text{font-size:13.5px;line-height:1.45}}';

  let overlay = null;

  function build() {
    document.head.insertAdjacentHTML('beforeend', '<style>' + CSS + '</style>');
    overlay = document.createElement('div');
    overlay.className = 'lmp-order lmp-hidden';
    overlay.innerHTML =
      '<div class="lmp-order-inner">' +
        '<div class="lmp-order-emoji"></div>' +
        '<p class="lmp-order-title">' + C.title + '</p>' +
        '<p class="lmp-order-text">' + textHtml('lmp-order-gh') + '</p>' +
        '<div class="lmp-order-links">' +
          '<a class="lmp-order-pill lmp-order-mail" href="mailto:' + C.email + '">' + mailLabel() + '</a>' +
          '<a class="lmp-order-pill lmp-order-tg" target="_blank" rel="noopener" href="' + C.telegram + '">' + C.tgLabel + '</a>' +
        '</div>' +
        '<a class="lmp-order-games" href="' + C.gamesUrl + '">' + C.gamesLabel + '</a>' +
        '<button class="lmp-order-close" type="button">' + C.backLabel + '</button>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('.lmp-order-close').addEventListener('click', close);
    overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(); });
    bindMailCopy(overlay.querySelector('.lmp-order-mail'));
  }

  function onKey(e) { if (e.key === 'Escape') close(); }

  function open(theme) {
    const t = Object.assign({
      bg: '#0b0b10', ink: '#fff', accent: '#ee3333',
      mailColor: '#ffcf3f', tgColor: '#6ec9ff',
      titleFont: "'Arial Black',Arial,sans-serif",
      bodyFont: 'Arial,sans-serif',
      emoji: '🎮', radius: '14px', gamesUrl: C.gamesUrl, zIndex: 10050,
    }, theme);
    if (!overlay) build();
    overlay.style.cssText =
      '--lmp-bg:' + t.bg + ';--lmp-ink:' + t.ink + ';--lmp-accent:' + t.accent +
      ';--lmp-mail:' + t.mailColor + ';--lmp-tg:' + t.tgColor +
      ';--lmp-title:' + t.titleFont + ';--lmp-body:' + t.bodyFont +
      ';--lmp-radius:' + t.radius + ';z-index:' + t.zIndex;
    overlay.querySelector('.lmp-order-emoji').textContent = t.emoji;
    overlay.querySelector('.lmp-order-games').href = t.gamesUrl;
    overlay.classList.remove('lmp-hidden');
    document.addEventListener('keydown', onKey);
  }

  function close() {
    if (!overlay) return;
    overlay.classList.add('lmp-hidden');
    document.removeEventListener('keydown', onKey);
  }

  return { open, close, fill, bindMailCopy, textHtml };
})();
