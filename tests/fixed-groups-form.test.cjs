const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const functions = html.slice(html.indexOf('function openFixed('),html.indexOf('function openLoan('));
const fixed = {id:'group',이름:'KT 통신요금',금액:400000,최대:400000,결제건수:3,문자로기록됨:'Y',매달:11,출금:'Test Card',문자이름:'KT통신요금'};
function form() {
  const nodes={}; let collect;
  const c=vm.createContext({S:{d:{ym:'2026-11',fixed:[fixed],people:['테스트'],cards:[{이름:'Test Card',사용:'Y'}],txs:[],summary:{fixedStatus:{group:{amount:429000,paid:429000,over:29000,n:3,actual:true,txIds:[]}}}}},$:(id)=>nodes[id],v:id=>nodes[id].value,esc:v=>String(v??''),won:v=>(Number(v)||0).toLocaleString('ko-KR')+'원',opts:()=>'',srcOptions:()=>'',toast:()=>{},itemSheet:(_title,_table,_item,fields,fn)=>{collect=fn;for(const m of fields.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)){nodes[m[1]]={value:(m[0].match(/\bvalue="([^"]*)"/)||[])[1]||'',hidden:false,textContent:''};}nodes.x_how.value='Y';nodes.x_who.value='공동';}});
  vm.runInContext(functions,c);c.openFixed('group');
  return {c,nodes,collect:()=>JSON.parse(JSON.stringify(collect()))};
}
test('all inline scripts parse',()=>{for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);});
test('group form exposes one maximum field and edits it without a stale hidden maximum',()=>{
  const f=form();assert.equal(f.nodes.x_amt.value,'400000');assert.equal(f.nodes.x_rangewrap.hidden,true);
  assert.match(html,/#x_rangewrap\[hidden\]\{display:none\}/);
  f.nodes.x_amt.value='410000';f.nodes.x_amt.oninput();
  assert.match(f.nodes.x_esthint.textContent,/410,000원/);
  const saved=f.collect();assert.equal(saved.최대,410000);assert.equal(saved.금액,410000);assert.equal(saved.결제건수,3);
});
test('completed and partial group states show the right sum and count',()=>{
  const {c}=form();assert.match(c.fxView(fixed).html,/3\/3건 결제됨/);assert.match(c.fxView(fixed).html,/29,000원 초과/);
  c.S.d.summary.fixedStatus.group={amount:400000,est:400000,paid:310000,actual:false,n:1,expected:3,txIds:[]};
  assert.equal(c.fxView(fixed).amt,400000);assert.match(c.fxView(fixed).html,/1\/3건 확인/);
});
test('legacy single payments do not show group details',()=>{const {c}=form();assert.equal(c.fixedGroupInfo({id:'group'}),'');assert.equal(c.fixedGroupInfo({...fixed,결제건수:1}),'');});
