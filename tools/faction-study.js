function runFactionStudy(legacy=null){
  const clone=x=>JSON.parse(JSON.stringify(x)),percent=(n,d)=>+(100*n/Math.max(1,d)).toFixed(3);
  const combat=[],violations=[],birth={households:{},clans:{},branches:{},lineages:{}},entry=[];
  const prepare=(api,seed)=>{const s=api.createLife('실험',seed,{originId:'orphan',started:true});s.age=30;s.tick=120;s.q=0;s.health=95;s.inner=1.5;s.swordXP=2200;s.operationXP=1900;s.methodXP=1800;s.rank=3;s.innerReserve=100;s.money=100;return s;};
  const runCombats=(api,label)=>{
    for(const kind of ['duel','hostile','lethal'])for(const stance of api.COMBAT_STANCES)for(const enemyPower of [35,75,115]){
      const r={rules:label,kind,stance:stance.id,enemyPower,n:300,wins:0,dead:0,wounded:0,permanent:0,innerLoss:0,grades:{}};
      for(let i=0;i<r.n;i++){
        const s=prepare(api,'calibration-'+i),actualKind=label==='0.4.1'&&kind==='hostile'?'lethal':kind;
        s.combat={uid:'study-combat',kind:actualKind,eventId:kind==='duel'?'duel':'bandit',round:0,enemy:{name:'실험 상대',power:enemyPower,weapon:'검',style:'통제된 상대'},age:s.age,q:s.q};
        let attempts=0;while(s.combat&&attempts++<4)api.resolveCombat(s,s.combat.uid,stance.id);
        if(s.combat||!api.validSave(s)){violations.push({type:'combat',rules:label,kind,stance:stance.id,i});continue;}
        r.wins+=+!!s.lastCombat.victory;r.dead+=+!s.alive;r.wounded+=+!!s.lastCombat.damage;r.permanent+=+!!s.lastCombat.permanent;r.innerLoss+=s.lastCombat.innerLoss;r.grades[s.lastCombat.grade||'구형 단일 승패']=(r.grades[s.lastCombat.grade||'구형 단일 승패']||0)+1;
      }
      combat.push({...r,winPct:percent(r.wins,r.n),deathPct:percent(r.dead,r.n),injuryPct:percent(r.wounded,r.n),permanentPct:percent(r.permanent,r.n)});
    }
  };
  if(legacy)runCombats(legacy,'0.4.1');runCombats(Murim,'0.4.2');
  for(let i=0;i<10000;i++){const s=Murim.createLife('출생',i,{started:true});for(const [field,key] of [['households',s.householdType],['clans',s.clanId||'none'],['branches',s.branchId||'none'],['lineages',s.birthLineage]])birth[field][key]=(birth[field][key]||0)+1;if(!Murim.validSave(s)||s.sectId||s.successorFlag||s.swordXP||s.inner)violations.push({type:'birth',i});}
  for(const t of Murim.SECTS){const r={id:t.id,name:t.name,n:200,success:0,expected:0,blockedUnqualified:0};for(let i=0;i<r.n;i++){const s=prepare(Murim,'entry-calibration-'+i);s.notoriety=40;s.ethics=-40;r.expected+=Murim.entryChance(s,t);Murim.queue(s,'join-'+t.id);Murim.dispatch(s);if(!Murim.resolveEvent(s,s.pendingEvent.uid,0)||!Murim.validSave(s))violations.push({type:'entry',id:t.id,i});r.success+=+(s.sectId===t.id);}r.expectedPct=percent(r.expected,r.n);r.observedPct=percent(r.success,r.n);entry.push(r);}
  const settle=s=>{let guard=0;while(s.alive&&(s.pendingEvent||s.combat||s.combatResultPending)&&guard++<80){if(s.combat){Murim.resolveCombat(s,s.combat.uid,'flee');continue;}if(s.combatResultPending){Murim.dismissCombat(s);continue;}const opts=Murim.options(s),preferred=s.pendingEvent.id.startsWith('war-')?['refuge','decline','home']:['decline','refuse','no','wait','care','help','remember'];let idx=-1;for(const id of preferred){idx=opts.findIndex(o=>o.id===id&&!o.disabled);if(idx>=0)break;}if(idx<0)idx=opts.findIndex(o=>!o.disabled);if(idx<0){violations.push({type:'deadlock',event:s.pendingEvent.id});break;}Murim.resolveEvent(s,s.pendingEvent.uid,idx);}};
  const warStudy={n:500,livesWithWar:0,started:0,ended:0,notices:0,durations:[],martialViolations:0,pairs:{},saveFailures:0};
  for(let i=0;i<warStudy.n;i++){
    const s=Murim.createLife('민초','war-life-'+i,{started:true});s.plan=s.nextPlan=['work','social','work','rest'];
    while(s.alive&&s.age<80){settle(s);if(!s.alive)break;if(!Murim.advanceQuarter(s))break;}settle(s);
    const wars=s.world.wars;warStudy.livesWithWar+=+(wars.length>0);warStudy.started+=wars.length;warStudy.ended+=wars.filter(w=>w.status==='ended').length;warStudy.notices+=s.choices.filter(c=>c.event.startsWith('war-')&&!c.event.startsWith('war-aftermath')).length;
    for(const w of wars){warStudy.pairs[w.pairId]=(warStudy.pairs[w.pairId]||0)+1;if(w.status==='ended')warStudy.durations.push(w.endTick-w.startTick);}
    if(s.swordXP||s.inner||s.sectId)warStudy.martialViolations++;if(!Murim.validSave(s)||!Murim.migrateSave(clone(s)))warStudy.saveFailures++;
  }
  if(warStudy.martialViolations||warStudy.saveFailures)violations.push({type:'war-study',martial:warStudy.martialViolations,save:warStudy.saveFailures});
  const report={version:Murim.VERSION,combatSamples:combat.reduce((sum,r)=>sum+r.n,0),birthSamples:10000,entrySamples:entry.reduce((sum,r)=>sum+r.n,0),warLives:warStudy.n,combat,birth,entry,warStudy,violations,violationCount:violations.length};
  return report;
}
