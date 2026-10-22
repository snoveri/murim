(async()=>{
 const results=[],snapshot=state,oldTab=detailTab;
 const check=(name,fn)=>{try{if(!fn())throw Error('Assertion failed');results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.message});}};
 state=Murim.createLife('소연',771,{originId:'noble',started:true});
 navigate('character');detailTab='기본';render();
 check('V-016 actual noble clan displays 남궁세가 instead of its internal ID',()=>document.querySelector('.character-body').textContent.includes('남궁세가')&&!document.querySelector('.character-body').textContent.includes('namgung'));
 check('V-017 character intro and contextual panel have equal width',()=>Math.abs(document.querySelector('.character-intro').getBoundingClientRect().width-document.querySelector('.detail-side').getBoundingClientRect().width)<1);
 check('V-017 mind method is merged into martial learning navigation',()=>![...document.querySelectorAll('[data-detail]')].some(b=>b.dataset.detail==='심법'));
 for(const tab of ['기본','능력','무공','생업','상태','업적','용어']){detailTab=tab;render();check('Detail '+tab+' has radar only when appropriate',()=>!!document.querySelector('.radar')===(tab==='능력'));}
 document.querySelector('[data-term="내력"]').click();check('Glossary lookup scrolls inside detail without leaving the screen',()=>view==='character'&&detailTab==='용어');
 detailTab='무공';state.learnedSkills=[{name:'나한권',source:'shaolin',age:18,weapon:'권'},{name:'이십사수매화검법',source:'huashan',age:25,weapon:'검',tier:'비전'}];render();
 document.querySelector('[data-learning="art-1"]').click();
 check('V-017 clicking a learned art opens its utility, limits and growth explanation',()=>document.querySelector('.character-bio').textContent.includes('이십사수매화검법')&&document.querySelector('.character-bio').textContent.includes('연환')&&document.querySelector('.character-bio').textContent.includes('22 XP'));
 detailTab='생업';render();document.querySelector('[data-career-detail="doctor"]').click();
 check('Career detail selection explains its story without silently changing career',()=>state.career==='farmer'&&document.querySelector('.character-bio').textContent.includes('환자'));
 detailTab='상태';render();check('Status uses RPG numeric rows',()=>document.querySelectorAll('.rpg-stats meter').length===8);
 state.rumors=[];const first=Murim.hearRumor(state,'manual',true);first.place=Murim.PLACES.find(p=>p.name!==state.location).name;Murim.hearRumor(state,'trade',true);Murim.hearRumor(state,'relief',true);navigate('chronicle');
 check('V-020 all active rumors remain visible rather than only the newest two',()=>document.querySelectorAll('[data-rumor]').length===3);
 const before=state.location;document.querySelector(`[data-rumor="${first.id}"]`).click();
 check('V-020 looking at a rumor asks about travel and states its price',()=>$('modal').open&&$('modal').textContent.includes('이동할까요')&&$('modal').textContent.includes('2냥')&&state.location===before&&state.travelTarget===null);
 document.querySelector(`[data-rumor-confirm="${first.id}"]`).click();
 check('V-020 confirmed trip reserves travel then investigation and keeps other rumors',()=>state.travelTarget===first.place&&state.targetRumorId===first.id&&state.plan.includes('travel')&&state.plan.includes('investigate')&&state.rumors.length===3);
 state=Murim.createLife('소연',18,{started:true});Murim.queue(state,'chain-guest');Murim.dispatch(state);navigate('event');
 check('V-023 a four-way chain displays its actor and known costs',()=>document.querySelectorAll('[data-choice]').length===4&&document.querySelector('.event-copy').textContent.includes(Murim.eventPresentation(state).actor)&&[...document.querySelectorAll('.choice-result')].some(b=>b.textContent.includes('3냥')));
 state.pendingEvent=null;state.eventQueue=[];state.age=104;state.q=3;state.tick=419;state.plan=['rest','rest','rest','rest'];state.nextPlan=state.plan.slice();state.lastEventTick=100000;Murim.advanceQuarter(state);navigate('chronicle');
 check('V-021 death first presents name, cause and life narrative above the ending',()=>!!$('passingOverlay')&&$('passingOverlay').textContent.includes('소연')&&$('passingOverlay').textContent.includes(state.deathCause)&&$('main').inert);
 document.querySelector('[data-action="finishPassing"]').click();await new Promise(resolve=>setTimeout(resolve,750));
 check('V-021 closing farewell reveals the complete biography and restores controls',()=>!$('passingOverlay')&&state.deathPresented&&!$('main').inert&&!!document.querySelector('.life-recap'));
 state=snapshot;detailTab=oldTab;selectedLearning='';selectedCareer='';selectedAchievement='';navigate('chronicle');return results;
})()
