// Avatar pixel-art 32x32 vẽ bằng SVG, đổi biểu cảm theo emotion: calm | nervous | angry | pleading.

const DARK = '#1a1a1a';
const WHITE = '#ffffff';
const TEAR = '#7fdcff';

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt));
  return '#' + [c(n >> 16), c((n >> 8) & 255), c(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

const HEAD_ROWS = { 6: [11, 21], 7: [10, 22], 21: [10, 22], 22: [11, 21] };
for (let y = 8; y <= 20; y++) HEAD_ROWS[y] = [9, 23];

export function renderAvatar(spec, emotion = 'calm', { size, className = '' } = {}) {
  const out = [];
  const r = (x, y, w, h, c) => out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`);
  const row = (y, x0, x1, c) => r(x0, y, x1 - x0 + 1, 1, c);

  const skin = spec.skin || '#e0ac69';
  const skinD = shade(skin, -28);
  const hc = spec.hairColor || '#1b1b1b';
  const cloth = spec.clothes || '#2c3e50';
  const acc = spec.acc || [];
  const hair = spec.hair || 'short';

  // Mũ trùm (vẽ phía sau đầu)
  if (hair === 'hood') {
    for (let y = 3; y <= 25; y++) row(y, y < 6 ? 10 - (y - 3) : 6, y < 6 ? 22 + (y - 3) : 26, cloth === '#111111' ? '#333' : shade(cloth, -20));
  }
  if (hair === 'long') {
    r(7, 8, 3, 16, hc);
    r(23, 8, 3, 16, hc);
  }

  // Thân & cổ
  row(25, 6, 26, cloth);
  for (let y = 26; y <= 31; y++) row(y, 3, 29, cloth);
  r(13, 22, 7, 4, skinD);
  r(15, 25, 3, 1, skinD);
  r(16, 26, 1, 1, skinD);
  r(4, 28, 1, 4, shade(cloth, -25));
  r(28, 28, 1, 4, shade(cloth, -25));

  // Đầu & tai
  for (const [y, [a, b]] of Object.entries(HEAD_ROWS)) row(+y, a, b, skin);
  r(8, 13, 1, 4, skin);
  r(24, 13, 1, 4, skin);
  r(8, 14, 1, 2, skinD);
  r(24, 14, 1, 2, skinD);

  // Tóc
  const shortTop = () => {
    row(4, 11, 21, hc);
    row(5, 10, 22, hc);
    row(6, 9, 23, hc);
    row(7, 9, 23, hc);
    r(9, 8, 2, 4, hc);
    r(22, 8, 2, 4, hc);
  };
  switch (hair) {
    case 'short':
      shortTop();
      row(8, 11, 15, hc);
      break;
    case 'long':
      shortTop();
      row(8, 11, 21, hc);
      break;
    case 'bob':
      shortTop();
      row(8, 10, 22, hc);
      r(8, 8, 2, 11, hc);
      r(23, 8, 2, 11, hc);
      break;
    case 'bun':
      shortTop();
      r(13, 1, 7, 3, hc);
      r(14, 0, 5, 1, hc);
      break;
    case 'bald':
      r(9, 11, 1, 3, hc);
      r(23, 11, 1, 3, hc);
      r(13, 7, 3, 1, shade(skin, 25));
      break;
    case 'shaved':
      row(6, 11, 21, skinD);
      row(7, 10, 22, skinD);
      r(9, 8, 1, 4, skinD);
      r(23, 8, 1, 4, skinD);
      break;
    case 'mohawk':
      r(14, 0, 5, 8, hc);
      r(15, 8, 3, 1, hc);
      row(7, 10, 13, skinD);
      row(7, 19, 22, skinD);
      break;
    case 'cap': {
      const hat = spec.hatColor || shade(cloth, 30);
      row(3, 12, 20, hat);
      for (let y = 4; y <= 7; y++) row(y, y === 4 ? 10 : 9, y === 4 ? 22 : 23, hat);
      row(8, 9, 23, shade(hat, -35));
      r(9, 9, 1, 2, hc);
      r(23, 9, 1, 2, hc);
      break;
    }
    case 'hood':
      row(4, 10, 22, shade(cloth, -10));
      row(5, 9, 23, shade(cloth, -10));
      r(9, 6, 1, 4, shade(cloth, -10));
      r(23, 6, 1, 4, shade(cloth, -10));
      row(6, 11, 21, hc);
      break;
  }

  // Râu (vẽ trước miệng)
  if (acc.includes('beard')) {
    r(9, 17, 3, 4, hc);
    r(21, 17, 3, 4, hc);
    row(21, 10, 22, hc);
    row(22, 11, 21, hc);
    row(23, 12, 20, hc);
    row(18, 13, 19, hc);
  }

  // Mũi
  r(16, 15, 1, 2, skinD);
  r(15, 17, 3, 1, skinD);

  // Biểu cảm
  const mouthC = '#7a3b2e';
  if (emotion === 'nervous') {
    r(12, 13, 2, 2, WHITE); r(19, 13, 2, 2, WHITE);
    r(13, 13, 1, 2, DARK); r(20, 13, 1, 2, DARK);
    r(11, 11, 2, 1, hc); r(13, 10, 1, 1, hc);
    r(19, 10, 1, 1, hc); r(20, 11, 2, 1, hc);
    r(14, 19, 1, 1, mouthC); r(15, 20, 1, 1, mouthC); r(16, 19, 1, 1, mouthC); r(17, 20, 1, 1, mouthC); r(18, 19, 1, 1, mouthC);
    r(25, 9, 1, 2, TEAR); r(25, 11, 1, 1, '#c8f3ff');
    r(10, 9, 1, 2, TEAR);
    r(6, 12, 1, 2, TEAR);
  } else if (emotion === 'angry') {
    r(12, 14, 2, 1, DARK); r(19, 14, 2, 1, DARK);
    r(11, 11, 2, 1, hc); r(13, 12, 1, 1, hc);
    r(19, 12, 1, 1, hc); r(20, 11, 2, 1, hc);
    r(13, 19, 7, 2, '#4a1414'); r(14, 19, 5, 1, WHITE);
    r(10, 16, 2, 1, 'rgba(220,40,40,.55)'); r(21, 16, 2, 1, 'rgba(220,40,40,.55)');
    r(20, 8, 1, 1, '#d63031'); r(22, 8, 1, 1, '#d63031'); r(21, 9, 1, 1, '#d63031');
  } else if (emotion === 'pleading') {
    r(12, 12, 2, 3, DARK); r(19, 12, 2, 3, DARK);
    r(12, 12, 1, 1, WHITE); r(19, 12, 1, 1, WHITE);
    r(11, 11, 1, 1, hc); r(12, 10, 1, 1, hc); r(13, 9, 1, 1, hc);
    r(19, 9, 1, 1, hc); r(20, 10, 1, 1, hc); r(21, 11, 1, 1, hc);
    r(12, 15, 1, 3, TEAR); r(20, 15, 1, 3, TEAR);
    r(14, 19, 5, 1, mouthC); r(13, 20, 1, 1, mouthC); r(19, 20, 1, 1, mouthC);
  } else {
    r(12, 13, 2, 2, DARK); r(19, 13, 2, 2, DARK);
    r(12, 13, 1, 1, '#555'); r(19, 13, 1, 1, '#555');
    r(11, 11, 3, 1, hc); r(19, 11, 3, 1, hc);
    r(14, 19, 5, 1, mouthC); r(13, 18, 1, 1, mouthC); r(19, 18, 1, 1, mouthC);
  }

  // Phụ kiện
  if (acc.includes('mustache')) row(18, 13, 19, hc);
  if (acc.includes('glasses')) {
    const g = '#222';
    for (const x of [11, 18]) {
      r(x, 12, 4, 1, g); r(x, 15, 4, 1, g); r(x, 12, 1, 4, g); r(x + 3, 12, 1, 4, g);
    }
    r(15, 13, 3, 1, g);
    r(9, 13, 2, 1, g); r(22, 13, 2, 1, g);
  }
  if (acc.includes('implant')) { r(22, 11, 1, 5, '#00e5ff'); r(21, 13, 1, 1, '#00e5ff'); r(23, 12, 1, 1, '#ff2bd6'); }
  if (acc.includes('scar')) { r(19, 16, 1, 1, '#9b4a3a'); r(20, 17, 1, 1, '#9b4a3a'); r(21, 18, 1, 1, '#9b4a3a'); r(18, 15, 1, 1, '#9b4a3a'); }
  if (acc.includes('earring')) { r(8, 17, 1, 1, '#ffd700'); r(24, 17, 1, 1, '#ffd700'); }

  const dim = size ? ` width="${size}" height="${size}"` : '';
  return `<svg class="${className}" viewBox="0 0 32 32"${dim} shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${out.join('')}</svg>`;
}
