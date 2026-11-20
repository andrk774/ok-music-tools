const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
(async () => {
  let browser;
  try { browser = await chromium.launch({channel:'chrome',headless:true}); }
  catch (_) { browser = await chromium.launch({headless:true}); }
  try {
    const page = await browser.newPage({viewport:{width:1300,height:1020},deviceScaleFactor:1});
    await page.setContent(`<!doctype html><html lang="ru"><meta charset="utf-8"><style>
      *{box-sizing:border-box}body{margin:0;font:16px Arial;background:#edf0f5;color:#242638}
      header{height:100px;padding:28px 36px;background:#fff;border-bottom:1px solid #d9dfea}
      header strong{font-size:25px}header span{float:right;font-size:14px;color:#697180;padding-top:9px}
      main{margin:24px 30px 0 560px;background:white;border-radius:16px;padding:26px;box-shadow:0 8px 30px #25365012}
      h2{margin:0 0 10px}p.note{color:#6e7583;font-size:14px;line-height:1.5}
      #music{height:600px;overflow-y:auto}.track-with-cover{position:relative;padding:20px 15px;border-bottom:1px solid #eee;min-height:82px}
      .track-with-cover_name{display:block;font-weight:bold;margin-bottom:7px}.track-with-cover_artist{display:block;font-size:14px;color:#707686}
      #music .sf-ok-pick{float:right}.footer{margin:18px 30px 0 560px;color:#6e7583;font-size:13px;line-height:1.6}
      #sf-ok-batch{left:30px!important;top:124px!important;bottom:auto!important;width:500px!important;max-height:860px!important;box-shadow:0 12px 32px #13172b33}
      #sf-ok-batch p{line-height:1.5}#sf-ok-batch [data-summary]{line-height:1.65;padding-top:8px}
      #sf-ok-batch [data-status]{color:#ffcc80}#sf-ok-batch small{display:block;line-height:1.5;color:#c1c6d8}
    </style><header><strong>ОК — загрузка музыки</strong><span>Версия 10.63.2.5 · демонстрация интерфейса</span></header>
    <main><h2>Моя музыка</h2><p class="note">Демонстрационный список · данные аккаунта не используются</p><div id="music"></div></main>
    <p class="footer">Выбор диапазона и конечной песни · Автосбор · Галочки<br>Сохранение очереди · Пауза и стоп · Отчёт по трекам</p></html>`);
    await page.evaluate(() => {
      const names=['Первый трек','Вечерний город','Дорога домой','Летний дождь','Колосок','Следующая песня','Новый день','Финальный трек'];
      const items=names.map((name,i)=>({id:String(i+1),name,artist:i===4?'ALEKS ATAMAN, FINIK':'Демо-исполнитель',title:(i===4?'ALEKS ATAMAN, FINIK':'Демо-исполнитель')+' — '+name}));
      const root=document.querySelector('#music');
      for(const item of items){const row=document.createElement('div');row.className='track-with-cover';row.dataset.trackId=item.id;const title=document.createElement('span');title.className='track-with-cover_name';title.textContent=item.name;const artist=document.createElement('span');artist.className='track-with-cover_artist';artist.textContent=item.artist;row.append(title,artist);root.append(row);}
      window.GM_getValue=()=>JSON.stringify({items,selected:['3','4','5'],sent:{'1':{time:'2026-11-20T10:00:00Z'},'2':{time:'2026-11-20T10:00:02Z'}},queue:[],errors:[],scroll:0,speed:1.5,skip:true,inFlight:null,collecting:false});
      window.GM_setValue=()=>{};
      window.GM_download=()=>{throw Error('Downloads disabled in screenshot fixture');};
      window.S={getLayer:()=>root,getNewLayer:()=>null,getAudioLinksIds:async()=>[],getNewAudioLinksIds:async()=>[],getAudioFromWall:async()=>items.map(item=>item.id)};
    });
    await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'batch-panel-v5.js'),'utf8')});
    await page.locator('#music .sf-ok-pick').first().waitFor();
    await page.locator('[data-start]').fill('3');
    await page.locator('[data-count]').fill('3');
    await page.locator('[data-range]').click();
    await page.getByText('Выбрано 3. Нажмите «Скачать выбранные».',{exact:true}).waitFor();
    fs.mkdirSync(path.join(__dirname,'docs'),{recursive:true});
    await page.screenshot({path:path.join(__dirname,'docs','preview.png'),fullPage:true});
    console.log('Saved docs/preview.png (actual UI, synthetic music data)');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
