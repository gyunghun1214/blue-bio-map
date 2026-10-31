// README 그림 다시 찍기 (2026-10-31). 화면 코드는 건드리지 않고 dist/를 그대로 띄워 찍는다.
//   python -m http.server 8765 --bind 127.0.0.1 --directory dist   (다른 창에서)
//   node docs/images/capture.mjs
// - 운영 DB(Supabase) 응답은 dist/live-snapshot.json(저장된 공개 자료 사본)으로 돌려준다. 화면은 '공개 기준 자료 연결됨'이 된다.
// - 위성·수심 타일과 분석 비콘은 막는다. 그래서 지도 배경은 경계선 지도다(위성 단추 옆 ⚠는 그 표시).
// - 1440×900, 배율 1, 한국어, 움직임 줄이기. 찍는 화면: 첫 화면, 탐색 지도(활용 × 보전, 전복), 비교와 지표(전복 선택),
//   근거와 방법의 접힘 04 '검증 기록'(펼친 칸만).
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const FX = JSON.parse(fs.readFileSync('dist/live-snapshot.json', 'utf8'));
const ABALONE = 397082; // 전복(종 수준) Haliotis discus: 활용 35 · 보전 80, 발표 2장·14장의 종
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({args: ['--no-sandbox', '--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const ctx = await browser.newContext({viewport: {width: 1440, height: 900}, deviceScaleFactor: 1, locale: 'ko-KR',
  timezoneId: 'Asia/Seoul', reducedMotion: 'reduce'});
await ctx.route(/supabase\.co/, r => {
  const u = r.request().url();
  const body = u.includes('species_profiles') ? FX.profiles : u.includes('species_map_cells') ? FX.cells : [];
  return r.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify(body)});
});
await ctx.route(/gibs\.earthdata\.nasa\.gov|gebco\.net|cloudflareinsights\.com/, r => r.abort());
await ctx.addInitScript(() => { try { localStorage.setItem('bbChatHintSeen', '1'); } catch {} });
const page = await ctx.newPage();
const shot = async (name, opts = {}) => {
  await page.screenshot({path: path.join(OUT, name), timeout: 120000, animations: 'disabled', caret: 'hide', ...opts});
  console.log('saved', name);
};
const waitData = () => page.waitForFunction(() => /연결됨/.test(document.getElementById('connection-state')?.textContent || ''), null, {timeout: 60000});

// 1. 첫 화면
await page.goto(BASE);
await page.waitForFunction(() => document.getElementById('site-gate')?.classList.contains('is-ready'), null, {timeout: 60000});
await sleep(4000);
console.log('근거 출처', await page.evaluate(() => document.querySelector('.gate-src-n')?.textContent));
await shot('01-first-screen.jpg', {type: 'jpeg', quality: 85}); // 지구 사진이라 JPEG(PNG면 1.3 MB)

// 2~4. 공유 링크 주소로 바로 연다(첫 화면을 거치지 않음)
const open = async hash => { await page.goto('about:blank'); await page.goto(BASE + '#' + hash); await waitData(); await sleep(3500); };
await open(`v=explore&s=${ABALONE}&t=value`);
await shot('02-explore-value-abalone.png');
await open(`v=compare&s=${ABALONE}`);
await shot('03-compare.png');
await open('v=method');
await page.evaluate(() => { const d = document.getElementById('mt-acc-04'); if (d) d.open = true; });
// 떠 있는 머리글이 칸 첫 줄(MFPI)을 가리지 않게, 이 그림에서만 머리글을 흐름 안에 둔다
await page.addStyleTag({content: 'header{position:static!important}'});
await sleep(1500);
await page.locator('#mt-acc-04').scrollIntoViewIfNeeded();
await sleep(800);
await page.locator('#mt-acc-04').screenshot({path: path.join(OUT, '04-verification-record.png'), timeout: 120000, animations: 'disabled'});
console.log('saved 04-verification-record.png');
await browser.close();
