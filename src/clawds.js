// Різні Clawd: колір × емоція. Піксельна модель 16x10, рендер у SVG
// (для вікна з Clawd і налаштувань).
// Обличчя задаються 8 рядками по 12 символів — це внутрішня частина тіла (стовпці 2–13).
// Символи: O — тіло, B — риси обличчя (чорні; на чорному Clawd — білі), W — білий,
// P — рум'янець, R — червоний (серця), M — рот усередині, T — сльоза.
// Руки й ноги малюються окремо, щоб їх анімувати.
(function (root) {
  const ARMS = [[5, [0, 1, 14, 15]], [6, [0, 1, 14, 15]]];
  const LEGS_A = [[8, [3, 5, 10, 12]], [9, [3, 5, 10, 12]]];
  const LEGS_B = [[8, [3, 5, 10, 12]], [9, [3, 10]]];
  const F = 'OOOOOOOOOOOO'; // рядок без рис

  // ---------- Кольори ----------
  // text — колір заголовка в бульбашці (темніший для світлих Clawd), dark — світлі риси обличчя
  const COLORS = {
    classic: { name: 'Класичний', color: '#D97757', text: '#C45E3E' },
    red: { name: 'Червоний', color: '#D9453B', text: '#C2362D' },
    orange: { name: 'Помаранчевий', color: '#F08A24', text: '#C96A0C' },
    yellow: { name: 'Жовтий', color: '#F5C518', text: '#A88000' },
    green: { name: 'Зелений', color: '#4CAF50', text: '#2E8B32' },
    lightblue: { name: 'Блакитний', color: '#4FC3F7', text: '#1A8DC0' },
    blue: { name: 'Синій', color: '#3B6FD9', text: '#2F5DBF' },
    violet: { name: 'Фіолетовий', color: '#8E5BD9', text: '#7444C2' },
    pink: { name: 'Рожевий', color: '#EC8DB5', text: '#CF5A8B' },
    brown: { name: 'Коричневий', color: '#8D5B3C', text: '#7A4B2E' },
    gray: { name: 'Сірий', color: '#9E9E9E', text: '#6B6B6B' },
    white: { name: 'Білий', color: '#F4F1EC', text: '#5C5C5C', outline: true },
    black: { name: 'Чорний', color: '#2B2B2B', text: '#2B2B2B', dark: true },
  };

  // ---------- Емоції ----------
  const EMOTIONS = {
    cool: {
      name: 'В окулярах', greet: ['Йо!', 'Агов!', 'Слухай сюди!'],
      face: [F, F, 'BBBBBBBBBBBB', 'OOBBBOOBBBOO', 'OOBBBOOBBBOO', F, F, F],
    },
    neutral: {
      name: 'Звичайний', greet: ['Привіт!', 'О, ти тут!', 'Нагадую:'],
      face: [F, F, 'OOOBOOOOBOOO', 'OOOBOOOOBOOO', F, F, F, F],
    },
    happy: {
      name: 'Радісний', greet: ['Ура, новина!', 'Гарного дня!', 'Хе-хе!'],
      face: [F, F, 'OOOBOOOOBOOO', 'OOOBOOOOBOOO', F, 'OOBOOOOOOBOO', 'OOOBBBBBBOOO', F],
    },
    laughing: {
      name: 'Сміється', greet: ['Ха-ха-ха!', 'Ой, не можу!', 'Хі-хі, час!'],
      face: [F, F, 'OOOBOOOOBOOO', 'OOBOBOOBOBOO', F, 'OOOBBBBBBOOO', 'OOOBMMMMBOOO', 'OOOOBBBBOOOO'],
    },
    kind: {
      name: 'Добрий', greet: ['Ти все встигнеш 🙂', 'Маленьке нагадування', 'Не поспішай 😊'],
      face: [F, F, 'OOOBOOOOBOOO', 'OOBOBOOBOBOO', 'OPOOOOOOOOPO', 'OOOOBOOBOOOO', 'OOOOOBBOOOOO', F],
    },
    love: {
      name: 'Закоханий', greet: ['Обожнюю нагадувати 💕', 'Для тебе!', 'Ммм, подія!'],
      face: [F, F, 'OROROOOORORO', 'ORRROOOORRRO', 'OOROOOOOOROO', F, 'OOOOOBBOOOOO', F],
    },
    sad: {
      name: 'Сумний', greet: ['Ех… нагадую…', 'Не хотів казати, але…', 'Сумно, але час'],
      face: [F, 'OOOOBOOBOOOO', 'OOOBOOOOBOOO', 'OOOBOOOOBOOO', F, 'OOOOBBBBOOOO', 'OOOBOOOOBOOO', F],
    },
    crying: {
      name: 'Плаче', greet: ['Ти ж не забудеш? 😢', 'Хнік… час!', 'Не пропусти, прошу!'],
      face: [F, 'OOOOBOOBOOOO', 'OOOBOOOOBOOO', 'OOOBOOOOBOOO', 'OOTOOOOOOTOO', 'OOTOBBBBOTOO', 'OOOBOOOOBOOO', F],
    },
    angry: {
      name: 'Злий', greet: ['Ану не спати!', 'Знову забув?!', 'Гей! Час!'],
      face: [F, 'OOBOOOOOOBOO', 'OOOBOOOOBOOO', 'OOOBBOOBBOOO', F, F, 'OOOOBBBBOOOO', F],
    },
    surprised: {
      name: 'Здивований', greet: ['Ого!', 'Ти диви!', 'Вже?!'],
      face: [F, F, 'OOBBOOOOBBOO', 'OOBBOOOOBBOO', F, 'OOOOOBBOOOOO', 'OOOOBOOBOOOO', 'OOOOOBBOOOOO'],
    },
    scared: {
      name: 'Наляканий', greet: ['А-а-а! Час!', 'Ой-ой-ой…', 'Не встигнемо?!'],
      face: [F, 'OOBBOOOOBBOO', 'OOWWOOOOWWOO', 'OOWBOOOOBWOO', F, F, 'OOOBOBOBOBOO', F],
    },
    sleepy: {
      name: 'Сонний', greet: ['Ааа… слухай…', 'Позіх… нагадую…', 'Zzz… ой, час!'],
      face: [F, F, F, 'OOBBOOOOBBOO', F, F, 'OOOOOOBOOOOO', F],
    },
    wink: {
      name: 'Підморгує', greet: ['Ну що, готовий? 😉', 'Між нами…', 'Тсс, нагадую'],
      face: [F, F, 'OOOBOOOOOOOO', 'OOOBOOOBBBOO', F, 'OOOOOOOOOBOO', 'OOOOBBBBBOOO', F],
    },
    thinking: {
      name: 'Задумливий', greet: ['Хм… здається…', 'Дай-но згадаю…', 'Цікаво…'],
      face: [F, 'OOOOOOOBBOOO', 'OOBOOOOBOOOO', F, F, F, 'OOOOOOOBBBOO', F],
    },
  };
  const FIXED = { W: '#FFFFFF', P: '#F4A3B8', R: '#E53950', M: '#B3261E', T: '#5BC0F8' };

  function rects(cells, color) {
    return cells.map(([r, cs]) => cs.map((c) => `<rect x="${c}" y="${r}" width="1" height="1" fill="${color}"/>`).join('')).join('');
  }

  // SVG одного Clawd. cell — розмір пікселя, id — атрибут id для <svg>
  function svg(colorId, emotionId, { cell = 12, id = '' } = {}) {
    const c = COLORS[colorId] || COLORS.classic;
    const e = EMOTIONS[emotionId] || EMOTIONS.cool;
    const feature = c.dark ? '#F4F1EC' : '#000';
    let body = '';
    e.face.forEach((row, r) => [...row].forEach((ch, i) => {
      const fill = ch === 'O' ? c.color : ch === 'B' ? feature : FIXED[ch] || c.color;
      body += `<rect x="${i + 2}" y="${r}" width="1.02" height="1.02" fill="${fill}"/>`;
    }));
    // м'яка тінь-контур, щоб білого Clawd було видно на світлому фоні
    const style = c.outline ? ' style="filter: drop-shadow(0 0 1px rgba(0,0,0,.45)) drop-shadow(0 0 1px rgba(0,0,0,.25))"' : '';
    return `<svg ${id ? `id="${id}"` : ''}${style} width="${16 * cell}" height="${10 * cell}" viewBox="0 0 16 10" shape-rendering="crispEdges">
      <g>${body}</g>
      <g class="arms">${rects(ARMS, c.color)}</g>
      <g class="legsA">${rects(LEGS_A, c.color)}</g>
      <g class="legsB">${rects(LEGS_B, c.color)}</g>
    </svg>`;
  }

  const pick = (obj, id) => {
    const ids = Object.keys(obj);
    return obj[id] ? id : ids[Math.floor(Math.random() * ids.length)];
  };

  root.Clawds = { COLORS, EMOTIONS, svg, pick };
  if (typeof module !== 'undefined') module.exports = root.Clawds;
})(typeof window !== 'undefined' ? window : globalThis);
