'use strict';
// One display rule for the index numbers on every screen (2026-10-19, LKH 9/10): BBVI and MBPI as whole numbers, MFPI and
// MCUI with one decimal, for every species. The explore cards, the comparison table, the matrix, the species detail and the
// sea expedition all write their numbers with this one function (app.js scoreValue and scoreText, expedition.js fmtAxis).
// Display only: the published files keep their values, and a type is judged on the value before rounding.
// A number takes one more decimal only where rounding would carry it across its matrix line (line, judged on raw, the value
// the type is judged on) or turn a non-zero value into 0, so a number never reads on the other side of its own type.
function scoreNumber(key,v,line,raw=v){
  if(!Number.isFinite(v))return '–';
  const side=x=>Number.isFinite(line)&&x>=line;
  for(let d=key==='BBVI'||key==='MBPI'?0:1;;d++){
    const t=(d<2?v:raw).toFixed(d);
    if(d>=4||(Number(t)===0)===(raw===0)&&side(Number(t))===side(raw))return t;
  }
}
globalThis.scoreNumber=scoreNumber;
