'use strict';
const MurimDev = (() => {
  let active=false,opened=false,original=null,initial=null,snapshot=null,snapshotScheduled=[],ui=null,undo=[],records=[],scheduled=[],sequence=0,tab='사건',filter='',lastMessage='';
  const copy=x=>JSON.parse(JSON.stringify(x));
  const bridge=Murim.connectDeveloperTools(s=>active&&s===state);
  delete Murim.connectDeveloperTools;
  const requireActive=()=>{if(!active)throw Error('테스트 모드가 비활성화되어 있습니다.');};
  const busy=()=>!!(state.pendingEvent||state.combat||state.combatResultPending);
  const idle=()=>{if(busy())throw Error('진행 중인 사건·전투·결과를 먼저 마치세요.');if(!state.alive)throw Error('사망한 테스트 생애입니다. 초기화하거나 원본을 복원하세요.');};
  function record(action,result){records.push({index:records.length+1,tick:state.tick,seed:state.seed,action,result:typeof result==='string'?result:copy(result??null)});if(records.length>1000)records.shift();}
  function check(){MurimBirth.initialize(state);MurimBirth.syncMentor(state);Murim.validSave(state,true);}
  function transaction(label,fn){requireActive();const before=copy(state),scheduleBefore=copy(scheduled);try{const result=fn();check();undo.push({state:before,scheduled:scheduleBefore});if(undo.length>30)undo.shift();record(label,result);lastMessage=label+' 완료';refresh();return result;}catch(e){state=before;scheduled=scheduleBefore;lastMessage=e.message;record(label,{error:e.message});refresh();throw e;}}
  function enable(){if(active){opened=true;refresh();return;}original=state;ui={view,detailTab,selectedPlace,personIndex,settingsTab,historyTab,selectedLearning,selectedCareer,selectedAchievement,region,peopleTab,selectedQuarter};initial=copy(state);state=copy(state);state.playing=false;active=true;opened=true;undo=[];records=[];scheduled=[];sequence=0;snapshot=null;snapshotScheduled=[];lastMessage='새 테스트 세션입니다. 원본 저장 슬롯은 보호됩니다.';record('테스트 진입',{version:Murim.VERSION,contentVersion:state.contentVersion});render();refresh();}
  function disable(){if(!active)return;state=original;view=ui.view;detailTab=ui.detailTab;selectedPlace=ui.selectedPlace;personIndex=ui.personIndex;settingsTab=ui.settingsTab;historyTab=ui.historyTab;selectedLearning=ui.selectedLearning;selectedCareer=ui.selectedCareer;selectedAchievement=ui.selectedAchievement;region=ui.region;peopleTab=ui.peopleTab;selectedQuarter=ui.selectedQuarter;active=false;opened=false;original=null;clockLast=performance.now();render();refresh();}
  const fields={
    'aptitude.body':['근골',0,100],'aptitude.mind':['오성',0,100],'aptitude.social':['사회적 재능',0,100],health:['건강',0,100],fatigue:['피로',0,100],injury:['부상·내상 공용',0,100],inner:['축적 내공 갑자',0,1000],innerReserve:['가용 내력 %',0,100],operationXP:['내공 운용 XP',0,1e7],methodXP:['심법 XP',0,1e7],swordXP:['무공 공통 XP',0,1e7],knowledgeXP:['학식 XP',0,1e7],rank:['경지 번호',0,Murim.RANKS.length-1],notoriety:['악명',0,100],reputation:['명성',0,100],merit:['공적',0,1e6],trust:['사부 신뢰',0,100],support:['지지도',0,100],happiness:['행복',0,100],money:['개인 자산',0,1e7],debt:['부채',0,1e7],ethics:['의협',-100,100],creation:['창시 연구',0,100],legacy:['전승',0,1e6],'organization.treasury':['조직 자금',0,1e7]
  };
  for(const c of Murim.CAREERS)fields['careerXP.'+c.id]=[c.name+' XP',0,1e7];
  const get=(s,path)=>path.split('.').reduce((v,k)=>v?.[k],s);
  function set(path,value,mode='set'){return transaction('수치 변경 '+path,()=>{const f=fields[path];if(!f)throw Error('허용된 수치 경로가 아닙니다.');const parts=path.split('.'),key=parts.pop(),obj=parts.reduce((o,k)=>o?.[k],state);if(!obj)throw Error('조직이 없습니다. 조직 사건으로 먼저 창업하세요.');const before=Number(obj[key]||0),n=mode==='reset'?Number(get(initial,path)||0):Number(value);if(!Number.isFinite(n))throw Error('유한한 숫자를 입력하세요.');const raw=mode==='add'?before+n:mode==='subtract'?before-n:n;const after=Math.min(f[2],Math.max(f[1],path==='rank'?Math.round(raw):raw));obj[key]=after;return {path,before,after,display:path.endsWith('XP')?Murim.skill(after):after};});}
  function createNPC(spec={}){return bridge('npc',state,spec);}
  function mentorCandidates(){return state.npcs.filter(n=>n.alive&&n.age>=18&&n.martial&&n.sectId===state.sectId&&n.martialSkill>=45);}
  function setMentor(id){return transaction('사부 배정',()=>{let n=id?state.npcs.find(n=>n.id===id):null;if(!id){const c=mentorCandidates();if(!c.length)throw Error('유효한 사부가 없습니다. 지도자 NPC 생성 후 다시 시도하세요.');n=c[Math.floor(Murim.random(state,'dev-mentor',sequence++)*c.length)];}return bridge('mentor',state,{id:n?.id}).id;});}
  function ensureSect(id='huashan'){if(!state.sectId){bridge('join',state,{id});state.eventQueue=state.eventQueue.filter(e=>e.id!=='entry-plan');}return state.sectId;}
  function prepareEvent(id,context={}){
    const e=Murim.EVENTS.find(e=>e.id===id);if(!e)throw Error('이벤트 ID가 없습니다.');
    const c={...context};if(e.opts.some(o=>o.special==='alliance'))ensureSect('huashan');if(e.opts.some(o=>o.special==='join')){state.notoriety=40;state.ethics=-40;const target=state.world.sects.find(t=>t.id===e.opts.find(o=>o.special==='join').sectId);if(target)target.alive=true;}if(id.startsWith('war-')){const pair=MurimFactionLife.PAIRS.find(p=>id.includes(p.id))||MurimFactionLife.PAIRS[0];let w=state.world.wars.find(w=>w.id===c.warId)||state.world.wars.find(w=>w.status==='active');if(!w){w=bridge('war',state,{pairId:pair.id,place:state.location});state.pendingEvent=null;state.eventQueue=state.eventQueue.filter(e=>!e.id.startsWith('war-'));}c.warId=w.id;if(id.startsWith('war-aftermath')){w.status='ended';w.endTick=state.tick;w.outcome='테스트 휴전';}state.warReceipts=state.warReceipts.filter(r=>r!==id+':'+w.id);}
    if(e.opts.some(o=>['sectMethod','promotion','transmission','succession','teachingPermit'].includes(o.special))||['advice','chain-mentor','mentorloss','sect-warning'].includes(id)||id.startsWith('sect-life-')){ensureSect(id.startsWith('sect-life-')?id.slice(10):context.sectId||'huashan');c.sectId??=state.sectId;c.actorId??=state.mentorId;}
    if(['ruin','methodoffer','entry-plan'].includes(id))c.sectId??=state.sectId||'huashan';
    if(e.opts.some(o=>o.special==='adapt'))state.manual??={name:'시험 고본',principle:'중정',quality:1.3,progress:100,adapted:false};
    if(['marriage','child','spouse','separate'].includes(id)){
      let n=state.npcs.find(n=>n.id===(context.partnerId||state.spouseId));if(!n)n=createNPC({name:'시험 인연',martial:false,age:25});
      n.affinity=80;c.actorId=n.id;c.partnerId=n.id;
      if(id!=='marriage'){state.spouseId=n.id;n.role='배우자';n.married=true;n.maritalStatus='married';}else n.married=false;
    }
    if(id==='childpath'&&!state.childIds.length){const n=createNPC({name:state.surname+'시험자녀',martial:false,age:18});n.role='자녀';state.childIds.push(n.id);c.actorId=n.id;}
    if(['organization','org-crisis','orgsuccess','orgheir'].includes(id))state.organization??={type:'civilian',name:'시험 공방',treasury:55,members:3,age:0};
    const root=Object.keys(chains).find(k=>chains[k]===id);
    if(root||id==='revenge'){
      const actor=state.npcs.find(n=>n.id===c.actorId)||createNPC({name:'시험 사건 당사자'});c.actorId=actor.id;
      if(!c.memoryId){const m=bridge('remember',state,{type:id==='revenge'?'원한':'약속',event:{id:root||'bandit',uid:'dev-cause-'+(++sequence),context:{actorId:actor.id}},text:'테스트에서 명시적으로 구성한 선행 사건'});c.memoryId=m.id;c.rootCause=root||'bandit';}
    }
    return c;
  }
  const chains={inkseal:'inkreturn',waybill:'wayreturn',grainbook:'grainreturn',bladeoath:'bladereturn',familydebt:'debtreturn',physician:'physicianreturn',oldLetter:'letterreturn',pilgrim:'pilgrimreturn'};
  function eligibility(id){requireActive();const e=Murim.EVENTS.find(e=>e.id===id);if(!e)throw Error('없는 사건입니다.');let condition=false,error='';try{condition=!!e.condition(state);}catch(e){error=e.message;}const once=!!e.once&&!!state.eventCounts[id],cooldown=state.tick-(state.eventLast[id]??-1e6)<e.cooldown;return {condition,onceBlocked:once,cooldownBlocked:cooldown,busy:busy(),alive:state.alive,eligible:condition&&!once&&!cooldown&&!busy()&&state.alive,error,conditionSource:String(e.condition),triggerOnly:String(e.condition).includes('false')};}
  function event(id,{force=false,prepare=false,context={}}={}){return transaction((force?'강제':'정상')+' 사건 '+id,()=>{idle();if(!force&&!eligibility(id).eligible)throw Error('정상 발생 조건·쿨다운·생애 1회 조건을 충족하지 못했습니다.');const c=prepare?prepareEvent(id,context):context;if(force){const e=Murim.EVENTS.find(e=>e.id===id);if(!e)throw Error('없는 사건입니다.');Murim.queue(state,id,c);if(state.eventQueue.some(e=>e.id===id)){const entry=state.eventQueue.find(e=>e.id===id);state.eventQueue.splice(state.eventQueue.indexOf(entry),1);state.pendingEvent={...entry,uid:'dev:'+state.tick+':'+id+':'+(++sequence),age:state.age,q:state.q};}else state.pendingEvent={id,context:c,uid:'dev:'+state.tick+':'+id+':'+(++sequence),age:state.age,q:state.q};state.playing=false;Murim.log(state,e.title+' — 테스트 강제 발생');}else{Murim.queue(state,id,c);Murim.dispatch(state);}view='event';render();return state.pendingEvent;});}
  function combat(spec={}){return transaction('전투 시작',()=>{idle();let n=spec.npcId?state.npcs.find(n=>n.id===spec.npcId):null;if(spec.npcId&&!n?.alive)throw Error('살아 있는 상대를 선택하세요.');if(!n)n=createNPC({name:spec.name||'시험 상대',sectId:spec.sectId||null,martial:spec.civilian!==true,skill:spec.skill??65});const enemy={name:n.name,weapon:spec.weapon||'검',style:'테스트에서 지정한 실제 전력',power:Math.max(0,Math.min(200,Number(spec.power??n.martialSkill??n.skill)))};n.combatProfile=n.testCombatProfile={rank:Math.max(0,Math.min(Murim.RANKS.length-1,Number(spec.rank)||0)),inner:Number(spec.inner)||0,reserve:Number(spec.reserve??100),health:Number(spec.health??100),injury:Number(spec.injury)||0,skill:Number(spec.skill??n.skill)};if(spec.affinity!==undefined)n.affinity=Math.max(0,Math.min(100,Number(spec.affinity)));const result=bridge('combat',state,{kind:spec.type||'hostile',type:spec.type||'hostile',enemy,opponentId:n.id});result.enemy.profile=Murim.opponentProfile(state,n);view='event';opened=false;render();return result;});}
  function rumor(kind,place,ttl=24){return transaction('소문 생성 '+kind,()=>{const r=Murim.hearRumor(state,kind,true);if(!r)throw Error('유효 소문 6개 제한 또는 같은 분기의 같은 유형 중복입니다.');if(place){if(!Murim.PLACES.some(p=>p.name===place))throw Error('없는 지역입니다.');r.place=place;r.text=place+'에서 확인할 '+r.text;}r.expiresTick=state.tick+Math.max(0,Math.min(400,Math.round(Number(ttl)||0)));return r;});}
  function investigate(id,outcome='normal'){return transaction('소문 조사 '+outcome,()=>{idle();const r=state.rumors.find(r=>r.id===id);if(!r||!['heard','expired'].includes(r.status))throw Error('추적 가능한 소문을 선택하세요.');state.targetRumorId=id;state.location=r.place;
    if(outcome==='normal'){Murim.setPlan(state,state.q,'investigate');Murim.advanceQuarter(state);}
    else{const ends={success:null,failure:'notfound',false:'false',departed:'departed',expired:'late',taken:'taken'};if(!Object.hasOwn(ends,outcome))throw Error('없는 조사 결과입니다.');const end=ends[outcome];r.status=end||'investigated';r.investigatedTick=state.tick;if(end==='late')r.expiresTick=state.tick;Murim.queue(state,end?'rumor-end-'+end:'rumor-'+r.kind,{rumorId:r.id,actorId:r.subjectId||r.sourceId,rootCause:r.rootCause});Murim.dispatch(state);}
    view='event';render();return r;});}
  function birth(spec={}){return transaction('출생 생성',()=>{const h=MurimBirth.HOUSEHOLDS.find(h=>h.id===spec.householdType);const opts={started:true};if(h)opts.originId=h.originId;if(spec.householdType)opts.birth=spec;if(spec.aptitude)opts.aptitude=spec.aptitude;state=Murim.createLife(state.givenName,spec.seed??state.seed,opts);scheduled=[];selectedPlace=state.location;personIndex=0;view='character';detailTab='기본';render();return {originId:state.originId,householdType:state.householdType,clanId:state.clanId,parents:state.birthParentIds,guardian:state.guardianId,seed:state.seed};});}
  function settle(){let count=0;while(busy()&&state.alive&&count++<100){if(state.combat)Murim.resolveCombat(state,state.combat.uid,'flee');else if(state.combatResultPending)Murim.dismissCombat(state);else{const i=Murim.options(state).findIndex(o=>!o.disabled);if(i<0)throw Error('선택 가능한 항목이 없습니다.');Murim.resolveEvent(state,state.pendingEvent.uid,i);}}if(count>=100)throw Error('자동 확정 100회 안전 한도');}
  function advance(quarters=1,auto=false){return transaction('실제 분기 진행',()=>{const n=Number(quarters);if(!Number.isInteger(n)||n<1||n>400)throw Error('1~400분기를 입력하세요.');let advanced=0;for(let i=0;i<n&&state.alive;i++){if(busy()){if(!auto)break;settle();}if(!state.alive)break;if(!Murim.advanceQuarter(state))break;advanced++;dispatchScheduled();}state.playing=false;view=busy()?'event':'chronicle';render();return {requested:n,advanced,age:state.age,q:state.q,alive:state.alive,awaiting:state.pendingEvent?.id||state.combat?.kind};});}
  function dispatchScheduled(){if(!active||busy())return;const due=scheduled.find(e=>e.tick<=state.tick);if(!due)return;scheduled.splice(scheduled.indexOf(due),1);const c=prepareEvent(due.id,due.context);state.pendingEvent={id:due.id,context:c,uid:'dev-scheduled:'+state.tick+':'+(++sequence),age:state.age,q:state.q};state.playing=false;}
  function run(command,arg={}){
    requireActive();
    if(command==='event')return event(arg.id,arg);
    if(command==='combat')return combat(arg);
    if(command==='stat')return set(arg.path,arg.value,arg.mode);
    if(command==='birth')return birth(arg);
    if(command==='advance')return advance(arg.quarters,arg.auto);
    if(command==='rumor')return rumor(arg.kind,arg.place,arg.ttl);
    if(command==='investigate')return investigate(arg.id,arg.outcome);
    if(command==='mentor')return setMentor(arg.id);
    if(command==='war')return transaction('세력 전쟁 개시',()=>{idle();const w=bridge('war',state,arg);view=state.pendingEvent?'event':view;render();return w;});
    if(command==='reset'){state=copy(initial);scheduled=[];undo=[];record('테스트 초기화',null);render();refresh();return true;}
    if(command==='undo'){const prev=undo.pop();if(!prev)throw Error('실행 취소할 변경이 없습니다.');state=prev.state;scheduled=prev.scheduled;record('직전 변경 취소',null);render();refresh();return true;}
    return transaction(command,()=>{
      if(command==='snapshot')return copy(state);
      if(command==='restoreSnapshot'){const s=Murim.migrateSave(arg.state);if(!s)throw Error('복구할 상태가 유효하지 않습니다.');const queue=arg.scheduled||[];if(!Array.isArray(queue)||!queue.every(e=>Murim.EVENTS.some(d=>d.id===e.id)&&Number.isInteger(e.tick)&&e.context&&typeof e.context==='object'))throw Error('개발 예약 데이터가 유효하지 않습니다.');state=s;scheduled=copy(queue);state.playing=false;return true;}
      if(command==='seed'){if(String(arg.seed).length>128)throw Error('시드는 128자 이하입니다.');state.seed=String(arg.seed);return state.seed;}
      if(command==='join'){idle();if(arg.force)return bridge('join',state,{id:arg.id});state.targetSect=arg.id;Murim.queue(state,'join-'+arg.id);Murim.dispatch(state);view='event';render();return Murim.entryChance(state,Murim.SECTS.find(t=>t.id===arg.id));}
      if(command==='leave')return bridge('leave',state,arg);
      if(command==='npc')return createNPC(arg);
      if(command==='npc-death')return bridge(command,state,arg);
      if(command==='relationship'){const n=state.npcs.find(n=>n.id===arg.id);if(!n)throw Error('없는 NPC입니다.');n.affinity=Math.max(0,Math.min(100,Number(arg.affinity)));return n.affinity;}
      if(command==='status'){const t=Murim.sect(state);if(!t)throw Error('문파에 먼저 입문하세요.');if(!Murim.discipleNames(state,t).includes(arg.status))throw Error('문파에 없는 신분입니다.');state.discipleStatus=arg.status;return arg.status;}
      if(command==='transmission'){if(!state.sectId)throw Error('소속이 없습니다.');state.transmission=!!arg.enabled;return state.transmission;}
      if(command==='permit'){if(!state.sectId)throw Error('소속이 없습니다.');if(!state.teachingPermits.includes(state.sectId))state.teachingPermits.push(state.sectId);return state.teachingPermits;}
      if(command==='travel'){if(!Murim.PLACES.some(p=>p.name===arg.place))throw Error('없는 지역입니다.');state.location=arg.place;return state.location;}
      if(command==='world'){const r=Murim.regionalState(state,arg.place||state.location);if(arg.crop&&!['평년','풍작','흉작'].includes(arg.crop))throw Error('잘못된 작황입니다.');if(arg.crop)r.crop=arg.crop;if(arg.conflict!==undefined)r.conflict=!!arg.conflict;r.sinceTick=state.tick;return r;}
      if(command==='schedule'){if(!Murim.EVENTS.some(e=>e.id===arg.id))throw Error('없는 사건입니다.');const delay=Number(arg.delay);if(!Number.isInteger(delay)||delay<1||delay>400)throw Error('1~400분기 뒤로 예약하세요.');scheduled.push({id:arg.id,tick:state.tick+delay,context:arg.context||{}});return scheduled;}
      if(command==='chain'){const root=arg.id in chains?arg.id:Object.keys(chains).find(k=>chains[k]===arg.id);if(!root)throw Error('8계열 연쇄 사건의 시작 ID를 선택하세요.');const c=prepareEvent(chains[root],arg.context||{});state.storyThreads.push({id:chains[root],dueTick:state.tick+1,actorId:c.actorId,memoryId:c.memoryId,rootCause:root,starterChoice:'test'});return c;}
      if(command==='progression')return bridge(command,state,arg);
      if(command==='saveRoundtrip'){const saved=JSON.stringify(state),restored=Murim.migrateSave(JSON.parse(saved));if(!restored)throw Error('저장 복구 실패');return {valid:true,equal:JSON.stringify(restored)===saved};}
      if(command==='founding')return Murim.foundingRequirements(state);
      throw Error('지원하지 않는 명령입니다.');
    });
  }
  function catalog(){requireActive();return Murim.EVENTS.map(e=>({id:e.id,title:e.title,category:e.id.startsWith('war-')?'세력 분쟁':e.id.startsWith('rumor-')?'소문':e.id.startsWith('join-')||e.id.startsWith('sect-')?'문중':Object.values(chains).includes(e.id)?'연쇄 후속':'생애',options:e.opts.length,condition:String(e.condition),once:e.once,cooldown:e.cooldown,eligibility:eligibility(e.id)}));}
  function report(){requireActive();return {kind:'murim-developer-session',version:Murim.VERSION,contentVersion:state.contentVersion,seed:state.seed,state:copy(state),records:copy(records),scheduled:copy(scheduled),eventQueue:copy(state.eventQueue),pendingEvent:copy(state.pendingEvent),originalPreserved:true};}
  function refresh(){
    let root=$('developerPanel');if(!root){root=document.createElement('aside');root.id='developerPanel';root.className='dev-panel';root.setAttribute('aria-label','개발 테스트 패널');document.body.appendChild(root);}
    root.hidden=!active||!opened;
    let badge=$('developerBadge');if(!badge){badge=document.createElement('button');badge.id='developerBadge';badge.className='dev-badge';badge.dataset.dev='open';document.body.appendChild(badge);}badge.hidden=!active;badge.textContent='테스트 세션 · 패널 열기';
    if(!active||!opened)return;
    const select=(id,rows,value='')=>`<select id="${id}">${rows.map(([v,n])=>`<option value="${esc(v)}" ${String(value)===String(v)?'selected':''}>${esc(n)}</option>`).join('')}</select>`;
    const input=(id,value,type='number')=>`<input id="${id}" type="${type}" value="${esc(value)}">`;
    const btn=(label,cmd)=>`<button data-dev="${cmd}">${label}</button>`;
    const places=Murim.PLACES.map(p=>[p.name,p.name]),sects=Murim.SECTS.map(s=>[s.id,s.name]),npcs=state.npcs.map(n=>[n.id,n.name+(n.alive?'':' †')]);
    let body='';
    if(tab==='사건'){const rows=catalog().filter(e=>(e.id+' '+e.title+' '+e.category).toLowerCase().includes(filter.toLowerCase()));body=`<label>검색 ${input('devSearch',filter,'search')}</label><p>전체 ${Murim.EVENTS.length}종 · 현재 ${rows.length}종 · 조건 우회와 정상 판정 분리</p><label>맥락 NPC ${select('devActor',[['','엔진 자동 지정'],...npcs])}</label><label>발생 지역 ${select('devEventPlace',places,state.location)}</label><label><input id="devPrepare" type="checkbox" checked>필수 맥락 구성 (별도 로그)</label><label>예약 지연 분기 ${input('devDelay',1)}</label><div class="dev-events">${rows.map(e=>`<article data-key="dev-event-${esc(e.id)}"><strong>${esc(e.title)}</strong> <code>${esc(e.id)}</code><small>${e.category} · 선택 ${e.options}개 · ${e.eligibility.eligible?'정상 발생 가능':e.eligibility.triggerOnly?'예약·특수 트리거 전용':'현재 조건 불충족'} · ${e.once?'생애 1회':'재발 가능'}</small><details><summary>발생 조건</summary><pre>${esc(e.condition)}</pre><p>쿨다운 ${e.cooldown}분기 · ${esc(JSON.stringify(e.eligibility))}</p></details><div class="dev-buttons"><button data-dev-event="${esc(e.id)}" data-force="true">강제 실행</button><button data-dev-event="${esc(e.id)}">정상 검증</button><button data-dev-schedule="${esc(e.id)}">예약</button><button data-dev-chain="${esc(e.id)}">연쇄</button></div></article>`).join('')}</div>`;}
    if(tab==='전투')body=`<p>생사결과 일반 적대전은 기존 lethal 판정을 공유합니다. 상대의 경지·내공 등은 관측용이며 실제 승률은 지정 전투력으로 판정합니다.</p><label>상대 ${select('devOpponent',[['','임의 상대 생성'],...npcs])}</label><label>문파 ${select('devEnemySect',[['','무소속'],...sects])}</label><label>신분 ${select('devEnemyRole',[['martial','무인'],['civilian','민초']])}</label><label>전투 유형 ${select('devCombatType',[['duel','비무 (사망 금지)'],['lethal','생사결'],['hostile','일반 적대 전투']])}</label>${['Power','Rank','Inner','Reserve','Skill','Health','Injury','Affinity'].map((k,i)=>`<label>${['전투력 0~200','경지 번호','축적 내공','가용 내력','무공 수준','건강','부상','관계'][i]}${input('devEnemy'+k,[65,2,1,100,65,100,0,50][i])}</label>`).join('')}${btn('기존 전투 화면으로 이동','combat')}<p>전력 / 최대한 강하게 / 평범 / 힘 조절 / 도주 모두 기존 화면에서 선택합니다.</p>`;
    if(tab==='수치')body=`<label>내부 수치 ${select('devField',Object.entries(fields).map(([k,f])=>[k,f[0]+' · 현재 '+(get(state,k)??'없음')+(k.endsWith('XP')?' / 표시 '+fNumber(Murim.skill(get(state,k)||0)): '')]))}</label><label>값 ${input('devValue',10)}</label><label>조작 ${select('devMode',[['set','지정'],['add','증가'],['subtract','감소'],['reset','테스트 진입 값으로 초기화']])}</label>${btn('실제 상태에 적용','stat')}${btn('직전 조작 실행 취소','undo')}<p>숙련은 표시값 대신 원시 XP를 변경합니다. 내상은 현재 엔진의 부상 수치와 공용입니다.</p>`;
    if(tab==='소문')body=`<label>유형 ${select('devRumorKind',Murim.RUMOR_KINDS.map(k=>[k,k]))}</label><label>장소 ${select('devRumorPlace',places,state.location)}</label><label>유효 기간 (분기) ${input('devRumorTTL',24)}</label>${btn('소문 강제 생성','rumor')}<label>조사 대상 ${select('devRumor',state.rumors.map(r=>[r.id,r.kind+' · '+r.place+' · '+r.status]))}</label><label>조사 방식 ${select('devRumorOutcome',[['normal','실제 분기 조사 판정'],['success','성공 맥락 → 실제 사건'],['failure','실패 → 종료 사건'],['false','거짓 소문'],['departed','대상 이탈'],['expired','기한 경과'],['taken','다른 이가 획득']])}</label>${btn('추적·결말 실행','investigate')}`;
    if(tab==='문파·NPC')body=`<label>문파 ${select('devSect',sects,state.targetSect)}</label>${btn('정상 입문 심사','join-normal')}${btn('조건 우회 입문','join-force')}<label>사부 ${select('devMentor',[['','유효 후보 중 무작위'],...mentorCandidates().map(n=>[n.id,n.name])])}</label>${btn('실제 NPC 사부 배정','mentor')}${btn('현재 문파 지도자 NPC 생성','teacher')}<label>제자 신분 ${select('devStatus',(Murim.sect(state)?Murim.discipleNames(state,Murim.sect(state)):[]).map(s=>[s,s]))}</label>${btn('신분 적용','status')}${btn('전수 허가','permit')}${btn('진전 상태 반전','transmission')}${btn('승급·돌파 조건 판정','progression')}${btn('탈퇴','leave')}${btn('파문','expel')}<label>NPC ${select('devNPC',npcs)}</label><label>호감 ${input('devAffinity',60)}</label>${btn('관계 변경','relationship')}${btn('NPC 사망·부고 처리','npc-death')}${btn('민초 NPC 생성','civilian')}<pre>${esc(JSON.stringify({mentorId:state.mentorId,discipleStatus:state.discipleStatus,transmission:state.transmission,successorFlag:state.successorFlag,discipleship:state.discipleship},null,2))}</pre>`;
    if(tab==='출생')body=`<p>기존 출생 추첨의 명문 8%를 5가문에 균등 배분합니다. 무가 12% 중 3%는 몰락가문입니다. 본가·분가와 직계·방계는 별도 추첨하며 후계권은 부여하지 않습니다.</p><label>시드 ${input('devBirthSeed',state.seed,'text')}</label><label>가구 ${select('devHousehold',MurimBirth.HOUSEHOLDS.map(h=>[h.id,h.name]),state.householdType)}</label><label>혈연 가문 ${select('devClan',[['','혈연 가문 없음'],...MurimBirth.CLANS.map(c=>[c.id,c.name])],state.clanId)}</label><label>본가·분가 ${select('devBranch',[['main','본가'],['branch','분가']])}</label><label>직계·방계 ${select('devLineage',[['direct','직계'],['collateral','방계']])}</label><label>출생 지역 ${select('devBirthPlace',places,state.birthPlace)}</label><label>출생 인정 ${select('devBirthStatus',[['recognized','인정'],['unknown','불명'],['adopted','입양'],['unrecognized','미인정'],['fallen','몰락']])}</label>${btn('지정 출생 생성','birth')}${btn('동일 시드 자연 추첨','birth-natural')}${btn('새 시드 자연 추첨','birth-reroll')}${btn('6000시드 출생 통계','birth-stats')}<pre>${esc(JSON.stringify({householdType:state.householdType,clanId:state.clanId,branchId:state.branchId,lineage:state.birthLineage,parents:state.birthParentIds,guardian:state.guardianId,sectId:state.sectId,surname:state.surname},null,2))}</pre>`;
    if(tab==='세계·저장')body=`<label>세력 전쟁 ${select('devWarPair',MurimFactionLife.PAIRS.map(p=>[p.id,MurimFactionLife.BLOCS[p.a]+' 대 '+MurimFactionLife.BLOCS[p.b]]))}</label>${btn('실제 전쟁 시작','faction-war')}<pre>${esc(JSON.stringify(state.world.wars,null,2))}</pre><label>진행할 분기 ${input('devQuarters',1)}</label><label><input id="devAutoChoices" type="checkbox">중간 사건 첫 유효 선택·전투 도주 자동 처리</label>${btn('실제 시간 진행','advance')}<label>지역 ${select('devPlace',places,state.location)}</label>${btn('즉시 이동','travel')}<label>작황 ${select('devCrop',[['평년','평년'],['풍작','풍년'],['흉작','흉년']])}</label><label><input id="devConflict" type="checkbox">지역 분쟁</label>${btn('세계 상태 적용','world')}${btn('저장·불러오기 왕복 검사','saveRoundtrip')}${btn('독립 문파 설립 조건 검사','founding')}<label>시나리오 ${select('devPreset',[['civilian','민초 성인'],['martial','무인 성인'],['leader','지도층 후보']])}</label>${btn('시나리오 생성','preset')}<p>나이 필드만 수정하지 않고 실제 분기·NPC·예약을 함께 진행합니다.</p>`;
    if(tab==='로그·큐')body=`<pre>${esc(JSON.stringify({pending:state.pendingEvent,combat:state.combat,lastCombat:state.lastCombat,eventQueue:state.eventQueue,followUps:state.followUps,storyThreads:state.storyThreads,scheduled,records:records.slice(-40)},null,2))}</pre>`;
    const html=`<header><div><strong>개발 테스트 모드</strong><small>일반 저장 보호 · 규칙 ${Murim.VERSION} · 콘텐츠 ${esc(state.contentVersion)} · 시드 ${esc(state.seed)} · ${state.age}세 ${state.q+1}분기</small></div>${btn('닫기','close')}</header><div class="dev-buttons">${btn('스냅샷 파일','snapshot-export')}${btn('스냅샷 복구','snapshot-restore')}${btn('결과 JSON','export')}${btn('결과 복사','copy')}${btn('세션 초기화','reset')}${btn('원본 복원·종료','disable')}</div><nav>${['사건','전투','수치','소문','문파·NPC','출생','세계·저장','로그·큐'].map(t=>`<button data-dev-tab="${t}" aria-pressed="${tab===t}">${t}</button>`).join('')}</nav><p role="status" class="dev-status">${esc(lastMessage||'테스트 조작은 원본 저장 슬롯에 기록되지 않습니다.')}</p><section class="dev-body">${body}</section>`;
    if(!root.firstChild)root.innerHTML=html;else patchHTML(root,html);
  }
  const fNumber=n=>Number(n).toFixed(2);
  function preset(id){run('reset');run('birth',{seed:'dev-preset-'+id,householdType:'orphan'});run('advance',{quarters:68,auto:true});if(!state.alive)throw Error('해당 시나리오에서 사망했습니다. 다른 시드를 사용하세요.');if(id!=='civilian'){run('join',{id:'huashan',force:true});transaction('기본 입문 안내 정리',()=>{settle();return true;});set('swordXP',2200);set('operationXP',2200);set('methodXP',2200);set('inner',2.5);}if(id==='leader'){set('rank',4);set('support',80);set('trust',85);set('merit',200);set('reputation',80);}refresh();}
  const priorPersist=persist;
  persist=function(explicit=false){if(active){if(explicit){download(JSON.stringify(report(),null,2),'무협생활_테스트세션.json','application/json');notify('테스트 세션을 별도 파일로 내보냈습니다. 일반 저장은 유지됩니다.');}return;}return priorPersist(explicit);};
  const priorSettings=settingsView;
  settingsView=function(){const html=priorSettings();if(settingsTab!=='게임 설정')return html;return html.replace('</h2>','</h2><div class="setting-row"><label><input type="checkbox" id="developerModeToggle" '+(active?'checked':'')+'>테스트 모드</label><p>현재 삶을 복사하여 별도 세션에서 검사합니다.</p></div>');};
  const priorRender=render;
  render=function(force=false){priorRender(force);if(active)dispatchScheduled();refresh();};
  document.addEventListener('change',e=>{if(e.target.id==='developerModeToggle'){if(e.target.checked)enable();else disable();}});
  document.addEventListener('input',e=>{if(e.target.id==='devSearch'){filter=e.target.value;refresh();}});
  document.addEventListener('click',async e=>{
    const t=e.target.closest('button');if(!t)return;
    const v=id=>$(id)?.value;
    try{
      if(t.dataset.devTab){tab=t.dataset.devTab;refresh();return;}
      if(t.dataset.devEvent){const place=v('devEventPlace'),actor=v('devActor'),prepare=$('devPrepare').checked;state.playing=false;transaction('이벤트 지역 설정',()=>{state.location=place;return state.location;});const context=actor?{actorId:actor}:{};event(t.dataset.devEvent,{force:t.dataset.force==='true',prepare,context});opened=false;refresh();return;}
      if(t.dataset.devSchedule){run('schedule',{id:t.dataset.devSchedule,delay:Number(v('devDelay')),context:v('devActor')?{actorId:v('devActor')}: {}});return;}
      if(t.dataset.devChain){run('chain',{id:t.dataset.devChain});return;}
      const cmd=t.dataset.dev;if(!cmd)return;
      if(cmd==='open'){requireActive();opened=true;refresh();return;}
      if(cmd==='close'){opened=false;refresh();return;}
      if(cmd==='disable'){disable();return;}
      if(cmd==='faction-war'){run('war',{pairId:v('devWarPair'),place:state.location});return;}
      if(cmd==='stat'){set(v('devField'),v('devValue'),v('devMode'));render();return;}
      if(cmd==='combat'){combat({npcId:v('devOpponent'),sectId:v('devEnemySect'),civilian:v('devEnemyRole')==='civilian',type:v('devCombatType'),power:+v('devEnemyPower'),rank:+v('devEnemyRank'),inner:+v('devEnemyInner'),reserve:+v('devEnemyReserve'),skill:+v('devEnemySkill'),health:+v('devEnemyHealth'),injury:+v('devEnemyInjury'),affinity:+v('devEnemyAffinity')});return;}
      if(cmd==='rumor'){rumor(v('devRumorKind'),v('devRumorPlace'),v('devRumorTTL'));return;}
      if(cmd==='investigate'){investigate(v('devRumor'),v('devRumorOutcome'));opened=false;refresh();return;}
      if(cmd==='join-normal'||cmd==='join-force'){run('join',{id:v('devSect'),force:cmd==='join-force'});if(cmd==='join-normal')opened=false;render();return;}
      if(cmd==='mentor'){setMentor(v('devMentor'));return;}
      if(cmd==='teacher'){run('npc',{name:'시험 문중 교관',role:'교관',sectId:state.sectId});return;}
      if(cmd==='civilian'){run('npc',{name:'시험 장인',martial:false});return;}
      if(cmd==='status'){run(cmd,{status:v('devStatus')});return;}
      if(cmd==='transmission'){run(cmd,{enabled:!state.transmission});return;}
      if(cmd==='relationship'){run(cmd,{id:v('devNPC'),affinity:+v('devAffinity')});return;}
      if(cmd==='npc-death'){run(cmd,{id:v('devNPC')});return;}
      if(cmd==='leave'||cmd==='expel'){run('leave',{reason:cmd==='expel'?'파문':'탈퇴'});render();return;}
      if(cmd==='birth'){birth({seed:v('devBirthSeed'),householdType:v('devHousehold'),clanId:v('devClan')||null,branchId:v('devBranch'),lineage:v('devLineage'),place:v('devBirthPlace'),birthStatus:v('devBirthStatus')});return;}
      if(cmd==='birth-natural'||cmd==='birth-reroll'){birth({seed:cmd==='birth-natural'?v('devBirthSeed'):String(Date.now())});return;}
      if(cmd==='birth-stats'){const stats={};for(let i=0;i<6000;i++){const s=Murim.createLife('통계',i);stats[s.originId]=(stats[s.originId]||0)+1;}record('6000시드 실제 생성 통계',stats);lastMessage=JSON.stringify(stats);refresh();return;}
      if(cmd==='advance'){advance(+v('devQuarters'),$('devAutoChoices').checked);return;}
      if(cmd==='travel'){run(cmd,{place:v('devPlace')});render();return;}
      if(cmd==='world'){run(cmd,{place:v('devPlace'),crop:v('devCrop'),conflict:$('devConflict').checked});return;}
      if(cmd==='preset'){preset(v('devPreset'));return;}
      if(cmd==='snapshot-export'){snapshot=copy(state);snapshotScheduled=copy(scheduled);download(JSON.stringify({kind:'murim-test-snapshot',state:snapshot,scheduled:snapshotScheduled},null,2),'무협생활_테스트스냅샷.json','application/json');record('현재 스냅샷 생성',null);return;}
      if(cmd==='snapshot-restore'){if(!snapshot)throw Error('먼저 스냅샷 파일을 생성하세요.');run('restoreSnapshot',{state:snapshot,scheduled:snapshotScheduled});render();return;}
      if(cmd==='export'){download(JSON.stringify(report(),null,2),'무협생활_테스트결과.json','application/json');return;}
      if(cmd==='copy'){try{await navigator.clipboard.writeText(JSON.stringify(report(),null,2));lastMessage='테스트 결과를 복사했습니다.';}catch{download(JSON.stringify(report(),null,2),'무협생활_테스트결과.json','application/json');lastMessage='복사 권한이 없어 파일로 내보냈습니다.';}refresh();return;}
      run(cmd);render();
    }catch(error){lastMessage=error.message;refresh();notify('테스트: '+error.message);}
  });
  document.addEventListener('click',e=>{if(!active)return;const a=e.target.closest('[data-action]')?.dataset.action;if(['reset','confirmReset','previousLife','load','import'].includes(a)){e.preventDefault();e.stopImmediatePropagation();notify('테스트 세션에서는 일반 저장 슬롯 교체를 차단합니다. 원본 복원 후 사용하세요.');}},true);
  return {get active(){return active;},enable,disable,run,set,event,combat,rumor,investigate,advance,catalog,eligibility,mentorCandidates,preset,report,open(){requireActive();opened=true;refresh();},close(){requireActive();opened=false;refresh();},fields};
})();
globalThis.MurimDev=MurimDev;
