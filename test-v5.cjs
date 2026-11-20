const {JSDOM} = require('jsdom');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const code = fs.readFileSync(__dirname + '/batch-panel-v5.js', 'utf8');
const turn = () => new Promise(resolve => setImmediate(resolve));
async function until(fn) { for (let i=0;i<500;i++) {if(fn()) return; await turn();} throw Error('Condition timeout'); }
async function fixture(storage = new Map(), options = {}) {
  const dom = new JSDOM('<body><div id="music" style="overflow-y:auto"></div></body>', {url:'https://ok.ru/music/profile/123',runScripts:'outside-only'});
  const w = dom.window, root = w.document.querySelector('#music'), handed = [], calls = [], timers = new Map();
  let pos=0, tick, timerId=0;
  const total=options.total || 10;
  const row = n => `<div class="track-with-cover" data-track-id="${n}"><span class="track-with-cover_name">${n===6?'Колосок':'Песня '+n}</span><span class="track-with-cover_artist">${n===6?'ALEKS ATAMAN, FINIK':'Исполнитель'}</span></div>`;
  function paint() {const first=Math.floor(pos/100)+1; root.innerHTML=Array.from({length:Math.min(3,total-first+1)},(_,i)=>row(first+i)).join('');}
  Object.defineProperties(root, {clientHeight:{get:()=>300},scrollHeight:{get:()=>total*100},scrollTop:{get:()=>pos,set:v=>{pos=Math.max(0,Math.min(v,total*100-300));paint();}}}); paint();
  w.setTimeout = (fn, ms) => { const id=++timerId; timers.set(id,fn); if(ms<30000) setImmediate(()=>{if(timers.delete(id))fn();}); return id; };
  w.clearTimeout = id => timers.delete(id); w.setInterval=fn=>{tick=fn;return 1;};
  w.GM_getValue = (key, fallback) => storage.get(key)||fallback;
  w.GM_setValue = (key,value) => storage.set(key,value);
  w.GM_download = opts => { assert.equal(opts.onload,undefined); assert.equal(opts.onerror,undefined); handed.push(opts); if(options.download) return options.download(opts,w); };
  w.confirm = () => true;
  w.S = {getLayer:()=>root,getNewLayer:()=>null,getAudioLinksIds:async()=>[],getNewAudioLinksIds:async()=>[],
    getAudioFromWall:async()=>Array.from(root.querySelectorAll('[data-track-id]')).map(el=>el.dataset.trackId),
    getAudioLinksViaAPI:(ids,progress,cb)=>{
      calls.push(ids[0]);
      if(options.resolve) return options.resolve(ids[0],cb,w);
      cb([{url:'https://media.invalid/'+ids[0],filename:ids[0]+'.mp3',title:'Песня '+ids[0]}]); return {abort(){}};
    }};
  w.eval(code);
  await until(()=>tick);
  const $=name=>w.document.querySelector('[data-'+name+']');
  const click=async name=>{await $(name).onclick();await turn();};
  const state=()=>JSON.parse(storage.get('ok-batch-v5:https://ok.ru/music/profile/123')||'{}');
  return {dom,w,root,handed,calls,timers,storage,$,click,state,tick:()=>tick()};
}
(async()=>{
  // Inclusive endpoint and virtualized rows: only three rows exist at any instant.
  const a=await fixture(); await a.click('until');
  assert.deepEqual(a.state().selected,['1','2','3','4','5','6']);
  assert.match(a.$('status').textContent,/включительно/);
  assert(a.root.querySelector('input.sf-ok-pick'));
  const cb=a.root.querySelector('input.sf-ok-pick'); cb.checked=false; cb.dispatchEvent(new a.w.Event('change'));
  await turn(); assert(!a.state().selected.includes(cb.dataset.track));
  cb.checked=true; cb.dispatchEvent(new a.w.Event('change')); await turn();
  await a.click('download'); assert.equal(a.handed.length,6);
  await a.click('until'); await a.click('download'); assert.equal(a.handed.length,6,'duplicates skipped');
  a.$('skip').checked=false; a.$('skip').onchange(); await a.click('until'); await a.click('download'); assert.equal(a.handed.length,12);
  assert(!JSON.stringify(a.state()).includes('media.invalid'),'media URLs not persisted');
  // Entire list, no endpoint filter, and names preserved.
  const b=await fixture(); await b.click('all'); assert.equal(b.handed.length,10); assert.equal(b.state().items.length,10);
  b.$('speed').value='0'; b.$('speed').onchange(); assert.equal(b.$('speed').value,'1.5');
  // Empty resolver result is attributed to the exact track and other downloads continue.
  const c=await fixture(new Map(),{resolve:(id,cb)=>{cb(id==='2'?[]:[{url:'https://media.invalid/'+id,filename:id+'.mp3'}]);return {abort(){}};}});
  c.$('count').value='3';await c.click('range');await c.click('download');
  assert.equal(c.handed.length,2);assert.equal(c.state().errors[0].id,'2');
  // Stop while waiting for the resolver, preserve the queue, reload, resume.
  let pending,aborted=false;
  const d=await fixture(new Map(),{resolve:(id,cb)=>{pending=cb;return {abort(){aborted=true;}};}});
  d.$('count').value='3';await d.click('range');const task=d.$('download').onclick();
  await until(()=>pending);d.$('stop').onclick();await task;
  assert(aborted);assert.equal(d.handed.length,0);assert.equal(d.state().queue.length,3);
  pending([{url:'https://late.invalid/file'}]);await turn();assert.equal(d.handed.length,0);
  const e=await fixture(d.storage);await e.click('resume');assert.equal(e.handed.length,3);assert.equal(e.state().queue.length,0);
  // Pause after receiving links but before invoking GM_download.
  let callback;
  const f=await fixture(new Map(),{resolve:(id,cb)=>{callback=cb;return {abort(){}};}});
  f.$('count').value='1';await f.click('range');const paused=f.$('download').onclick();await until(()=>callback);
  f.$('pause').onclick();callback([{url:'https://media.invalid/1',filename:'1.mp3'}]);await turn();await turn();assert.equal(f.handed.length,0);
  f.$('pause').onclick();await paused;assert.equal(f.handed.length,1);
  // Uncertain transfer on reload is reported and not silently duplicated.
  const store=new Map(e.storage), k='ok-batch-v5:https://ok.ru/music/profile/123';
  const data=JSON.parse(store.get(k));data.inFlight='4';data.queue=['4','5'];store.set(k,JSON.stringify(data));
  const g=await fixture(store);await g.click('resume');assert.equal(g.handed.length,1);assert(g.state().sent['4'].uncertain);
  // Missing endpoint never launches downloads.
  const h=await fixture();h.$('target').value='Нет такой песни';await h.click('until');assert.match(h.$('status').textContent,/не найдена/);assert.equal(h.handed.length,0);
  // Timeout is reported per track.
  const i=await fixture(new Map(),{resolve:()=>({abort(){}})});i.$('count').value='1';await i.click('range');const timed=i.$('download').onclick();
  await until(()=>i.calls.length);for(const fn of [...i.timers.values()])fn();await timed;assert.match(i.state().errors[0].message,/30 секунд/);
  for(const x of [a,b,c,d,e,f,g,h,i])x.dom.window.close();
  console.log('PASS: endpoint inclusive, virtualized autoscroll, checkboxes, full collection, duplicate history, reload/resume, pause/stop, late callbacks, timeout, per-track errors, no persisted media URLs');
})().catch(error=>{console.error(error);process.exitCode=1;});
