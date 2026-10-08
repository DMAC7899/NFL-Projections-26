const fs=require('fs');
const html=fs.readFileSync(process.env.IDX||require('path').join(__dirname,'..','index.html'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)||html.match(/<script>([\s\S]*)<\/script>/);
let code=m[1];
function mk(){const f=function(){return mk()};return new Proxy(f,{get:(t,k)=>{if(k===Symbol.toPrimitive)return()=>'';if(k==='length')return 0;if(k==='dataset')return {};if(k==='style'||k==='classList')return mk();if(k==='children'||k==='options')return [];if(k==='value'||k==='innerHTML'||k==='textContent')return '';if(k==='forEach')return()=>{};return mk()},set:()=>true,apply:()=>mk()})}
const document=mk(), window={addEventListener(){},}, localStorage={getItem(){return null},setItem(){}};
global.document=document;global.window=window;global.localStorage=localStorage;
global.navigator={};global.requestAnimationFrame=()=>{};global.setTimeout=(f)=>0;
// expose
code+='\n;globalThis.__X={QB_PRESSURE,QB_PRESSURE_LEAGUE_AVG,getBlendedBaseline,qbRushLeakMult:(typeof qbRushLeakMult!=="undefined"?qbRushLeakMult:null),computeTeamProjectedPoints,defenderInjuryFactors:(typeof defenderInjuryFactors!=="undefined"?defenderInjuryFactors:null),QB_MATCHUP_ADJ,RB_MATCHUP_ADJ,WR_MATCHUP_ADJ,TE_MATCHUP_ADJ,P,TEAMS,computeProjection,neutralOptsFor,PLAYER_AVAILABILITY,AVAILABILITY_WEEK_OVERRIDES};';
try{(0,eval)(code)}catch(e){console.error('LOAD ERR',e.message.slice(0,300)); }
module.exports=globalThis.__X;
