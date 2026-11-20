/* Local OK music queue. Uses the original SaveFrom resolver. */
(function () {
setTimeout(async function () {
  if (document.getElementById('sf-ok-batch')) return;
  const panel = document.createElement('section');
  panel.id = 'sf-ok-batch';
  panel.style.cssText = 'position:fixed;bottom:14px;left:14px;z-index:2147483647;background:#222337;color:white;padding:14px;border:2px solid #ff9800;border-radius:12px;font:14px Arial;width:460px;max-width:90vw;max-height:78vh;overflow:auto';
  panel.innerHTML = `<style>
  #sf-ok-batch button{padding:5px;margin:3px;color:#111;background:#eee;cursor:pointer;border:1px solid #aaa;border-radius:4px}
  #sf-ok-batch button:disabled{opacity:.45;cursor:default} #sf-ok-batch p{margin:7px 0}
  #sf-ok-batch input{color:#111;background:white} #sf-ok-batch input[type=number]{width:65px}
  #sf-ok-batch [data-list]{max-height:160px;overflow:auto} #sf-ok-batch [data-list] label{display:block;padding:3px}
  .sf-ok-pick{display:inline-block!important;position:relative!important;z-index:10!important;width:18px!important;height:18px!important;margin:6px!important}
  </style><strong>ОК — музыка · v5</strong><button data-collapse style="float:right">−</button><div data-body>
  <p><button data-auto>Автосбор</button><button data-all>Скачать всё</button></p>
  <p>С песни <input data-start type="number" min="1" value="1"> Количество <input data-count type="number" min="1" value="50"><button data-range>Выбрать диапазон</button></p>
  <p>До песни включительно:<br><input data-target value="Колосок" placeholder="Название" style="width:44%"> <input data-artist value="ALEKS ATAMAN, FINIK" placeholder="Исполнитель" style="width:46%"><br><button data-until>Собрать и выбрать до песни</button></p>
  <p><button data-download>Скачать выбранные</button><button data-resume>Продолжить очередь / сбор</button></p>
  <p><button data-pause>Пауза</button><button data-stop>Стоп</button><button data-clear>Снять галочки</button></p>
  <p><label><input data-skip type="checkbox" checked> Пропускать переданные браузеру</label></p>
  <p>Интервал загрузок, сек. <input data-speed type="number" min="0.5" max="60" step="0.5" value="1.5"></p>
  <div data-summary></div><p data-status role="status"></p>
  <details><summary>Список песен и галочки</summary><div data-list></div></details>
  <p><button data-report>Скачать отчёт</button><button data-reset>Очистить историю передач</button></p>
  <small>«Передано» не подтверждает сохранение файла. Проверяйте Ctrl+J. При смене сборника начните новый автосбор.</small>
  </div>`;
  document.body.appendChild(panel);
  const $ = name => panel.querySelector('[data-' + name + ']');
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const unique = ids => Array.from(new Set(ids.filter(id => id != null && id !== '').map(String)));
  const norm = text => String(text || '').toLocaleLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const fresh = () => ({items: [], selected: [], sent: {}, queue: [], errors: [], scroll: 0, speed: 1.5, skip: true, inFlight: null, collecting: false, target: null, collectAction: 'collect'});
  let state = fresh(), selected = new Set(), page = location.href, busy = false, paused = false, stopped = false;
  let scanPromise = null, cancelRequest = null, saveChain = Promise.resolve(), runPage, runLayer, mode = '';
  const key = url => 'ok-batch-v5:' + url;
  const say = text => { $('status').textContent = text; };
  const layer = () => S.getLayer() || S.getNewLayer() || document.querySelector('.media-layer.__active') || document;
  const rowSelector = '.track-with-cover, wm-track, wm-track2, .m_portal_track, .m_c_tr, .mus-tr_i';
  function save() {
    state.selected = Array.from(selected);
    const storageKey = key(page), data = JSON.stringify(state);
    saveChain = saveChain.catch(() => {}).then(() => GM_setValue(storageKey, data));
    return saveChain;
  }
  async function restore() {
    const raw = await GM_getValue(key(page), null);
    state = fresh();
    if (raw) {
      const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (value && Array.isArray(value.items) && Array.isArray(value.queue)) Object.assign(state, value);
    }
    selected = new Set(unique(state.selected));
    if (state.inFlight) {
      const id = state.inFlight;
      state.sent[id] = {time: new Date().toISOString(), uncertain: true};
      state.queue = state.queue.filter(value => value !== id);
      state.errors.push({id, stage: 'перезагрузка', message: 'Передача могла состояться. Проверьте Ctrl+J; запись пропускается как повтор.'});
      state.inFlight = null;
    }
    $('speed').value = state.speed; $('skip').checked = state.skip;
    say(state.queue.length || state.collecting ? 'Состояние восстановлено. Нажмите «Продолжить очередь / сбор».' : 'Готово. Можно выбрать песни до «Колосок» включительно.');
    render(true);
  }
  function render(list) {
    $('summary').textContent = 'Найдено: ' + state.items.length + ' · Выбрано: ' + selected.size + ' · Передано ранее: ' + Object.keys(state.sent).length + ' · Очередь: ' + state.queue.length + ' · Ошибок: ' + state.errors.length;
    ['auto', 'all', 'until', 'range', 'download', 'resume', 'reset', 'clear'].forEach(name => { $(name).disabled = busy; });
    $('pause').disabled = $('stop').disabled = !busy;
    $('pause').textContent = paused ? 'Продолжить' : 'Пауза';
    if (list) {
      const fragment = document.createDocumentFragment();
      state.items.forEach((item, index) => {
        const label = document.createElement('label'), input = document.createElement('input');
        input.type = 'checkbox'; input.checked = selected.has(item.id); input.disabled = busy;
        input.onchange = () => choose(item.id, input.checked);
        label.append(input, document.createTextNode(' ' + (index + 1) + '. ' + (item.title || 'Песня ' + item.id) + (state.sent[item.id] ? ' [передано]' : '')));
        fragment.appendChild(label);
      });
      $('list').replaceChildren(fragment);
    }
    document.querySelectorAll('input.sf-ok-pick').forEach(input => { input.checked = selected.has(input.dataset.track); input.disabled = busy; });
  }
  function choose(id, checked) {
    if (busy) return;
    if (checked) selected.add(id); else selected.delete(id);
    save().catch(error => say(error.message)); render(true);
  }
  async function scan() {
    if (scanPromise) return scanPromise;
    scanPromise = (async () => {
      const root = layer(), scanPage = page;
      const [oldIds, newIds, wallIds] = await Promise.all([S.getAudioLinksIds(root), S.getNewAudioLinksIds(root), S.getAudioFromWall(root)]);
      if (page !== scanPage || location.href !== scanPage) return;
      const ids = unique([...(oldIds || []), ...(newIds || []), ...(wallIds || [])]);
      const map = new Map(state.items.map(item => [item.id, item]));
      ids.forEach(id => { if (!map.has(id)) { const item = {id, title: '', name: '', artist: ''}; map.set(id, item); state.items.push(item); } });
      const wmRows = Array.from(root.querySelectorAll('wm-track, wm-track2'));
      root.querySelectorAll(rowSelector).forEach(row => {
        let id = row.dataset.trackId;
        if (!id && wmRows.includes(row)) id = (newIds || [])[wmRows.indexOf(row)];
        if (!id && typeof S.getTrackId === 'function') { try { id = Object.keys(S.getTrackId(row) || {})[0]; } catch (_) {} }
        if (id == null || !map.has(String(id))) return;
        id = String(id);
        const item = map.get(id);
        const title = row.querySelector('.track-with-cover_name, [data-tsid="track_name"], [data-l="t,title"], .mus-tr_song, .m_track_source');
        const artist = row.querySelector('.track-with-cover_artist, [data-l="t,artist"], .mus-tr_artist, .m_c_artist');
        if (title) item.name = title.textContent.trim();
        if (artist) item.artist = artist.textContent.trim();
        item.title = [item.artist, item.name].filter(Boolean).join(' — ');
        let input = row.querySelector('input.sf-ok-pick');
        if (!input) {
          input = document.createElement('input'); input.type = 'checkbox'; input.className = 'sf-ok-pick'; input.title = 'Выбрать для скачивания';
          input.addEventListener('click', event => event.stopPropagation()); input.addEventListener('mousedown', event => event.stopPropagation());
          input.addEventListener('change', () => choose(input.dataset.track, input.checked)); row.prepend(input);
        }
        input.dataset.track = id;
      });
      render(true); await save();
    })();
    try { return await scanPromise; } finally { scanPromise = null; }
  }
  function scrollBox() {
    const row = layer().querySelector(rowSelector);
    for (let node = row && row.parentElement; node && node !== document.body; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight + 8 && /(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node;
    }
    return null;
  }
  function changed() { return location.href !== runPage || (runLayer !== document && !runLayer.isConnected); }
  async function gate() {
    while (paused && !stopped && !changed()) await sleep(150);
    if (stopped || changed()) throw new Error('Остановлено. Остаток очереди и позиция сбора сохранены.');
  }
  function endpoint() {
    if (!state.target) return -1;
    return state.items.findIndex(item => norm(item.name) === norm(state.target.name) && (!state.target.artist || norm(item.artist).includes(norm(state.target.artist))));
  }
  function selectThrough(index) {
    const start = state.target.start;
    if (index < start - 1) throw new Error('Конечная песня находится раньше указанного начала.');
    selected = new Set(state.items.slice(start - 1, index + 1).map(item => item.id));
    say('Найдена «' + state.items[index].title + '». Выбрано ' + selected.size + ' песен до неё включительно. Нажмите «Скачать выбранные».');
  }
  async function collect(resume, target, action) {
    mode = 'collect'; await scan(); await gate();
    const box = scrollBox();
    if (!box) throw new Error('Не найден прокручиваемый список. Откройте «Моя музыка», прокрутите песни немного вручную и повторите.');
    if (!resume) { state.items = []; selected.clear(); state.scroll = 0; state.target = target || null; state.collectAction = action || 'collect'; }
    state.collecting = true; await save();
    box.scrollTop = resume ? state.scroll : 0;
    await sleep(1000);
    let stable = 0, previousSize = -1, previousHeight = -1;
    for (let step = 0; step < 20000; step++) {
      await gate(); await scan(); await gate(); state.scroll = box.scrollTop;
      const index = endpoint();
      if (index >= 0) { selectThrough(index); state.collecting = false; await save(); render(true); return; }
      say('Автосбор: ' + state.items.length + ' песен' + (state.target ? '. Ищу «' + state.target.name + '»…' : '.'));
      const bottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 5;
      stable = bottom && previousSize === state.items.length && previousHeight === box.scrollHeight ? stable + 1 : 0;
      if (stable >= 8) {
        state.collecting = false; await save();
        if (state.target) throw new Error('Песня не найдена среди ' + state.items.length + ' собранных. Проверьте название и исполнителя. Ничего не отправлено на скачивание.');
        say('Собрано ' + state.items.length + '. Новые строки не появлялись 8 секунд. Полноту сравните со счётчиком ОК.'); return;
      }
      previousSize = state.items.length; previousHeight = box.scrollHeight;
      await save(); box.scrollTop += Math.max(100, box.clientHeight * 0.65); await sleep(1000);
    }
    throw new Error('Достигнут предел автопрокрутки. Список сохранён.');
  }
  function resolveTrack(id) {
    return new Promise((resolve, reject) => {
      let job, done = false;
      const finish = (error, links) => { if (done) return; done = true; clearTimeout(timer); cancelRequest = null; if (error) { if (job) job.abort(); reject(error); } else resolve(links); };
      const timer = setTimeout(() => finish(new Error('SaveFrom не ответил за 30 секунд.')), 30000);
      cancelRequest = () => finish(new Error('Остановлено пользователем.'));
      try { job = S.getAudioLinksViaAPI([id], () => {}, links => finish(null, links)); } catch (error) { finish(error); }
    });
  }
  async function downloads() {
    mode = 'download'; let handed = 0, skipped = 0;
    while (state.queue.length) {
      await gate(); const id = state.queue[0];
      if (state.skip && state.sent[id]) { skipped++; state.queue.shift(); await save(); render(false); continue; }
      const item = state.items.find(entry => entry.id === id);
      say('Получение ссылки: ' + (item && item.title || id) + '. Осталось: ' + state.queue.length);
      let dispatched = false;
      try {
        const links = await resolveTrack(id); await gate();
        if (!links || !links.length || !links[0].url) throw new Error('SaveFrom не вернул ссылку.');
        const link = links[0]; if (item && link.title) item.title = link.title;
        state.inFlight = id; await save(); await gate();
        await Promise.resolve(GM_download({url: link.url, name: link.filename || 'music-' + id + '.mp3', saveAs: false}));
        dispatched = true;
        state.sent[id] = {time: new Date().toISOString(), uncertain: false};
        state.inFlight = null; state.queue.shift(); selected.delete(id); handed++;
        await save(); render(true);
      } catch (error) {
        if (dispatched) throw error;
        state.inFlight = null;
        if (stopped || changed()) throw error;
        state.errors.push({id, title: item && item.title || id, stage: 'загрузка', message: String(error.message || error), time: new Date().toISOString()});
        state.queue.shift(); await save(); render(false);
      }
      let remaining = Math.round(state.speed * 1000);
      while (remaining > 0) { await gate(); await sleep(Math.min(remaining, 200)); remaining -= 200; }
    }
    say('Передано браузеру: ' + handed + '. Пропущено повторов: ' + skipped + '. Ошибки — в отчёте. Файлы проверяйте через Ctrl+J.');
  }
  async function run(fn) {
    if (busy) return;
    busy = true; paused = stopped = false; runPage = page; runLayer = layer(); render(true);
    try { await fn(); } catch (error) { say(String(error.message || error)); }
    finally { busy = paused = false; cancelRequest = null; mode = ''; await save().catch(error => say('Ошибка сохранения: ' + error.message)); render(true); }
  }
  $('auto').onclick = () => run(() => collect(false));
  $('all').onclick = () => run(async () => { await collect(false, null, 'download'); await gate(); state.queue = state.items.map(item => item.id); await save(); await downloads(); });
  $('until').onclick = () => run(async () => {
    const target = {name: $('target').value.trim(), artist: $('artist').value.trim(), start: Number($('start').value)};
    if (!target.name || !Number.isSafeInteger(target.start) || target.start < 1) throw new Error('Введите название и положительный номер начала.');
    await collect(false, target);
  });
  $('download').onclick = () => run(async () => { state.queue = Array.from(selected); await save(); await downloads(); });
  $('resume').onclick = () => run(async () => {
    if (state.collecting) {
      await collect(true); await gate();
      if (state.collectAction === 'download') { state.queue = state.items.map(item => item.id); await save(); await downloads(); }
    } else if (state.queue.length) await downloads();
    else say('Сохранённой очереди нет. Выберите песни.');
  });
  $('range').onclick = () => run(async () => {
    await scan(); await gate(); const start = Number($('start').value), count = Number($('count').value);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(count) || start < 1 || count < 1) throw new Error('Введите целые положительные числа.');
    if (start - 1 + count > state.items.length) throw new Error('Найдено ' + state.items.length + ', требуется ' + (start - 1 + count) + '. Используйте автосбор.');
    selected = new Set(state.items.slice(start - 1, start - 1 + count).map(item => item.id)); say('Выбрано ' + selected.size + '. Нажмите «Скачать выбранные».');
  });
  $('pause').onclick = () => { paused = !paused; render(false); say(paused ? 'Пауза. Новые файлы не отправляются.' : 'Продолжаю…'); };
  $('stop').onclick = () => { stopped = true; paused = false; if (cancelRequest) cancelRequest(); say('Останавливаю. Переданные браузеру файлы продолжат скачиваться.'); };
  $('clear').onclick = () => { selected.clear(); save(); render(true); };
  $('speed').onchange = () => { const value = Number($('speed').value); if (!Number.isFinite(value) || value < 0.5 || value > 60) { $('speed').value = state.speed; say('Интервал: от 0,5 до 60 секунд.'); return; } state.speed = value; save(); };
  $('skip').onchange = () => { state.skip = $('skip').checked; save(); };
  $('reset').onclick = () => { if (confirm('Очистить историю передач этого списка? Песни смогут скачаться повторно.')) { state.sent = {}; save(); render(true); } };
  $('collapse').onclick = () => { $('body').hidden = !$('body').hidden; $('collapse').textContent = $('body').hidden ? '+' : '−'; };
  $('report').onclick = () => {
    const report = {date: new Date().toISOString(), page, note: 'Передача браузеру не подтверждает сохранение.', found: state.items.length, queued: state.queue.length,
      tracks: state.items.map(item => ({...item, transfer: state.sent[item.id] || null, queued: state.queue.includes(item.id)})), errors: state.errors};
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], {type: 'application/json;charset=utf-8'}));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'ok-music-report.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  };
  try { await restore(); } catch (error) { say('Ошибка восстановления: ' + error.message); }
  setInterval(async () => {
    try {
      if (location.href !== page) {
        if (busy) { stopped = true; paused = false; if (cancelRequest) cancelRequest(); return; }
        await save(); page = location.href; await restore();
      }
      if (!busy) await scan();
    } catch (error) { if (!busy) say('Ошибка чтения: ' + error.message); }
  }, 1200);
  render(true);
}, 0);
return true;
})()
