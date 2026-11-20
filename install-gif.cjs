const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');
const escape = text => text.replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(),'ok-install-gif-'));
  let browser;
  try { browser = await chromium.launch({channel:'chrome',headless:true}); }
  catch (_) { browser = await chromium.launch({headless:true}); }
  const topCode = fs.readFileSync(path.join(__dirname,'savefrom-ok-batch.user.js'),'utf8').split('\n').slice(0,7).join('\n');
  const steps = [
    {title:'1. Скачайте скрипт с GitHub', note:'Войдите в GitHub: репозиторий приватный. Откройте файл и нажмите Download raw file.', tab:'GitHub · andrk774 / ok-music-tools', x:949,y:300,
      body:'<div class="path">andrk774 / ok-music-tools</div><h2>savefrom-ok-batch.user.js</h2><div class="toolbar"><span>Готовый скрипт · 10.63.2.5</span><button class="focus">↓ Download raw file</button></div><pre>'+escape(topCode)+'</pre>'},
    {title:'2. Скопируйте весь код файла',note:'Откройте скачанный .user.js через «Открыть с помощью → Блокнот». Ctrl+A, затем Ctrl+C.',tab:'Блокнот · savefrom-ok-batch.user.js',x:570,y:427,
      body:'<div class="toolbar">Файл　 Правка　 Вид <span class="key">Ctrl+A → Ctrl+C</span></div><pre class="selected">'+escape(topCode)+'\n\n// … далее весь код файла …</pre><p class="tip">Копируйте весь файл, включая заголовок и код ниже.</p>'},
    {title:'3. Откройте редактор OrangeMonkey',note:'OrangeMonkey → My scripts → New. Для обновления уже установленной версии нажмите Edit.',tab:'OrangeMonkey · My scripts',x:977,y:248,
      body:'<div class="orange">◉ OrangeMonkey</div><div class="toolbar"><span>My scripts</span><button class="focus">New</button></div><div class="card"><h2>SaveFrom — ОК выбор количества</h2><p>Если эта локальная версия уже установлена:</p><button>Edit</button><button>Disable</button><span class="hint">Edit — заменить код существующего скрипта</span></div>'},
    {title:'4. Вставьте код и сохраните',note:'В поле редактора: Ctrl+A → Ctrl+V. Затем нажмите Save & Close.',tab:'OrangeMonkey · редактор скрипта',x:968,y:250,
      body:'<div class="toolbar"><span>Редактор скрипта</span><button class="focus">Save &amp; Close</button></div><pre>'+escape(topCode)+'\n\n// … полный код вставлен из скачанного файла …</pre><div class="key">Ctrl+A → Ctrl+V</div>'},
    {title:'5. Оставьте включённой одну версию',note:'У старого SaveFrom нажмите Disable. У новой версии кнопка Disable означает, что скрипт включён.',tab:'OrangeMonkey · My scripts',x:271,y:320,
      body:'<div class="card"><h2>SaveFrom.net helper — старая версия</h2><button>Edit</button><button class="focus">Disable</button></div><div class="card"><h2>SaveFrom — ОК выбор количества</h2><p>Версия 10.63.2.5 · новая</p><button>Edit</button><button>Disable</button><span class="ok">Включён</span></div>'},
    {title:'6. Обновите страницу музыки ОК',note:'Вернитесь в «Моя музыка» и нажмите F5. Должна появиться панель «ОК — музыка · v5».',tab:'ok.ru · Моя музыка',x:119,y:231,
      body:'<div class="toolbar"><button class="focus">↻ F5</button><span>Моя музыка</span></div><div class="finish"><strong>ОК — музыка · v5</strong><p><button>Автосбор</button><button>Скачать всё</button></p><p>До песни включительно: <b>Колосок</b></p><p><button>Собрать и выбрать до песни</button></p><p><button>Скачать выбранные</button><button>Продолжить очередь / сбор</button></p><p><button>Пауза</button><button>Стоп</button><button>Скачать отчёт</button></p></div><p class="tip">Сначала проверьте загрузку одной песни. Результат — Ctrl+J.</p>'}
  ];
  try {
    const page=await browser.newPage({viewport:{width:1200,height:800},deviceScaleFactor:1});
    let index=0;
    for(let step=0;step<steps.length;step++){
      const item=steps[step];
      await page.setContent(`<!doctype html><html lang="ru"><meta charset="utf-8"><style>
      *{box-sizing:border-box}body{margin:0;background:#eef1f6;color:#22263a;font-family:Arial}header{background:#222337;color:white;padding:24px 36px;height:168px}
      h1{font-size:32px;margin:0 0 14px}header p{font-size:20px;margin:0;line-height:1.4;max-width:1100px}
      .browser{margin:24px 36px;background:white;border:1px solid #d1d5de;border-radius:12px;overflow:hidden;height:520px;box-shadow:0 7px 20px #18254415}
      .tab{background:#e2e6ed;padding:13px 24px;font-size:16px}.content{padding:22px 28px}.path{color:#596780;font-size:18px}h2{font-size:22px;margin:12px 0}
      .toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;gap:15px}button{background:#f1f3f7;border:1px solid #b9c1cf;border-radius:6px;padding:10px 16px;font-size:18px;margin-right:8px}
      .focus{background:#ffe4ae;border:3px solid #ff9500}.card{border:1px solid #d7dce5;border-radius:8px;padding:18px;margin-bottom:18px}.card p{font-size:18px}
      pre{background:#f5f7fa;font:17px/1.6 Consolas,monospace;padding:20px;overflow:hidden;margin:8px 0;white-space:pre-wrap}.selected{background:#dbe9ff;color:#17498d}
      .key{display:inline-block;background:#222337;color:white;border-radius:7px;padding:10px 18px;font-size:22px}.tip{font-size:20px;color:#566077}.hint{font-size:15px;color:#697083}.orange{font-size:23px;color:#d97700}.ok{color:#17834c;font-weight:bold}
      .finish{background:#222337;color:white;border:2px solid #ff9800;border-radius:12px;padding:16px;width:670px}.finish strong{font-size:22px}.finish p{margin:8px 0}.finish button{padding:6px 10px;font-size:16px}
      footer{padding:0 36px;display:flex;justify-content:space-between;font-size:16px;color:#637087}.dots{color:#e48400;font-size:20px}
      #pointer{position:fixed;z-index:100;pointer-events:none;color:#111;font-size:44px;text-shadow:1px 1px white,-1px -1px white}#ring{position:fixed;border:4px solid #ff9100;border-radius:50%;width:50px;height:50px;pointer-events:none;display:none}
      </style><header><h1>${item.title}</h1><p>${item.note}</p></header><div class="browser"><div class="tab">${item.tab}</div><div class="content">${item.body}</div></div><footer><span>Учебная схема · OrangeMonkey уже установлен · без данных аккаунта</span><span class="dots">${steps.map((_,i)=>i===step?'●':'○').join(' ')}</span></footer><div id="pointer">➤</div><div id="ring"></div></html>`);
      const target = await page.locator('.focus, .selected').first().boundingBox();
      const point = {x:target.x + target.width * 0.65, y:target.y + target.height * 0.5};
      for(let frame=0;frame<8;frame++){
        await page.evaluate(({x,y,frame})=>{
          const offset=frame<3?(3-frame)*16:0;
          const pointer=document.querySelector('#pointer');pointer.style.left=(x+offset)+'px';pointer.style.top=(y+offset)+'px';pointer.style.transform='rotate(-110deg)';
          const ring=document.querySelector('#ring');ring.style.left=(x-5)+'px';ring.style.top=(y-6)+'px';ring.style.display=frame===3||frame===4?'block':'none';
        },{...point,frame});
        await page.screenshot({path:path.join(temp,String(index++).padStart(3,'0')+'.png')});
      }
    }
    fs.mkdirSync(path.join(__dirname,'docs'),{recursive:true});
    execFileSync(process.env.FFMPEG_PATH||'ffmpeg',['-y','-framerate','2','-i',path.join(temp,'%03d.png'),'-filter_complex','[0:v]split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3','-loop','0',path.join(__dirname,'docs','install.gif')],{stdio:'pipe'});
    console.log('Saved docs/install.gif: 6 steps, 24 seconds, 1200×800. Frames: '+temp);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
