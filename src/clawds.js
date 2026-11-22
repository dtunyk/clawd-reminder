// Різні Clawd: піксельні моделі 16x10 і рендер у SVG (для вікна з Clawd і налаштувань).
// Символи: O — тіло, B — чорний, P — рум'янець, W — білий, . — порожньо.
// Рядки 0–7 — тіло (руки й ноги малюються окремо, щоб їх анімувати).
(function (root) {
  const ARMS = [[5, [0, 1, 14, 15]], [6, [0, 1, 14, 15]]];
  const LEGS_A = [[8, [3, 5, 10, 12]], [9, [3, 5, 10, 12]]];
  const LEGS_B = [[8, [3, 5, 10, 12]], [9, [3, 10]]];
  const TOP = '..OOOOOOOOOOOO..';

  const VARIANTS = {
    classic: {
      name: 'Класичний', color: '#D97757',
      greet: ['Йо!', 'Агов!', 'Слухай сюди!'],
      body: [TOP, TOP,
        '..BBBBBBBBBBBB..',
        '..OOBBBOOBBBOO..',
        '..OOBBBOOBBBOO..',
        TOP, TOP, TOP],
    },
    bare: {
      name: 'Без окулярів', color: '#D97757',
      greet: ['Привіт!', 'О, ти тут!', 'Дивись!'],
      body: [TOP, TOP,
        '..OOOBOOOOBOOO..',
        '..OOOBOOOOBOOO..',
        TOP, TOP, TOP, TOP],
    },
    pink: {
      name: 'Рожевий', color: '#E889B0',
      greet: ['Хей-хей! 💖', 'Сюрприз!', 'Ку-ку!'],
      body: [TOP, TOP,
        '..BBBBBBBBBBBB..',
        '..OOBBBOOBBBOO..',
        '..OOBBBOOBBBOO..',
        TOP, TOP, TOP],
    },
    angry: {
      name: 'Злий', color: '#C9483E',
      greet: ['Ану не спати!', 'Знову забув?!', 'Гей! Час!'],
      body: [TOP,
        '..OOBOOOOOOBOO..',
        '..OOOBOOOOBOOO..',
        '..OOOBBOOBBOOO..',
        TOP, TOP,
        '..OOOOBBBBOOOO..',
        TOP],
    },
    kind: {
      name: 'Добрий', color: '#E0915F',
      greet: ['Ти все встигнеш 🙂', 'Маленьке нагадування', 'Не поспішай 😊'],
      body: [TOP, TOP,
        '..OOOBOOOOBOOO..',
        '..OOBOBOOBOBOO..',
        '..OPOOOOOOOOPO..',
        '..OOOOBOOBOOOO..',
        '..OOOOOBBOOOOO..',
        TOP],
    },
    sleepy: {
      name: 'Сонний', color: '#C98A6B',
      greet: ['Ааа… слухай…', 'Позіх… нагадую…', 'Zzz… ой, час!'],
      body: [TOP, TOP, TOP,
        '..OOBBOOOOBBOO..',
        TOP, TOP,
        '..OOOOOOBOOOOO..',
        TOP],
    },
  };

  const PALETTE = { B: '#000', P: '#F4A3B8', W: '#fff' };

  function rects(cells, color) {
    return cells.map(([r, cs]) => cs.map((c) => `<rect x="${c}" y="${r}" width="1" height="1" fill="${color}"/>`).join('')).join('');
  }

  // SVG одного Clawd; cell — розмір пікселя, id — атрибут id для <svg>
  function svg(variantId, { cell = 12, id = '' } = {}) {
    const v = VARIANTS[variantId] || VARIANTS.classic;
    let body = '';
    v.body.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === '.') return;
      const fill = ch === 'O' ? v.color : PALETTE[ch];
      body += `<rect x="${c}" y="${r}" width="1.02" height="1.02" fill="${fill}"/>`;
    }));
    return `<svg ${id ? `id="${id}"` : ''} width="${16 * cell}" height="${10 * cell}" viewBox="0 0 16 10" shape-rendering="crispEdges">
      ${body}
      <g class="arms">${rects(ARMS, v.color)}</g>
      <g class="legsA">${rects(LEGS_A, v.color)}</g>
      <g class="legsB">${rects(LEGS_B, v.color)}</g>
    </svg>`;
  }

  root.Clawds = { VARIANTS, svg, ids: Object.keys(VARIANTS) };
  if (typeof module !== 'undefined') module.exports = root.Clawds;
})(typeof window !== 'undefined' ? window : globalThis);
