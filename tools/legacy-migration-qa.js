(()=>{
 const fixtures=globalThis.__legacy032Fixtures||[],results=[];
 for(const [i,old] of fixtures.entries()){
  const check=(name,fn)=>{try{if(!fn())throw Error('Assertion failed');results.push({name:'Actual v0.3.2 fixture '+i+': '+name,pass:true});}catch(e){results.push({name:'Actual v0.3.2 fixture '+i+': '+name,pass:false,error:e.message});}};
  const restored=Murim.migrateSave(old);
  check('accepted without losing personal facts or logs',()=>restored&&restored.seed===old.seed&&restored.money===old.money&&restored.inner===old.inner&&restored.givenName===old.givenName&&JSON.stringify(restored.logs)===JSON.stringify(old.logs));
  check('prose memory and in-flight threads are preserved',()=>restored&&JSON.stringify(restored.storyMemory)===JSON.stringify(old.storyMemory)&&JSON.stringify(restored.storyHashes)===JSON.stringify(old.storyHashes)&&JSON.stringify(restored.storyThreads)===JSON.stringify(old.storyThreads));
  check('partial quarter and pending choice or combat are preserved',()=>restored&&JSON.stringify(restored.quarterStory)===JSON.stringify(old.quarterStory)&&JSON.stringify(restored.pendingEvent)===JSON.stringify(old.pendingEvent)&&JSON.stringify(restored.combat)===JSON.stringify(old.combat));
  check('new memories do not invent a past actor',()=>restored&&restored.memories.length===0);
 }
 const resumed=Murim.migrateSave(fixtures[0]);
 try{
  const startCount=resumed.eventCounts.wayreturn||0;let guard=0;
  while((resumed.eventCounts.wayreturn||0)===startCount&&resumed.alive&&guard++<100){if(resumed.combat)Murim.resolveCombat(resumed,resumed.combat.uid,'normal');else if(resumed.combatResultPending)Murim.dismissCombat(resumed);else if(resumed.pendingEvent){const n=Murim.options(resumed).findIndex(o=>!o.disabled);Murim.resolveEvent(resumed,resumed.pendingEvent.uid,n);}else Murim.advanceQuarter(resumed);}
  results.push({name:'Actual v0.3.2 waiting chapter resumes once after migration',pass:(resumed.eventCounts.wayreturn||0)===startCount+1&&Murim.validSave(resumed)});
 }catch(e){results.push({name:'Actual v0.3.2 waiting chapter resumes once after migration',pass:false,error:e.message});}
 return results;
})()
