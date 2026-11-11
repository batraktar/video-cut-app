import { SEGMENT_MODES } from './editorConstants';

// У реченнях — повні назви каналів, а не короткі чипи «Thermal D/A».
const HUMAN_LABELS = {
  analog: 'Analog',
  digital: 'Digital',
  thermal_analog: 'Thermal Analog',
  thermal_digital: 'Thermal Digital'
};
const modeLabel = id => HUMAN_LABELS[id] || SEGMENT_MODES.find(m => m.id === id)?.label || id;

// Кількість кадрів за класами моделі для запису «перевір тип каналу»:
// спершу структуроване поле labelCounts, а для старих записів — розбір
// текстового журналу, щоб і вони показувались нормальною мовою.
export function mismatchCounts(entry) {
  if (entry?.labelCounts && typeof entry.labelCounts === 'object') {
    const counts = {};
    Object.entries(entry.labelCounts).forEach(([k, v]) => {
      const n = Number(v);
      if (k && Number.isFinite(n) && n > 0) counts[k] = n;
    });
    if (Object.keys(counts).length > 0) return counts;
  }
  const detail = String(entry?.errorDetail || '');
  const m = detail.match(/класи моделі: ([^;]+)/);
  if (!m) return null;
  const counts = {};
  m[1].split(',').forEach(part => {
    const [k, v] = part.split('=').map(s => (s || '').trim());
    const n = Number(v);
    if (k && Number.isFinite(n) && n > 0) counts[k] = n;
  });
  return Object.keys(counts).length > 0 ? counts : null;
}

// Людський опис розбіжності каналів замість сирого технічного журналу.
export function formatMismatchHuman(entry) {
  const counts = mismatchCounts(entry);
  if (!counts) {
    return 'Модель знайшла в цьому відео інші канали, ніж записано в таблиці, тому сегменти не застосовано.';
  }
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [topId, topN] = sorted[0];
  const rest = sorted.slice(1);
  let text = `Модель бачить це відео переважно як ${modeLabel(topId)} — ${topN} зі ${total} кадрів`;
  if (rest.length > 0) {
    text += `; ще є ${rest.map(([k, v]) => `${modeLabel(k)} — ${v}`).join(', ')}`;
  }
  text += '.';
  const expected = Array.isArray(entry?.expectedModes) ? entry.expectedModes : [];
  if (expected.length > 0) {
    text += ` У таблиці натомість стоїть ${expected.map(modeLabel).join(' + ')} — тому сегменти не застосовано, перевір, де правда.`;
  } else {
    text += ' У таблиці записано інший канал — тому сегменти не застосовано, перевір, де правда.';
  }
  return text;
}
