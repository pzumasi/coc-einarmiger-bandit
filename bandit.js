// Einarmiger Bandit, 1925 — reine Spiellogik (ohne DOM), in Browser und Node nutzbar.
// Balance: Münzen sind Flair. Finanzkraft (FK) bewegt sich nur beim „Großen Einsatz“,
// und nur über zwei seltene Ereignisse, die den Besuch sofort beenden:
//   drei Glocken  → Jackpot     → +1 FK
//   drei Zitronen → Pechsträhne → −1 FK
// Pro Besuch höchstens ±1. Leichter Hausvorteil (Pechsträhne etwas häufiger als Jackpot).

export const SYMBOLS = {
  kirsche: { glyph: '🍒', name: 'Kirsche' },
  zitrone: { glyph: '🍋', name: 'Zitrone' },
  orange: { glyph: '🍊', name: 'Orange' },
  traube: { glyph: '🍇', name: 'Traube' },
  bar: { glyph: 'BAR', name: 'Bar' },
  glocke: { glyph: '🔔', name: 'Glocke' },
};

// Walzen mit je 20 Stopps wie bei den Mills-Automaten; jede Walze anders bestückt.
const strip = (counts) => Object.entries(counts).flatMap(([s, n]) => Array(n).fill(s));
export const REELS = [
  strip({ kirsche: 4, zitrone: 3, orange: 4, traube: 3, bar: 3, glocke: 3 }),
  strip({ kirsche: 4, zitrone: 3, orange: 4, traube: 4, bar: 2, glocke: 3 }),
  strip({ kirsche: 3, zitrone: 3, orange: 5, traube: 4, bar: 3, glocke: 2 }),
];

export const MODES = {
  klein: { label: 'Kleingeld', coin: 0.05, coinName: 'Nickel', fk: false,
    blurb: '5-Cent-Automat an der Theke. Reiner Zeitvertreib — Finanzkraft bleibt unberührt.' },
  gross: { label: 'Großer Einsatz', coin: 1, coinName: 'Silberdollar', fk: true,
    blurb: 'Dollar-Automat im Hinterzimmer. Zwanzig Dollar sind ein Wochenlohn: Jackpot +1 Finanzkraft, Pechsträhne −1.' },
};

export const BAG = 20; // Münzen pro Besuch

// Auszahlung in Münzen je eingeworfener Münze.
export function evaluate([a, b, c]) {
  if (a === 'glocke' && b === 'glocke' && c === 'glocke') return { pay: 50, event: 'jackpot', text: 'Drei Glocken — JACKPOT!' };
  if (a === 'zitrone' && b === 'zitrone' && c === 'zitrone') return { pay: 0, event: 'pech', text: 'Drei Zitronen.' };
  if (a === 'bar' && b === 'bar' && c === 'bar') return { pay: 20, text: 'Drei Bars.' };
  if (a === 'traube' && b === 'traube' && c === 'traube') return { pay: 14, text: 'Drei Trauben.' };
  if (a === 'orange' && b === 'orange' && c === 'orange') return { pay: 10, text: 'Drei Orangen.' };
  if (a === 'kirsche' && b === 'kirsche') return { pay: 5, text: 'Zwei Kirschen.' };
  if (a === 'kirsche') return { pay: 2, text: 'Eine Kirsche.' };
  return { pay: 0, text: '' };
}

// mulberry32 — kleiner, deterministischer PRNG; der Seed macht jeden Besuch nachprüfbar.
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newVisit(name, mode, seed) {
  return { name, mode, seed: seed >>> 0, bag: BAG, tray: 0, spins: [], fk: 0, over: false, reason: '' };
}

// Ein Hebelzug. Gibt das Ergebnis zurück und verändert den Besuch.
export function pull(visit, rand) {
  if (visit.over || visit.bag <= 0) throw new Error('Besuch ist vorbei');
  const stops = REELS.map((r) => Math.floor(rand() * r.length));
  const syms = stops.map((i, k) => REELS[k][i]);
  const res = evaluate(syms);
  visit.bag -= 1;
  visit.tray += res.pay;
  visit.spins.push(syms);
  const m = MODES[visit.mode];
  if (m.fk && res.event === 'jackpot') { visit.fk = 1; end(visit, 'jackpot'); }
  else if (m.fk && res.event === 'pech') { visit.fk = -1; end(visit, 'pech'); }
  else if (visit.bag <= 0) end(visit, 'leer');
  return { stops, syms, ...res };
}

export function end(visit, reason) { visit.over = true; visit.reason = reason; }

// Spielt einen Besuch aus Seed + Anzahl Züge nach (für die Prüfung der Quittung).
export function replay(name, mode, seed, n, stopReason) {
  const v = newVisit(name, mode, seed); const rand = rng(seed);
  for (let i = 0; i < n && !v.over; i++) pull(v, rand);
  if (!v.over) end(v, stopReason || 'aufgehoert');
  return v;
}

// FNV-1a über die kanonische Quittungszeile → 6 Zeichen.
export function checkCode(v) {
  const str = [v.name, v.mode, v.seed, v.spins.length, v.tray, v.fk, v.reason].join('|');
  let h = 0x811c9dc5;
  for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36).toUpperCase().padStart(7, '0').slice(-6);
}

export const REASONS = {
  jackpot: 'Jackpot — der Automat ist leer geklingelt',
  pech: 'Pechsträhne — mehr verzockt als im Beutel war',
  leer: 'Beutel leer',
  aufgehoert: 'Aufgehört',
};

export function receipt(v) {
  const m = MODES[v.mode];
  const net = (v.tray - v.spins.length) * m.coin;
  const fk = m.fk ? (v.fk > 0 ? '+1' : v.fk < 0 ? '−1' : '±0') : '— (Kleingeld)';
  return [
    `🎰 Einarmiger Bandit — Quittung`,
    `Investigator: ${v.name}`,
    `Automat: ${m.label} (${m.coinName}, ${m.coin === 1 ? '1 $' : '5 ¢'})`,
    `Züge: ${v.spins.length} von ${BAG} · Gewinnschale: ${v.tray} Münzen`,
    `Bilanz: ${net >= 0 ? '+' : '−'}${Math.abs(net).toFixed(2)} $`,
    `Ende: ${REASONS[v.reason]}`,
    `Finanzkraft: ${fk}`,
    `Prüfcode: ${v.seed.toString(36).toUpperCase()}-${checkCode(v)}`,
  ].join('\n');
}

// Liest eine Quittung zurück und prüft sie durch Nachspielen.
export function verify(text) {
  const get = (re) => (text.match(re) || [])[1];
  const name = get(/Investigator:\s*(.+)/);
  const mode = /Großer Einsatz/.test(text) ? 'gross' : /Kleingeld/.test(text) ? 'klein' : null;
  const n = Number(get(/Züge:\s*(\d+)/));
  const code = get(/Prüfcode:\s*([0-9A-Z]+-[0-9A-Z]+)/);
  if (!name || !mode || !n || !code) return { ok: false, msg: 'Quittung unvollständig.' };
  const [seedPart] = code.split('-');
  const seed = parseInt(seedPart, 36);
  const reasonKey = Object.keys(REASONS).find((k) => text.includes(REASONS[k]));
  const v = replay(name.trim(), mode, seed, n, reasonKey === 'aufgehoert' ? 'aufgehoert' : undefined);
  // Die ganze Quittung muss exakt dem Nachspielen entsprechen — jede geänderte Zeile fällt auf.
  const ok = receipt(v) === text.trim().replace(/\r\n/g, '\n');
  return { ok, msg: ok ? 'Echt — Ergebnis nachgespielt und bestätigt.' : 'Stimmt nicht mit dem Nachspielen überein.', visit: v };
}
