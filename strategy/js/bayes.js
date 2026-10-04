// Общие данные и форматы для страниц про Байеса: штуки (естественные частоты) и шансы.
// Оба способа считают одни и те же примеры, поэтому числа на страницах не могут разойтись.
window.Bayes = (() => {
  const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 10 });

  // Две значащие цифры: 199 → 200, 1 666 666 → 1 700 000, 6,94 → 6,9
  function sig2(x) {
    if (x < 10) return nf.format(Math.round(x * 10) / 10);
    const step = 10 ** (Math.floor(Math.log10(x)) - 1);
    return nf.format(Math.round(x / step) * step);
  }
  const odds = (o) => !isFinite(o) ? '∞ : 1' : o === 0 ? '0 : 1' : o >= 1 ? sig2(o) + ' : 1' : '1 : ' + sig2(1 / o);
  const oddsToPct = (o) => isFinite(o) ? o / (1 + o) * 100 : 100;
  function pct(p) {
    if (p >= 99 && p < 100) return nf.format(Math.floor(p * 10) / 10) + '%';
    if (p >= 10) return Math.round(p) + '%';
    if (p >= 1) return nf.format(Math.round(p * 10) / 10) + '%';
    return nf.format(Number(p.toPrecision(1))) + '%';
  }
  // «в 2 раза», «в 50 раз», «в 1,6 раза»
  function times(x) {
    const s = sig2(x);
    const n = Number(s.replace(/\s/g, '').replace(',', '.'));
    const few = !Number.isInteger(n) || ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100));
    return `в ${s} ${few ? 'раза' : 'раз'}`;
  }
  // Штуки в дереве: целые как есть, дробные с «≈»
  function count(x) {
    const r = Math.round(x);
    if (Math.abs(x - r) < 1e-6) return nf.format(r);
    return '≈ ' + (x >= 10 ? nf.format(r) : nf.format(Math.round(x * 10) / 10));
  }

  // Пример = N случаев до наблюдения, из них nH с гипотезой, и как часто наблюдение в каждой ветке
  const EXAMPLES = {
    spb: { chip: 'Питер: тучи → дождь', unit: 'дней', N: 365, nH: 200, pEH: 198 / 200, pEnH: 137 / 165,
           hName: 'дождь', nhName: 'сухо', eName: 'тучи', neName: 'ясно' },
    cy: { chip: 'Кипр: тучи → дождь', unit: 'дней', N: 365, nH: 45, pEH: 44 / 45, pEnH: 6 / 320,
          hName: 'дождь', nhName: 'сухо', eName: 'тучи', neName: 'ясно' },
    boss: { chip: 'вызов в кабинет → увольнение', unit: 'сотрудников', N: 1000, nH: 10, pEH: 0.8, pEnH: 0.5,
            hName: 'уволят', nhName: 'не уволят', eName: 'позвали', neName: 'не звали',
            e: 'начальник вызвал в кабинет', h: 'меня уволят', notH: 'увольнять не собирались',
            priorNote: 'увольняют одного из сотни', lrNote: 'перед увольнением так зовут в 80% случаев, а просто так в 50%',
            resExtra: 'как и в статье про спокойствие' },
    fire: { chip: 'дым → пожар', unit: 'дней', N: 200, nH: 1, pEH: 1, pEnH: 1 / 50,
            hName: 'пожар', nhName: 'без пожара', eName: 'дым', neName: 'нет дыма',
            e: 'дым', h: 'это пожар', notH: 'пожара не было',
            priorNote: 'пожары нечасты, раз в полгода', lrNote: 'без пожара дымит лишь один дом из полста' },
    allin: { chip: 'олл-ин → блеф', unit: 'раздач', N: 1000, nH: 750, pEH: 0.02, pEnH: 0.2,
             hName: 'мусор', nhName: 'сильная рука', eName: 'олл-ин', neName: 'без олл-ина',
             e: 'соперник пошёл олл-ин', h: 'у него мусор и он блефует', notH: 'у него была сильная рука',
             priorNote: 'в раздачах мусор приходит чаще сильных рук', lrNote: 'с мусором обычно сбрасывают, а с сильной рукой охотно идут олл-ин',
             resExtra: 'олл-ин снизил шанс блефа с 75%' },
    sms: { chip: 'СМС «вы выиграли миллиард» → развод', unit: 'СМС', N: 1e6, nH: 1e5, pEH: 0.01, pEnH: 1e-6,
           hName: 'развод', nhName: 'честные', eName: 'про миллиард', neName: 'другие',
           e: 'СМС «вы выиграли миллиард»', h: 'это развод', notH: 'выигрыш был честным',
           priorNote: 'среди всех СМС мошеннических немного', lrNote: 'о честных выигрышах так не сообщают' },
    metro: { chip: 'подозрительный тип в метро → террорист', unit: 'пассажиров', N: 1e7, nH: 10, pEH: 0.5, pEnH: 0.05,
             hName: 'террорист', nhName: 'обычный', eName: 'подозрительный', neName: 'обычный на вид',
             e: 'подозрительный тип в метро', h: 'он террорист', notH: 'он был обычным пассажиром',
             priorNote: 'террористов исчезающе мало', lrNote: 'странно выглядит куча обычных людей' },
    plane: { chip: 'самолёт трясёт → катастрофа', unit: 'рейсов', N: 5e7, nH: 10, pEH: 0.9, pEnH: 0.3,
             hName: 'катастрофа', nhName: 'обычный рейс', eName: 'трясло', neName: 'не трясло',
             e: 'самолёт потряхивает', h: 'самолёт разобьётся', notH: 'рейсу ничего не грозило',
             priorNote: 'катастрофы реже одной на миллионы рейсов', lrNote: 'трясёт почти в каждом полёте' },
    reply: { chip: 'не ответила → обиделась', unit: 'переписок', N: 1100, nH: 100, pEH: 0.6, pEnH: 0.3,
             hName: 'обиделась', nhName: 'всё в порядке', eName: 'не ответила', neName: 'ответила',
             e: 'она не ответила на сообщение', h: 'она обиделась', notH: 'всё было в порядке',
             priorNote: 'обижаются нечасто', lrNote: 'люди и так часто отвечают не сразу' },
    whistle: { chip: 'свистит в доме → денег не будет', unit: 'дней', N: 600, nH: 100, pEH: 0.3, pEnH: 0.3,
               hName: 'без денег', nhName: 'при деньгах', eName: 'свистел', neName: 'не свистел',
               e: 'он свистит в доме', h: 'денег не будет', notH: 'с деньгами всё было бы в порядке',
               priorNote: 'безденежье бывает', lrNote: 'свистят одинаково и при деньгах, и без',
               resExtra: 'как и без свиста' },
    cat: { chip: 'кошка умывается → гости придут', unit: 'дней', N: 800, nH: 100, pEH: 0.9, pEnH: 0.9,
           hName: 'гости', nhName: 'без гостей', eName: 'умывалась', neName: 'не умывалась',
           e: 'кошка умывается', h: 'придут гости', notH: 'гостей не ждали',
           priorNote: 'гости раз в неделю', lrNote: 'кошка умывается каждый день',
           resExtra: 'как и без кошки' },
  };

  function solve(ex) {
    const nNH = ex.N - ex.nH;
    const eH = ex.nH * ex.pEH, eNH = nNH * ex.pEnH;
    return { nNH, eH, eNH, prior: ex.nH / nNH, lr: ex.pEH / ex.pEnH, post: eH / eNH };
  }

  // Кнопки-переключатели примеров над любым блоком
  function chips(box, keys, onPick) {
    const buttons = keys.map((key) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = EXAMPLES[key].chip;
      b.addEventListener('click', () => pick(key));
      box.appendChild(b);
      return b;
    });
    function pick(key) {
      buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(keys[i] === key)));
      onPick(EXAMPLES[key]);
    }
    return pick;
  }

  return { sig2, odds, oddsToPct, pct, times, count, EXAMPLES, solve, chips };
})();
