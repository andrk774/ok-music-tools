/* Inserted inside the OK module; uses SaveFrom's existing audio resolver and queue. */
(function () {
  setTimeout(function () {
    if (document.getElementById('sf-ok-batch')) return;
    const panel = document.createElement('div');
    panel.id = 'sf-ok-batch';
    panel.style.cssText = 'position:fixed;bottom:18px;left:18px;z-index:2147483647;background:#222337;color:white;padding:14px;border:2px solid #ff9800;border-radius:12px;font:14px Arial;max-width:420px;box-shadow:0 4px 24px #0008';
    panel.innerHTML = '<strong>ОК — скачать выбранное количество</strong><button data-action="collapse" style="float:right">−</button><div data-body><p>Прокрутите список музыки для подгрузки песен,<br>затем нажмите «Выбрать».</p><label>С какой песни <input data-start type="number" min="1" value="1" style="width:75px"></label> <label>Количество <input data-count type="number" min="1" value="50" style="width:75px"></label><p><button data-action="select">Выбрать</button> <button data-action="download" disabled>Скачать выбранные</button></p><div data-status role="status">Откройте нужный список музыки.</div></div>';
    document.body.appendChild(panel);
    const startInput = panel.querySelector('[data-start]');
    const countInput = panel.querySelector('[data-count]');
    const selectButton = panel.querySelector('[data-action="select"]');
    const downloadButton = panel.querySelector('[data-action="download"]');
    const status = panel.querySelector('[data-status]');
    const collectButton = document.createElement('button');
    collectButton.textContent = 'Начать сбор с начала списка';
    const collectedStatus = document.createElement('div');
    collectedStatus.textContent = 'Для большого списка: вернитесь наверх, включите сбор и медленно прокручивайте песни вниз.';
    panel.querySelector('[data-body]').appendChild(collectButton);
    panel.querySelector('[data-body]').appendChild(collectedStatus);
    let collected = new Set();
    let collectionUrl = '';
    let collectionLayer = null;
    let collecting = false;
    let collectingRead = false;
    let collectionGeneration = 0;
    async function readIds(layer) {
      const results = await Promise.all([S.getAudioLinksIds(layer), S.getNewAudioLinksIds(layer), S.getAudioFromWall(layer)]);
      return Array.from(new Set(results.flat().filter(id => id !== undefined && id !== null && id !== '').map(String)));
    }
    collectButton.onclick = function () {
      if (busy) return;
      invalidate();
      collectionGeneration++;
      if (collecting) {
        collecting = false;
        collectButton.textContent = 'Начать новый сбор с начала';
        return;
      }
      collected = new Set();
      collectionUrl = location.href;
      collectionLayer = S.getLayer() || S.getNewLayer() || document;
      collecting = true;
      collectButton.textContent = 'Остановить сбор';
      collectedStatus.textContent = 'Сбор включён. Медленно прокручивайте правый список песен.';
      collectVisible();
    };
    async function collectVisible() {
      if (!collecting || collectingRead || busy) return;
      if (location.href !== collectionUrl || (collectionLayer !== document && !collectionLayer.isConnected)) {
        collecting = false;
        collected.clear();
        collectionGeneration++;
        invalidate();
        collectButton.textContent = 'Начать сбор с начала списка';
        collectedStatus.textContent = 'Страница изменилась. Начните новый сбор.';
        return;
      }
      collectingRead = true;
      const generation = collectionGeneration;
      try {
        const ids = await readIds(collectionLayer);
        if (generation !== collectionGeneration) return;
        ids.forEach(id => collected.add(id));
        collectedStatus.textContent = 'Накоплено песен: ' + collected.size + '. Номера идут в порядке обнаружения. Не переключайте сборник во время сбора.';
      } catch (error) {
        if (generation === collectionGeneration) collectedStatus.textContent = 'Ошибка сбора: ' + (error.message || error);
      } finally { collectingRead = false; }
    }
    setInterval(collectVisible, 700);
    let selected = [];
    let sourceUrl = '';
    let sourceLayer = null;
    let playlistName = '';
    let busy = false;
    function invalidate() {
      selected = [];
      downloadButton.disabled = true;
      status.textContent = 'Нажмите «Выбрать», чтобы обновить выбор.';
    }
    startInput.addEventListener('input', invalidate);
    countInput.addEventListener('input', invalidate);
    panel.querySelector('[data-action="collapse"]').onclick = function () {
      const body = panel.querySelector('[data-body]');
      body.hidden = !body.hidden;
      this.textContent = body.hidden ? '+' : '−';
    };
    selectButton.onclick = async function () {
      if (busy) return;
      invalidate();
      const start = Number(startInput.value), count = Number(countInput.value);
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(count) || start < 1 || count < 1) {
        status.textContent = 'Введите целые положительные числа.';
        return;
      }
      busy = true;
      selectButton.disabled = true;
      status.textContent = 'Читаю список песен…';
      try {
        const layer = S.getLayer() || S.getNewLayer() || document;
        const visibleIds = await readIds(layer);
        const useCollection = collectionUrl === location.href && collectionLayer === layer && (collecting || collected.size > 0);
        if (useCollection) visibleIds.forEach(id => collected.add(id));
        const ids = useCollection ? Array.from(collected) : visibleIds;
        const end = start - 1 + count;
        if (!Number.isSafeInteger(end) || end > ids.length) {
          status.textContent = 'Найдено ' + ids.length + ' песен. Для выбранного диапазона нужно ' + end + '. Прокрутите список дальше или уменьшите количество.';
          return;
        }
        selected = ids.slice(start - 1, end);
        sourceUrl = location.href;
        sourceLayer = layer;
        playlistName = S.getPlaylistName(layer) || S.getNewPlaylistName(layer) || 'Музыка ОК';
        status.textContent = 'Найдено: ' + ids.length + '. Выбрано: ' + selected.length + ' (№ ' + start + '–' + end + ').';
        downloadButton.disabled = false;
      } catch (error) {
        status.textContent = 'Не удалось прочитать список: ' + (error.message || error);
      } finally {
        busy = false;
        selectButton.disabled = false;
      }
    };
    downloadButton.onclick = async function () {
      if (!selected.length || busy) return;
      if (location.href !== sourceUrl || (sourceLayer !== document && !sourceLayer.isConnected)) {
        invalidate();
        return;
      }
      const ids = selected.slice();
      selected = [];
      busy = true;
      selectButton.disabled = true;
      downloadButton.disabled = true;
      startInput.disabled = countInput.disabled = true;
      status.textContent = 'Получение ссылок: 0 / ' + ids.length;
      try {
        const links = await new Promise(function (resolve, reject) {
          let job, timer, done = false;
          function finish(error, result) {
            if (done) return;
            done = true;
            clearTimeout(timer);
            if (error) { if (job) job.abort(); reject(error); }
            else resolve(result);
          }
          function watchdog() {
            clearTimeout(timer);
            timer = setTimeout(function () { finish(new Error('SaveFrom не ответил за 30 секунд при получении ссылок.')); }, 30000);
          }
          watchdog();
          try {
            job = S.getAudioLinksViaAPI(ids.slice(), function (completed, total) {
              if (done) return;
              status.textContent = 'Получение ссылок: ' + completed + ' / ' + total;
              watchdog();
            }, function (result) { finish(null, result); });
          } catch (error) { finish(error); }
        });
        if (!links.length) throw new Error('SaveFrom вернул 0 ссылок. Проверьте, скачивается ли эта песня отдельной оранжевой стрелкой.');
        if (typeof GM_download !== 'function') throw new Error('Менеджер скриптов не предоставил GM_download.');
        let completed = 0;
        for (const link of links) {
          status.textContent = 'Передача браузеру ' + (completed + 1) + ' / ' + links.length + ': ' + (link.title || link.filename || 'песня');
          // OrangeMonkey rejects download callbacks (not_supported_events).
          // Use the same callback-free call as the original SaveFrom helper.
          await Promise.resolve(GM_download({url: link.url, name: link.filename || 'music.mp3', saveAs: false}));
          await new Promise(resolve => setTimeout(resolve, 1500));
          completed++;
        }
        selected = [];
        status.textContent = 'Передано на скачивание: ' + completed + ' из выбранных ' + ids.length + (completed < ids.length ? '. Для остальных SaveFrom не вернул ссылки.' : '') + '. Завершение проверьте в загрузках Chrome (Ctrl+J).';
      } catch (error) {
        status.textContent = 'Ошибка: ' + (error.message || error);
      } finally {
        busy = false;
        selectButton.disabled = false;
        startInput.disabled = countInput.disabled = false;
        downloadButton.disabled = !selected.length;
      }
    };
  }, 0);
  return true;
})()
