'use strict';
const MurimFactionLife=(()=>{
  const VERSION='0.4.2';
  const BLOCS={order:'무림맹',sapa:'사파연합',demon:'마교',blood:'혈교',state:'관부·군부',neutral:'중립 조직',civilian:'민초'};
  const PAIRS=[{id:'order-sapa',a:'order',b:'sapa',cause:'길목의 통행세와 무림의 자치권을 둘러싼 충돌'},{id:'order-demon',a:'order',b:'demon',cause:'교단의 강제 포교와 납치에 맞선 무림맹의 토벌'},{id:'order-blood',a:'order',b:'blood',cause:'혈교의 인신 약탈과 금기 술법을 막기 위한 연합'}];
  const ROLES=Object.keys(BLOCS);
  const additions=[
    ['zhongnan','종남파','정파','화산','종남산','중정','검'],['emei','아미파','정파','성도','아미산','음유','검'],['kunlun','곤륜파','정파','천산','곤륜산','중정','검'],['kongtong','공동파','정파','화산','공동산','양강','권'],['qingcheng','청성파','정파','성도','청성산','중정','검'],['diancang','점창파','정파','성도','점창산','양강','검'],['hainan','해남파','정파','항주','해남도','중정','검'],
    ['tang','사천당가','정파','성도','사천','음유','암기','당'],['paeng','하북팽가','정파','낙양','하북','양강','도','팽'],['zhuge','제갈세가','정파','무당산','호북','중정','검','제갈'],['murong','모용세가','정파','합비','요동','중정','검','모용'],
    ['greenwood','녹림연합','사파','화산','산채','양강','도'],['waterway','장강수로채','사파','항주','장강','양강','도'],['hao','하오문','사파','낙양','시정','음유','단도'],['assassins','살수조직','사파','성도','비밀 거점','음유','단도'],
    ['escort','표국','중립','합비','표행 거점','중정','도'],['guild','상단·객잔','중립','항주','상업 거점','중정','봉'],['military','관아·군영','관부','낙양','관아와 군영','양강','창']
  ];
  function configure(sects,arts,actions){
    for(const [id,name,faction,place,seat,principle,weapon,family] of additions){
      const civilian=id==='guild';
      sects.push({id,name,faction,place,seat,region:'중원',quality:civilian?1.05:family?1.45:faction==='사파'?1.36:1.42,entry:faction==='사파'?.48:family?.46:civilian?.8:.52,disciples:civilian?['고용인','정식 상원','책임 상원']:id==='military'?['향병','정규 군졸','훈련 교관']:family?['외성 문하','정식 문하','직전제자']:['입문 문도','정식 문도','직전제자'],method:name+' 기초심법',principle,family,rule:`${seat}에 연고를 두며 ${place}의 연락 거점에서 지원한다. ${family?'혈연과 외성 문하의 전수·후계권은 별도 심사한다.':civilian?'생업과 장부의 신용을 심사하며 무공 수련을 요구하지 않는다.':id==='military'?'성인만 자원 입대하며 관부의 치안 의무를 진다.':faction==='사파'?'강호의 악명 12 이상 또는 비협의 성향 -15 이하를 요구한다.':'기초 소양과 사승의 신뢰를 심사한다.'}`});
      arts[id]={basic:name+' 기초'+(weapon==='권'?'권법':weapon==='암기'?'암기술':weapon+'법'),secret:name+' 전승초식',weapon,origin:'기획 세력 목록에 따른 본작의 임시 기초무학; 유명 절학 자동 부여 없음'};
    }
    for(const t of sects){t.bloc=t.faction==='정파'?'order':t.faction==='사파'?'sapa':t.id==='demon'?'demon':t.id==='blood'?'blood':t.faction==='관부'?'state':'neutral';if(['demon','blood'].includes(t.id)){t.entry=t.id==='blood'?.22:.26;t.rule='강제 포교와 약탈을 일삼는 적대 교단. 악명 25·의협 -25 이하·성인 조건 또는 납치 생존자의 내부 연고가 있어야 입교 심사를 받을 수 있다. 이탈과 거부는 가능하다.';}}
    actions.push({id:'beg',name:'동냥·시정 탐문',icon:'scroll',desc:'개방 방도로서 동냥과 구휼, 거리의 소문을 살핀다. 무공 경험은 자동 증가하지 않는다.'});
  }
  function initialize(s){
    s.notoriety??=0;s.cultBackground??=null;s.infirmities??=[];s.world.wars??=[];s.world.warNextTick??=Math.max(64,s.tick+8);s.warContributions??={};s.warReceipts??=[];s.warNotices??={};s.mentorObituaries??=[];s.birthIntroPending??=false;
    s.nextInfirmityId??=s.infirmities.length;
  }
  const bloc=(s,sects)=>sects.find(t=>t.id===s.sectId)?.bloc||'civilian';
  function entryRule(s,t){
    if(!t)return {ok:false,reason:'없는 세력'};
    if(t.id==='military'&&s.age<18)return {ok:false,reason:'자원 입대는 18세부터'};
    if(['demon','blood'].includes(t.id)&&!(s.age>=18&&((s.notoriety>=25&&s.ethics<=-25)||s.cultBackground===t.id)))return {ok:false,reason:'성인·악명 25·의협 -25 이하 또는 납치 생존 연고 필요'};
    if(t.bloc==='sapa'&&s.notoriety<12&&s.ethics>-15)return {ok:false,reason:'악명 12 또는 의협 -15 이하 필요'};
    return {ok:true,reason:t.rule};
  }
  function install(events,a){
    const {ev,choice,queue,dispatch,random,sects}=a;
    const roles={order:['사문의 소집장','문파·세가의 원로들이 무림맹의 출진 요청을 전했다. 혈연만으로 참전을 강제할 수는 없다.'],sapa:['연합의 통행권','사파연합은 산채와 수로의 자치를 내걸었다. 실리를 위해 민가를 희생시킬지, 동료의 강경론을 막을지 선택할 때다.'],demon:['교단의 강제 원정','교단의 지휘부는 강제 포교를 위한 원정대를 모은다. 명령을 따르거나 포로의 탈출을 돕고 등을 돌릴 수 있다.'],blood:['혈교의 포로 명부','교단은 잡혀 온 사람들을 금기 술법에 쓰려 한다. 명부를 넘기려는 지휘부와 사로잡힌 이들의 눈이 마주쳤다.'],state:['관군의 경계령','관군은 성문과 민가의 치안을 지킬 병력을 찾는다. 강호의 승패보다 백성의 생존을 우선할 수도 있다.'],neutral:['표행과 닫힌 상로','중립 조직에 두 진영의 물자 계약이 동시에 왔다. 어느 쪽에 서든 거래와 사람의 목숨이 함께 걸린다.'],civilian:['전란이 닿은 마을','무림의 싸움이 평범한 사람들의 논과 공방에 닿았다. 무공을 배우지 않아도 삶을 지키고 이웃을 도울 길은 있다.']};
    for(const p of PAIRS)for(const role of ROLES){
      const [title,body]=roles[role],evil=['demon','blood'].includes(role);
      const first=role==='civilian'?choice('refuge','가족과 안전한 곳에 머문다','피로 +3 · 전투·무공 수련 없음',{fatigue:3,happiness:2},{special:'war'}):role==='neutral'?choice('supply','민간 구호 물자만 운송한다','피로 +6 · 보수 6냥 · 전투 없음',{fatigue:6,money:6},{special:'war'}):choice('fight',evil?'교단의 군령을 받아 전장에 선다':'전투 참여에 자원한다','실제 적대 전투 · 전투력과 부상 위험 확인',{}, {special:'war'});
      events.push(ev('war-'+p.id+'-'+role,title+' · '+BLOCS[p.a]+' 대 '+BLOCS[p.b],`${p.cause}으로 ${BLOCS[p.a]}과 ${BLOCS[p.b]} 사이에 전쟁이 났다. ${body}`,[first,choice('aid',evil?'포로의 탈출을 돕고 구호소를 연다':'피난민과 부상자를 돕는다','3냥 · 의협 +3 · 학식 +25 XP · 기여 +2',{money:-3,ethics:3,knowledgeXP:25},{cost:3,special:'war'}),choice('talk',evil?'강제 동원을 거부하고 교단에서 이탈한다':'정전의 서신과 포로 교환을 중재한다',evil?'탈퇴 · 기존 무공과 혈연 보존':'학식 +35 XP · 정전 진척 +1', {knowledgeXP:35},{special:'war'}),choice('decline','생업과 사람들을 먼저 돌본다','참전하지 않는다 · 소속·무공 강제 변경 없음',{happiness:1},{special:'war'})],()=>false,0));
    }
    for(const role of ROLES)events.push(ev('war-aftermath-'+role,'전쟁 뒤에 남은 자리',`${BLOCS[role]}의 사람들이 전쟁 뒤의 길과 살림을 돌아본다. 승패와 별개로 남겨진 사람과 상처를 어떻게 대할지 정한다.`,[choice('rebuild','무너진 집과 일터의 복구를 돕는다','피로 +5 · 행복 +3 · 기여에 따른 보수',{fatigue:5,happiness:3},{special:'warAfter'}),choice('record','살아남은 이들의 사연을 기록한다','학식 +40 XP · 전승 +1',{knowledgeXP:40,legacy:1},{special:'warAfter'}),choice('home','인연이 기다리는 집으로 돌아간다','행복 +4',{happiness:4},{special:'warAfter'})],()=>false,0));
    for(const id of ['demon','blood'])events.push(ev('cult-captive-'+id,'닫힌 교단의 문','어린 날 길에서 납치당한 뒤 강제 포교를 피할 틈을 엿보았다. 이 경험은 입교 명령이 아니며, 무엇을 배울지는 스스로 정할 수 있다.',[choice('escape','틈을 타 보호자의 집으로 돌아간다','교단 연고 기록 · 자동 입교·무공 습득 없음',{happiness:2},{special:'cultBackground',sectId:id}),choice('report','관아에 납치범의 행방을 알린다','교단 연고 기록 · 의협 +3',{ethics:3},{special:'cultBackground',sectId:id})],s=>s.age>=8&&s.age<=15&&!s.sectId&&!s.cultBackground&&s.lastAction==='explore',80,true));
    events.push(ev('sapa-reputation','거친 길의 평판','길목에서 만난 무리가 부당한 통행세를 함께 거두자고 권했다. 그들의 인정을 얻는 일과 이웃의 믿음을 얻는 일은 다르다.',[choice('extort','부당한 징수에 가담한다','악명 +14 · 의협 -18 · 재산 +4',{money:4,ethics:-18},{special:'notoriety'}),choice('refuse','거절하고 길손을 돕는다','의협 +3 · 행복 +2',{ethics:3,happiness:2})],s=>s.age>=16&&!s.sectId&&s.lastAction==='explore',32));
    events.push(ev('cult-contact','음지에서 온 입교장','강제 포교를 하는 교단의 사자가 악행의 전력을 보고 입교 시험을 제의했다. 문에 들어서기 위해서도 신뢰를 얻어야 한다.',[choice('accept','교단의 입교 심사를 청한다','악명 +12 · 의협 -12 · 입교 시험 예약',{ethics:-12},{special:'cultContact'}),choice('refuse','입교장을 돌려보낸다','자동 입교 없음',{happiness:2})],s=>s.age>=18&&!s.sectId&&s.notoriety>=14&&s.ethics<=-15,40));
    events.push(ev('gaebang-bowl','밥그릇과 거리의 소식','개방의 방도들은 동냥으로 받은 곡식을 나누고 길손의 소식을 전한다. 비어 있는 밥그릇 하나에도 누군가의 사정이 담겨 있다.',[choice('share','곡식을 나누고 구휼 명부를 살핀다','공헌 +4 · 의협 +2',{merit:4,ethics:2}),choice('listen','방도들의 소문을 대조한다','학식 +40 XP · 새 소문',{knowledgeXP:40},{special:'begRumor'})],s=>s.sectId==='gaebang',24));
    const obituary=events.find(e=>e.id==='mentorloss');obituary.once=false;obituary.cooldown=0;
    for(const id of ['demon','blood']){const e=events.find(e=>e.id==='join-'+id);if(e)e.text=sects.find(t=>t.id===id).rule;}
  }
  function startWar(s,pairId,place,a){
    initialize(s);const p=PAIRS.find(p=>p.id===pairId);if(!p)throw Error('정의되지 않은 분쟁입니다.');
    if(s.world.wars.some(w=>w.status==='active'))return null;
    const w={id:'war-'+s.tick+'-'+s.world.wars.length,pairId:p.id,a:p.a,b:p.b,place:place||s.location,startTick:s.tick,endTick:s.tick+12,status:'active',peace:0,balance:0};
    s.world.wars.push(w);if(s.world.wars.length>24)s.world.wars.shift();a.log(s,`${BLOCS[w.a]}과 ${BLOCS[w.b]}의 전쟁이 ${w.place} 길목에서 시작되었다. ${p.cause}.`,'강호');return w;
  }
  function quarter(s,a){
    initialize(s);heal(s,s.lastAction==='rest'?4:1,false);
    if(!s.alive)return;
    let w=s.world.wars.find(w=>w.status==='active');
    if(!w&&s.tick>=s.world.warNextTick&&s.age>=16){
      s.world.warNextTick=s.tick+4;
      if(a.random(s,'faction-war-start')<.035)w=startWar(s,PAIRS[Math.floor(a.random(s,'war-pair')*PAIRS.length)].id,a.places[Math.floor(a.random(s,'war-place')*a.places.length)].name,a);
    }
    if(!w)return;
    if(w.lastProgressTick!==s.tick&&s.tick>w.startTick){const roll=a.random(s,'war-front',w.startTick);w.balance=Math.max(-100,Math.min(100,w.balance+(roll<.36?-1:roll>.64?1:0)));if(s.tick-w.startTick>=4&&a.random(s,'war-peace',w.startTick)<.2)w.peace++;w.lastProgressTick=s.tick;}
    if(s.tick>=w.endTick||w.peace>=4||s.tick-w.startTick>=6&&Math.abs(w.balance)>=5){w.status='ended';w.endTick=s.tick;s.world.warNextTick=s.tick+32;w.outcome=w.peace>=4?'중재 휴전':w.balance>=3?BLOCS[w.a]+' 우세':w.balance<=-3?BLOCS[w.b]+' 우세':'상호 소모 후 휴전';a.log(s,`${BLOCS[w.a]}과 ${BLOCS[w.b]}의 전쟁이 ${w.outcome}으로 멎었다.`,'강호');if(s.warNotices[w.id])a.queue(s,'war-aftermath-'+bloc(s,a.sects),{warId:w.id});return;}
    const role=bloc(s,a.sects),involved=[w.a,w.b].includes(role)||s.location===w.place;
    if(s.age>=16&&involved&&!s.warNotices[w.id]){s.warNotices[w.id]=true;a.queue(s,'war-'+w.pairId+'-'+role,{warId:w.id});}
  }
  function heal(s,amount,permanent=false){
    for(const i of s.infirmities){if(i.severity<=0||i.permanent&&!permanent)continue;i.severity=Math.max(0,i.severity-amount);if(!i.severity)i.healedTick=s.tick;}
  }
  function addInjury(s,{permanent=false,severity=5,kind='외상',source='전투'}={}){
    initialize(s);if(s.infirmities.filter(i=>i.severity>0).length>=16){const existing=s.infirmities.find(i=>i.permanent===permanent&&i.kind===kind&&i.severity>0)||s.infirmities.find(i=>i.severity>0);existing.severity=Math.min(35,existing.severity+severity);existing.permanent||=permanent;return existing;}
    const i={id:'wound-'+s.tick+'-'+s.nextInfirmityId++,kind,permanent,severity:Math.min(35,Math.max(1,severity)),fromTick:s.tick,source};s.infirmities.push(i);if(s.infirmities.length>64)s.infirmities.splice(s.infirmities.findIndex(i=>i.severity===0),1);return i;
  }
  function penalty(s){return Math.min(.4,(s.infirmities||[]).reduce((v,i)=>v+i.severity,0)/200);}
  function handle(s,p,o,a){
    initialize(s);
    if(o.special==='cultBackground'){s.cultBackground=o.sectId;return '납치에서 살아 돌아온 경위를 남겼다. 교단의 악행을 목격했지만 입교나 무공 수련은 강제되지 않았다.';}
    if(o.special==='notoriety'){s.notoriety=Math.min(100,s.notoriety+14);return '부당한 통행세에 가담한 전력과 악명이 남았다.';}
    if(o.special==='cultContact'){s.notoriety=Math.min(100,s.notoriety+12);const t=a.sects.find(t=>t.id===(a.random(s,'cult-choice')<.5?'demon':'blood'));a.queue(s,'join-'+t.id);return '입교 시험이 예약되었다. 악행의 전력이 입교 성공을 보장하지는 않는다.';}
    if(o.special==='begRumor'){a.hearRumor(s,null,true);return '방도들이 수집한 소문을 대조했다. 듣는 것과 사실을 확인하는 것은 별개다.';}
    if(o.special==='war'||o.special==='warAfter'){
      const w=s.world.wars.find(w=>w.id===p.context.warId);if(!w)return '전쟁의 기록이 없어 추가 전공과 보수는 지급되지 않았다.';
      const receipt=p.id+':'+w.id;if(s.warReceipts.includes(receipt))return '이미 처리한 전쟁 선택이다. 보상은 다시 지급하지 않았다.';
      s.warReceipts.push(receipt);if(s.warReceipts.length>256)s.warReceipts.shift();
      const role=bloc(s,a.sects);
      if(o.special==='warAfter'){if(w.status!=='ended')return '전쟁이 아직 끝나지 않아 복구 보수는 지급하지 않았다.';const amount=Math.min(20,(s.warContributions[w.id]||0)*2);a.income(s,amount);return `${w.outcome}. 전쟁에 남긴 기여 ${s.warContributions[w.id]||0}에 따라 보수 ${amount}냥을 받았다. 이후의 삶은 다시 스스로 정한다.`;}
      if(w.status!=='active')return '이미 휴전한 전쟁이다. 새로운 참전은 진행하지 않았다.';
      if(o.id==='fight'){if(s.age<18)return '성인이 아니므로 전투 동원을 거절하고 후방에 남았다.';a.startCombat(s,'hostile',p.id,p.uid);s.combat.warId=w.id;s.combat.warSide=role;return `${w.place}의 전투에 자원했다. 상대를 살피고 대응을 정해야 한다.`;}
      if(o.id==='aid'||o.id==='supply')s.warContributions[w.id]=(s.warContributions[w.id]||0)+2;
      if(o.id==='talk'){if(['demon','blood'].includes(role)){a.leaveSect(s,'강제 동원 거부');return '포로를 살피고 교단을 떠났다. 혈연·이미 익힌 무공과 사승 이력은 남았다.';}w.peace+=2;}
      return o.id==='decline'?'참전을 거절하고 자신의 삶을 지켰다.':o.id==='refuge'?'가족을 돌보며 피난처에 머물렀다. 무공을 배우지 않아도 삶은 이어진다.':'전장의 승패와 별개로 사람과 약속을 지키는 선택이 전쟁 기록에 남았다.';
    }
    return null;
  }
  function valid(s){
    const num=(n,l,h)=>Number.isFinite(n)&&n>=l&&n<=h;
    return Number.isInteger(s.nextInfirmityId)&&s.nextInfirmityId>=0&&num(s.notoriety,0,100)&&(s.cultBackground===null||['demon','blood'].includes(s.cultBackground))&&typeof s.birthIntroPending==='boolean'&&Array.isArray(s.infirmities)&&s.infirmities.length<=64&&new Set(s.infirmities.map(i=>i.id)).size===s.infirmities.length&&s.infirmities.every(i=>typeof i.id==='string'&&typeof i.permanent==='boolean'&&num(i.severity,0,35)&&Number.isInteger(i.fromTick)&&typeof i.kind==='string')&&Array.isArray(s.world.wars)&&s.world.wars.length<=24&&new Set(s.world.wars.map(w=>w.id)).size===s.world.wars.length&&s.world.wars.every(w=>typeof w.id==='string'&&PAIRS.some(p=>p.id===w.pairId&&p.a===w.a&&p.b===w.b)&&['active','ended'].includes(w.status)&&Number.isInteger(w.startTick)&&Number.isInteger(w.endTick)&&w.endTick>=w.startTick&&num(w.peace,0,100)&&num(w.balance,-100,100))&&s.world.wars.filter(w=>w.status==='active').length<=1&&Number.isInteger(s.world.warNextTick)&&s.warContributions&&Object.values(s.warContributions).every(v=>num(v,0,10000))&&Array.isArray(s.warReceipts)&&s.warReceipts.length<=256&&s.warNotices&&Array.isArray(s.mentorObituaries);
  }
  return {VERSION,BLOCS,PAIRS,ROLES,configure,initialize,entryRule,install,startWar,quarter,handle,heal,addInjury,penalty,valid,bloc};
})();
globalThis.MurimFactionLife=MurimFactionLife;
if(typeof module!=='undefined')module.exports=MurimFactionLife;
