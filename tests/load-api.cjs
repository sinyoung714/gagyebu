const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const path = require('node:path');

function loadApi(file = process.env.GAGYEBU_API_SOURCE || path.join(__dirname, '../supabase/functions/api/index.ts')) {
  const source = fs.readFileSync(file, 'utf8').replace(/^import .*\n/gm, '').replace(/^const sql = postgres.*\n/m, '');
  const context = vm.createContext({ ...crypto, Buffer, console, Date, URL, Response, AbortController, setTimeout, clearTimeout, Deno: { env: { get: () => '' }, serve: () => {} } });
  vm.runInContext(source, context, { filename: file });
  const run = code => vm.runInContext(code, context);
  const value = code => JSON.parse(JSON.stringify(run(code)));
  function initialize(objects, now = '2026-11-11 09:30') {
    context.fixtureObjects = objects;
    context.fixtureNow = now;
    run(`CUR = { book: mkBook(Object.keys(HEADERS).map(name => ({ name, ver: 1, data: [HEADERS[name].slice(), ...(fixtureObjects[name] || []).map(obj => HEADERS[name].map(h => obj[h] === undefined ? '' : obj[h]))] }))), kv: { 'p:SHEET_ID': { v: 'fixture' } }, kvDirty: new Set(), fetches: [] }; _ss = null; for (const k in _cache) delete _cache[k]; nowParts_ = () => ({str:fixtureNow, y:+fixtureNow.slice(0,4), m:+fixtureNow.slice(5,7), d:+fixtureNow.slice(8,10), ym:fixtureNow.slice(0,7)});`);
  }
  return { context, run, value, initialize };
}
module.exports = { loadApi };
