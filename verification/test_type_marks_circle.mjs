// 2026-10-18: the four matrix types are told apart by colour, place and words; every type mark (explore cards, side panel,
// '활용 × 보전' 2×2 key, matrix quadrant names, type cards, profile) and every matrix point is a circle. An MCUI set by the
// stock-decline signal reads in the number's brackets ('60.0 (LC + 자원 감소)') and the point's tooltip, never as a shape.
// The browser side (computed styles, positions, the weight slider) is checked by verification/2026-10-18-matrix-markers-circle/capture.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const app=read('app.js'), theme=read('theme.css'), compare=read('compare.css'), html=read('index.html'), chatbot=read('chatbot.js');
const TYPES=['conservation_priority','alternative_production','baseline_survey','sustainable_use'];
// strip comments: they may still name the old shapes for history
const code=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');

// one shape rule for every type: a circle, and no per-type clip-path or 45° turn
assert.match(theme,/\n\.shape\{[^}]*border-radius:50%[^}]*\}/,'.shape is a circle');
for(const t of TYPES){
  assert.doesNotMatch(code(theme),new RegExp(`\\.shape-${t}\\{`),`no own rule for .shape-${t}`);
  assert.doesNotMatch(code(compare),new RegExp(`\\[data-type=${t}\\][^{]*(?:strong::before|cp-shape|mt-shape)[^{]*\\{[^}]*(?:clip-path|border-radius:2px)`),`no own shape for ${t}`);
}
assert.match(compare,/#compare \.matrix \.quadrant\.typed strong::before\{[^}]*border-radius:50%/,'quadrant names: a circle');
assert.match(compare,/#compare :is\(\.cp-shape,\.mt-shape\)\{[^}]*border-radius:50%/,'type cards and profile: a circle');
for(const [name,css] of [['theme.css',theme],['compare.css',compare]]){
  assert.doesNotMatch(code(css),/\.stock\b[^{]*\{[^}]*rotate\(45deg\)/,`${name}: no diamond for the stock-decline signal`);
  assert.doesNotMatch(code(css),/\.(?:shape|cp-shape|mt-shape|matrix-point)[^{]*\{[^}]*clip-path:polygon/,`${name}: no polygon type mark`);
}
// markup: no 'stock' class on a point, no stock legend item, no ◆ beside the table's MCUI, no type glyphs in rendered strings
assert.doesNotMatch(app,/stockMcui\(s\)\?' stock'/,'matrix points carry no stock class');
assert.doesNotMatch(app,/lg\('stock'/,'legend has no 자원 감소 신호 item');
assert.doesNotMatch(app,/cv-stock|sd-mark/,'no stock mark beside the MCUI number or in the stock box heading');
assert.doesNotMatch(code(app),/[▲■◆◇△□]/,'app.js renders no shape glyph');
assert.doesNotMatch(html,/[▲■◆◇△□]/,'index.html has no shape glyph');
// the stock-decline signal stays in words: the point's tooltip and the brackets beside the number
assert.match(app,/MCUI \$\{scoreText\(s,'MCUI',pilotScore\(s,'MCUI'\)\)\}\$\{kind\}/,'point tooltip keeps the MCUI text with its brackets and basis');
// the sentences that described the diamond now say where the signal is written
for(const [where,text] of [[html,'두 값은 따로 봅니다 · 점 색은 유형입니다 · 자원 감소 신호로 정한 MCUI는 숫자 옆 괄호와 점 툴팁에 적습니다'],
  [html,'자원 감소 신호(KOSIS 어획량 추세)로 MCUI가 정해진 종은 MCUI 숫자 옆 괄호에 ‘어획량 감소’로 적습니다.'],
  [app,'KOSIS 어획량 추세(자원 감소 신호)로 MCUI가 정해진 종은 MCUI 숫자 옆 괄호에 ‘어획량 감소’로 적습니다.'],
  [chatbot,'칸마다 유형 색 원(●)과 위치 이름이']])assert.ok(where.includes(text),text);
for(const [name,s] of [['index.html',html],['app.js',app],['chatbot.js',chatbot]])assert.doesNotMatch(s,/마름모/,`${name}: no 마름모`);
assert.doesNotMatch(chatbot,/유형 모양\(/,'chatbot FAQ no longer lists type shapes');
console.log('type marks circle: ok');
