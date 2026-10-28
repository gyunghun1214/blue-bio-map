// Exercise the production scheduler without WebGL: cancellation, resume, and repeated toggles.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../dist/expedition.js',import.meta.url),'utf8').split('// ---- browser ----')[0];
const context=vm.createContext({});
vm.runInContext(source+';globalThis.makeLoop=seaFrameLoop;',context);
const queue=new Map();let id=0,draws=0,lastTime=null;
const loop=context.makeLoop(time=>{draws++;lastTime=time;},fn=>{queue.set(++id,fn);return id;},key=>queue.delete(key));
const tick=time=>{const callbacks=[...queue.values()];queue.clear();callbacks.forEach(fn=>fn(time));};
loop.start();loop.start();assert.equal(queue.size,1);
tick(16);assert.equal(draws,1);assert.equal(queue.size,1);
loop.stop();tick(60000);assert.equal(draws,1);assert.equal(queue.size,0);
for(let i=0;i<20;i++){loop.start();loop.start();assert.equal(queue.size,1);tick(60016+i*16);loop.stop();assert.equal(queue.size,0);}
assert.equal(draws,21);assert.equal(lastTime,60320);
// A callback already handed to the event loop still does no work after cancellation.
loop.start();const stale=[...queue.values()][0];loop.stop();stale(70000);assert.equal(draws,21);assert.equal(queue.size,0);
console.log('PASS: sea loop pauses without callbacks, resumes once, and survives 20 card/background toggles');
