const { chromium } = require('playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const pg=await b.newPage();
 const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('file://'+require('path').join(__dirname,'..','index.html'));await pg.waitForTimeout(600);
 for(const wk of [5,6,9]){
  await pg.selectOption('#globalWeek',String(wk));await pg.waitForTimeout(150);
  const r=await pg.evaluate((wk)=>{
   const out={browseDiff:[],rankDiff:[],slateDiff:[],bbDiff:[],bettingDiff:[],n:0};
   const eng={};
   for(const p of P){const no=neutralOptsFor(p,wk);if(no.isBye||no.isOut)continue;eng[p.n]=computeProjection(p,no.opts).ppr}
   for(const p of P){ if(!(p.n in eng))continue;selectPlayer(p);setWeek(String(wk));
     const v=parseFloat(document.getElementById('fpts-ppr').textContent);out.n++;
     if(Math.abs(v-eng[p.n])>0.051)out.browseDiff.push([p.n,v,+eng[p.n].toFixed(2)]);}
   // rankings
   for(const pos of ['QB','RB','WR','TE']){rankPos=pos;rankFmt='ppr';renderRankings();
     for(const tr of document.querySelectorAll('#rankBody tr')){const c=[...tr.children].map(x=>x.innerText.trim());const nm=c[1];if(nm in eng){const v=parseFloat(c[c.length-2]);if(!isNaN(v)&&Math.abs(v-eng[nm])>0.051)out.rankDiff.push([nm,v,+eng[nm].toFixed(2)])}}}
   slatePos='ALL';renderSlate();
   for(const tr of document.querySelectorAll('#slateBody tr')){const c=[...tr.children].map(x=>x.innerText.trim());if(c[1] in eng&&Math.abs(parseFloat(c[4])-eng[c[1]])>0.051)out.slateDiff.push([c[1],c[4],eng[c[1]]])}
   renderBigBoard();
   for(const row of document.querySelectorAll('.bb-row')){const nm=row.querySelector('.bb-name').innerText;const v=parseFloat(row.querySelector('.bb-pts').innerText);if(nm in eng&&Math.abs(v-eng[nm])>0.051)out.bbDiff.push([nm,v,eng[nm]])}
   // betting: every game
   const sel=document.getElementById('bettingGameFilter');renderBetting();
   for(const o of [...sel.options]){sel.value=o.value;renderBetting();
     for(const tr of document.querySelectorAll('#bettingResults tbody tr')){const c=[...tr.children].map(x=>x.innerText.trim());if(c[0] in eng&&Math.abs(parseFloat(c[c.length-1])-eng[c[0]])>0.051)out.bettingDiff.push([c[0],c[c.length-1],eng[c[0]]])}}
   return out},wk);
  console.log('week',wk,'players checked',r.n,'| browse',r.browseDiff.length,'rank',r.rankDiff.length,'slate',r.slateDiff.length,'bigboard',r.bbDiff.length,'betting',r.bettingDiff.length);
  for(const k of ['browseDiff','rankDiff','slateDiff','bbDiff','bettingDiff'])if(r[k].length)console.log(k,JSON.stringify(r[k].slice(0,8)));
 }
 console.log('page errors',errs.length,errs.slice(0,3));
 await b.close()})();
