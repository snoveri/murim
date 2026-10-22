/* Browser and Node compatible; executes precisely the shipped Murim engine. */
function runBalance(samples=1200,mode='standard') {
 const quant=(arr,p)=>{if(!arr.length)return null;const a=arr.slice().sort((a,b)=>a-b);return +a[Math.floor((a.length-1)*p)].toFixed(3);};
 const pct=(n,d)=>d?+(100*n/d).toFixed(2):0;
 const policies=mode==='leadership'?['adaptive']:['civilian','martial','hybrid','lateEntry','retired','wanderer'];
 const all=[], violations=[], paths={},examples={};
 function applyPolicy(s,policy){
   if(policy==='adaptive'){
     if(!s.sectId)s.plan=['work','seek','sword','inner'];
     else{const r=Murim.RANKS[Math.min(s.rank+1,6)];s.plan=['sword','inner','mission','inner'];
       if(s.inner>=r.inner*1.1&&Murim.skill(s.methodXP)>=r.method&&Murim.skill(s.operationXP)>=r.operation)s.plan[1]='sword';
       if(s.inner>=r.inner*1.3&&Murim.skill(s.methodXP)>=r.method+5&&Murim.skill(s.operationXP)>=r.operation+5)s.plan[3]='sword';
       if(s.rank>=4&&(s.support<65||s.reputation<72))s.plan[1]='mission';
     }
   }
   if(policy==='civilian')s.plan=['work','social','work','rest'];
   if(policy==='hybrid')s.plan=['work','sword','inner','work'];
   if(policy==='martial')s.plan=s.sectId?['sword','inner','mission','inner']:['work','seek','sword','inner'];
   if(policy==='lateEntry')s.plan=s.age<32?['work','social','work','rest']:s.sectId?['sword','inner','mission','inner']:['work','seek','sword','inner'];
   if(policy==='retired')s.plan=s.age>=48?['work','social','rest','rest']:s.sectId?['sword','inner','mission','inner']:['work','seek','sword','inner'];
   if(policy==='wanderer'){s.targetSect=s.age<28?'demon':s.age<46?'blood':'gaebang';if(s.sectId&&s.sectId!==s.targetSect&&s.age>=28){Murim.queue(s,'departure');Murim.dispatch(s);}s.plan=s.sectId?['sword','inner','mission','explore']:['work','seek','sword','inner'];}
 }
 function decide(s,policy){const opts=Murim.options(s),id=s.pendingEvent.id;
   const desired=[];const martial=policy==='adaptive'||policy==='martial'||policy==='wanderer'||policy==='retired'&&s.age<48||policy==='lateEntry'&&s.age>=32;
   if(id.startsWith('war-'))desired.push(policy==='civilian'?'refuge':'aid','decline','home');
   if(id==='sapa-reputation')desired.push('refuse');
   if(id==='cult-contact')desired.push('refuse');
   if(id.startsWith('join-'))desired.push(martial?'apply':'decline');
   if(['breakthrough','transmission','promotion','succession','alliance'].includes(id))desired.push(martial?'attempt':'decline','accept','stand');
   if(id==='talent')desired.push(martial?'martial':'craft');
   if(id==='manual')desired.push(martial?'keep':'sell');
   if(id==='adapt')desired.push(martial?'adapt':'preserve');
   if(id==='methodoffer')desired.push(martial?'adopt':'preserve');
   if(id==='departure')desired.push('leave');
   if(id==='bandit')desired.push(policy==='wanderer'?'fight':'flee');
   if(id==='duel')desired.push(martial?'duel':'observe');
   if(id==='retire')desired.push(policy==='retired'?'retire':'continue');
   if(id==='ruin')desired.push(martial?'wander':'civil');
   if(id==='business')desired.push(policy==='civilian'?'open':'wait');
   if(id==='marriage'||id==='child')desired.push('yes');
   if(id==='bloodorder')desired.push('reform');
   desired.push('repair','greet','craft','safe','small','learn','help','listen','respect','free','watch','accept');
   let index=-1;for(const d of desired){index=opts.findIndex(o=>o.id===d&&!o.disabled);if(index>=0)break;}
   if(index<0)index=opts.findIndex(o=>!o.disabled);if(index<0)throw Error('No valid option '+id);
   Murim.resolveEvent(s,s.pendingEvent.uid,index);
 }
 const start=performance.now();
 for(let i=0;i<samples;i++){
   // 6 origins × 6 policies; common seed blocks keep origin/policy comparisons reproducible.
   const block=policies.length*6;
   const origin=Murim.ORIGINS[Math.floor(i/policies.length)%6].id,policy=policies[i%policies.length];
   const seed=(mode==='leadership'?30000:10000)+Math.floor(i/block);const s=Murim.createLife('무명',seed,{originId:origin,started:true});
   s.career=Murim.CAREERS[Math.floor(i/block)%6].id;s.targetSect=Murim.SECTS[Math.floor(i/block)%8].id;
   let guard=0,lastTick=s.tick;
   while(s.alive&&guard++<1200){if(s.combat){Murim.resolveCombat(s,s.combat.uid,'normal');continue;}if(s.combatResultPending){Murim.dismissCombat(s);continue;}if(s.pendingEvent){decide(s,policy);continue;}applyPolicy(s,policy);s.nextPlan=s.plan.slice();Murim.advanceQuarter(s);
     if(s.tick<lastTick)violations.push('time reversed');lastTick=s.tick;
   }
   if(s.alive)violations.push('life did not terminate '+i);
   if(policy==='civilian'&&(s.inner!==0||s.swordXP!==0))violations.push('civilian martial leakage '+i);
   if(!Murim.validSave(s)){let reason='';try{Murim.validSave(s,true);}catch(e){reason=e.message;}violations.push('invalid final save '+i+' '+reason);if(!globalThis.invalidLife)globalThis.invalidLife=JSON.parse(JSON.stringify(s));}
   if(s.logs.some((l,j)=>j&&l.tick<s.logs[j-1].tick))violations.push('log reversed '+i);
   if(s.resolved.length!==new Set(s.resolved).size)violations.push('duplicate commit '+i);
   const a=s.statsAt60||null;
   const row={seed,origin,policy,...Murim.summary(s),at60:a,cause:s.deathCause,ending:Murim.ending(s),everMarried:s.choices.some(c=>c.event==='marriage'&&c.choice==='yes'),survived60:!!a?.alive,rank60:a?.rank??null,inner60:a?.inner??null,career60:a?.career??null,wealth60:a?.wealth??null,transitions:s.memberships.length,memoryCount:s.memories.length,closedMemoryCount:s.memories.filter(m=>m.status==='closed').length,storyRoots:[...new Set(s.memories.map(m=>m.causeId))],activeSeconds:(s.tick-32)*3,estimatedSeconds:(s.tick-32)*3+s.choices.length*12};all.push(row);
   const key=origin+'/'+policy;if(!paths[key])paths[key]=[];paths[key].push(row);
   if(s.successorFlag&&!examples[origin+'/'+s.officeId])examples[origin+'/'+s.officeId]={seed,origin,policy,office:s.officeId,age:s.age,inner:s.inner,choices:s.choices,sequence:s.milestones};
 }
 function aggregate(rows){const alive60=rows.filter(r=>r.at60?.alive);return {n:rows.length,survival60:pct(alive60.length,rows.length),deathAge:{p10:quant(rows.map(r=>r.age),.1),p50:quant(rows.map(r=>r.age),.5),p90:quant(rows.map(r=>r.age),.9)},at60:{n:alive60.length,inner:{p50:quant(alive60.map(r=>r.at60.inner),.5),p90:quant(alive60.map(r=>r.at60.inner),.9),p99:quant(alive60.map(r=>r.at60.inner),.99)},career:{p10:quant(alive60.map(r=>r.at60.career),.1),p50:quant(alive60.map(r=>r.at60.career),.5),p90:quant(alive60.map(r=>r.at60.career),.9),over90:pct(alive60.filter(r=>r.at60.career>=90).length,alive60.length)},wealth:{p10:quant(alive60.map(r=>r.at60.wealth),.1),p50:quant(alive60.map(r=>r.at60.wealth),.5),p90:quant(alive60.map(r=>r.at60.wealth),.9)},ranks:Murim.RANKS.map((r,j)=>({rank:r.name,n:alive60.filter(x=>x.at60.rank===j).length})),leadership:alive60.filter(r=>['장문인','가주','천마','혈마','무림맹주','사도련주','방주'].includes(r.at60.office)).length,seniorInner:{n:alive60.filter(r=>r.at60.office).length,p50:quant(alive60.filter(r=>r.at60.office).map(r=>r.at60.inner),.5),p90:quant(alive60.filter(r=>r.at60.office).map(r=>r.at60.inner),.9)}},family:{everMarriedPercent:pct(rows.filter(r=>r.everMarried).length,rows.length),survivingSpousePercent:pct(rows.filter(r=>r.married).length,rows.length),childrenP50:quant(rows.map(r=>r.children),.5)},transitionsPercent:pct(rows.filter(r=>r.transitions>0).length,rows.length),debtAt60Percent:pct(alive60.filter(r=>r.at60.wealth<0).length,alive60.length),eventualLeadership:rows.filter(r=>['장문인','가주','천마','혈마','무림맹주','사도련주','방주'].includes(r.office)).length,events:{at60P50:quant(alive60.map(r=>r.at60.events),.5),at60P90:quant(alive60.map(r=>r.at60.events),.9),p50:quant(rows.map(r=>r.events),.5),p90:quant(rows.map(r=>r.events),.9)},minutes:{activeP50:quant(rows.map(r=>r.activeSeconds/60),.5),with12secChoicesP50:quant(rows.map(r=>r.estimatedSeconds/60),.5),with12secChoicesP90:quant(rows.map(r=>r.estimatedSeconds/60),.9)},narrative:{memoriesP50:quant(rows.map(r=>r.memoryCount),.5),closedP50:quant(rows.map(r=>r.closedMemoryCount),.5),roots:Object.fromEntries([...new Set(rows.flatMap(r=>r.storyRoots))].map(id=>[id,rows.filter(r=>r.storyRoots.includes(id)).length]))},causes:Object.fromEntries([...new Set(rows.map(r=>r.cause))].map(c=>[c,rows.filter(r=>r.cause===c).length]))};}
 globalThis.balanceRows=all;
 const pairs={compared:0,martialRicher:0,civilianRicher:0,tied:0};
 if(mode==='standard')for(let i=0;i<all.length;i+=6){const c=all[i],m=all[i+1];if(c?.at60?.alive&&m?.at60?.alive){pairs.compared++;const diff=m.at60.wealth-c.at60.wealth;if(diff>0)pairs.martialRicher++;else if(diff<0)pairs.civilianRicher++;else pairs.tied++;}}
 return {version:Murim.VERSION,date:'2026-10-22',samples,elapsedMs:Math.round(performance.now()-start),eventDefinitions:Murim.EVENTS.length,design:mode==='leadership'?'6 origins × 8 target sects × 24 seed scenarios; adaptive training; holdout seeds 30000–30191; prior 20000-series used for development; full life on production engine':'6 origins × 6 policies; balanced complete blocks; common stateless random channels; full life 8 to natural death, protected childhood 0–7; same production engine',choiceReadingSecondsAssumed:12,violations:violations.slice(0,30),violationCount:violations.length,overall:aggregate(all),byPolicy:Object.fromEntries(policies.map(p=>[p,aggregate(all.filter(r=>r.policy===p))])),byOriginPolicy:Object.fromEntries(Object.entries(paths).map(([k,v])=>[k,aggregate(v)])),pairedWealth:pairs,leadershipExamples:examples};
}
