const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApi } = require('./load-api.cjs');

const group = { id: 'group', 이름: 'KT 통신요금', 금액: 400000, 최대: 400000, 매달: 11, 사람: '공동', 문자로기록됨: 'Y', 사용: 'Y', 출금: 'Test Card', 문자이름: 'KT통신요금', 시작월: '2026-11', 결제건수: 3 };
const card = { id: 'card', 이름: 'Test Card', 주인: '테스트', 인식단어: '신한카드', 이용시작일: 2, 결제일: 15, 사용: 'Y' };
const tx = (amount, i, patch = {}) => ({ id: 'tx' + i, 날짜: '2026-11-11 09:' + (10 + i), 사람: '테스트', 카드: 'Test Card', 가맹점: 'KT통신요금', 금액: amount, 분류: '기타', 출처: '문자', 상태: '확정', ...patch });
function app(charges = [], fixed = [group]) {
  const a = loadApi();
  a.initialize({ 카드: [card], 고정지출: fixed, 거래: charges, 설정: [{ 항목: '월수입', 값: '3000000' }, { 항목: '월급날', 값: '10' }] });
  return a;
}
const status = a => a.value("fxAmt_(readTable_('고정지출')[0], '2026-11', readTable_('거래'))");

test('reserves the full maximum until all separate charges arrive, including a small third charge', () => {
  for (const charges of [[], [210000], [210000, 150000]]) {
    const s = status(app(charges.map((n, i) => tx(n, i))));
    assert.equal(s.amount, 400000); assert.equal(s.n, charges.length); assert.equal(s.actual, false);
  }
  const s = status(app([210000, 150000, 8000].map((n, i) => tx(n, i))));
  assert.equal(s.amount, 368000); assert.equal(s.n, 3); assert.equal(s.actual, true); assert.equal(s.reserve, 0);
});

test('actual spending can exceed the estimate, both during partial arrival and after completion', () => {
  const a = app([tx(310000, 1), tx(110000, 2)]);
  assert.equal(status(a).amount, 420000); assert.equal(status(a).actual, false);
  a.run("appendObj_('거래', { id:'last', 날짜:'2026-11-11 10:00', 카드:'Test Card', 가맹점:'KT통신요금', 금액:9000 })");
  assert.equal(status(a).amount, 429000); assert.equal(status(a).over, 29000);
});

test('linking existing charges changes no transactions, card bill, or remaining money', () => {
  const a = app([210000, 150000, 8000].map((n, i) => tx(n, i)), []);
  const before = a.value("({txs:readTable_('거래'), bill:cardStmt_(readTable_('거래'),'Test Card',2,'2026-12'), remain:autoBudget_('2026-11',getSettings_())-variableSpent_('2026-11',readTable_('거래'))})");
  a.context.newGroup = group;
  a.run("saveItem_('고정지출',newGroup)");
  const after = a.value("({txs:readTable_('거래'), bill:cardStmt_(readTable_('거래'),'Test Card',2,'2026-12'), remain:autoBudget_('2026-11',getSettings_())-variableSpent_('2026-11',readTable_('거래'))})");
  assert.deepEqual(after, before);
  const flow = a.value("bootstrap_('2026-12').summary.flow");
  assert.equal(flow.items.filter(i => i.kind === 'card').reduce((a, i) => a + i.amount, 0), 368000);
  assert.equal(flow.items.filter(i => i.kind === 'fixed').length, 0);
});

test('a new month starts with the maximum and does not reuse the previous charges', () => {
  const a = app([210000, 150000, 8000].map((n, i) => tx(n, i)));
  const next = a.value("fxAmt_(readTable_('고정지출')[0], '2026-12', readTable_('거래'))");
  assert.equal(next.amount, 400000); assert.equal(next.n, 0); assert.equal(next.actual, false);
});

test('card, exact merchant, start month, income and pending status exclude unrelated transactions', () => {
  const a = app([tx(100000, 1, { 카드: 'Other Card' }), tx(100000, 2, { 가맹점: 'KT통신요금 다른상품' }), tx(100000, 3, { 날짜: '2026-10-11 09:00' }), tx(100000, 4, { 상태: '예정' }), tx(100000, 5, { 분류: '수입' })]);
  assert.equal(status(a).n, 0);
  assert.equal(a.run("cardFixOf_(readTable_('거래')[2])"), null);
});

test('an overlapping fixed item cannot count the same transaction twice', () => {
  const other = { ...group, id: 'other', 결제건수: 1, 금액: 210000, 최대: '' };
  const a = app([tx(210000, 1)], [other, group]);
  const owner = a.value("cardFixOf_(readTable_('거래')[0])");
  assert.equal(owner.id, 'group'); assert.equal(status(a).actual, false);
  const grouped = a.value("fxAmt_(readTable_('고정지출')[1], '2026-11', readTable_('거래'))");
  assert.equal(grouped.n, 1); assert.deepEqual(grouped.txIds, ['tx1']);
});

test('a same-cycle cancellation reduces the actual sum and never becomes extra variable spending', () => {
  const a = app([tx(210000, 1), tx(150000, 2), tx(8000, 3), tx(-8000, 4)]);
  assert.equal(status(a).amount, 360000); assert.equal(status(a).n, 3);
  assert.equal(a.run("variableSpent_('2026-11',readTable_('거래'))"), 0);
});

test('replaying an already-recorded SMS does not create another charge', () => {
  const a = app();
  a.context.text = '[Web발신]\n신한카드(1234)승인 테*트님 KT통신요금 자동납부 8,000원 정상 승인';
  assert.equal(a.value("addFromSms_(text,'문자')").ok, true);
  assert.equal(a.value("addFromSms_(text,'문자')").duplicate, true);
  assert.equal(a.run("readTable_('거래').length"), 1);
  assert.equal(a.run("readTable_('거래')[0]['분류']"), '고정지출');
});

test('saving groups validates count and registered card, and keeps unchanged settings on old clients', () => {
  const a = app();
  assert.throws(() => a.run("saveItem_('고정지출',{id:'group',결제건수:2.5})"), /1~31/);
  assert.throws(() => a.run("saveItem_('고정지출',{id:'group',출금:'없는 카드'})"), /카드/);
  a.run("saveItem_('고정지출',{id:'group',이름:'변경한 이름'})");
  assert.equal(a.run("readTable_('고정지출')[0]['결제건수']"), 3);
});

test('header upgrade appends a column without changing existing transaction values', () => {
  const a = app([tx(100000, 1)]);
  const before = a.value("readTable_('거래')");
  a.run("CUR.book.getSheetByName('고정지출').data.forEach(r => r.pop()); for(const k in _cache) delete _cache[k]; ensureHeaders_()");
  assert.equal(a.value("CUR.book.getSheetByName('고정지출').data[0]").at(-1), '결제건수');
  assert.deepEqual(a.value("readTable_('거래')"), before);
});
