const fs=require('fs');const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const code=html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)[1];fs.writeFileSync('/tmp/s.js',code);
let ok=true;const fail=m=>{ok=false;console.log('FAIL',m)};
require('child_process').execSync('node --check /tmp/s.js');console.log('1 syntax ok');
const X=require('./load.js');
let extra='';
const names=X.P.map(p=>p.n);const uniq=new Set(names);if(names.length!==uniq.size)fail('duplicates '+names.filter((n,i)=>names.indexOf(n)!==i));else console.log('2 no duplicates, roster',names.length);
// raw grep duplicates incl quote styles
const raw=[...code.matchAll(/\{n:(?:'((?:[^'\\]|\\.)*)'|"([^"]*)")/g)].map(m=>(m[1]||m[2]).replace(/\\'/g,"'"));if(raw.length!==new Set(raw).size)fail('raw dupes');
let dang=0;for(const p of X.P)if(p.partner&&!uniq.has(p.partner)){fail('partner '+p.n+'->'+p.partner);dang++}console.log('3 dangling partners',dang);
let cf=0;for(const p of X.P){for(const wk of [null,4,5,6]){try{const no=X.neutralOptsFor(p,wk);if(no.isBye)continue;const r=X.computeProjection(p,no.opts);if(!isFinite(r.ppr))throw new Error('NaN')}catch(e){cf++;fail('compute '+p.n+' wk'+wk+' '+e.message)}}}console.log('4 compute failures',cf);
const names2=Object.keys(X.PLAYER_AVAILABILITY);let miss=0;for(const n of names2)if(!uniq.has(n)){miss++;fail('avail name '+n)}
for(const w in X.AVAILABILITY_WEEK_OVERRIDES)for(const n in X.AVAILABILITY_WEEK_OVERRIDES[w]){if(!uniq.has(n)){miss++;fail('override '+n)}const r=X.AVAILABILITY_WEEK_OVERRIDES[w][n].replacement;if(r&&!uniq.has(r)){miss++;fail('replacement '+r)}}
console.log('6 availability unresolved',miss);
// DVP tables cover all teams
for(const T of ['QB','RB','WR','TE']){const n=Object.keys(X[T+'_MATCHUP_ADJ']).length;if(n!==32)fail(T+' table has '+n)}
// every P team valid and every sch opp valid
for(const p of X.P)if(!X.TEAMS[p.t])fail('team '+p.n+' '+p.t);
console.log(ok?'ALL OK':'FAILURES');
