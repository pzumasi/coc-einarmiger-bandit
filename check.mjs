// Ein laufender Check: Balance (analytisch + Monte Carlo) und Quittungsprüfung.
// node check.mjs
import assert from 'node:assert/strict';
import { REELS, BAG, evaluate, rng, newVisit, pull, end, receipt, verify } from './bandit.js';

// 1) Exakte Wahrscheinlichkeiten pro Zug und Auszahlungsquote (RTP) über alle 8000 Stellungen.
let rtp = 0, pJack = 0, pPech = 0;
const N = REELS.reduce((a, r) => a * r.length, 1);
for (const a of REELS[0]) for (const b of REELS[1]) for (const c of REELS[2]) {
  const r = evaluate([a, b, c]);
  rtp += r.pay / N;
  if (r.event === 'jackpot') pJack += 1 / N;
  if (r.event === 'pech') pPech += 1 / N;
}
const visitJack = 1 - (1 - pJack) ** BAG, visitPech = 1 - (1 - pPech) ** BAG;
console.log(`pro Zug: Jackpot ${(pJack * 100).toFixed(3)} %, Pechsträhne ${(pPech * 100).toFixed(3)} %, Auszahlungsquote ${(rtp * 100).toFixed(1)} %`);

// 2) Monte Carlo: ganze Besuche im Großen Einsatz (immer alle 20 Münzen gespielt).
const T = 200000; let plus = 0, minus = 0, coins = 0;
const seedRand = rng(12345);
for (let i = 0; i < T; i++) {
  const v = newVisit('Sim', 'gross', Math.floor(seedRand() * 2 ** 32)); const r = rng(v.seed);
  while (!v.over) pull(v, r);
  if (v.fk > 0) plus++; if (v.fk < 0) minus++;
  coins += v.tray - v.spins.length;
}
const fp = plus / T, fm = minus / T;
console.log(`pro Besuch (Großer Einsatz, ${BAG} Züge): +1 FK ${(fp * 100).toFixed(1)} % · −1 FK ${(fm * 100).toFixed(1)} % · ±0 ${((1 - fp - fm) * 100).toFixed(1)} %`);
console.log(`Erwartung pro Besuch: ${(fp - fm).toFixed(3)} FK · nach 50 Besuchen ${((fp - fm) * 50).toFixed(1)} FK, Streuung ±${Math.sqrt(50 * (fp + fm - (fp - fm) ** 2)).toFixed(1)}`);
console.log(`Münzbilanz pro Besuch im Schnitt: ${(coins / T).toFixed(2)} Münzen (analytisch ohne Abbruch ${(visitJack * 100).toFixed(1)} % / ${(visitPech * 100).toFixed(1)} %)`);

// Balance-Ziele: beide Ereignisse selten, Pechsträhne etwas häufiger als Jackpot, Haus gewinnt leicht.
assert.ok(fp > 0.03 && fp < 0.07, 'Jackpot pro Besuch soll ~5 % sein');
assert.ok(fm > 0.05 && fm < 0.09, 'Pechsträhne pro Besuch soll ~7 % sein');
assert.ok(fm > fp, 'Haus-Vorteil: Pechsträhne häufiger als Jackpot');
assert.ok(rtp > 0.75 && rtp < 0.95, 'Auszahlungsquote im Bereich der Zeit');

// 3) Quittung: echt → bestätigt; manipuliert → abgelehnt; vorzeitig aufgehört → bestätigt.
const v = newVisit('Tex', 'gross', 987654321); const r = rng(v.seed);
while (!v.over) pull(v, r);
assert.ok(verify(receipt(v)).ok, 'echte Quittung');
assert.ok(!verify(receipt(v).replace(/Gewinnschale: \d+/, 'Gewinnschale: 999')).ok, 'geänderte Gewinnschale fällt auf');
assert.ok(!verify(receipt(v).replace(/Finanzkraft: .*/, v.fk > 0 ? 'Finanzkraft: −1' : 'Finanzkraft: +1')).ok, 'geänderte Finanzkraft fällt auf');
const w = newVisit('Jack Zora', 'klein', 42); const r2 = rng(w.seed);
for (let i = 0; i < 7; i++) pull(w, r2); end(w, 'aufgehoert');
assert.ok(verify(receipt(w)).ok, 'Aufhören nach 7 Zügen');
const forged = receipt(w).replace('Züge: 7', 'Züge: 6');
assert.ok(!verify(forged).ok, 'geänderte Zugzahl fällt auf');
console.log('OK');
