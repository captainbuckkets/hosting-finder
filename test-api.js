// Local test harness for the API handlers (no Vercel needed).
const search = require('./api/search');
const provider = require('./api/provider');
const stats = require('./api/stats');
const go = require('./api/go');

function mockReq(query = {}, headers = {}) {
  return { query, headers, socket: { remoteAddress: '127.0.0.1' } };
}
function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.headers = {};
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (obj) => { res.body = obj; return res; };
  res.redirect = (c, url) => { res.statusCode = c; res.headers.Location = url; res.body = { redirect: url }; return res; };
  res.writeHead = (c, h) => { res.statusCode = c; Object.assign(res.headers, h || {}); };
  res.end = () => res;
  return res;
}

function run(name, handler, query, headers) {
  const req = mockReq(query, headers);
  const res = mockRes();
  handler(req, res);
  console.log(`\n=== ${name} (HTTP ${res.statusCode}) ===`);
  console.log(JSON.stringify(res.body, null, 1).slice(0, 1200));
}

run('stats', stats, {});
run('search: VPS in Germany, max $10', search, { type: 'vps', country: 'Germany', max_price: '10' });
run('search: crypto VPS', search, { type: 'vps', crypto: 'true', limit: '5' });
run('search: DMCA-ignored dedicated', search, { type: 'dedicated', dmca: 'ignored', limit: '5' });
run('search: no-KYC', search, { kyc: 'none', limit: '5' });
run('provider H0001', provider, { id: 'H0001' });
run('search: free-text hetzner', search, { q: 'hetzner' });
// Click tracker: affiliate click, website click, unknown id, debug mode.
run('go: affiliate click H0318 (GreenGeeks)', go, { id: 'H0318', src: 'skill' });
run('go: website click H0001 (Hetzner, no affiliate)', go, { id: 'H0001', src: 'web' });
run('go: unknown id', go, { id: 'H9999', src: 'skill' });
run('go: debug H0195 (Hosting.com)', go, { id: 'H0195', src: 'api', debug: '1' });
run('search: check click_url present', search, { q: 'greengeeks' });
run('stats after clicks', stats, {});
console.log('\nAll local tests ran.');
