import { SYMBOLS, REELS, MODES, BAG, rng, newVisit, pull, end, receipt, verify } from './bandit.js';

const $ = (id) => document.getElementById(id);
const KEY = 'coc-bandit-visit';
const reelEls = [...document.querySelectorAll('.reel')];
let visit = null, rand = null, busy = false;

for (const k of Object.keys(MODES)) document.querySelector(`[data-blurb="${k}"]`).textContent = MODES[k].blurb;

// Gewinntafel aus der Logik ableiten wäre Overkill — sie steht hier einmal, passend zu evaluate().
const G = (s) => SYMBOLS[s].glyph;
$('paytable').innerHTML = [
  [`${G('glocke')} ${G('glocke')} ${G('glocke')}`, 'Jackpot · 50'],
  ['BAR BAR BAR', '20'], [`${G('traube')} ${G('traube')} ${G('traube')}`, '14'],
  [`${G('orange')} ${G('orange')} ${G('orange')}`, '10'], [`${G('kirsche')} ${G('kirsche')} –`, '5'],
  [`${G('kirsche')} – –`, '2'], [`${G('zitrone')} ${G('zitrone')} ${G('zitrone')}`, 'Pechsträhne · 0'],
].map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');

function paint(el, s) {
  el.textContent = SYMBOLS[s].glyph;
  el.classList.toggle('bar', s === 'bar');
}
function showStop(k, i) {
  const strip = REELS[k], n = strip.length;
  const [above, line, below] = reelEls[k].children;
  paint(above, strip[(i - 1 + n) % n]); paint(line, strip[i]); paint(below, strip[(i + 1) % n]);
}
const save = () => localStorage.setItem(KEY, JSON.stringify({ name: visit.name, mode: visit.mode, seed: visit.seed, n: visit.spins.length, reason: visit.over ? visit.reason : '' }));

function counters() { $('bag').textContent = visit.bag; $('tray').textContent = visit.tray; }
function say(text, cls = '') { const m = $('msg'); m.textContent = text; m.className = 'msg ' + cls; }

function begin(name, mode, seed, n = 0, reason = '') {
  visit = newVisit(name, mode, seed); rand = rng(seed);
  let last = null;
  for (let i = 0; i < n && !visit.over; i++) last = pull(visit, rand);
  if (reason === 'aufgehoert' && !visit.over) end(visit, 'aufgehoert');
  $('setup').hidden = true; $('machine').hidden = false; $('done').hidden = true;
  $('plate-who').textContent = name; $('plate-mode').textContent = MODES[mode].label;
  if (last) last.stops.forEach((i, k) => showStop(k, i)); else reelEls.forEach((_, k) => showStop(k, k * 7));
  counters(); save();
  if (visit.over) finish(); else { say(n ? 'Weiter geht’s.' : 'Münze einwerfen, Hebel ziehen.'); $('pull').focus(); }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

async function doPull() {
  if (busy || !visit || visit.over) return;
  busy = true; $('pull').disabled = $('stop').disabled = true;
  const res = pull(visit, rand); save();
  $('bag').textContent = visit.bag;
  say('…');
  if (!reduced) {
    reelEls.forEach((r) => r.classList.add('spinning'));
    const t0 = performance.now();
    const keys = Object.keys(SYMBOLS);
    for (let k = 0; k < 3; k++) {
      const until = t0 + 550 + k * 350;
      while (performance.now() < until) {
        for (let j = k; j < 3; j++) [...reelEls[j].children].forEach((el) => paint(el, keys[Math.floor(Math.random() * keys.length)]));
        await wait(55);
      }
      reelEls[k].classList.remove('spinning'); showStop(k, res.stops[k]);
    }
  } else res.stops.forEach((i, k) => showStop(k, i));
  counters();
  const m = MODES[visit.mode];
  if (res.event === 'jackpot' && m.fk) say('JACKPOT! Der Automat klingelt sich leer — +1 Finanzkraft.', 'big');
  else if (res.event === 'jackpot') say(`JACKPOT! Fünfzig ${m.coinName}s klimpern in die Schale.`, 'big');
  else if (res.event === 'pech' && m.fk) say('Drei Zitronen. Du hast angeschrieben, mehr als im Beutel war — −1 Finanzkraft.', 'bad');
  else if (res.event === 'pech') say('Drei Zitronen. Pech gehabt.', 'bad');
  else if (res.pay) say(`${res.text} ${res.pay} ${res.pay === 1 ? 'Münze' : 'Münzen'} in die Schale.`, 'win');
  else say(['Nichts.', 'Die Walzen schweigen.', 'Klack. Nichts.', 'Der Automat behält sie.'][visit.spins.length % 4]);
  busy = false;
  if (visit.over) { await wait(reduced ? 300 : 1400); finish(); }
  else { $('pull').disabled = $('stop').disabled = false; $('pull').focus(); }
}

function finish() {
  save();
  $('machine').hidden = true; $('done').hidden = false;
  $('receipt').textContent = receipt(visit);
  $('copy').focus();
}

$('who').addEventListener('change', () => { $('other-wrap').hidden = $('who').value !== ''; });
$('start').addEventListener('click', () => {
  const name = ($('who').value || $('other').value).trim();
  if (!name) { $('other').focus(); return; }
  const mode = document.querySelector('input[name=mode]:checked').value;
  begin(name, mode, crypto.getRandomValues(new Uint32Array(1))[0]);
});
$('pull').addEventListener('click', doPull);
$('stop').addEventListener('click', () => { if (!busy && visit && !visit.over) { end(visit, 'aufgehoert'); finish(); } });
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !$('machine').hidden && document.activeElement?.id !== 'stop') { e.preventDefault(); doPull(); }
});
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('receipt').textContent); $('copy').textContent = 'Kopiert ✓'; }
  catch { getSelection().selectAllChildren($('receipt')); $('copy').textContent = 'Markiert — Strg+C'; }
  setTimeout(() => { $('copy').textContent = 'Kopieren'; }, 2000);
});
$('again').addEventListener('click', () => {
  localStorage.removeItem(KEY); visit = null;
  $('done').hidden = true; $('setup').hidden = false; $('start').focus();
});
$('check').addEventListener('click', () => {
  const r = verify($('check-in').value);
  $('check-out').textContent = r.msg; $('check-out').className = r.ok ? 'ok' : 'bad';
});

// Laufenden oder beendeten Besuch nach Neuladen wiederherstellen (kein Neuwürfeln per F5).
try {
  const s = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (s && MODES[s.mode] && Number.isInteger(s.seed) && s.n <= BAG) begin(s.name, s.mode, s.seed, s.n, s.reason);
} catch { localStorage.removeItem(KEY); }
