const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const { loadApi } = require('./load-api.cjs');

(async () => {
  const api = loadApi();
  const group = { id:'group', 이름:'KT 통신요금', 금액:400000, 최대:400000, 매달:11, 사람:'공동', 문자로기록됨:'Y', 사용:'Y', 출금:'Test Card', 문자이름:'KT통신요금', 시작월:'2026-11', 결제건수:3 };
  api.initialize({ 고정지출:[group], 카드:[{ id:'card', 이름:'Test Card', 주인:'테스트', 인식단어:'신한카드', 이용시작일:2, 결제일:15, 사용:'Y' }], 거래:[310000,110000,9000].map((금액,i)=>({id:'tx'+i,날짜:'2026-11-11 09:1'+i,사람:'테스트',카드:'Test Card',가맹점:'KT통신요금',금액,분류:'고정지출',출처:'문자',상태:'확정'})), 설정:[{항목:'월수입',값:'3000000'}] });
  const data = api.value("bootstrap_('2026-11')");
  const html = fs.readFileSync(path.join(__dirname,'../index.html'));
  const server = http.createServer((req,res)=>{ res.setHeader('Content-Type','text/html;charset=utf-8'); res.end(html); });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser = await chromium.launch({ headless:true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}) });
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];let saved;
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://daysucvaoormvckvqgsn.supabase.co/**', async route => {
      saved=JSON.parse(route.request().postData() || '{}');
      await route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,r:{data,result:{id:'group'}}})});
    });
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.evaluate(d=>{ S.d=d;S.ym=d.ym;S.view='plan';$('lock').classList.remove('on');$('loading').classList.add('off');render(); }, data);
    await page.locator('[data-fixed="group"]').waitFor();
    assert.match(await page.locator('[data-fixed="group"]').innerText(),/429,000원/);
    assert.match(await page.locator('[data-fixed="group"]').innerText(),/3\/3건 결제됨/);
    await page.locator('[data-fixed="group"]').click();
    assert.equal(await page.locator('#x_amt').inputValue(),'400000');
    assert.equal(await page.locator('#x_count').inputValue(),'3');
    assert.equal(await page.locator('#x_rangewrap').isVisible(),false);
    assert.match(await page.locator('#sheet').innerText(),/카드 이용액에 이미 포함/);
    await page.screenshot({path:process.env.KT_UI_SCREENSHOT || '/tmp/kt-group-mobile.png',fullPage:true});
    // Editing the only visible budget field must override the previous saved maximum.
    await page.locator('#x_amt').fill('410000');
    await page.locator('#i_save').click();
    await page.waitForFunction(()=>!document.body.classList.contains('busy'));
    assert.equal(saved.payload.item['최대'],410000); assert.equal(saved.payload.item['금액'],410000);
    assert.equal(saved.payload.item['결제건수'],3); assert.equal(saved.action,'saveItem');
    await page.setViewportSize({width:320,height:740});
    await page.evaluate(d=>{ d.summary.fixedStatus.group={amount:400000,est:400000,actual:false,n:1,expected:3,paid:310000,over:0,txIds:['tx0']}; S.d=d;renderPlan(); },data);
    assert.match(await page.locator('[data-fixed="group"]').innerText(),/1\/3건 확인/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    assert.deepEqual(errors,[]);
    console.log('Mobile UI passed: progress, details, single maximum field, save payload, 320px layout, no JS errors.');
  } finally { await browser.close();server.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
