const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const elements = {};
const el = key => elements[key] ||= {value: key === '[data-start]' ? '1' : '50', addEventListener() {}, appendChild() {}};
const panel = {style: {}, querySelector: el};
let captured, queued;
const created = [];
const document = {getElementById: () => null, createElement: () => {const element = created.length ? {} : panel; created.push(element); return element;}, body: {appendChild() {}}};
const timers = new Map(); let timerId = 0;
const context = {document, location: {href: 'https://ok.ru/music/profile/123'}, setTimeout: (fn, ms) => {if (!ms || ms === 1500) {fn(); return 0;} timers.set(++timerId, fn); return timerId;}, clearTimeout: id => timers.delete(id), GM_download: options => {queued = (queued || 0) + 1; assert.equal(options.onload, undefined); assert.equal(options.onerror, undefined); assert.equal(options.ontimeout, undefined);}, S: {
  getLayer: () => null, getNewLayer: () => null,
  getAudioLinksIds: async () => Array.from({length: 120}, (_, i) => i + 1),
  getNewAudioLinksIds: async () => [1, 2], getAudioFromWall: async () => [],
  getPlaylistName: () => 'Test',
  getAudioLinksViaAPI: (ids, progress, cb) => { captured = ids; progress(ids.length, ids.length); cb(ids.map(id => ({url: 'https://example.com/' + id, filename: id + '.mp3'}))); return {abort() {}}; }
}, c: {downloadList: {showBeforeDownloadPopup: links => {queued = links;}}}};
let collectTick;
context.setInterval = fn => {collectTick = fn;};
vm.runInNewContext(fs.readFileSync(__dirname + '/batch-panel.js', 'utf8'), context);
(async () => {
  await el('[data-action="select"]').onclick();
  await el('[data-action="download"]').onclick();
  assert.equal(captured.length, 50); assert.equal(captured[0], '1'); assert.equal(captured[49], '50');
  assert.equal(queued, 50);
  el('[data-start]').value = '51'; el('[data-count]').value = '70';
  await el('[data-action="select"]').onclick(); await el('[data-action="download"]').onclick();
  assert.equal(captured.length, 70); assert.equal(captured[0], '51'); assert.equal(captured[69], '120');
  el('[data-count]').value = '71'; await el('[data-action="select"]').onclick();
  assert.equal(el('[data-action="download"]').disabled, true);
  el('[data-start]').value = '-1'; await el('[data-action="select"]').onclick();
  assert.match(el('[data-status]').textContent, /положительные/);
  el('[data-start]').value = '1'; el('[data-count]').value = '5';
  await el('[data-action="select"]').onclick();
  context.location.href = 'https://ok.ru/music/other';
  el('[data-action="download"]').onclick(); assert.equal(el('[data-action="download"]').disabled, true);
  context.location.href = 'https://ok.ru/music/profile/123';
  context.S.getAudioLinksViaAPI = (ids, progress, cb) => {cb([]); return {abort() {}};};
  await el('[data-action="select"]').onclick(); await el('[data-action="download"]').onclick();
  assert.match(el('[data-status]').textContent, /0 ссылок/);
  let aborted = false;
  context.S.getAudioLinksViaAPI = () => ({abort() {aborted = true;}});
  await el('[data-action="select"]').onclick();
  const pending = el('[data-action="download"]').onclick();
  for (const callback of [...timers.values()]) callback();
  await pending;
  assert.equal(aborted, true); assert.match(el('[data-status]').textContent, /30 секунд/);
  assert.equal(el('[data-action="select"]').disabled, false);
  assert.equal(timers.size, 0);
  context.S.getAudioLinksIds = async () => [1, 2, 3];
  context.S.getNewAudioLinksIds = async () => [];
  created[1].onclick();
  await new Promise(resolve => setImmediate(resolve));
  context.S.getAudioLinksIds = async () => [3, 4, 5];
  await collectTick();
  assert.match(created[2].textContent, /5/);
  context.S.getAudioLinksIds = async () => [5];
  el('[data-start]').value = '1'; el('[data-count]').value = '5';
  await el('[data-action="select"]').onclick();
  assert.equal(el('[data-action="download"]').disabled, false);
  context.location.href = 'https://ok.ru/music/new';
  await collectTick();
  assert.equal(el('[data-action="download"]').disabled, true);
  console.log('PASS: ranges, callback-free downloads, API timeout, collection across recycled rows, deduplication, navigation reset');
})().catch(error => {console.error(error); process.exitCode = 1;});
