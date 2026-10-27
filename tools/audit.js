const { chromium } = require('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const pg=await b.newPage();
 const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('file://'+require('path').join(__dirname,'..','index.html'));await pg.waitForTimeout(600);
 for(const wk of [5,6,9]){
  await pg.selectOption('#globalWeek',String(wk));await pg.waitForTimeout(150);
  const r=await pg.evaluate((wk)=>{
   const out={browseDiff:[],slateDiff:[],bettingDiff:[],n:0};
   const eng={};
   for(const p of P){const no=neutralOptsFor(p,wk);if(no.isBye||no.isOut)continue;eng[p.n]=computeProjection(p,no.opts).ppr}
   for(const p of P){ if(!(p.n in eng))continue;selectPlayer(p);setWeek(String(wk));
     const v=parseFloat(document.getElementById('fpts-ppr').textContent);out.n++;
     if(Math.abs(v-eng[p.n])>0.051)out.browseDiff.push([p.n,v,+eng[p.n].toFixed(2)]);}
   // week board: every listed player's projected stat must equal the engine
   document.getElementById('slateGameFilter').value='ALL';document.getElementById('slateTopN').value='25';renderSlate();
   const sec=[...document.querySelectorAll('#wbSections .wb-sec')];out.slateSecs=sec.length;
   for(const [si,col] of [[0,-1],[1,-1]]){const wantLab=si===0?'Rush Yards':'Rec Yards';
     for(const tr of sec[si].querySelectorAll('tbody tr.wb-row')){const c=[...tr.children].map(x=>x.innerText.trim());c[1]=c[1].replace(/[ \u26a0?]+$/,'');const p=P.find(q=>q.n===c[1]);const v=parseFloat(c[c.length-1]);
       const no=neutralOptsFor(p,wk);const l=computeProjection(p,no.opts).lines.find(x=>x.label===wantLab);if(Math.abs(v-l.val)>0.051)out.slateDiff.push([c[1],wantLab,v,l.val])}}
   for(const tr of sec[2].querySelectorAll('tbody tr.wb-row')){const c=[...tr.children].map(x=>x.innerText.trim());c[1]=c[1].replace(/[ \u26a0?]+$/,'');const p=P.find(q=>q.n===c[1]);const no=neutralOptsFor(p,wk);const r=computeProjection(p,no.opts);
     const g=l=>(r.lines.find(x=>x.label===l)||{val:0}).val;const pr=1/(1-Math.exp(-(g('Rush TD')+g('Rec TD'))));if(Math.abs(parseFloat(c[c.length-1])-pr)>0.011)out.slateDiff.push([c[1],'odds',c[c.length-1],pr])}
   for(const tr of sec[3].querySelectorAll('tbody tr.wb-row')){const c=[...tr.children].map(x=>x.innerText.trim());c[1]=c[1].replace(/[ \u26a0?]+$/,'');const p=P.find(q=>q.n===c[1]);const no=neutralOptsFor(p,wk);const l=computeProjection(p,no.opts).lines.find(x=>x.label==='Pass Yards');if(Math.abs(parseFloat(c[6])-l.val)>0.51)out.slateDiff.push([c[1],'passY',c[6],l.val])}
   // no unavailable player may appear
   document.querySelectorAll('#wbSections tr.wb-row').forEach(tr=>{const nm=tr.children[1].innerText.replace(/[ \u26a0?]+$/,'');const p=P.find(q=>q.n===nm);if(p){const no=neutralOptsFor(p,wk);if(no.isOut||no.isBye)out.slateDiff.push([nm,'unavailable listed'])}});
   // betting: every game
   const sel=document.getElementById('bettingGameFilter');renderBetting();
   for(const o of [...sel.options]){sel.value=o.value;renderBetting();
     for(const tr of document.querySelectorAll('#bettingResults tbody tr')){const c=[...tr.children].map(x=>x.innerText.trim());if(c[0] in eng&&Math.abs(parseFloat(c[c.length-1])-eng[c[0]])>0.051)out.bettingDiff.push([c[0],c[c.length-1],eng[c[0]]])}}
   return out},wk);
  console.log('week',wk,'players checked',r.n,'| browse',r.browseDiff.length,'slate',r.slateDiff.length,'betting',r.bettingDiff.length);
  for(const k of ['browseDiff','slateDiff','bettingDiff'])if(r[k].length)console.log(k,JSON.stringify(r[k].slice(0,8)));
 }
 console.log('page errors',errs.length,errs.slice(0,3));
 await b.close()})();
