// 2026-10-26: the matrix quadrant names step aside from the points (app.js placeQuadrantNames). Both lines of a name sit in one
// .q-name block that moves as one, under the points and group buttons, never taking a click, on a faint panel-colour backing
// that leaves the text where it was. The names are placed again whenever the points, their labels or the plot change.
// The browser side (no name over a point, button or shown name at 360–1440px, every group filter, two weights) is in uicheck.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');
const app=read('app.js'), compare=read('compare.css'), html=read('index.html');

// markup: the four quadrants keep their words; each name's two lines are one block, '현재 0종' stays centred in the quadrant
for(const [q,name] of [['q1','보전 연구 우선 검토'],['q2','활용·보전 병행 검토'],['q3','기초조사 검토'],['q4','활용 연구 검토']])
  assert.ok(html.includes(`<div class="quadrant ${q}"><div class="q-name"><strong>${name}</strong><span></span></div><em class="q-empty" hidden>현재 0종</em></div>`),`${q}: both lines in one .q-name`);

// style: under the points (z-index 2, before #matrix-points), no clicks, backing 70% panel colour with 6px corners and 2px × 6px
// padding taken back by the margin, no font size of its own
const rule=compare.match(/#compare \.matrix \.q-name\{([^}]*)\}/)?.[1]||'';
for(const d of ['z-index:2','pointer-events:none','margin:-2px -6px','padding:2px 6px','border-radius:6px','color-mix(in srgb,var(--cs-panel) 70%,transparent)'])assert.ok(rule.includes(d),`.q-name has ${d}`);
assert.doesNotMatch(rule,/font-size/,'.q-name keeps the lines\' font sizes');
assert.match(compare,/#compare \.matrix :is\(\.q2,\.q4\) \.q-name\{align-self:flex-end;align-items:flex-end\}/,'right-hand names stay right-aligned');
assert.ok(html.indexOf('class="q-name"')<html.indexOf('id="matrix-points"'),'names come before the points');

// when: after the points and labels are placed, after a filter (the note can change the plot's height), when a basket name
// shows or hides, in the simulated example, and again after a weight change once the panel has its new height
const body=name=>{const i=app.indexOf(`function ${name}(`);assert.ok(i>=0,name);let d=0,j=app.indexOf('{',i);for(let k=j;k<app.length;k++){if(app[k]==='{')d++;else if(app[k]==='}'&&!--d)return app.slice(j,k+1);}};
assert.match(body('declutterPointLabels'),/^\{\n  resetQuadrantNames\(\);/,'declutter starts from the names in their corners');
assert.match(body('declutterPointLabels'),/syncClusterDims\(\);placeQuadrantNames\(\);/,'declutter places the names last');
assert.match(body('applyCompareFilter'),/placeQuadrantNames\(\);[^\n]*\n\}$/,'a filter places the names again');
assert.match(body('markBasketPoints'),/placeQuadrantNames\(\)/,'a basket change places the names again');
assert.match(app,/if\(!value\)declutterPointLabels\(\);else placeQuadrantNames\(\);/,'the simulated example places the names');
assert.match(body('redrawForWeight'),/declutterPointLabels\(\);\n  slideMatrixPoints\(before\);/,'a weight change lays the matrix out again on its new height');

// how: four corners of its own quadrant (its own first), 6px clear of points (+2px), buttons, shown names and tick numbers;
// else outside the plot; one measurement, no loop over positions, the plot height kept
const place=body('placeQuadrantNames');
assert.match(app,/const QN_GAP=6;/);
assert.match(place,/\[\[0,0\],\[dx,0\],\[0,dy\],\[dx,dy\]\]/,'four corners, its own first');
assert.match(place,/grow\(box\(e\),2\)/,'a point counts 4px wider');
assert.match(place,/matrix-cluster-btn,#matrix-points \.point-label,\.matrix-ticks i,\.matrix-ticks b/,'buttons, names and ticks are in the way');
assert.match(place,/setAttribute\('data-out',''\)/,'a name with no free corner stands outside the plot');
assert.match(place,/m\.style\.minHeight=plot\.height\+'px'/,'the plot keeps its height');
assert.doesNotMatch(place,/\bwhile\b|requestAnimationFrame|setTimeout/,'one pass');
assert.doesNotMatch(place,/textContent\s*=|innerHTML|\.hidden\s*=|display\s*=|ellipsis/,'no line hidden or rewritten');
console.log('matrix quadrant names: ok');
