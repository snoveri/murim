'use strict';
/* Shared by the playable UI and the Monte Carlo runner. No wall clock or DOM. */
const Murim = (() => {
  const VERSION = '0.4.2';
  const EXP = typeof module!=='undefined'&&module.exports ? require('./faction-life.js') : globalThis.MurimFactionLife;
  const BIRTH = typeof module!=='undefined'&&module.exports ? require('./birth-model.js') : globalThis.MurimBirth;
  const STORY = typeof module!=='undefined'&&module.exports ? require('./story-pool.js') : globalThis.MurimStoryPool;
  if(!STORY)throw Error('story-pool.js must load before engine.js');
  const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, n));
  const skill = xp => 100 * (1 - Math.exp(-xp / 1300));
  const SEASONS = ['봄', '여름', '가을', '겨울'];
  const ORIGINS = [
    { id: 'orphan', name: '천애고아', weight: 18, money: 3, support: 0 },
    { id: 'farm', name: '농가', weight: 28, money: 9, support: 0.05 },
    { id: 'craft', name: '장인의 집', weight: 18, money: 15, support: 0.08 },
    { id: 'merchant', name: '상인 가문', weight: 16, money: 30, support: 0.10 },
    { id: 'martial', name: '무인 가계', weight: 12, money: 18, support: 0.17 },
    { id: 'noble', name: '남궁세가 직계', weight: 8, money: 55, support: 0.28 }
  ];
  const SECTS = [
    {id:'namgung',name:'남궁세가',faction:'정파',place:'합비',region:'강남',quality:1.5,entry:0.48,disciples:['외성 문하','정식 문하','직전제자'],method:'창궁심법',family:'남궁',principle:'양강',rule:'혈족과 외성 문하를 구분. 가주는 남궁 혈족만 선출한다.'},
    {id:'huashan',name:'화산파',faction:'정파',place:'화산',region:'관중',quality:1.45,entry:0.51,disciples:['입문제자','정식제자','직전제자'],method:'매화심법',principle:'중정',rule:'검술 기초와 사부의 신뢰를 중시한다.'},
    {id:'shaolin',name:'소림사',faction:'정파',place:'숭산',region:'중원',quality:1.5,entry:0.5,disciples:['속가제자','정식 속가','직전제자'],method:'나한심법',principle:'양강',rule:'속가 경로로 입문. 출가와 혼인 금지는 이번 시제품에 강제하지 않는다.'},
    {id:'wudang',name:'무당파',faction:'정파',place:'무당산',region:'호북',quality:1.5,entry:0.49,disciples:['문하제자','입실제자','직전제자'],method:'태화심법',principle:'중정',rule:'사승 계보와 호흡의 운용을 중시한다.'},
    {id:'gaebang',name:'개방',faction:'정파',place:'낙양',region:'중원',quality:1.3,entry:0.82,disciples:['방도','분타 방도','직전제자'],method:'혼원심법',principle:'중정',rule:'출신보다 구휼 공적과 방도들의 신뢰를 중시한다.'},
    {id:'heuksa',name:'흑사방',faction:'사파',place:'성도',region:'서남',quality:1.4,entry:0.78,disciples:['방도','집사','직전제자'],method:'흑류심법',principle:'음유',rule:'실리와 공적을 중시. 사파 소속만으로 악행을 기록하지 않는다.'},
    {id:'demon',name:'천산마교',faction:'마교',place:'천산',region:'새외',quality:1.65,entry:0.67,disciples:['교도','수석교도','직전제자'],method:'천산심법',principle:'양강',rule:'교단의 공적과 호법 지지로 교주를 선출한다. 천마는 교주의 존호다.'},
    {id:'blood',name:'혈교',faction:'혈교',place:'서령',region:'새외',quality:1.65,entry:0.71,disciples:['교도','수석교도','직전제자'],method:'혈하심법',principle:'음유',rule:'금기 의술을 둘러싼 내분이 있다. 개혁과 이탈도 가능하며 혈마는 교주의 존호다.'}
  ];
  const MARTIAL_ARTS = {
    namgung:{basic:'청룡검법',secret:'창궁무애검법',weapon:'검',origin:'장르 관습을 본작에 채택'},
    huashan:{basic:'육합검법',secret:'이십사수매화검법',weapon:'검',origin:'사용자 피드백과 한국 무협 관습을 본작에 채택'},
    shaolin:{basic:'나한권',secret:'금강복마권',weapon:'권',origin:'장르 관습을 본작에 채택'},
    wudang:{basic:'무당장권',secret:'태극검법',weapon:'검',origin:'장르 관습을 본작에 채택'},
    gaebang:{basic:'개문권',secret:'타구봉법',weapon:'봉',origin:'장르 관습을 본작에 채택'},
    heuksa:{basic:'흑사단도',secret:'흑류팔식',weapon:'도',origin:'자체 창작'},
    demon:{basic:'천산연환도',secret:'천산파천도',weapon:'도',origin:'자체 창작'},
    blood:{basic:'혈하장',secret:'회혈수',weapon:'장',origin:'자체 창작'}
  };
  const GLOSSARY = {
    '초식':'공격과 방어를 이루는 개별 동작이나 수법.', '운기':'호흡과 의념으로 내공을 이끌어 운용하는 일.',
    '조식':'호흡을 고르게 다스리는 기초 수련.', '행공':'심법에 따라 기운을 순환시키는 수련.',
    '내력':'전투와 운기에 지금 쓸 수 있는 기운. 본작에서는 축적 내공과 별도로 소모·회복한다.',
    '내상':'몸 안에 남은 상처. 무리한 운기는 내공 손실로 이어질 수 있다.',
    '주화입마':'운기를 그르쳐 몸과 마음에 손상을 입는 상태를 가리키는 무협 표현.',
    '비무':'실력을 겨루는 대련. 본작에서는 생사결을 별도로 밝히지 않는 한 치명상이 없다.',
    '생사결':'생명을 걸고 벌이는 결투. 우회·협상이나 도주도 선택할 수 있다.',
    '녹림':'산길을 근거지로 삼는 무리나 그 사회를 이르는 장르 용어.',
    '표행':'의뢰받은 사람이나 화물을 호송하는 일.', '사승':'가르침을 주고받는 사부와 제자의 계보.',
    '진전':'문중의 핵심 무학을 전수받았다는 상태. 제자 신분·후계권과는 별개다.',
    '직전제자':'특정 사부에게 직접 배우는 제자. 본작의 최고 제자 신분이다.',
    '개파':'독립된 무학과 사승의 기틀을 세워 문파를 여는 일.', '은거':'강호의 일을 줄이고 조용히 살아가는 선택.'
  };
  function josa(text,pair='이/가') {
    text=String(text);let [withFinal,withoutFinal]=pair.split('/');if(pair==='와/과')[withFinal,withoutFinal]=['과','와'];const last=text.codePointAt(text.length-1);
    if(last<0xac00||last>0xd7a3)return text+withFinal+'('+withoutFinal+')';
    const final=(last-0xac00)%28;return text+(pair==='으로/로'?(final&&final!==8?withFinal:withoutFinal):(final?withFinal:withoutFinal));
  }
  const PLACES = [
    {name:'합비',region:'강남',x:65,y:55,desc:'남궁세가와 장터가 함께 자리한 강남의 거점.'},
    {name:'항주',region:'강남',x:77,y:72,desc:'물길과 시장이 발달한 상업 도시. 문파 없이도 생업을 이을 수 있다.'},
    {name:'화산',region:'관중',x:37,y:32,desc:'관중의 험준한 산세에 화산파의 검향이 머문다.'},
    {name:'숭산',region:'중원',x:53,y:39,desc:'하남 숭산의 소림사. 속가 문하와 민간 마을이 이웃한다.'},
    {name:'무당산',region:'호북',x:44,y:56,desc:'호북 산중의 도가 문파. 사승과 운기 수련을 중시한다.'},
    {name:'낙양',region:'중원',x:58,y:27,desc:'관부와 상단, 개방의 소식이 교차하는 도시.'},
    {name:'성도',region:'서남',x:27,y:71,desc:'공방과 약방이 발달한 서남 거점. 흑사방이 세력을 이루고 있다.'},
    {name:'천산',region:'새외',x:16,y:19,desc:'변방 교역로의 천산마교 총단. 신앙과 권력의 갈등이 이어진다.'},
    {name:'서령',region:'새외',x:17,y:48,desc:'혈교가 자리한 가상의 변방 산지. 교단의 진로를 둘러싼 다툼이 있다.'}
  ];
  const CAREERS = [
    {id:'farmer',name:'농부',base:3.5,volatility:0.14}, {id:'artisan',name:'장인',base:4.0,volatility:0.18},
    {id:'merchant',name:'상인',base:4.8,volatility:0.55}, {id:'doctor',name:'의원',base:3.9,volatility:0.18},
    {id:'teacher',name:'훈장',base:3.7,volatility:0.10}, {id:'innkeeper',name:'객잔 주인',base:4.3,volatility:0.32}
  ];
  const ACTIONS = [
    {id:'work',name:'생업',icon:'coin',desc:'현재 직업을 익히고 수입을 얻는다. 숙련이 높을수록 성장이 느려진다.'},
    {id:'sword',name:'무공 수련',icon:'sword',desc:'공개 기초무공 또는 전수받은 무공을 연마한다. 분기 수련비 0.5냥.'},
    {id:'inner',name:'내공 수련',icon:'meditate',desc:'내공량·운용·심법 숙련을 함께 기른다. 분기 약재비 0.5냥.'},
    {id:'mission',name:'문파 임무',icon:'scroll',desc:'공헌·지지도와 보수를 얻는다. 무소속은 지역 일거리로 대체.'},
    {id:'social',name:'인연 돌보기',icon:'people',desc:'가족·벗·사부와 시간을 보내며 신뢰와 행복을 기른다.'},
    {id:'rest',name:'휴식',icon:'tea',desc:'부상과 피로를 회복한다. 생계는 자동 생활과 구휼로 처리.'},
    {id:'explore',name:'강호 유람',icon:'map',desc:'낯선 인연·의뢰·기연을 찾는다. 여비 1냥, 사건 위험이 있다.'},
    {id:'seek',name:'입문 청원',icon:'home',desc:'목표 문파의 자격 심사를 청한다. 출생·기존 직업은 바뀌지 않는다.'},
    {id:'study',name:'독서·연구',icon:'book',desc:'학식을 기르고 발견한 비급의 해독과 무공 창시를 진행한다.'},
    {id:'teach',name:'전승·교육',icon:'person',desc:'제자를 가르친다. 무공 숙련 65 또는 직업 숙련 60 이상 필요.'},
    {id:'travel',name:'이동',icon:'pin',desc:'예약한 거점으로 한 분기 이동한다. 여비 2냥.'}
  ];
  ACTIONS.push({id:'investigate',name:'소문 추적',icon:'scroll',desc:'소문의 장소에서 진위를 탐문한다. 헛소문일 수도 있으며 발견과 습득은 별개다.'});
  EXP.configure(SECTS,MARTIAL_ARTS,ACTIONS);
  const RANKS = [
    {name:'일반인',sword:0,operation:0,method:0,inner:0},
    {name:'삼류',sword:16,operation:10,method:8,inner:.12},
    {name:'이류',sword:36,operation:29,method:25,inner:.48},
    {name:'일류',sword:69,operation:58,method:53,inner:1.1},
    {name:'절정',sword:80,operation:75,method:71,inner:2.1},
    {name:'초절정',sword:88,operation:83,method:81,inner:2.8},
    {name:'화경',sword:96,operation:94,method:93,inner:4.1}
  ];
  function hash(str) { let h = 2166136261; for (let i=0;i<str.length;i++) {h^=str.charCodeAt(i);h=Math.imul(h,16777619);} h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);return (h^(h>>>16))>>>0; }
  // Stateless, independent channels prevent action-specific RNG consumption from shifting mortality.
  const random = (s, channel, slot=0, tick=s.tick) => hash(`${s.seed}|${tick}|${channel}|${slot}`)/4294967296;
  const pick = (s, arr, channel, slot=0) => arr[Math.floor(random(s,channel,slot)*arr.length)];
  const sect = s => SECTS.find(x=>x.id===s.sectId);
  const discipleNames=(s,t)=>t.family&&s.clanId===t.id?[s.branchId==='branch'?'분가 수학':'본가 수학','정식 가문 제자','직전제자']:t.disciples;
  const career = s => CAREERS.find(x=>x.id===s.career);
  const careerSkill = s => skill(s.careerXP[s.career] || 0);
  const name = s => s.surname+s.givenName;
  const currentYear = s => s.birthYear+s.age;
  function log(s,text,type='사건') { s.logs.push({age:s.age,q:s.q,year:currentYear(s),month:s.q*3+1,tick:s.tick,type,text}); }
  function aptitude(s,key) { let n=0;for(let i=0;i<3;i++)n+=1+Math.floor(random(s,key,i,-1)*6);return Math.round((n-3)/15*100); }
  function createLife(givenName='무명', seed=1, options={}) {
    const s={version:VERSION,seed:String(seed),rngVersion:1,tick:0,age:0,q:0,p:0,speed:1,playing:false,alive:true,started:!!options.started,
      givenName:String(givenName).trim().slice(0,12)||'무명',surname:'',birthYear:112,location:'항주',originId:'',lineage:'민간',clanId:null,
      birthParentIds:[],guardianId:null,mentorId:null,sectId:null,discipleStatus:'없음',officeId:null,transmission:false,successorFlag:false,
      career:'farmer',careerXP:{},inner:0,swordXP:0,operationXP:0,methodXP:0,knowledgeXP:0,rank:0,merit:0,support:0,trust:25,
      method:{id:'basic',name:'기초 토납법',principle:'중정',quality:1},health:94,injury:0,fatigue:0,happiness:57,money:0,debt:0,reputation:0,ethics:0,
      plan:['work','social','work','rest'],targetSect:'gaebang',travelTarget:null,repeatYears:0,goal:'none',goalStart:8,
      spouseId:null,childIds:[],npcs:[],memberships:[],learnedSkills:[],manual:null,organization:null,creation:0,legacy:0,
      nextPlan:['work','social','work','rest'],quarterStory:null,latestPersonalStory:'',rumors:[],targetRumorId:null,
      memories:[],followUps:[],socialTargetId:null,socialMode:'auto',localReputation:{},lifeActions:{martial:0,civilian:0},peaks:{rank:0,offices:[],careers:{}},deathPresented:false,trainingFocus:'balanced',lastOutcome:null,
      innerReserve:100,combat:null,lastCombat:null,combatResultPending:false,teachingPermits:['public'],teachingSource:'public',forgottenArt:null,independentSect:null,sectRelations:{},
      pendingEvent:null,eventQueue:[],lastCommit:null,resolved:[],eventCounts:{},eventLast:{},lastEventTick:-12,
      logs:[],choices:[],milestones:[],statsAt60:null,annualIncome:0,annualExpense:0,lastYear:null,
      world:{dynasty:'대연',era:'승평',climate:'평년',unrest:0,market:1,sects:SECTS.map(x=>({id:x.id,alive:true,leaderAlive:true}))},
      autoRepeat:true,autoSave:true,notifyEvents:true,sound:false,music:false,volume:35};
    let roll=random(s,'origin',0,-1)*100;
    const o=ORIGINS.find(o=>(roll-=o.weight)<0)||ORIGINS[0];
    s.originId=options.originId||o.id;const origin=ORIGINS.find(o=>o.id===s.originId)||o;s.originId=origin.id;
    s.surname=origin.id==='noble'?'남궁':pick(s,['왕','이','장','진','유','조','주','오','정','임'],'surname');
    s.aptitude={body:aptitude(s,'body'),mind:aptitude(s,'mind'),social:aptitude(s,'social')};
    if(options.aptitude) s.aptitude={...options.aptitude};
    s.money=origin.money;s.birthSupport=origin.support;s.birthYear=122;
    s.location=origin.id==='noble'?'합비':pick(s,PLACES,'birthPlace').name;s.birthPlace=s.location;
    s.career=({craft:'artisan',merchant:'merchant'})[origin.id]||'farmer';
    if(origin.id==='noble'){s.clanId='namgung';s.lineage='직계 혈족';}
    const npc=(id,n,age,role)=>({id,name:n,age,birthYear:s.birthYear-age,role,affinity:45+Math.floor(random(s,'affinity',s.npcs.length)*25),trust:45,alive:true,goal:pick(s,['수련','가업','가족','유람'],'goal',s.npcs.length),skill:10,married:false,office:'없음',portrait:s.npcs.length%4});
    if(origin.id==='orphan') {s.guardianId='guardian';s.npcs.push(npc('guardian','주씨 아저씨',35,'보호자'));}
    else {s.birthParentIds=['father','mother'];s.guardianId='mother';s.npcs.push(npc('father',s.surname+'정호',28,'부친'),npc('mother','윤소정',25,'모친'));s.npcs[0].married=true;s.npcs[1].married=true;s.npcs[0].spouseId='mother';s.npcs[1].spouseId='father';}
    for(let i=0;i<8;i++){const p=npc('peer-'+i,pick(s,['서','백','한','송','유','임','조','당'],'npcSurname',i)+pick(s,['연','청','운','소하','진','우','설','명'],'npcGiven',i),i<4?i+1:15+i,'지인');s.npcs.push(p);}
    if(!options.originId&&!options.birth){
      if(origin.id==='noble'){const c=pick(s,BIRTH.CLANS,'birth-clan',0);options={...options,birth:{householdType:'clan',clanId:c.id,branchId:random(s,'birth-branch')<.65?'main':'branch',lineage:random(s,'birth-lineage')<.4?'direct':'collateral',place:c.id==='tang'?'성도':c.id==='paeng'?'낙양':c.id==='zhuge'?'무당산':'합비'}};}
      else if(origin.id==='martial'&&random(s,'fallen-household')<.25)options={...options,birth:{householdType:'fallen'}};
    }
    if(options.birth)BIRTH.initialize(s,options);
    log(s,`${s.world.dynasty} ${s.world.era} ${s.birthYear}년, ${s.location}의 ${options.birth?BIRTH.describe(s):origin.name}에서 ${name(s)}의 삶이 시작되었다.`,'출생');
    if(origin.id==='orphan')log(s,'혈연을 알지 못한다. 마을의 구휼과 보호자의 보살핌으로 어린 시절을 보냈다.','출생');
    for(let age=1;age<=8;age++){s.age=age;s.tick=age*4;s.q=0;s.npcs.forEach(p=>p.age++);if(age===3||age===7){s.happiness+=Math.floor(random(s,'childhood')*7)-2;log(s,age===3?'골목의 아이들과 어울리며 세상의 말을 배웠다.':'글과 숫자를 익히며 장터와 강호의 이야기를 들었다.','유년');}}
    s.health=90+Math.floor(random(s,'childHealth')*10);s.happiness=clamp(s.happiness);s.knowledgeXP=35;
    log(s,'여덟 살의 봄. 이제 사계절의 일을 직접 정할 수 있다. 무공을 배우지 않는 삶도 온전한 선택이다.','유년');
    initializeStories(s);BIRTH.initialize(s,options);EXP.initialize(s);
    return s;
  }
  const getNPC = (s,id) => s.npcs.find(n=>n.id===id);
  const livingSpouse = s => getNPC(s,s.spouseId)?.alive;
  function delta(s,key,n) {s[key]+=n;if(['health','fatigue','happiness','trust','support','reputation'].includes(key))s[key]=clamp(s[key]);if(['merit','inner','injury'].includes(key))s[key]=Math.max(0,s[key]);}
  function spend(s,n) {if(s.money<n)return false;s.money-=n;s.annualExpense+=n;return true;}
  function income(s,n) {s.money+=n;s.annualIncome+=n;}
  const canTrain = s => s.age>=8&&s.health>25&&s.injury<50;
  function planAppliesNextYear(s,q) {return q<s.q||(q===s.q&&s.quarterStory?.tick===s.tick&&s.quarterStory.mask>0);}
  function setPlan(s,q,id) {
    if(!s.alive||!Number.isInteger(q)||q<0||q>3||!ACTIONS.some(a=>a.id===id)||id==='seek'&&(s.sectId||s.independentSect))return false;
    s.nextPlan[q]=id;if(!planAppliesNextYear(s,q))s.plan[q]=id;return true;
  }
  function setPreset(s,ids) {if(!Array.isArray(ids)||ids.length!==4)return false;return ids.every((id,q)=>setPlan(s,q,id));}
  function storyContext(s) {
    const requested=s.plan[s.q],target=s.rumors.find(r=>r.id===s.targetRumorId&&['heard','expired'].includes(r.status));
    const ready=requested==='investigate'&&!target?'explore':requested;
    const actual=['sword','inner','mission','explore'].includes(ready)&&!canTrain(s)?'rest':ready;
    if(s.quarterStory?.tick===s.tick){if(!s.quarterStory.mask){s.quarterStory.actionId=actual;s.quarterStory.careerId=s.career;}return s.quarterStory;}
    const roll=random(s,'actionOutlook');const positive=clamp(.20+s.aptitude.mind/500-s.fatigue/240-s.injury/300,.03,.42);
    const poor=clamp(.12+s.fatigue/250+s.injury/300,.08,.65);
    const outlook=roll<positive?'favorable':roll>1-poor?'poor':'steady';
    s.quarterStory={tick:s.tick,actionId:actual,careerId:s.career,mask:0,outlook,boost:outlook==='favorable'?1.10:outlook==='poor'?.86:1,lines:[]};
    return s.quarterStory;
  }
  // A vignette is chosen by action and situation, not by a single global sentence dice roll.
  // Save only its short key, never full text; a resume at mid-quarter therefore remains identical.
  function storyPick(s,arr,channel,key) {
    if(!arr?.length)return '';
    const recent=s.storyMemory||[];
    const start=Math.floor(random(s,channel,0)*arr.length);
    let index=start, oldest=Infinity;
    for(let n=0;n<arr.length;n++){
      const candidate=(start+n)%arr.length;
      const last=recent.lastIndexOf(`${key}:${candidate}`);
      if(last<0){index=candidate;break;}
      if(n===0||last<oldest){index=candidate;oldest=last;}
    }
    s.storyMemory.push(`${key}:${index}`);
    if(s.storyMemory.length>240)s.storyMemory.splice(0,s.storyMemory.length-240);
    return arr[index];
  }
  function livingCompany(s){
    const candidates=s.npcs.filter(n=>n.alive&&n.age>=8&&n.affinity>=35&&n.location===s.location&&n.role!=='원한 상대');
    if(!candidates.length)return null;
    const priority=candidates.filter(n=>n.id===s.spouseId||n.id===s.mentorId);
    const pool=priority.length&&random(s,'storyBondPriority')<.47?priority:candidates;
    return pick(s,pool,'storyCompanion',3);
  }
  function storyAftermath(s){
    const lost=s.npcs.filter(n=>!n.alive&&Number.isInteger(n.deathTick)&&s.tick-n.deathTick>=0&&s.tick-n.deathTick<=18);
    if(lost.length)return {kind:'bereaved',npc:lost[lost.length-1]};
    if(s.health<45||s.injury>27)return {kind:'lowHealth'};
    if(s.fatigue>60)return {kind:'fatigue'};
    if(s.happiness<36)return {kind:'troubled'};
    if(s.happiness>75)return {kind:'good'};
    if(!s.npcs.some(n=>n.alive&&n.age>=18))return {kind:'alone'};
    return {kind:'steady'};
  }
  const punctuate = text => /[.!?]$/.test(text)?text:text+'.';
  function personalLine(s,id,stage,context) {
    let pool=STORY.POOL[id]||STORY.POOL.rest;
    const target=id==='social'?socialTarget(s):null,remote=target&&(s.socialMode==='letter'||target.location!==s.location);
    if(id==='sword'&&artProfile(s).weapon!=='검')pool={scenes:['발끝의 중심부터 잡고 배운 초식을 낮은 자세로 펼쳤다','손끝에 들어간 힘을 풀고 보법과 공격의 간격을 맞추었다','한 호흡 안에서 초식의 시작과 끝을 차분히 이었다','실초와 허초가 갈리는 순간을 거울 앞에서 되짚었다','앞선 동작보다 물러나는 발의 위치를 먼저 바로잡았다','힘을 모으는 자세와 흘리는 자세를 번갈아 익혔다'],results:['몸이 앞서 나가지 않도록 한 번 더 호흡을 골랐다','초식의 이름보다 중심을 잃지 않는 일이 어려웠다','발끝의 흔들림을 바로잡자 무공의 흐름이 조금 선명해졌다','빠른 한 번보다 정확한 한 번을 마음에 남겼다','익숙한 동작에도 아직 다듬을 여지가 남아 있었다','실전과 연마의 차이를 생각하며 기초로 돌아갔다']};
    if(id==='teach'&&skill(s.swordXP)<65)pool={scenes:['작업을 익히려는 이에게 기초부터 천천히 시범 보였다','글과 도구를 고르는 순서를 배우려는 이와 함께 살폈다','직업의 기술보다 맡은 사람에 대한 책임을 먼저 이야기했다'],results:['기술을 전하며 스스로의 오랜 습관도 돌아보았다','다음 세대가 질문한 까닭을 듣고 답을 고쳐 설명했다','몸에 익힌 배움을 말로 옮기는 일도 또 하나의 공부였다']};
    const label=STORY.SEASON[s.q]||STORY.SEASON[0];
    if(stage===1){
      const scene=storyPick(s,pool.scenes,'narrativeScene:'+id,'scene:'+id);
      context.storyFocus=scene;
      let text=punctuate(scene);
      if(remote)text=`${target.location}의 ${target.name}에게 쓴 편지를 천천히 고쳐 읽었다. `+punctuate(storyPick(s,['서로의 안부를 묻고 답장을 기다리기로 했다','멀리 있어도 지금의 사정부터 묻기로 했다','직접 만나지 못한 계절의 일을 편지에 담았다'],'remoteScene','remote-scene'));
      else if(target)text=`${josa(target.name,'와/과')} 시간을 보냈다. `+text;
      // Seeded seasonal observations vary presentation without pretending that a random encounter changed stats.
      if(random(s,'narrativeSeason:'+id)<.44)text=punctuate(storyPick(s,label,'narrativeWeather:'+id,'weather:'+s.q))+' '+text;
      if(id==='work'&&random(s,'careerDetail')<.48)text+=' '+punctuate(storyPick(s,STORY.CAREER_DETAILS[s.career]||STORY.CAREER_DETAILS.farmer,'narrativeWorkDetail','detail:'+s.career));
      if(id==='inner'&&s.method?.name&&s.method.id!=='basic'&&random(s,'narrativeMethod')<.37)text+=` ${s.method.name}의 구결과 현재 운기를 어긋나지 않게 맞추려 했다.`;
      if(id==='sword'&&s.transmission&&random(s,'narrativeSecret')<.34)text+=' 전수받은 비전 초식은 함부로 드러내지 않고 따로 연마했다.';
      if(id==='mission'&&!s.sectId)text=text.replace('문중의','마을의').replace('문파의','이웃의').replace('사형제','이웃');
      if(id==='investigate'){
        const rumor=s.rumors.find(r=>r.id===s.targetRumorId&&r.status==='heard'&&r.expiresTick>=s.tick);
        if(!rumor)text='현재 이어 갈 단서가 없어 인근의 소문부터 가려 들었다. '+punctuate(scene);
        else if(s.location!==rumor.place)text=`${rumor.place}에 남은 단서까지는 길이 멀었다. `+punctuate(scene);
      }
      return text;
    }
    const result=storyPick(s,pool.results,'narrativeResult:'+id,'result:'+id);
    const outlook=context.outlook;
    const aftermath=storyAftermath(s);
    let text=punctuate(result);
    if(s.fatigue>=65||outlook==='poor'||outlook==='favorable'||aftermath.kind==='bereaved'){
      let kind=aftermath.kind;
      if(kind==='steady'&&outlook==='poor')kind='troubled';
      if(kind==='steady'&&outlook==='favorable')kind='good';
      const addition=storyPick(s,STORY.ATMOSPHERE[kind]||STORY.ATMOSPHERE.steady,'storyMood:'+kind,'mood:'+kind);
      if(random(s,'storyMoodShown')<.55||aftermath.kind==='bereaved')text+=' '+punctuate(addition);
    }
    const companion=id==='social'?target:livingCompany(s);
    if(companion&&random(s,'storyConversation')<.43){
      const dialogue=storyPick(s,STORY.RELATIONS[companion.goal]||STORY.RELATIONS.가족,'storyTalk:'+companion.id,'talk:'+companion.goal);
      const role=companion.id===s.spouseId?'배우자':companion.id===s.mentorId?'사부':companion.role;
      text+=remote?` ${companion.name}에게서 들었던 안부를 떠올렸다. ${punctuate(dialogue)}`:` ${role} ${josa(companion.name)} ${punctuate(dialogue)}`;
    }
    if(regionalState(s).crop==='흉작'&&['work','mission','social','explore'].includes(id)&&random(s,'storyFamine')<.22)text+=' '+punctuate(storyPick(s,STORY.EVENT_DETAILS.famine,'storyFamineDetail','famine'));
    if(regionalState(s).crop==='풍작'&&id==='work'&&random(s,'storyProsper')<.18)text+=' '+punctuate(storyPick(s,STORY.EVENT_DETAILS.prosper,'storyProsperDetail','prosper'));
    return text;
  }
  // Output the numerical outcome as a ledger entry. It is not another repeated 'the action ended' sentence.
  function actionLedger(s,id,before,context,note='') {
    const f=(v,d=1)=>Number(v.toFixed(d));
    const inc=(a,b,d=1)=>`${f(a,d)} → ${f(b,d)}`;
    const desc={
      sword:`무공 숙련 ${inc(skill(before.swordXP),skill(s.swordXP),2)} · 운용 ${inc(skill(before.operationXP),skill(s.operationXP),2)}`,
      inner:`내공 ${inc(before.inner,s.inner,4)}갑자 · 심법 숙련 ${inc(skill(before.methodXP),skill(s.methodXP),2)}`,
      work:`소지금 ${inc(before.money,s.money,2)}냥 · ${career(s).name} 숙련 ${inc(before.career,careerSkill(s),2)}`,
      mission:s.sectId?`문파 공헌 ${inc(before.merit,s.merit)} · 소지금 ${inc(before.money,s.money,2)}냥`:`이웃의 일손을 돕고 소지금 ${inc(before.money,s.money,2)}냥 · 명성 ${f(s.reputation,1)}`, 
      social:`행복 ${inc(before.happiness,s.happiness)} · 함께한 인연을 돌봄`,
      rest:`건강 ${inc(before.health,s.health)} · 피로 ${inc(before.fatigue,s.fatigue)}`,
      explore:`${s.plan[s.q]==='investigate'?'추적할 단서가 없어 주변 견문을 살핌 · ':''}견문 경험 ${inc(before.knowledgeXP,s.knowledgeXP)} · ${s.location}에서 여정을 이어 감`,
      seek:`입문 심사: ${s.sectId?'이미 문파에 소속됨':(s.pendingEvent||s.eventQueue.some(e=>e.id==='join-'+s.targetSect))?'청원 접수':'문규·입문 자격 확인'} · 대상 ${s.targetSect?SECTS.find(t=>t.id===s.targetSect)?.name:''}`, 
      study:`학식 숙련 ${inc(skill(before.knowledgeXP),skill(s.knowledgeXP),2)}${s.manual?' · 비급 해독 '+f(s.manual.progress,1)+'%':''}`,
      teach:`전승 ${inc(before.legacy,s.legacy,2)} · 소지금 ${inc(before.money,s.money,2)}냥`,
      travel:`현재 거점 ${s.location} · 소지금 ${inc(before.money,s.money,2)}냥`,
      investigate:`소문 ${s.rumors.find(r=>r.id===s.targetRumorId)?.status==='investigated'?'단서 확인':s.rumors.find(r=>r.id===s.targetRumorId)?.status==='false'?'허위 판명':s.rumors.find(r=>r.id===s.targetRumorId)?.status==='heard'?'행선지 확인 필요':'추적 대상 없음'} · ${s.location}`
    };
    const text=(note?note:'')+(desc[id]||'한 계절의 일과를 정리했다');
    // An unchanged rumour target is a warning once, not 30 copies of the same sentence.
    if(id==='investigate'&&s.rumors.find(r=>r.id===s.targetRumorId)?.status==='heard'){
      const key=`rumor-warning:${s.targetRumorId}:${s.location}`;
      if(s.storyMemory.includes(key))return;
      s.storyMemory.push(key);
      if(s.storyMemory.length>240)s.storyMemory.splice(0,s.storyMemory.length-240);
    }
    // The account ledger need not repeat an identical no-change status every year.
    // Keep one account per completed quarter even when a numerical state is unchanged.
    log(s,text,'행동');
  }
  function rumorTexts(place){
    const content={
      manual:[`${place}의 산등성이 아래 멸문한 청계문의 검보가 묻혔다는 말이 전해졌다.`,`${place}에서 돌아온 표객이 청계문 폐원의 검보를 봤다는 증인의 이름을 알려 주었다.`,`${place} 장터의 폐서 수집가가 청계문의 십이검을 언급했다.`,`${place}의 허물어진 담장에 청계문 검로가 새겨졌다는 소문이 흘렀다.`,`${place} 인근의 늙은 책장수가 청계문의 옛 검보를 찾는 이를 봤다고 했다.`,`${place}의 묘지기에게서 청계문 유물을 숨겼던 폐원 이야기를 들었다.`],
      healer:[`${place} 약방의 나그네 의원이 오래된 내상을 살핀다는 이야기를 들었다.`,`${place}의 의원이 돈보다 환자의 사정을 먼저 묻는다며 소문이 났다.`,`${place}에서 돌아온 상인이 상처를 살피는 떠돌이 의원의 이름을 전했다.`,`${place} 장터의 약초꾼이 외지에서 온 의원의 치료법을 이야기했다.`,`${place}의 작은 의방에 밤마다 환자가 찾아온다는 말을 들었다.`,`${place} 근처 물레방앗간에서 오래된 내상을 다루는 의원이 머문다고 했다.`],
      master:[`${place}의 객잔에 이름을 감춘 무인이 머물며 비무 상대를 구한다고 했다.`,`${place} 술집의 노객이 상대를 다치게 하지 않는 비무를 청한다는 소식이 들렸다.`,`${place} 장터에 예를 지키는 검객이 나타나 초식을 논한다고 했다.`,`${place}의 작은 연무장에 길손 한 사람이 매일 같은 시각 나타난다고 했다.`,`${place} 객잔 주인이 신분을 묻지 않는 무인을 보았다고 말했다.`,`${place}의 외진 객방에 머무는 무인이 밤마다 목검 소리를 낸다는 풍문이 돌았다.`]
    };
    return content;
  }
  const RUMOR_KINDS=['manual','healer','master','trade','relief','missing','dispute','apprentice'];
  function hearRumor(s,kind=null,force=false) {
    if(!force&&random(s,'hearRumor')>.055)return null;
    const active=s.rumors.filter(r=>r.status==='heard'&&r.expiresTick>=s.tick);if(active.length>=6)return null;
    const type=kind||pick(s,RUMOR_KINDS,'rumorKind');if(!RUMOR_KINDS.includes(type))return null;
    const subject=pick(s,s.npcs.filter(n=>n.alive),'rumorSubject');const source=pick(s,s.npcs.filter(n=>n.alive&&n.location===s.location),'rumorSource');
    const place=['missing','apprentice'].includes(type)&&subject?subject.location:pick(s,PLACES,'rumorPlace').name;
    const id=`rumor-${s.tick}-${type}`;if(s.rumors.some(r=>r.id===id))return null;
    const region=regionalState(s,place);
    const content={manual:`${place} 부근의 오래된 폐원에 멸문한 청계문의 검보가 남아 있다는 소문을 들었다.`,healer:`${place}의 약방에 떠돌이 의원이 머물며 오래된 내상을 살핀다는 말을 들었다.`,master:`${place}의 객잔에 이름을 감춘 무인이 머물며 비무 상대를 찾는다는 소문을 들었다.`,trade:`${place} 장터에서 새 거래처를 구한다는 말이 돈다. 물목과 약속을 직접 확인해야 한다.`,relief:`${place} 공동 창고에서 ${region.crop==='흉작'?'흉작을 견딜 구휼':'비축 곡식 정리'}를 도울 손을 구한다.`,missing:`${subject?.name||'길손'}의 소식이 ${place}에서 끊겼다는 말을 들었다. 실종인지 늦은 서신인지 확인되지 않았다.`,dispute:`${place} 길목의 ${region.conflict?'분쟁':'통행 장부 시비'}를 중재할 사람을 구한다.`,apprentice:`${subject?.name||'이웃'}에게 배움을 청할 이가 ${place}에 찾아온다는 말을 들었다.`};
    const rumor={id,kind:type,place,text:storyPick(s,rumorTexts(place)[type]||[content[type]],'rumorText:'+type,'rumor:'+type),heardTick:s.tick,expiresTick:s.tick+(['trade','missing'].includes(type)?12:24),status:'heard',sourceId:source?.id||null,subjectId:['missing','apprentice'].includes(type)?subject?.id||null:null,rootCause:`${place}:${region.sinceTick}:${type}`,sourceLabel:source?.name||'장터의 행상'};s.rumors.push(rumor);
    if(s.rumors.length>40)s.rumors.shift();log(s,rumor.text,'소문');return rumor;
  }
  // A bounded whole-life hash ledger prevents exact recycled prose even after long periods.
  // This is presentation-only RNG; combat, mortality and economy use independent channels.
  function neverRepeatProse(s,text,id,stage) {
    const seen=s.storyHashes||[];
    const original=text;
    const codas=id==='sword'&&artProfile(s).weapon!=='검'?['무학은 손끝뿐 아니라 발끝에도 남았다','배움의 이름보다 몸에 익힌 과정이 오래 남았다','한 초식에도 배우는 이의 체격과 사정이 달랐다','다음 연마에서는 서두르지 않기로 했다','스스로의 빈틈을 감추지 않고 기록했다','오늘의 호흡을 다음 계절의 기초로 삼았다']:STORY.CODA[id]||STORY.CODA.rest;
    const withCoda=random(s,'codaShown:'+id+':'+stage)<.63;
    if(withCoda)text+=' '+punctuate(storyPick(s,codas,'coda:'+id+':'+stage,'coda:'+id));
    if(seen.includes(hash(text))){
      const rotation=Math.floor(random(s,'uniqueCoda:'+id+':'+stage)*codas.length);
      for(let i=0;i<codas.length;i++){
        const expanded=original+' '+punctuate(codas[(rotation+i)%codas.length]);
        if(!seen.includes(hash(expanded))){text=expanded;break;}
        // Context-consistent second observation for very long-lived, focused characters.
        const context=STORY.SEASON[s.q][(rotation+i)%STORY.SEASON[s.q].length];
        const twice=expanded+' '+punctuate(context);
        if(!seen.includes(hash(twice))){text=twice;break;}
      }
    }
    // Text collisions are improbable; keep a bounded ledger for imported-save sanity.
    seen.push(hash(text));
    if(seen.length>2400)seen.splice(0,seen.length-2400);
    return text;
  }
  function advanceNarrative(s,progress=1) {
    if(!s.alive||!s.started||s.pendingEvent||s.combat)return false;
    const context=storyContext(s);let changed=false;
    for(const stage of [1,2]){if(progress<(stage/3)||context.mask&(1<<(stage-1)))continue;
      context.mask|=1<<(stage-1);const text=neverRepeatProse(s,personalLine(s,context.actionId,stage,context),context.actionId,stage);context.lines.push(text);
      s.latestPersonalStory=text;log(s,text,'발자취');changed=true;
      if(stage===2){const mood=random(s,'smallStoryEffect');if(mood<.12)delta(s,'happiness',1);else if(mood>.90)delta(s,'fatigue',1);
        if(['work','social','explore','investigate'].includes(context.actionId))hearRumor(s);
      }
    }
    return changed;
  }
  function marriageChance(age) {return age<18?0:age<35?.13:age<40?.025:age<50?.008:.003;}
  function childChance(s) {const n=getNPC(s,s.spouseId);if(!n?.alive||s.age<20||n.age<18||n.affinity<55||s.childIds.length>=3)return 0;const age=Math.max(s.age,n.age);return age<30?.055:age<35?.04:age<40?.02:age<45?.006:age<50?.001:0;}
  function maritalLabel(s,n) {if(['부친','모친'].includes(n.role)){if(n.married&&n.maritalStatus==='remarried')return '기혼(재혼)';const other=getNPC(s,n.spouseId||s.birthParentIds.find(id=>id!==n.id));return other&&!other.alive?'사별':'기혼';}return n.maritalStatus==='widowed'?'사별':n.maritalStatus==='separated'?'이별':n.married?'기혼':'미혼';}
  function independentArt(s) {return s.createdArt?{name:s.createdArt,source:'created'}:s.forgottenArt?.learned?{name:s.forgottenArt.name,source:'lost'}:null;}
  function foundingRequirements(s) {
    return [{label:'현재 문파에서 독립한 상태',ok:!s.sectId&&!s.independentSect},{label:'직접 창시한 상승무공 또는 해독·습득한 잊힌 무공',ok:!!independentArt(s)},
      {label:'일류 이상 · 무공 숙련 65 이상',ok:s.rank>=3&&skill(s.swordXP)>=65},{label:'강호 명망 35 이상',ok:s.reputation>=35},
      {label:'뜻을 함께할 생존 인연 2명(호감 60 이상)',ok:s.npcs.filter(n=>n.alive&&n.age>=18&&n.affinity>=60).length>=2},
      {label:'문중 마련 80냥 · 기존 조직 없음',ok:s.money>=80&&!s.organization}];
  }
  function canFoundSect(s) {return s.age>=18&&foundingRequirements(s).every(r=>r.ok);}
  function canOpenDojo(s) {const source=s.teachingSource;return s.age>=18&&!s.organization&&s.money>=80&&skill(s.swordXP)>=65&&s.teachingPermits.includes(source)&&(source==='public'||source==='created'&&!!s.createdArt||source==='lost'&&s.forgottenArt?.learned||s.learnedSkills.some(a=>a.source===source));}
  const choice = (id,label,hint,effects={},extra={}) => ({id,label,hint,effects,...extra});
  const ev = (id,title,text,opts,condition=()=>true,cooldown=24,once=false) => ({id,title,text,opts,condition,cooldown,once});
  // Story state is saved with the life. Old logs are never turned into invented past facts.
  function initializeNPC(s,n,index=0) {
    if(n.careerId===undefined)n.careerId=['부친','모친','보호자'].includes(n.role)?s.career:CAREERS[index%CAREERS.length].id;
    if(n.martial===undefined)n.martial=n.role==='사부';
    if(!n.martial&&n.goal==='수련')n.goal='가업';
    if(n.martialSkill===undefined)n.martialSkill=n.martial?n.skill:0;
    if(n.civilSkill===undefined)n.civilSkill=n.martial?12:n.skill;
    if(n.location===undefined)n.location=['부친','모친','보호자','자녀','배우자','사부'].includes(n.role)||index<5?s.location:PLACES[index%PLACES.length].name;
    if(n.sectId===undefined)n.sectId=n.role==='사부'?s.sectId:null;
    if(n.teachingStyle===undefined)n.teachingStyle=index%2?'엄격':'배려';
    if(!n.martial&&n.office==='교관')n.office='없음';
  }
  function initializeStories(s) {
    s.storyMemory??=[];s.storyHashes??=[];s.storyThreads??=[];
    s.memories??=[];s.followUps??=[];s.socialTargetId??=null;s.socialMode??='auto';s.localReputation??={};s.lifeActions??={martial:0,civilian:0};s.peaks??={rank:s.rank,offices:[],careers:{}};s.deathPresented??=!s.alive;s.trainingFocus??='balanced';s.lastOutcome??=null;
    s.world.regions??=PLACES.map(p=>({place:p.name,crop:'평년',conflict:false,recovery:0,sinceTick:s.tick}));
    s.npcs.forEach((n,i)=>initializeNPC(s,n,i));
    s.knownMethods??=[{...s.method,age:s.age}];
    for(const r of s.rumors){r.sourceId??=null;r.subjectId??=null;r.rootCause??='legacy';r.sourceLabel??='이전에 들은 소식';}
  }
  function regionalState(s,place=s.location){return s.world.regions.find(r=>r.place===place);}
  function regionalMultiplier(s) {
    const r=regionalState(s),job=s.career;let n=1;
    if(r.crop==='흉작')n*=job==='farmer'?.70:['merchant','doctor'].includes(job)?1.06:.92;
    if(r.crop==='풍작')n*=job==='farmer'?1.12:job==='merchant'?.96:1.02;
    if(r.conflict)n*=job==='innkeeper'?.82:.94;
    if(r.recovery)n*=job==='artisan'?1.09:1.02;
    return n;
  }
  function socialTarget(s) {
    const explicit=getNPC(s,s.socialTargetId);if(explicit?.alive)return explicit;
    const all=s.npcs.filter(n=>n.alive&&n.age>=8&&n.role!=='원한 상대');
    return all.sort((a,b)=>{const score=n=>(n.location===s.location?40:0)+(['부친','모친','보호자','배우자','자녀'].includes(n.role)?15:0)+(n.id===s.mentorId?12:0)-n.affinity*.25;return score(b)-score(a)||a.id.localeCompare(b.id);})[0]||null;
  }
  function remember(s,type,p,o,text,status='open') {
    const id=`memory-${p.uid}`;const prior=s.memories.find(m=>m.id===id);if(prior)return prior;
    const m={id,type,causeId:p.id,causeTick:s.tick,age:s.age,actorId:p.context.actorId||null,place:s.location,choice:o.id,label:o.label,outcome:text,status};s.memories.push(m);return m;
  }
  function later(s,m,id,quarters=8,extra={}) {if(s.followUps.some(f=>f.memoryId===m.id&&f.id===id))return;s.followUps.push({id,dueTick:s.tick+quarters,memoryId:m.id,actorId:m.actorId,...extra});}
  function actorFor(s,id) {
    const specs={inkseal:['동문',true,26,'teacher'],waybill:['표사',true,32,'merchant'],grainbook:['마을 이웃',false,36,'farmer'],bladeoath:['문인',true,24,'teacher'],familydebt:['옛 은인',false,52,'artisan'],physician:['의방의 연락인',false,34,'doctor'],pilgrim:['노객',true,68,'teacher']};
    if(specs[id]&&s.npcs.length<95){const [role,martial,age,careerId]=specs[id],nid=`story-actor-${id}-${s.tick}`;const existing=getNPC(s,nid);if(existing)return existing.id;const n={id:nid,name:pick(s,['백','정','한','서','유','진'],'arcSurname:'+id)+pick(s,['소담','청우','무진','도윤','서현','운학'],'arcGiven:'+id),role,martial,age,careerId,alive:true,affinity:45,trust:45,goal:martial?'수련':'가업',skill:martial?45:38,office:'없음',married:false,portrait:s.npcs.length%4,location:s.location,sectId:['inkseal','bladeoath','pilgrim'].includes(id)?s.sectId:null};s.npcs.push(n);initializeNPC(s,n,s.npcs.length-1);return n.id;}
    let list=s.npcs.filter(n=>n.alive);
    if(['parent','chain-family','familydebt'].includes(id))list=list.filter(n=>['부친','모친','보호자'].includes(n.role));
    else if(['advice','chain-mentor','mentorloss','transmission'].includes(id))return getNPC(s,s.mentorId)?.id||null;
    else if(['spouse','child'].includes(id))return s.spouseId;
    else if(id==='childpath')list=list.filter(n=>s.childIds.includes(n.id)&&n.age>=16);
    else if(['friend','oldLetter'].includes(id))list=list.filter(n=>n.role==='지인');
    else if(['chain-guest','first-pupil'].includes(id))list=list.filter(n=>['지인','자녀'].includes(n.role)&&n.location===s.location&&n.age>=16);
    else list=list.filter(n=>n.location===s.location&&n.age>=16&&n.role!=='원한 상대');
    return list.length?pick(s,list,'eventActor:'+id).id:null;
  }
  function relationChange(s,actorId,amount){const n=getNPC(s,actorId);if(n?.alive){n.affinity=clamp(n.affinity+amount);n.trust=clamp(n.trust+amount/2);}return n;}
  function updatePeaks(s){s.peaks.rank=Math.max(s.peaks.rank,s.rank);if(s.officeId&&!s.peaks.offices.includes(s.officeId))s.peaks.offices.push(s.officeId);for(const c of CAREERS)s.peaks.careers[c.id]=Math.max(s.peaks.careers[c.id]||0,skill(s.careerXP[c.id]||0));}
  function storyQuarter(s) {
    updatePeaks(s);
    for(const thread of [...s.storyThreads]){if(thread.dueTick>s.tick||s.tick-s.lastEventTick<5)continue;queue(s,thread.id,{actorId:thread.actorId||null,memoryId:thread.memoryId||null,starterChoice:thread.starterChoice,rootCause:thread.rootCause||'이전의 선택'});s.storyThreads.splice(s.storyThreads.indexOf(thread),1);}
    for(const f of [...s.followUps]){if(s.tick<f.dueTick)continue;const m=s.memories.find(m=>m.id===f.memoryId);if(!m){s.followUps.splice(s.followUps.indexOf(f),1);continue;}
      if(f.automatic){const n=getNPC(s,f.actorId);const text=n&&!n.alive?`${n.name}의 부고를 들었다. ${m.age}세에 나눈 약속과 ${m.label}의 기억을 일대기에 남겼다.`:`${n?.name||m.place+'의 이웃'}에게서 후일담이 왔다. ${m.age}세에 택한 ‘${m.label}’ 뒤로 ${m.outcome}`;m.status='closed';m.aftermath=text;log(s,text,'후일담');s.followUps.splice(s.followUps.indexOf(f),1);}
      else if(s.tick-s.lastEventTick>=5&&!s.eventQueue.some(e=>e.context.memoryId===m.id)&&s.pendingEvent?.context.memoryId!==m.id){queue(s,f.id,{memoryId:m.id,actorId:f.actorId,rootCause:m.causeId});s.followUps.splice(s.followUps.indexOf(f),1);}
    }
  }
  function eventPresentation(s) {
    const p=s.pendingEvent;if(!p)return null;const e=eventDef(p.id),n=getNPC(s,p.context.actorId),m=s.memories.find(m=>m.id===p.context.memoryId);
    let text=eventText(s,p.id,p.context);
    if(n&&!n.alive&&Object.values(ARC_NEXT).includes(p.id))text='지난 선택의 당사자가 남긴 서찰과 장부가 전해졌다. 당사자의 삶은 끝났지만 남은 기록을 어떻게 정리할지 선택할 수 있다.';
    if(n)text=`${n.name}${n.alive?` (${n.role} · ${n.location})`:' (고인)'}의 사정이다. `+text;
    if(n&&!n.alive)text+=' 당사자는 이미 세상을 떠났다. 만남 대신 남은 기록과 약속을 정리한다.';
    if(p.id==='friend'&&n&&n.location!==s.location)text+=' 멀리 머물고 있어 직접 방문에는 여비와 시간이 필요하다.';
    if(p.id==='mentorloss')text+=' 배운 무학과 사승 이력은 남으며 혼자 수련하거나 새 스승을 찾을 수 있다.';
    if(p.id==='chain-village')text+=` 이곳의 작황은 ${regionalState(s).crop}이다. 나눔은 수익을 보장하지 않는다.`;
    if(p.id==='chain-mentor'&&n)text+=` ${n.teachingStyle==='엄격'?'사부는 기초의 정확함과 맡은 일을 끝내는 태도를 중시한다.':'사부는 몸을 해치지 않는 호흡과 동문의 사정을 살피는 태도를 중시한다.'}`;
    if(p.id==='transmission'&&n)text+=` ${n.teachingStyle==='엄격'?'초식의 빈틈을 짚는 시연':'호흡과 동문을 살피는 지도'}로 이해를 확인한다.`;
    if(p.id==='ruin')text+=` ${SECTS.find(t=>t.id===p.context.sectId)?.name||'옛 문중'}의 지원은 끊겼지만 혈연과 배움은 지워지지 않는다.`;
    return {title:e.title,text,actor:n?.name||null,cause:m?`${m.age}세 · ${eventDef(m.causeId)?.title||'지난 선택'} · ${m.label}`:p.context.rootCause||null};
  }
  function biographyLines(s) {
    const origin=ORIGINS.find(o=>o.id===s.originId)||BIRTH.profile(s),lines=[`${name(s)}은(는) ${s.birthPlace}의 ${origin.name}에서 태어나 ${s.age}세까지 자신의 삶을 걸었다.`];
    for(const m of s.memberships)lines.push(`${m.from}~${m.to}세, ${SECTS.find(t=>t.id===m.sectId).name}에서 배웠고 ${m.reason} 뒤에도 그 배움을 간직했다.`);
    for(const m of s.memories.slice().sort((a,b)=>a.causeTick-b.causeTick)){const n=getNPC(s,m.actorId);lines.push(`${m.age}세, ${n?n.name+'의 사정에서 ':''}‘${m.label}’을 택했다. ${m.aftermath||m.outcome}${m.status==='open'?' 끝내 답을 듣지 못한 약속도 남았다.':''}`);}
    const marriages=s.choices.filter(c=>c.event==='marriage'&&c.choice==='yes');if(marriages.length)lines.push(`혼인으로 이어진 인연은 ${marriages.length}번이었다. ${s.npcs.filter(n=>['배우자','옛 배우자'].includes(n.role)).map(n=>n.name+(n.alive?'':'(고인)')).join(', ')}와 나눈 날들은 마지막 혼인 상태와 별개로 남는다.`);
    lines.push(`가장 높이 닿은 무학: ${RANKS[s.peaks.rank].name}. 맡았던 직위: ${s.peaks.offices.join(', ')||'없음'}.`);
    lines.push(`마지막에는 ${career(s).name}${s.officeId?' · '+s.officeId:''}으로 지냈다. ${ending(s).join(' · ')}.`);return lines;
  }
  function farewell(s) {const a=s.lifeActions,martial=a.martial>a.civilian,total=a.martial+a.civilian,both=a.martial>0&&a.civilian>0;
    const life=martial?(s.retired?'오래 걸었던 강호에서 물러나 남은 날을 보냈다.':s.reputation>=60?'강호에 이름과 인연을 새기며 살았다.':'거친 강호를 견디며 자신의 길을 걸었다.'):`${career(s).name}의 일을 이어가며 ${s.happiness>=60?'사람들과 평온한 날들을 나누었다.':'살림과 인연을 지키려 애썼다.'}`;
    return `${name(s)}, ${s.age}세의 ${SEASONS[s.q]}에 ${s.deathCause}으로 생을 마치다. ${life}${both?` 무학과 생업을 모두 경험했고, 기록된 주요 활동 중 ${Math.round(Math.max(a.martial,a.civilian)/total*100)}%를 ${martial?'무학과 사문의 일':'생업'}에 쏟았다.`:''} ${s.peaks.offices.length?'한때 '+s.peaks.offices.join(' · ')+'의 책임을 맡았다. ':''}그가 고른 길과 남긴 인연은 한 편의 일대기가 되었다.`;}
  function artProfile(s,art=s.learnedSkills.at(-1)) {
    const source=art?.source||'public',profiles={namgung:['검','정면 압박',.03,'내력 소모가 큰 정면 승부'],huashan:['검','빈틈을 잇는 연환',.025,'지친 몸에서는 연환이 흐트러진다'],shaolin:['권','안정된 근거리 수비',.02,'먼 거리와 퇴로 확보에는 불리'],wudang:['검','힘을 흘리는 운용',.025,'운용 숙련이 낮으면 뜻을 살리기 어렵다'],gaebang:['봉','거리와 퇴로 확보',.02,'좁은 곳에서 긴 병기를 다루기 어렵다'],heuksa:['도','짧은 거리의 속공',.025,'장기전에는 집중을 잃기 쉽다'],demon:['도','강한 일격',.03,'힘을 몰아 쓰면 회복이 필요하다'],blood:['장','정밀한 운기',.025,'부상 중에는 섬세한 운용이 어렵다'],created:['종합','빈틈을 보완한 전승',.025,'완성 뒤에도 제자의 체격에 맞는 검증 필요'],lost:['검','부드러운 연결',.025,'해독만으로 실전 경험이 생기지는 않는다'],public:['기초','호신과 기본기',0,'상승 무학의 깊이에는 미치지 못한다']};
    const [weapon,use,bonus,weakness]=profiles[source]||profiles.public;return {weapon:art?.weapon||weapon,use,bonus,weakness};
  }
  function artModifier(s,stance){if(!s.learnedSkills.length)return 1;const art=s.learnedSkills.at(-1),p=artProfile(s,art);let bonus=p.bonus*(s.fatigue>60?.35:1);if(art.source==='wudang'&&skill(s.operationXP)<40)bonus*=.5;if(stance==='flee'&&art.source==='gaebang')bonus+=.025;return clamp(1+bonus,1,1.055);}
  function applyStory(s,p,o) {
    const actor=getNPC(s,p.context.actorId),prior=s.memories.find(m=>m.id===p.context.memoryId);let text='';
    if(p.id.endsWith('-return')){
      if(!prior)return '이전 약속의 기록을 확인할 수 없어 후일담을 보류했다.';
      text=actor&&!actor.alive?`${actor.name}의 부고 앞에서 함께한 날을 기록했다.`:
        prior.causeId==='chain-village'?(regionalState(s,prior.place).crop==='흉작'?'흉작이 이어져 당장 갚을 여력은 없었다. 함께한 수고와 남은 빚을 장부에 적었다.':'살림은 조금 회복되었다. 나눔의 기억은 남았지만 재산이 저절로 불어나지는 않았다.'):
        `${actor?.name||'그 사람'}${actor?.location===s.location?'의 안부를 직접 확인했다.':'에게 서신으로 안부를 전했다.'} 지난 ${prior.label}의 기억을 서로의 삶에 남겼다.`;
      prior.status='closed';prior.aftermath=text;relationChange(s,prior.actorId,o.id==='close'?1:5);return text;
    }
    switch(p.id){
      case 'chain-guest':text=o.id==='lodge'?'잠자리와 끼니를 내어 주었다. 회복 여부는 의방의 진료와 이후의 삶에 달렸다.':o.id==='doctor'?'의방에 연결했다. 직접 치료를 했다고 기록하지는 않았다.':o.id==='official'?'관아에 신원을 물어 책임 있는 도움을 구했다.':'물을 나누고 길을 알려 주었지만 돌볼 책임까지 맡지는 않았다.';break;
      case 'chain-village':text=o.id==='home'?'가족의 끼니를 먼저 챙겼다. 이웃에게 도움을 보장하지 못한다고 밝혔다.':'종자와 끼니, 공동 구휼에 힘을 보탰다. 이후 작황에 따라 사정이 달라질 것이다.';break;
      case 'chain-mentor':text=`${actor?.name||'사부'}에게 ${o.label}의 뜻을 전했다. ${o.id==='honest'?'몸을 돌보는 것도 긴 수련의 일부였다.':'가르침은 문중의 일과 함께 이어졌다.'}`;break;
      case 'chain-family':text=o.id==='career'?'흔들리는 지원에 기대는 대신 생업을 준비했다. 성씨와 지난 배움은 보존되었다.':'가계의 위기 속에서 할 수 있는 책임을 맡았다. 출신이 앞으로의 진로를 정하지는 않았다.';break;
      case 'sect-warning':{const w=s.world.sects.find(t=>t.id===p.context.sectId);if(w){w.response=o.id;w.protected=o.id==='protect';}if(o.id==='leave')s.nextPlan=['work','social','work','rest'];text='위기 앞에서 고른 책임을 기록했다. 문중의 이후 형편은 시간 속에서 결정된다.';break;}
      case 'training-advice':s.trainingFocus=o.id==='body'?'body':o.id==='breath'?'breath':'balanced';text='수련의 초점을 바꾸었다. 부족한 조건은 상세의 능력 화면에서 확인할 수 있다.';break;
      case 'first-pupil':{const martial=s.createdArt||s.organization&&['sect','dojo'].includes(s.organization.type);if(martial&&s.organization?.type==='dojo'&&!s.teachingPermits.includes(s.organization.teachingSource))return '현재 전수 허가를 확인할 수 없어 무공 지도는 보류했다.';if(actor?.alive&&o.id!=='wait'){actor.goal=martial?'수련':'가업';actor.martial=!!martial;if(martial)actor.sectId=s.independentSect?.id||null;else actor.careerId=s.career;}text=o.id==='wait'?'당장 가르치지는 않고 준비 뒤 다시 안부를 묻기로 했다.':martial?'허가된 범위와 무학의 약점을 밝히고 첫 배움의 과정을 남겼다.':'대표 작업을 함께 살피며 직업의 책임과 배움을 나누었다.';break;}
      case 'retired-letter':text=o.id==='decline'?'은거처와 가족을 지키기로 했다. 정중한 거절도 이 삶이 택한 책임이었다.':o.id==='delegate'?'옛 인연을 적절한 사람에게 연결했다. 강호에 복귀하지 않고도 도울 수 있었다.':'직접 안부를 살피고 은거처로 돌아왔다. 모든 부탁을 다시 맡겠다고 하지는 않았다.';break;
      case 'leader-heir':{const t=sect(s);const candidates=s.npcs.filter(n=>n.alive&&n.age>=18&&n.martial&&n.affinity>=55&&(!t?.family||n.clanId===t.id&&n.birthStatus==='recognized'&&['direct','collateral'].includes(n.lineage)));if(o.id==='qualified'&&candidates.length){s.heirId=candidates[0].id;text=`${candidates[0].name}을(를) 후보로 추천했다. 확정 승계는 원로들의 심사와 지지를 필요로 한다.`;}else text=o.id==='qualified'?'현재 혈족·문인 자격을 충족하는 후보가 없어 공개 심사를 준비했다.':'후계권을 성급히 약속하지 않고 다음 세대의 절차를 남겼다.';break;}
      case 'leader-dispute':text='집단 안의 분쟁을 맡아 판결과 절차를 기록했다. 직위와 무학의 높이는 별개의 책임이다.';break;
      default:text=p.id.startsWith('sect-life-')?`${sect(s)?.name||'옛 사문'}에서 ${o.label}의 선택을 남겼다. 문규와 사람들의 기억이 함께 쌓였다.`:p.id.startsWith('rumor-')?'소문의 내용을 실제 당사자와 장부에 대조했다. 확인한 일만 기록했다.':'현재의 약속을 기록했다.';
    }
    const type=p.id==='chain-guest'?'구명':p.id==='chain-village'?'빚':'약속';const m=remember(s,type,p,o,text,['training-advice','sect-warning'].includes(p.id)?'closed':'open');
    if(p.id.startsWith('chain-'))later(s,m,p.id+'-return',6+Math.floor(random(s,'followDelay')*7));
    else if(o.id==='wait')later(s,m,'first-pupil',8,{automatic:true});
    else later(s,m,p.id,8,{automatic:true});
    if(actor?.alive)relationChange(s,actor.id,o.id==='decline'||o.id==='pass'?1:4);
    const old=s.localReputation[s.location]||0;s.localReputation[s.location]=clamp(old+(o.id==='decline'||o.id==='home'?0:2),-50,50);return text;
  }
  const EVENTS = [
    ev('school','마을의 서당','훈장이 아이들에게 글을 가르친다. 품을 보태면 학비를 대신할 수 있다고 한다.',[choice('learn','품을 보태 글을 배운다','학식 +70 XP · 피로 +5',{knowledgeXP:70,fatigue:5}),choice('play','벗과 들판에 나간다','행복 +5',{happiness:5})],s=>s.age<18,24,true),
    ev('help','이웃의 손길','살림이 빠듯한 것을 알아챈 이웃이 곡식을 내민다.',[choice('accept','도움을 받고 훗날 갚기로 한다','소지금 +4냥 · 행복 +3',{money:4,happiness:3}),choice('work','장터의 일을 함께 돕는다','소지금 +6냥 · 피로 +6',{money:6,fatigue:6})],s=>s.money<12,24),
    ev('talent','뜻밖의 소질','반복하던 일이 어느 순간 손에 익었다. 이 감각을 어디에 쓸까.',[choice('craft','생업에 집중한다','직업 경험 +90',{careerXP:90}),choice('martial','기초 무공을 익힌다','무공 경험 +75 · 수련 계획은 직접 변경',{swordXP:75}),choice('life','서두르지 않고 삶을 즐긴다','행복 +7',{happiness:7})],s=>s.age<23,20,true),
    ev('harvest','흉년의 문턱','비가 제때 오지 않았다. 종자를 아낄지, 마을 공동 창고를 찾을지 고민한다.',[choice('seed','좋은 종자를 산다','6냥 지출 · 직업 경험 +90',{money:-6,careerXP:90},{cost:6}),choice('relief','관아의 구휼을 신청한다','3냥 지원 · 강제 전투 없음',{money:3,happiness:-2})],s=>s.age>=16&&s.career==='farmer',28),
    ev('craftorder','공방의 큰 주문','상단이 정교한 물건을 주문했다. 숙련과 납기를 함께 살펴야 한다.',[choice('large','큰 주문을 맡는다','숙련에 따라 순수익 6~20냥 · 피로 +10',{}, {special:'craftOrder'}),choice('small','작은 물건부터 만든다','수입 +5냥 · 직업 경험 +35',{money:5,careerXP:35})],s=>s.age>=16&&s.career==='artisan',20),
    ev('trade','상단의 동행 제안','먼 장터에 물건을 팔자는 제안이다. 예상 이익만큼 손실 가능성도 크다.',[choice('safe','소규모로 거래한다','순수익 +5냥',{money:5}),choice('risk','15냥을 출자한다','60%: 순이익 18냥 · 40%: 15냥 손실',{}, {cost:15,special:'trade'})],s=>s.age>=18&&s.career==='merchant',20),
    ev('herbs','약초의 계절','의방에서 약초를 구한다. 깊은 산에는 더 귀한 약재도 있다고 한다.',[choice('safe','마을 주변을 살핀다','수입 +5냥 · 의술 경험 +40',{money:5,careerXP:40}),choice('mountain','산길을 오른다','65%: 15냥 · 실패: 건강 -8',{}, {special:'herbs'})],s=>s.age>=16&&s.career==='doctor',20),
    ev('pupil','배움을 청하는 아이','배우고 싶지만 학비가 없는 아이가 문 앞에 서 있다.',[choice('free','학비 없이 가르친다','명성 +4 · 행복 +4',{reputation:4,happiness:4}),choice('help','품삯 대신 서당 일을 맡긴다','직업 경험 +60 · 수입 +3냥',{careerXP:60,money:3})],s=>s.age>=18&&s.career==='teacher',20),
    ev('guest','객잔의 낯선 손님','길손들이 서로 다른 이야기를 전한다. 사람들의 말을 듣는 것도 객잔의 일이다.',[choice('listen','차를 내고 이야기를 듣는다','학식 경험 +55 · 명성 +2',{knowledgeXP:55,reputation:2}),choice('rooms','빈방을 정성껏 손질한다','순수입 +7냥 · 직업 경험 +25',{money:7,careerXP:25})],s=>s.age>=18&&s.career==='innkeeper',20),
    ev('errand','문파의 잡무','문중의 일손이 모자란다. 눈에 띄지 않는 일도 누군가는 해야 한다.',[choice('help','살림을 돕는다','공헌 +10 · 신뢰 +4 · 보수 3냥',{merit:10,trust:4,money:3}),choice('train','오늘은 자신의 수련에 집중한다','무공 경험 +55 · 신뢰 -2',{swordXP:55,trust:-2})],s=>!!s.sectId,20),
    ev('advice','사부의 가르침','사부는 초식보다 마음의 흐트러짐을 먼저 살피라고 말한다.',[choice('listen','기초부터 다시 익힌다','운용 +65 XP · 신뢰 +5',{operationXP:65,trust:5}),choice('ask','자신의 의문을 솔직히 묻는다','심법 +70 XP · 신뢰 +3',{methodXP:70,trust:3})],s=>!!getNPC(s,s.mentorId)?.alive,24),
    ev('charity','길가의 피난민','떠돌던 이들이 마을 밖에 머문다. 관아도 구휼의 손길을 구하고 있다.',[choice('donate','5냥을 기부한다','명성 +5 · 의협 +5',{money:-5,reputation:5,ethics:5},{cost:5}),choice('labor','몸으로 구휼을 돕는다','명성 +3 · 피로 +8',{reputation:3,fatigue:8})],s=>s.age>=16,28),
    ev('dispute','장터의 다툼','상인과 길손이 거래를 놓고 언성을 높인다. 칼을 빼지 않아도 해결할 길이 있다.',[choice('mediate','장부를 살펴 중재한다','학식 +50 XP · 명성 +3',{knowledgeXP:50,reputation:3}),choice('leave','관아에 알리고 물러난다','행복 +2',{happiness:2})],s=>s.age>=16,24),
    ev('friend','오래된 벗의 편지','함께 자란 벗이 근황을 묻는다. 지난 시간은 서로를 얼마나 바꾸었을까.',[choice('meet','직접 만나 안부를 나눈다','행복 +6 · 인연 호감 +8',{happiness:6,affinity:8}),choice('letter','정성스레 답장을 쓴다','행복 +3 · 인연 호감 +4',{happiness:3,affinity:4})],s=>s.npcs.some(n=>n.alive&&n.role==='지인'),24),
    ev('parent','보호자의 바람','어린 시절을 지켜 준 이가 이제는 자신의 몸을 돌보라고 당부한다.',[choice('visit','곁에서 하루를 보낸다','행복 +6 · 가족 호감 +7',{happiness:6,affinity:7}),choice('gift','작은 선물을 마련한다','4냥 지출 · 가족 호감 +10',{money:-4,affinity:10},{cost:4})],s=>s.age>=18&&s.npcs.some(n=>n.alive&&['보호자','부친','모친'].includes(n.role)),32),
    ev('spouse','배우자의 고민','배우자가 가족과 함께하는 시간이 줄었다며 조심스럽게 말을 꺼낸다.',[choice('listen','경청하고 함께 시간을 보낸다','행복 +6 · 배우자 신뢰 +8',{happiness:6,spouseAffinity:8}),choice('defer','이번 일을 마치고 대화하자고 한다','배우자 신뢰 -6 · 소지금 +3냥',{spouseAffinity:-6,money:3})],s=>livingSpouse(s),24),
    ev('childpath','자녀의 진로','자녀가 자신의 길을 정하고 싶다며 찾아온다. 부모와 같은 삶을 원하지 않을 수도 있다.',[choice('respect','스스로 고른 길을 존중한다','가족 신뢰 +10 · 행복 +5',{affinity:10,happiness:5}),choice('offer','전승을 제안하되 수락을 기다린다','동의한 경우에만 전승 시작',{}, {special:'childTeach'})],s=>s.childIds.some(id=>{const n=getNPC(s,id);return n?.alive&&n.age>=16;}),40,true),
    ev('illness','갑작스러운 병환','몸이 무겁고 기침이 잦아졌다. 치료와 휴식을 함께 고려해야 한다.',[choice('doctor','의원을 찾는다','8냥 지출 · 건강 +10 · 부상 -8',{money:-8,health:10,injury:-8},{cost:8}),choice('rest','구휼 의방에서 쉬어 간다','건강 +5 · 피로 -12',{health:5,fatigue:-12})],s=>s.age>=24,32),
    ev('tax','관아의 세금 고지','장부를 점검하라는 관아의 고지가 도착했다. 무림의 명성도 법을 대신하지 않는다.',[choice('pay','3냥을 납부한다','소지금 -3냥 · 평판 유지',{money:-3},{cost:3}),choice('appeal','형편을 설명하고 부역으로 대신한다','피로 +8 · 학식 +20 XP',{fatigue:8,knowledgeXP:20})],s=>s.age>=18,36),
    ev('flood','불어난 강물','거센 비에 짐과 살림이 물에 잠길 위기다.',[choice('people','사람부터 대피시킨다','재산 일부 손실 · 명성 +4',{}, {special:'flood'}),choice('plan','이웃과 제방을 보강한다','피로 +12 · 행복 +2',{fatigue:12,happiness:2})],s=>s.age>=16,40),
    ev('bandit','길을 막은 무리','통행을 요구하는 무리가 앞을 막았다. 우회로가 있고 관아에 신고할 수도 있다.',[choice('flee','먼 길로 우회한다','여비 2냥 또는 피로 +8',{}, {special:'flee'}),choice('talk','먹을거리를 나누고 협상한다','3냥 또는 피로 +6 · 전투 없음',{}, {special:'negotiate'}),choice('fight','맞서 싸운다','선택 전 전력·승률·치명 위험 표시',{}, {special:'combat'})],s=>s.age>=18&&s.lastAction==='explore',24),
    ev('duel','비무의 초대','무인이 공개 비무를 청해 왔다. 생사를 겨루는 자리가 아니며 거절할 수 있다.',[choice('duel','비살상 비무에 응한다','실력에 따른 승패 · 치명상 없음',{}, {special:'duel'}),choice('observe','관전하며 초식을 배운다','무공 경험 +45',{swordXP:45})],s=>s.rank>=1,28),
    ev('revenge','오래된 원한','지난 다툼의 상대가 다시 소식을 보내왔다. 은원은 칼끝으로만 풀리지 않는다.',[choice('peace','화해를 청한다','5냥 또는 피로 +5 · 의협 +3',{}, {special:'peace'}),choice('avoid','접촉을 끊고 거리를 둔다','명성 -2 · 행복 +2',{reputation:-2,happiness:2})],s=>s.memories.some(m=>m.type==='원한'&&m.status==='open'&&getNPC(s,m.actorId)?.alive),40,true),
    ev('expel','문중의 불신','문중에서 공적에 대한 시비가 일었다. 관계를 회복하거나 새로운 삶을 택할 수 있다.',[choice('explain','장부를 공개하고 신뢰를 회복한다','공헌 -8 · 신뢰 +10',{merit:-8,trust:10}),choice('leave','배운 것을 간직하고 문파를 떠난다','과거 사승·무공 보존',{}, {special:'leave'})],s=>!!s.sectId&&s.trust<45,40),
    ev('bloodorder','혈교의 명령','교단의 연구가 민가를 해친다는 고발이 들어왔다. 금기의 경계를 정해야 한다.',[choice('reform','피해자를 보호하고 개혁을 주장한다','의협 +8 · 신뢰 -6 · 지지 +5',{ethics:8,trust:-6,support:5}),choice('refuse','명을 거부하고 이탈한다','무공 보존 · 소속 이탈',{}, {special:'leave'})],s=>s.sectId==='blood',28,true),
    ev('demontrial','호법의 시험','호법들이 교도들의 공적과 신념을 묻는다. 출생보다 앞으로의 선택을 본다고 한다.',[choice('duty','구휼과 호위를 맡는다','공헌 +14 · 지지 +5 · 피로 +5',{merit:14,support:5,fatigue:5}),choice('debate','교리와 현실을 토론한다','학식 +70 XP · 신뢰 +4',{knowledgeXP:70,trust:4})],s=>s.sectId==='demon',28),
    ev('elderrequest','원로의 청탁','원로가 자신의 친족에게 공을 돌려 달라고 부탁한다. 정파의 명분도 사람의 욕심을 지우지는 못한다.',[choice('decline','공적은 사실대로 기록한다','의협 +5 · 신뢰 -4 · 지지 +3',{ethics:5,trust:-4,support:3}),choice('accept','청탁을 받아들인다','소지금 +8냥 · 의협 -5',{money:8,ethics:-5})],s=>sect(s)?.faction==='정파'&&s.merit>=20,32,true),
    ev('sapahelp','흑사방의 구휼','흑사방이 흉년을 맞은 이웃에게 곡식을 나누고 있다. 그 배경에는 거래와 선의가 함께 있다.',[choice('help','배급을 돕는다','의협 +4 · 공헌 +8',{ethics:4,merit:8}),choice('books','물자의 장부를 정리한다','학식 +50 XP · 보수 4냥',{knowledgeXP:50,money:4})],s=>s.sectId==='heuksa',28),
    ev('retire','은거를 권하는 벗','이제는 쌓아 온 것보다 남은 시간을 돌아볼 때가 되었다는 말을 듣는다.',[choice('retire','생업과 인연을 중심으로 계획을 바꾼다','생업·교류·휴식·휴식으로 계획',{}, {special:'retire'}),choice('continue','아직 하고 싶은 일이 있다','행복 +2',{happiness:2})],s=>s.age>=55,32,true),
    ev('lastlesson','마지막 가르침','남길 수 있는 것이 재산만은 아니다. 배운 것과 함께한 시간을 돌아본다.',[choice('teach','제자에게 경험을 전한다','전승 +3 · 행복 +5',{legacy:3,happiness:5}),choice('family','가족과 지난 이야기를 나눈다','행복 +8 · 가족 호감 +8',{happiness:8,affinity:8})],s=>s.age>=68,24,true),
    ev('festival','등불이 켜진 밤','마을의 축제가 시작되었다. 각자 사정이 달라도 오늘만큼은 같은 불빛 아래 모인다.',[choice('join','축제에 함께한다','2냥 지출 · 행복 +8',{money:-2,happiness:8},{cost:2}),choice('watch','언덕에서 불빛을 바라본다','행복 +4',{happiness:4})],s=>true,24),
    ev('masterwork','완성에 가까운 손길','오랜 경험으로 손끝에 맺힌 성취를 세상에 내보일 기회가 왔다.',[choice('show','사람들에게 선보인다','직업 명성 +8 · 수입 +15냥',{reputation:8,money:15}),choice('pass','기술을 이웃과 나눈다','전승 +2 · 행복 +5',{legacy:2,happiness:5})],s=>careerSkill(s)>=65,32,true),
    ev('escort','상단의 호위 의뢰','상단은 실력 있는 호위와 교관을 찾고 있다. 수련의 성과가 생계로 이어질 기회다.',[choice('escort','호위를 맡는다','경지에 따라 8~32냥 · 피로 +12',{}, {special:'escort'}),choice('coach','호신술을 가르친다','수입 +9냥 · 명성 +2',{money:9,reputation:2})],s=>s.rank>=2,24),
    ev('mentorloss','사부가 남긴 자리','사부의 부고가 전해졌다. 사승은 끝나지 않지만 이제 스스로 길을 정해야 한다.',[choice('remember','가르침을 정리한다','심법 +70 XP · 전승 +1',{methodXP:70,legacy:1}),choice('mourn','동문들과 함께 애도한다','신뢰 +8 · 행복 +3',{trust:8,happiness:3})],()=>false,4,true),
    ev('ruin','문파의 몰락','문중이 내분과 외부 압박으로 해산되었다. 직계 혈족도 옛 보호를 잃을 수 있다. 살아남은 사람들은 다른 길을 찾는다.',[choice('civil','민간에서 삶을 다시 세운다','무공·혈연 보존 · 소속 해산',{}, {special:'ruinCivil'}),choice('wander','강호에서 새 스승을 찾는다','무공·혈연 보존 · 소속 해산',{}, {special:'ruinWander'})],()=>false,0,false),
    ev('manual','낡은 비급','오래된 장서에서 운기법을 발견했다. 글을 얻는 것과 이해하는 것은 다르다.',[choice('keep','보관하고 독서·연구로 해독한다','해독에 여러 분기 필요 · 내공 자동 증가 없음',{}, {special:'manual'}),choice('sell','필요로 하는 서점에 넘긴다','소지금 +12냥',{money:12})],s=>!s.manual&&s.lastAction==='explore',100,true),
    ev('adapt','비급의 뜻을 풀다','해독한 심법은 지금의 운기와 다를 수 있다. 손실과 내상의 위험을 감수할지 정해야 한다.',[choice('adapt','주력 심법을 바꾼다','호환성에 따른 내공 손실·내상 위험',{}, {special:'adapt'}),choice('preserve','초식의 지식만 참고한다','주력 심법 유지 · 무공 경험 +80',{swordXP:80})],()=>false,4,true),
    ev('promotion','새로운 책임','공적과 신뢰를 인정받았다. 더 가까이 가르침을 받는 대신 문중의 책임도 무거워질 것이다.',[choice('accept','책임을 받아들인다','문파별 제자 신분 승급 · 진전·후계는 별도',{}, {special:'promotion'}),choice('decline','현재의 자리에서 돕는다','행복 +3 · 신뢰 +2',{happiness:3,trust:2})],()=>false,16),
    ev('transmission','비전의 전수','사부와 원로들이 핵심 심법의 전수를 논의했다. 제자 신분과 별개의 심사다. 준비가 부족하면 다음 기회를 기다릴 수 있다.',[choice('accept','전수를 받는다','진전 상태 · 심법 품질 상승 · 계통 유지',{}, {special:'transmission'}),choice('decline','기초를 더 다지고 싶다고 말한다','운용 +100 XP · 6년 뒤 다시 심사 가능',{operationXP:100})],()=>false,24),
    ev('breakthrough','경지의 문턱','무공·운용·심법과 내공이 다음 경지의 최소 조건에 닿았다. 돌파에는 실패와 회복의 시간이 따른다.',[choice('attempt','돌파를 시도한다','성공률과 실패 시 내상 표시',{}, {special:'breakthrough'}),choice('wait','다음 기회를 기다린다','행복 +2 · 4년 후 재시도',{happiness:2})],()=>false,16),
    ev('marriage','함께 걷자는 제안','서로를 알아 온 인연이 앞으로의 삶을 함께할지 묻는다. 상대의 동의와 자신의 뜻이 모두 필요하다.',[choice('yes','서로의 뜻을 확인하고 혼인한다','양쪽 동의 검사 · 혼인비 8냥 또는 소박한 예식',{}, {special:'marry'}),choice('no','벗으로 남고 싶다고 말한다','혼인 없음 · 행복 +1',{happiness:1})],()=>false,24),
    ev('child','새 식구의 이야기','배우자가 아이를 함께 키울 생각이 있는지 묻는다. 두 사람의 동의가 있어야 가족을 늘린다.',[choice('yes','함께 아이를 맞이한다','양육비 매 분기 반영 · 상대 동의 검사',{}, {special:'child'}),choice('no','지금의 가족과 함께한다','행복 +2',{happiness:2})],()=>false,24),
    ev('succession','문중의 후계 논의','지도자의 자리가 비었다. 원로들은 실력과 공적, 지지와 정통성을 함께 살핀다.',[choice('stand','추대를 받아들인다','승계 자격과 원로 지지 재검사',{}, {special:'succession'}),choice('decline','다른 후보를 지지한다','지지 +4 · 행복 +3',{support:4,happiness:3})],()=>false,32,false),
    ev('alliance','연합의 추대','문파 밖에서도 공적을 인정받았다. 연합의 지도자는 출신보다 무학·명망·정치적 지지를 요구받는다.',[choice('accept','연합의 추대에 응한다','지지와 명망 조건 재검사',{}, {special:'alliance'}),choice('decline','문중의 일을 우선한다','행복 +4',{happiness:4})],()=>false,40,true),
    ev('business','독립 조직의 문턱','함께 일하던 이들이 독립된 터전을 마련하자고 권한다. 개인 재산과 조직 금고는 별도로 운영해야 한다.',[choice('open','80냥을 출자해 조직을 연다','개인 80냥 출자 → 금고 55냥 · 설립비 25냥',{}, {cost:80,special:'business'}),choice('wait','기존의 삶을 이어 간다','행복 +2',{happiness:2})],s=>s.age>=25&&!s.organization&&s.money>=80&&careerSkill(s)>=52,40,true),
    ev('businesscrisis','조직의 자금난','일감이 끊겨 금고가 줄었다. 사재를 더 넣을지, 규모를 줄일지 선택해야 한다.',[choice('invest','개인 재산 15냥을 출자한다','개인 -15냥 · 조직 금고 +15냥',{}, {cost:15,special:'invest'}),choice('close','남은 금고를 정리하고 해산한다','남은 금고 60% 회수 · 조직 해산',{}, {special:'closeBusiness'})],s=>!!s.organization&&s.organization.treasury<15,16),
    ev('creation','자신의 무학','여러 초식의 장단점이 하나의 흐름으로 정리되었다. 남에게 전할 수 있는 무공을 완성했다.',[choice('write','약점까지 기록해 비급을 남긴다','창시 성취 · 전승 +5',{}, {special:'creation'}),choice('test','제자와 검증하며 전한다','창시 성취 · 전승 +4 · 행복 +3',{}, {special:'creation'})],()=>false,40,true)
  ];
  for (const t of SECTS) EVENTS.push(ev('join-'+t.id,`${t.name}의 문 앞`,`${t.rule} 출신은 심사에 영향을 주지만 입문을 금지하지 않는다.`,[choice('apply','심사를 받는다','자격·추천·문파 사정에 따른 확률 판정',{}, {special:'join',sectId:t.id}),choice('decline','지금의 삶을 이어 간다','입문 없음 · 직업 유지',{happiness:1})],()=>false,16));
  EVENTS.push(ev('methodoffer','사문의 운기법','사부가 문중의 심법을 가르치겠다고 한다. 이미 쌓은 내공은 호환성에 따른 손실을 거쳐 옮겨야 한다.',[choice('adopt','비용과 위험을 확인하고 운기법을 바꾼다','현재 심법과의 호환성 표시',{}, {special:'sectMethod'}),choice('preserve','현재 심법으로 수련을 이어 간다','새 문파의 외공만 배운다. 주력 심법 유지',{operationXP:30})],()=>false,16));
  EVENTS.push(ev('departure','문파를 떠나는 길','사문의 배움과 지난 인연은 지워지지 않는다. 지금의 소속을 떠나 새 길을 걸을지 정한다.',[choice('leave','인사를 남기고 탈퇴한다','현재 소속·직위 정리 · 무공·심법·성씨·혈연 보존',{}, {special:'leave'}),choice('stay','당분간 남는다','소속 유지',{happiness:1})],()=>false,0));
  EVENTS.push(ev('meeting','새로운 인연','장터에서 함께 일을 돕던 사람과 이야기를 나누게 되었다. 서로의 삶에 관심을 가질지 정한다.',[choice('greet','이름과 안부를 나눈다','성인 지인 생성 · 혼인 자동 확정 없음',{}, {special:'meeting'}),choice('pass','가벼운 인사로 마친다','행복 +1',{happiness:1})],s=>s.age>=18&&!livingSpouse(s)&&s.npcs.length<40,28));
  EVENTS.push(ev('separation','멀어진 마음','함께한 시간에도 서로의 마음은 달라질 수 있다. 관계를 돌볼지 각자의 길을 택할지 마주 앉아 이야기한다.',[choice('repair','함께 시간을 내어 관계를 돌본다','배우자 호감 +30 · 행복 +4',{spouseAffinity:30,happiness:4}),choice('part','합의하여 각자의 길로 간다','혼인 해소 · 자녀·과거 인연 이력 유지',{}, {special:'separate'})],s=>livingSpouse(s)&&getNPC(s,s.spouseId).affinity<25,32));
  // Six distinct civilian accomplishments, independent of martial rank.
  for (const c of CAREERS) EVENTS.push(ev('career-'+c.id,`${josa(c.name,'으로/로')}서의 이름`,`${c.name}의 일로 이웃의 신뢰를 쌓았다. 직업의 성취를 어떻게 남길까.`,[choice('teach','배움을 나누어 후학을 키운다','전승 +3 · 명성 +5',{legacy:3,reputation:5}),choice('serve','사람들에게 필요한 일을 이어 간다','행복 +6 · 수입 +12냥',{happiness:6,money:12})],s=>s.career===c.id&&careerSkill(s)>=72,40,true));
  EVENTS.push(ev('rumor-manual','폐원에 남은 검보','소문을 따라 찾은 폐원에서 청계문의 낡은 검보를 발견했다. 지금 강호의 문파가 전승하는 무공과 계통이 다르지만, 습득에는 연구와 수련이 필요하다.',[choice('learn','검보를 보관하고 뜻을 연구한다','해독·습득 전에는 독립 무학으로 사용할 수 없음',{}, {special:'forgottenArt'}),choice('leave','기록만 남기고 돌아간다','학식 +30 XP',{knowledgeXP:30})],()=>false,0));
  EVENTS.push(ev('rumor-healer','떠돌이 의원의 손길','소문 속 의원을 만났다. 무공의 높낮이와 상관없이 몸에 남은 상처를 살펴 준다고 한다.',[choice('care','치료를 청한다','5냥 · 건강 +10 · 내상 -12',{money:-5,health:10,injury:-12},{cost:5}),choice('help','약방 일을 돕고 치료받는다','건강 +5 · 내상 -6 · 피로 +6',{health:5,injury:-6,fatigue:6})],()=>false,0));
  EVENTS.push(ev('rumor-master','객잔의 무인','소문 속 무인은 이름보다 초식의 빈틈을 먼저 보았다. 생사를 걸지 않고 무학을 논할 수 있다고 한다.',[choice('duel','비무를 청한다','독립 전투 화면 · 비살상 대련',{}, {special:'duel'}),choice('listen','가르침만 듣는다','학식 +50 XP · 강제 무공 습득 없음',{knowledgeXP:50})],()=>false,0));
  EVENTS.push(ev('teachingPermit','전수 허가를 구하다','배운 무공은 사문의 인연이 담긴 배움이다. 무관에서 가르치려면 문중의 허가와 허가 범위를 확인해야 한다.',[choice('request','문중에 정식으로 허가를 청한다','신뢰 65 · 공헌 60 필요, 승인 시 공헌 20 사용',{}, {special:'teachingPermit'}),choice('wait','아직은 기다린다','허가 없음',{happiness:1})],()=>false,16));
  EVENTS.push(ev('openDojo','무관을 열 뜻','허락받은 무학의 범위 안에서 사람들에게 호신과 기초를 가르칠 터전을 마련한다. 새 문파를 세우는 것과는 다른 일이다.',[choice('open','무관을 연다','허가받은 무공만 전수 · 80냥',{}, {cost:80,special:'openDojo'}),choice('wait','준비를 더 한다','변화 없음')],()=>false,8));
  EVENTS.push(ev('foundSect','새로운 사승의 시작','독립된 무학을 바탕으로 뜻을 함께할 이들과 새로운 사문을 연다. 남의 문파에서 배운 비전만으로 개파할 수는 없다.',[choice('found','사승의 맹약을 나누고 개파한다','독립 무학·지지·명망·80냥 조건 재검사',{}, {cost:80,special:'foundSect'}),choice('wait','아직 인연을 더 쌓는다','변화 없음')],()=>false,8));
  const storyChoice=(id,label,hint,effects={},extra={})=>choice(id,label,hint,effects,{special:'story',...extra});
  EVENTS.push(
    ev('entry-plan','입문 뒤의 새 일과','입문 청원은 마쳤다. 반복 계획을 무공 수련·내공 수련·문파 임무·내공 수련으로 바꾸었다. 지난 계절의 기록은 유지한다.',[choice('confirm','확인하고 새 일과를 따른다','자동으로 다시 입문을 청하지 않음'),choice('edit','계획을 직접 고친다','계획 화면에서 생업 병행 등 자유롭게 변경')],()=>false,0),
    ev('chain-guest','객잔에 남긴 자리','다친 길손이 빈자리에 앉았다. 먼저 쉴 곳과 도움받을 길을 정해야 한다. 치료 자격 없이 상처를 다룰 수는 없다.',[storyChoice('lodge','잠자리와 끼니를 내준다','3냥 · 상대와 구명의 인연',{money:-3,happiness:2},{cost:3}),storyChoice('doctor','의방에 연락해 치료를 잇는다','피로 +6 · 치료 결과는 이후 확인',{fatigue:6}),storyChoice('official','관아에 신원을 확인해 달라 청한다','학식 +25 · 공적인 도움에 연결',{knowledgeXP:25}),storyChoice('pass','물 한 잔을 내고 떠나는 길을 알려 준다','직접 돌볼 책임은 맡지 않음',{happiness:1})],s=>s.age>=16&&(s.career==='innkeeper'||s.lastAction==='explore'),32,true),
    ev('chain-guest-return','그 자리에 돌아온 소식','지난 길손에게서 소식이 왔다. 도움의 기억을 이어갈지, 여기서 인연을 마칠지 정한다.',[storyChoice('welcome','지금의 사정을 묻고 안부를 잇는다','생존·거리에 맞춰 만남 또는 서신 · 행복 +4',{happiness:4}),storyChoice('close','기록을 남기고 각자의 길을 응원한다','약속을 정리 · 행복 +2',{happiness:2})],()=>false,0),
    ev('chain-village','마을의 빚','공동 창고의 곡식이 모자라 이웃이 장부를 들고 왔다. 종자와 당장의 끼니 사이에서 선택해야 한다.',[storyChoice('seed','살림을 줄여 종자를 마련한다','6냥 · 농사 경험 +70 · 수확 보장 없음',{money:-6,careerXP:70},{cost:6}),storyChoice('share','내 몫의 곡식을 이웃과 나눈다','4냥 · 지역 신뢰 · 가족 비용 발생',{money:-4,happiness:3},{cost:4}),storyChoice('labor','공동 구휼의 일손을 맡는다','피로 +9 · 명성 +2',{fatigue:9,reputation:2}),storyChoice('home','가족의 끼니부터 지킨다','2냥 지원 · 이웃에게 사정을 설명',{money:2})],s=>s.age>=16&&s.career==='farmer'&&regionalState(s).crop==='흉작',32,true),
    ev('chain-village-return','장부에 남은 이름','한 철이 지난 뒤 공동 창고의 장부를 다시 펼쳤다. 형편에 따라 갚을 수 있는 것과 남은 빚이 다르다.',[storyChoice('continue','무리 없는 범위에서 일을 이어 간다','피로 +4 · 같은 이웃과 신뢰를 잇는다',{fatigue:4}),storyChoice('settle','받고 베푼 일을 정리하고 일상으로 돌아간다','관계 기억 보존 · 금전 보상 보장 없음',{happiness:3})],()=>false,0),
    ev('chain-mentor','사부의 빈자리','사부가 가르침과 문중의 책임을 조금 나누려 한다. 자신의 수련과 동문을 돌보는 일 중 무엇을 맡을까.',[storyChoice('assist','기초를 익히는 동문을 돌본다','피로 +7 · 사부 신뢰 +6',{fatigue:7,trust:6}),storyChoice('practice','미숙한 초식을 사부 앞에서 되짚는다','무공 +55 XP · 운용 +30 XP',{swordXP:55,operationXP:30}),storyChoice('honest','몸 상태를 밝히고 지금 맡을 수 있는 일을 정한다','피로 -6 · 사부 신뢰 +2',{fatigue:-6,trust:2})],s=>!!s.sectId&&!!getNPC(s,s.mentorId)?.alive,32,true),
    ev('chain-mentor-return','배움을 잇는 사람','시간이 흘렀다. 사부의 현재 사정과 지난 약속을 살피며 배움을 어떻게 남길지 묻는다.',[storyChoice('record','함께 배운 구결과 과정을 정리한다','학식 +50 XP · 전승 +1 · 사부 생존 여부와 무관',{knowledgeXP:50,legacy:1}),storyChoice('peer','동문에게 남은 일을 나누어 맡긴다','행복 +3 · 혼자 모든 책임을 지지 않음',{happiness:3})],()=>false,0),
    ev('chain-family','망한 집안의 장부','가계의 거래와 지원이 흔들린다는 소식이 왔다. 혈연은 남지만 어제의 지위가 내일의 살림을 보장하지 않는다.',[storyChoice('protect','가족의 거처와 생활부터 지킨다','5냥 · 가족과 약속',{money:-5,happiness:4},{cost:5}),storyChoice('rebuild','장부를 정리하고 재건을 돕는다','피로 +10 · 학식 +50 XP',{fatigue:10,knowledgeXP:50}),storyChoice('help','이웃과 문중에 의탁할 길을 찾는다','지역 신뢰에 따른 도움 · 강제 입문 없음',{reputation:2}),storyChoice('career','새 생업으로 독립할 준비를 한다','현재 생업 +70 XP · 출신과 무공 보존',{careerXP:70})],s=>s.age>=18&&['noble','martial','merchant'].includes(s.originId)&&regionalState(s).conflict,32,true),
    ev('chain-family-return','다시 꾸린 살림','한때의 위기는 누군가에게 새 터전이 되었고 누군가에게는 남은 빚이 되었다. 지난 선택의 당사자와 후일을 정리한다.',[storyChoice('visit','현재 사정을 확인하고 안부를 잇는다','살아 있는 가족과 연락 · 행복 +4',{happiness:4}),storyChoice('independent','서로의 삶을 존중하며 새 길을 걷는다','과거와 혈연을 보존 · 생업 +35 XP',{careerXP:35})],()=>false,0),
    ev('sect-warning','사문의 흔들리는 울타리','분쟁과 내분으로 문중의 살림이 위태롭다. 아직 해산된 것은 아니다. 남은 사람과 배움을 지킬 방법을 정한다.',[storyChoice('protect','사람과 장서를 안전한 곳으로 옮긴다','피로 +8 · 해산 시에도 인연과 기록 보존',{fatigue:8}),storyChoice('rebuild','8냥을 보태 재건에 힘쓴다','8냥 · 해산 위험 감소, 회복 보장 없음',{money:-8},{cost:8}),storyChoice('leave','먼저 독립할 준비를 한다','다음 해 생업·인연 중심 · 소속 이탈은 별도 선택',{happiness:1})],()=>false,0),
    ev('training-advice','문턱 앞의 되짚기','돌파에 실패했어도 배운 것이 사라진 것은 아니다. 현재 부족한 축을 확인하고 수련의 초점을 바꿀 수 있다.',[storyChoice('body','초식의 정확함을 다듬는다','무공 수련 XP 효율 +5% · 전투력 즉시 상승 없음'),storyChoice('breath','호흡과 운용을 되짚는다','내공 수련 운용·심법 XP 효율 +5%'),storyChoice('rest','서두르지 않고 내상부터 다스린다','부상 -4 · 초점 균형으로 복귀',{injury:-4})],()=>false,0),
    ev('first-pupil','처음 배움을 청한 사람','내가 남긴 배움을 다른 사람이 익히려 한다. 무공은 체격과 허가 범위를, 생업은 작업과 책임을 함께 살펴야 한다.',[storyChoice('adapt','약점을 밝히고 기초에 맞춰 가르친다','전승 +2 · 해당 분야만 전수',{legacy:2}),storyChoice('document','과정과 한계를 글로 남긴다','학식 +40 XP · 전승 +1',{knowledgeXP:40,legacy:1}),storyChoice('wait','더 준비한 뒤 다시 만나자고 한다','약속을 남김 · 즉시 전승 없음')],()=>false,0,true),
    ev('retired-letter','은거처에 닿은 서신','옛 인연이 작은 분쟁을 도와 달라는 편지를 보냈다. 지난 책임을 돌아보되 남은 삶의 방식은 스스로 고른다.',[storyChoice('visit','직접 나서되 은거의 뜻은 지킨다','여비 2냥 · 피로 +6 · 강제 복귀 없음',{money:-2,fatigue:6},{cost:2}),storyChoice('delegate','믿을 만한 사람에게 연결한다','전승 +1 · 지역 신뢰',{legacy:1}),storyChoice('decline','사정을 밝히고 정중히 거절한다','행복 +3 · 가족과 현재 삶을 지킨다',{happiness:3})],s=>!!s.retired&&s.age>=48,60,true),
    ev('leader-dispute','수장의 판결','서로 다른 공적을 내세운 두 문인이 다투고 있다. 지위는 승부를 이기는 힘만으로 유지되지 않는다.',[storyChoice('records','장부와 증언을 함께 듣는다','학식 +40 XP · 지지 +3',{knowledgeXP:40,support:3}),storyChoice('protect','약한 쪽을 보호하고 재심을 연다','신뢰 -2 · 의협 +4',{trust:-2,ethics:4}),storyChoice('delegate','원로들에게 심사를 맡긴다','지지 +1 · 독단을 줄인다',{support:1})],s=>['장문인','가주','천마','혈마','방주','무림맹주','사도련주','개파조사'].includes(s.officeId),60,true),
    ev('leader-heir','다음 울타리를 맡을 사람','수장의 다음 세대를 논의한다. 성씨와 사승, 무학과 지지는 다른 자격이다. 아직 후계자를 정하지 않을 수도 있다.',[storyChoice('qualified','자격을 갖춘 문인을 추천한다','가문의 혈족 조건 재검사 · 원로들의 심사 필요'),storyChoice('council','공개 심사와 공동 운영을 준비한다','전승 +1 · 후계자 강제 지정 없음',{legacy:1}),storyChoice('defer','더 지켜보며 결정을 미룬다','현 직위 유지 · 행복 +1',{happiness:1})],s=>s.age>=55&&['장문인','가주','천마','혈마','방주','개파조사'].includes(s.officeId),60,true)
  );
  const sectTrials={namgung:['가문의 울타리','혈족과 외성 문하가 함께 일하지만 상속권은 다르다. 장부를 맡을지 호신 수련을 도울지 묻는다.','장부의 책임을 맡는다','외성 동문의 수련을 돕는다'],huashan:['매화가 피기 전','사부가 연환초식의 빈틈과 검끝의 정확함을 확인한다.','초식을 느리게 되짚는다','동문과 검로를 맞춘다'],shaolin:['속가의 짐','속가 문하는 가정의 책임과 수련을 함께 짊어진다. 구휼 물자를 옮길 손이 필요하다.','구휼 물자를 나른다','쉬어 가는 이들의 호흡을 돕는다'],wudang:['한 호흡의 길이','서두른 운기는 도리어 흐트러진다. 무학의 뜻과 동문의 호흡을 살핀다.','구결의 뜻을 토론한다','천천히 행공을 되짚는다'],gaebang:['분타의 한 끼','나눈 곡식과 확인한 정보가 방도들을 잇는다. 출신보다 한 일을 살핀다.','배급 명부를 정리한다','흩어진 방도의 소식을 잇는다'],heuksa:['거래의 선','이익을 남길 수 있는 거래에도 지켜야 할 선이 있다. 방도들은 약속을 어떻게 지키는지 본다.','계약을 공개해 이익을 나눈다','손해를 줄일 새 거래를 찾는다'],demon:['호법 앞의 말','교단의 공적은 출신보다 선택으로 증명한다. 교리와 현장의 사정이 다를 때의 책임을 묻는다.','현장을 살펴 교도를 돕는다','교리의 해석을 토론한다'],blood:['금기의 경계','의술을 빌미로 타인의 동의를 건너뛰어도 되는가. 교단 안에서도 답은 하나가 아니다.','동의 없는 연구를 막는다','환자의 뜻을 먼저 기록한다']};
  for(const t of SECTS){const a=sectTrials[t.id]||[t.name+'의 책임',t.rule,t.id==='military'?'성문과 피난민의 경계를 맡는다':t.id==='guild'?'장부와 구호 물자를 정리한다':t.family?'혈족과 외성 문하의 권리를 구분해 공적을 기록한다':t.bloc==='sapa'?'부당한 약탈을 막고 길목의 약속을 지킨다':'연락 거점에서 문중의 일을 돕는다','선배에게 문규와 살아온 사정을 묻는다'];EVENTS.push(ev('sect-life-'+t.id,a[0],a[1],[storyChoice('service',a[2],'공헌 +8 · 신뢰 +3 · 피로 +5',{merit:8,trust:3,fatigue:5}),storyChoice('understand',a[3],t.id==='huashan'?'무공 +45 XP · 신뢰 +2':'학식 +45 XP · 신뢰 +2',t.id==='huashan'?{swordXP:45,trust:2}:{knowledgeXP:45,trust:2}),storyChoice('decline','이번 책임은 맡지 않는다','사정을 밝힘 · 강제 악행이나 출가 없음',{happiness:1})],s=>s.sectId===t.id,60,true));}
  const rumorScenes={trade:['약속이 되는 거래','소문 속 거래처가 물목과 납기를 설명했다. 큰 출자 없이 작은 약속부터 시작할 수 있다.'],relief:['창고 앞의 이름들','실제 공동 창고와 이웃의 명부를 확인했다. 나눔에는 수고가 들고 이익이 보장되지는 않는다.'],missing:['끊어진 안부','소문의 당사자가 남긴 행적을 찾았다. 현재 생존 여부와 머무는 곳을 확인하며 기록을 잇는다.'],dispute:['길목의 증언','통행을 막는 시비의 장부를 찾았다. 칼을 뽑기 전에 서로의 말을 확인할 수 있다.'],apprentice:['배움을 잇는 자리','소문의 당사자와 배우려는 이의 뜻을 확인한다. 남의 전수권을 대신 약속할 수는 없다.']};
  for(const [id,a] of Object.entries(rumorScenes))EVENTS.push(ev('rumor-'+id,a[0],a[1],[storyChoice('help','작은 약속부터 함께한다','피로 +5 · 해당 인물과 관계 기억',{fatigue:5}),storyChoice('record','사정을 기록하고 필요한 곳에 연결한다','학식 +35 XP · 강제 무공 습득 없음',{knowledgeXP:35}),storyChoice('leave','확인한 사실만 남기고 돌아간다','보상 없음 · 소문 확인 완료',{happiness:1})],()=>false,0));
  for(const [id,title,text] of [['taken','먼저 다녀간 발자취','이미 다른 사람이 물건을 가져갔다. 남은 자취만으로 내 소유를 주장할 수 없다.'],['notfound','찾지 못한 흔적','알려진 곳을 살폈지만 확실한 흔적을 찾지 못했다. 찾지 못했다는 사실과 거짓말이었다는 판단은 다르다.'],['false','헛된 풍문','당사자와 장부를 확인하니 소문의 중요한 부분이 사실과 달랐다.'],['departed','떠난 사람의 소식','당사자가 다른 곳으로 떠났거나 세상을 떠났다. 지난 소식을 현재의 만남으로 되살릴 수는 없다.'],['late','때를 놓친 약속','소문의 유효 기간이 지났다. 거래와 만남은 종료되었고 뒤늦은 기록만 남는다.']])EVENTS.push(ev('rumor-end-'+id,title,text,[choice('record','확인한 내용을 기록한다','학식 +15 XP · 중복 보상 없음',{knowledgeXP:15}),choice('leave','지난 소식으로 남긴다','추적 종료')],()=>false,0));
  // Original two-chapter story arcs. A chapter returns only after the player's earlier decision.
  // All actors named in these scenes are anonymous locals unless an NPC ID is explicitly tracked.
  const ARC_NEXT={inkseal:'inkreturn',waybill:'wayreturn',grainbook:'grainreturn',bladeoath:'bladereturn',familydebt:'debtreturn',physician:'physicianreturn',oldLetter:'letterreturn',pilgrim:'pilgrimreturn'};
  EVENTS.push(
    ev('inkseal','먹빛 아래의 이름','문중의 공적 장부에서 이름을 지운 흔적이 발견되었다. 낮은 항렬의 제자는 오래된 공훈이 잘못 기록되었다며 직접 증언해 달라고 청한다. 기록을 고치면 원로의 체면이 상할 수도 있다.',[
      choice('witness','지워진 이름의 사정을 조사한다','학식 +70 XP · 신뢰 -2',{knowledgeXP:70,trust:-2}),choice('mediate','원로와 제자 양쪽을 만나 조정한다','신뢰 +4 · 피로 +4',{trust:4,fatigue:4})],s=>s.age>=18&&!!s.sectId&&s.merit>=20,48,true),
    ev('inkreturn','그날의 장부가 돌아오다','몇 해 전 공적 장부를 문제 삼았던 제자가 다시 나타났다. 비에 젖은 낡은 문서에 오랫동안 감춰져 있던 당시의 날짜가 남아 있다. 이제 누가 이 사실을 떠맡을지 정해야 한다.',[
      choice('publish','잘못된 기록을 공개하고 바로잡는다','명성 +6 · 문중 신뢰 -4',{reputation:6,trust:-4}),choice('protect','이름을 되찾되 원로의 공개 망신은 피한다','신뢰 +5 · 명성 +2',{trust:5,reputation:2})],()=>false,0,true),
    ev('waybill','봉인된 운송 장부','나루에서 만난 표사가 봉인된 장부를 맡겨 달라고 했다. 산길에서 표행이 끊겼고, 남겨진 사람은 약속된 품삯을 받지 못했다. 봉인은 찢기지 않았지만 날짜가 덧씌워져 있다.',[
      choice('deliver','본래의 수취인에게 장부를 돌려준다','명성 +3 · 학식 +35 XP',{reputation:3,knowledgeXP:35}),choice('copy','사본을 만들어 표사와 가족 양쪽에 남긴다','학식 +65 XP · 피로 +4',{knowledgeXP:65,fatigue:4})],s=>s.age>=18&&['explore','travel','mission','work'].includes(s.lastAction),56,true),
    ev('wayreturn','늦게 도착한 표행의 사람','장부를 기다리던 표사의 가족이 나타났다. 행방불명된 이가 숨겨둔 마지막 운송료가 이제야 확인되었지만, 빚을 주장하는 상인도 찾아왔다. 돈을 누구에게 먼저 돌릴지 결정해야 한다.',[
      choice('family','미지급 품삯을 받지 못한 가족의 손을 들어준다','의협 +5 · 명성 +3',{ethics:5,reputation:3}),choice('court','관아에서 장부와 빚을 함께 심리하도록 한다','학식 +50 XP · 명성 +2',{knowledgeXP:50,reputation:2})],()=>false,0,true),
    ev('grainbook','빈 곡식 창고의 봉인','흉년의 장터 한쪽에서 곡식 창고의 봉인이 바뀌었다는 말이 돌았다. 마을 사람은 굶주리지만 창고주는 아직 곡식을 내놓지 않았다. 잘못 다루면 소동이 날 수도 있다.',[
      choice('audit','창고주의 장부를 대조한다','학식 +60 XP · 피로 +4',{knowledgeXP:60,fatigue:4}),choice('relief','당장 먹을 죽과 곡식을 마련한다','소지금 -4냥 · 명성 +3',{money:-4,reputation:3},{cost:4})],s=>s.age>=16&&regionalState(s).crop==='흉작',40,true),
    ev('grainreturn','곡식보다 오래 남은 빚','지난 흉년 뒤 마을 사람들은 약속한 곡식의 분배가 지켜졌는지 묻고 있다. 몇 사람의 빚은 여전히 장부에 남아 있고, 비축한 종자는 다음 파종을 기다린다.',[
      choice('seed','우선 내년 파종을 위한 종자를 지킨다','생업 경험 +80 · 행복 +2',{careerXP:80,happiness:2}),choice('debt','묵은 빚을 줄이도록 주민과 관아를 설득한다','명성 +4 · 학식 +30 XP',{reputation:4,knowledgeXP:30})],()=>false,0,true),
    ev('bladeoath','끊어진 검끈','연무장 뒤편에서 끊어진 검끈과 오래된 호패를 발견했다. 죽은 문인의 제자가 그것을 알아보았으나, 그 이름은 문중의 공적 기록에 없다. 누군가 사건을 덮은 것일지도 모른다.',[
      choice('search','유품의 주인을 찾아 과거의 시비를 살핀다','학식 +60 XP · 신뢰 +2',{knowledgeXP:60,trust:2}),choice('restore','유품을 정성스레 보존하고 제자에게 돌려준다','전승 +1 · 행복 +3',{legacy:1,happiness:3})],s=>s.age>=18&&!!s.sectId&&s.rank>=1,60,true),
    ev('bladereturn','검끈을 이어 매는 사람','유품의 사연이 밝혀질 무렵, 그 검을 물려받을 제자가 찾아왔다. 그는 원한을 갚기보다 사문의 초식을 온전히 배우고 싶다고 했다. 옛 싸움의 정통성을 내세우는 사람도 적지 않다.',[
      choice('teach','잊힌 사람의 공을 밝혀 전수의 뜻을 돕는다','명성 +3 · 전승 +2',{reputation:3,legacy:2}),choice('record','가르침의 경위를 적어 후대의 시비를 막는다','학식 +80 XP · 행복 +2',{knowledgeXP:80,happiness:2})],()=>false,0,true),
    ev('familydebt','봉투 속 남은 품삯','어린 시절 집안을 도왔던 사람이 낡은 품삯 봉투를 들고 찾아왔다. 서로 기억하는 돈의 액수는 다르지만 누구도 악의를 보이지 않는다. 이제는 지난 세월의 도움을 어떻게 갚을지 물을 차례다.',[
      choice('repay','남은 품삯을 넉넉히 계산해 돌려준다','소지금 -6냥 · 행복 +5',{money:-6,happiness:5},{cost:6}),choice('talk','그때의 사정을 듣고 함께 장부를 확인한다','학식 +40 XP · 행복 +3',{knowledgeXP:40,happiness:3})],s=>s.age>=22&&s.money>=6&&s.npcs.some(n=>n.alive&&['부친','모친','보호자'].includes(n.role)),60,true),
    ev('debtreturn','다시 열린 대문','지난날 품삯을 두고 이야기했던 사람이 뜻밖의 소식을 보냈다. 돈보다 중요한 것은 그 시절을 기억해 준 사람이라는 짧은 글이 적혀 있었다. 그 은혜를 어디로 이어 보낼지 정하게 되었다.',[
      choice('help','형편이 어려운 이웃에게 일손을 나눈다','명성 +4 · 피로 +5',{reputation:4,fatigue:5}),choice('remember','집안의 지난 이야기를 기록해 남긴다','학식 +45 XP · 행복 +5',{knowledgeXP:45,happiness:5})],()=>false,0,true),
    ev('physician','산길의 약상자','폭우가 지난 산길에서 젖은 약상자를 주웠다. 처방전에는 의원의 이름 대신 치료받던 환자의 사정이 적혀 있다. 약재를 찾으러 간 의원이 아직 돌아오지 않았다는 소식도 들린다.',[
      choice('deliver','약상자를 의방에 가져다준다','명성 +3 · 학식 +40 XP',{reputation:3,knowledgeXP:40}),choice('seek','소문 속 의원의 행방을 더 알아본다','학식 +60 XP · 피로 +5',{knowledgeXP:60,fatigue:5})],s=>s.age>=26&&['explore','work','investigate'].includes(s.lastAction),52,true),
    ev('physicianreturn','약상자에 남은 글씨','그때 약상자를 기다렸던 이가 다시 서찰을 보내왔다. 의원은 늦게 돌아왔고, 한 환자의 상처는 아직 아물지 않았다고 한다. 찾아갈 길은 열려 있지만 모두의 병을 혼자 고칠 수는 없다.',[
      choice('aid','의방에 필요한 손길을 보탠다','명성 +4 · 행복 +3',{reputation:4,happiness:3}),choice('lesson','약방에 치료의 기록을 남긴다','학식 +70 XP',{knowledgeXP:70})],()=>false,0,true),
    ev('oldLetter','먼지 속의 약속','지난 계절 서신을 정리하다 어린 시절 벗의 이름을 발견했다. 마지막으로 만났던 날 이후 서로 다른 길을 걸었으며, 그 편지의 끝에는 답하지 못한 질문이 남아 있다.',[
      choice('reply','그때 하지 못한 대답을 적는다','행복 +4 · 지인 호감 +4',{happiness:4,affinity:4}),choice('visit','직접 찾아가 지난 약속을 묻는다','피로 +4 · 지인 호감 +6',{fatigue:4,affinity:6})],s=>s.age>=25&&s.npcs.some(n=>n.alive&&n.role==='지인'&&n.age>=20),64,true),
    ev('letterreturn','답장이 늦게 온 까닭','벗에게서 답이 왔다. 글은 길지 않았으나 그동안 서로 몰랐던 사정을 인정하는 내용이었다. 같은 길을 걷지 않아도 은원의 끝에는 사람의 이름이 남는 법이다.',[
      choice('meet','다시 만날 날을 정한다','행복 +5 · 지인 호감 +5',{happiness:5,affinity:5}),choice('keep','서찰을 간직하고 서로의 길을 존중한다','행복 +4 · 학식 +30 XP',{happiness:4,knowledgeXP:30})],()=>false,0,true),
    ev('pilgrim','비 오는 산문의 노객','비를 피하러 들어온 노객이 처마 아래서 오래된 사문 이야기를 들려주었다. 이름을 밝히지는 않았으나 그가 말한 항렬과 연도가 지금 문규와 어긋났다. 거짓말인지 오래된 상처인지는 알 수 없다.',[
      choice('listen','노객의 사연을 끝까지 듣는다','학식 +60 XP · 행복 +2',{knowledgeXP:60,happiness:2}),choice('verify','기록에서 당시의 항렬을 확인한다','학식 +80 XP · 피로 +5',{knowledgeXP:80,fatigue:5})],s=>s.age>=19&&!!s.sectId,52,true),
    ev('pilgrimreturn','노객이 남긴 묵서','그 노객이 더는 산문을 찾지 않는다는 이야기가 전해졌다. 대신 처마 기둥에 짧은 묵서가 남았다. 오래된 문중의 실수와 용서를 두고 서로 다른 해석이 엇갈린다.',[
      choice('truth','기록에 남은 사정을 있는 그대로 전한다','명성 +4 · 신뢰 -2',{reputation:4,trust:-2}),choice('peace','사실을 보존하되 다시 원한을 만들지 않도록 중재한다','신뢰 +5 · 행복 +2',{trust:5,happiness:2})],()=>false,0,true)
  );
  const expansionAPI={ev,choice,queue,dispatch,random,sects:SECTS,places:PLACES,log,income,hearRumor,startCombat,leaveSect};
  EXP.install(EVENTS,expansionAPI);
  function eventText(s,id,context={}){
    const e=EVENTS.find(e=>e.id===id);if(!e)return '';
    const sectText=s.sectId?`현재 ${sect(s)?.name}의 ${s.discipleStatus}이지만 이 문제 앞에서 문파의 이름이 곧 답이 되지는 않는다.`:'';
    const prior=context.starterChoice==='audit'||context.starterChoice==='verify'||context.starterChoice==='search'||context.starterChoice==='witness'||context.starterChoice==='copy';
    let tail='';
    if(id in {inkreturn:1,wayreturn:1,grainreturn:1,bladereturn:1,debtreturn:1,physicianreturn:1,letterreturn:1,pilgrimreturn:1})tail=prior?' 지난번에 직접 조사한 자료가 남아 있어, 이제는 그 내용에 책임을 져야 한다.':' 지난번에는 사람의 사정부터 듣기로 했다. 이번에도 누구의 말에 귀를 기울일지 선택해야 한다.';
    if(['advice','transmission','elderrequest','errand'].includes(id))tail=' '+sectText;
    else if(id==='spouse'&&livingSpouse(s))tail=` 배우자 ${getNPC(s,s.spouseId).name}에게도 나름의 세월이 쌓였다.`;
    else if(id==='tax'&&s.world.climate==='흉년')tail=' 하필 흉년이라 세금을 낼 돈보다 식구의 끼니가 걱정된다.';
    else if(id==='illness'&&s.injury>20)tail=' 전에 입었던 내상이 아직 다 낫지 않았기에 이번 병이 더욱 두렵다.';
    return e.text+tail;
  }
  const ARC_OUTCOMES={
      inkseal:{witness:'먹이 지워진 자리를 직접 확인하기로 했다. 누군가 감추려 했던 이름을 그냥 넘기지 않았다.',mediate:'두 편의 체면을 지키며 사실을 묻기로 했다. 말보다 사람의 태도를 먼저 살폈다.'},
      waybill:{deliver:'약속된 주인을 찾아 봉인한 장부를 돌려보냈다. 글자보다 무거운 약속이 남았다.',copy:'당사자들의 몫이 지워지지 않도록 사본을 만들었다. 기록에는 언제나 증인이 필요했다.'},
      grainbook:{audit:'곡식 장부의 수를 확인하기로 했다. 굶주린 사람에게 소문만을 전할 수는 없었다.',relief:'창고의 시비가 가려지기 전, 당장 필요한 곡식을 마련했다.'},
      bladeoath:{search:'죽은 문인의 이름을 찾아 옛 기록을 뒤지기 시작했다. 작은 의심이 오래된 사문을 흔들었다.',restore:'주인을 찾은 유품을 제자에게 돌려주었다. 이별의 예만큼은 소홀히 하지 않았다.'},
      familydebt:{repay:'오래전 받은 도움을 지금의 형편에서 갚았다. 은혜가 숫자에만 있지 않다는 것을 알았다.',talk:'서로 기억이 다른 부분을 장부와 말로 맞췄다. 먼저 미안하다고 말하는 사람이 있었다.'},
      physician:{deliver:'약상자가 기다리는 사람에게 닿도록 맡겼다. 치료의 공은 이름 없는 손을 거쳐 이어졌다.',seek:'잃어버린 약재의 주인을 찾기로 했다. 소문을 좇는 목적이 내공만은 아니었다.'},
      oldLetter:{reply:'오래 미뤄 온 답을 써 보냈다. 봉투를 봉하며 예전의 말을 다시 고쳤다.',visit:'대답을 글로 미루지 않고 직접 만나 묻기로 했다.'},
      pilgrim:{listen:'노객의 긴 이야기 속에서 오래된 문중의 상처를 엿보았다.',verify:'항렬과 연도를 대조해 무엇이 어긋났는지 확인하기로 했다.'}
    };
  const eventDef = id => EVENTS.find(e=>e.id===id);
  function eligible(s,id) {const e=eventDef(id);return e&&(!e.once||!s.eventCounts[id])&&s.tick-(s.eventLast[id]??-10000)>=e.cooldown;}
  function queue(s,id,context={}) {if(!eligible(s,id))return;if(id==='mentorloss'&&(s.mentorObituaries||[]).includes(context.actorId||s.mentorId))return;if(ARC_NEXT[id]&&(s.eventQueue.some(e=>e.id===id)||s.pendingEvent?.id===id))return;context={actorId:Object.hasOwn(context,'actorId')?context.actorId:actorFor(s,id),...context};if(id==='revenge'&&!context.memoryId){const m=s.memories.find(m=>m.type==='원한'&&m.status==='open'&&getNPC(s,m.actorId)?.alive);if(!m)return;context={...context,actorId:m.actorId,memoryId:m.id};}const same=e=>e.id===id&&JSON.stringify(e.context)===JSON.stringify(context);if(s.eventQueue.some(same)||s.pendingEvent&&same(s.pendingEvent))return;s.eventQueue.push({id,context});}
  function dispatch(s) {if(s.pendingEvent||s.combat||s.combatResultPending||!s.alive||!s.eventQueue.length)return;const e=s.eventQueue.shift();s.pendingEvent={...e,uid:`${s.tick}:${e.id}:${s.eventCounts[e.id]||0}`,age:s.age,q:s.q};s.playing=false;s.lastEventTick=s.tick;log(s,`${eventDef(e.id).title} — 선택을 기다린다.`);}
  function entryChance(s,t) {if(!EXP.entryRule(s,t).ok)return 0;return clamp(t.entry+(s.aptitude.body+s.aptitude.mind-100)/400+(s.clanId===t.id ? .18 : 0)+(s.reputation/500)-(s.age>30 ? .1 : 0),.08,.94);}
  function breakthroughChance(s) {return clamp(.34+s.aptitude.mind/330+(getNPC(s,s.mentorId)?.alive?.08:0)+s.trust/1000-s.injury/150,.2,.88);}
  function power(s) {return (skill(s.swordXP)*.44+skill(s.operationXP)*.22+skill(s.methodXP)*.1+Math.sqrt(s.inner)*17+s.rank*4)*(s.health/100)*(1-s.injury/150)*(1-EXP.penalty(s));}
  function combatInfo(s) {const enemy=25+random(s,'opponent')*65;const win=clamp(.5+(power(s)-enemy)/110,.05,.95);return {enemy,win,fatal:.015+(1-win)*.065};}
  const COMBAT_STANCES=[
    {id:'allout',label:'전력으로 임한다',factor:1.32,cost:45,risk:.20,injury:30,desc:'가용 내력 45 · 승부에 전력을 쏟는다. 패배 시 치명상 위험이 가장 높고, 무리한 운기로 내상을 입을 수 있다.'},
    {id:'forceful',label:'가능한 힘껏 임한다',factor:1.16,cost:24,risk:.085,injury:24,desc:'가용 내력 24 · 무공을 적극 운용한다. 패배 시 중상과 내상 위험이 있다.'},
    {id:'normal',label:'평소의 실력으로 임한다',factor:1,cost:10,risk:.045,injury:18,desc:'가용 내력 10 · 상대와 자신의 무공·상태에 따라 승부와 부상이 결정된다.'},
    {id:'restrained',label:'힘을 아끼며 임한다',factor:.58,cost:0,risk:.14,injury:28,desc:'내력 소모 없음 · 실력의 일부만 사용한다. 패배하면 치명상 위험과 명망 손실이 크다.'},
    {id:'flee',label:'도망친다',factor:0,cost:0,risk:0,injury:6,desc:'퇴로를 찾는다. 전력과 보법 차이가 클수록 벗어나기 어렵다. 실패하면 부상을 입고 다시 대응해야 한다.'}
  ];
  function opponentProfile(s,n){
    const k=clamp(n.martial?n.martialSkill:0,0,99.9),p=n.combatProfile||{rank:Math.min(6,Math.floor(k/17)),inner:n.martial?Math.max(0,(k-15)/28):0,reserve:100,health:90,injury:0,skill:k,operation:k*.85,method:k*.8};
    const strength=(p.skill*.44+(p.operation??p.skill*.85)*.22+(p.method??p.skill*.8)*.1+Math.sqrt(p.inner)*17+p.rank*4)*(p.health/100)*(1-p.injury/150)*(.75+p.reserve/400);
    return {...p,power:clamp(strength,0,200)};
  }
  function startCombat(s,kind,eventId,uid,context={}) {
    let n=getNPC(s,context.actorId);
    if(!n?.alive||!n.martial)n=kind==='duel'?s.npcs.find(n=>n.alive&&n.martial&&n.age>=18&&n.affinity>=40):null;
    if(!n&&s.npcs.length<95){const k=25+random(s,'opponent')*60;n={id:'encounter-'+uid,name:kind==='duel'?'비무를 청한 무인':'길을 막은 무인',role:kind==='duel'?'지인':'원한 상대',age:22+Math.floor(random(s,'enemyAge')*35),alive:true,affinity:kind==='duel'?45:10,trust:30,goal:'유람',skill:k,office:'없음',married:false,portrait:2,martial:true,location:s.location,sectId:null};initializeNPC(s,n);s.npcs.push(n);}
    const profile=n?opponentProfile(s,n):null;
    s.playing=false;s.combat={uid:`${uid}:combat`,kind,eventId,round:0,opponentId:n?.id||null,enemy:{name:n?.name||(kind==='duel'?'비무를 청한 무인':'길을 막은 무인'),power:profile?.power??25+random(s,'opponent')*65,profile,weapon:kind==='duel'?'목검':'환도',style:pick(s,['빠른 연환초식','무거운 일격','빈틈을 노리는 보법'],'enemyStyle')},age:s.age,q:s.q};
    log(s,kind==='duel'?'서로 예를 갖추고 비무장에 섰다. 생사결은 하지 않기로 했다.':'녹림의 도객과 거리를 두고 대응할 방식을 살폈다.','전투');
  }
  function combatOptions(s) {if(!s.combat)return [];const c=s.combat;return COMBAT_STANCES.map(o=>{const ready=.75+s.innerReserve/400,art=artModifier(s,o.id);const win=o.id==='flee'?clamp((.65+(power(s)-c.enemy.power)/140+skill(s.operationXP)/350)*art,.12,.96):clamp(.5+(power(s)*o.factor*ready*art-c.enemy.power)/110,.03,.97);const fatal=c.kind==='duel'||o.id==='flee'?0:clamp(o.risk+(1-win)*o.risk,0,.48);return {...o,win,fatal,disabled:s.innerReserve<o.cost};});}
  function combatIntel(s) {const c=s.combat;if(!c)return null;const n=getNPC(s,c.opponentId),friendly=c.kind==='duel'&&n?.alive&&n.affinity>=80;const insight=skill(s.knowledgeXP)+s.reputation*.25+clamp((s.age-25)*.35,-6,15)+clamp(s.inner*3,0,15);const level=friendly?(n.affinity>=90?'detailed':'partial'):insight>=60?'detailed':insight>=28?'partial':'limited';const gap=c.enemy.power-power(s),p=c.enemy.profile;return {level,name:c.enemy.name,weapon:c.enemy.weapon,style:level==='limited'?'초식의 흐름을 아직 읽기 어렵다.':c.enemy.style,estimate:level==='detailed'?`전력 추정 ${Math.round(c.enemy.power)}`:level==='partial'?(gap>15?'자신보다 강할 가능성이 높다.':gap<-15?'정면 승부에서도 해볼 만하다.':'실력이 비슷해 보인다.'):'경지와 내공은 알려지지 않았다.',basis:friendly?'친분에 따른 사전 지식':'학식·명성·나이·내공을 통한 관찰',details:p&&(level==='detailed'||friendly)?`${RANKS[p.rank]?.name||'미상'} · 내공 ${p.inner.toFixed(2)}갑자 · 무공 ${Math.round(p.skill)} · 운용 ${Math.round(p.operation??p.skill*.85)} · 심법 ${Math.round(p.method??p.skill*.8)} · 내력 ${Math.round(p.reserve)}`:''};}
  function resolveCombat(s,uid,stanceId,expectedRound=s.combat?.round) {
    const c=s.combat;if(!c||!s.alive||c.uid!==uid||c.round!==expectedRound)return false;const o=combatOptions(s).find(o=>o.id===stanceId);if(!o||o.disabled)return false;
    const commit=`${c.uid}:${c.round}`;if(s.resolved.includes(commit))return false;s.resolved.push(commit);
    const roll=random(s,'combat:'+uid,c.round);s.innerReserve=clamp(s.innerReserve-o.cost);s.choices.push({tick:s.tick,age:s.age,q:s.q,event:c.eventId,choice:stanceId,label:o.label});
    let text='',victory=false,fatal=false,damage=0,innerLoss=0,escaped=false,enemyKilled=false,grade='도주',permanent=false;
    if(stanceId==='flee'){
      escaped=roll<o.win;if(escaped)text='보법을 펼쳐 퇴로를 확보했다. 싸움을 벗어났다.';
      else{damage=6;delta(s,'injury',damage);delta(s,'health',-4);c.round++;text='퇴로를 가로막혀 가벼운 부상을 입었다. 다시 대응할 틈을 찾는다.';
        if(c.round<3){log(s,text,'전투');s.latestPersonalStory=text;return true;}spend(s,Math.min(8,s.money));text='끝내 싸움 대신 짐을 내주고 몸을 보전했다.';escaped=true;
      }
    }else{
      victory=roll<o.win;
      const margin=victory?roll/o.win:(roll-o.win)/(1-o.win),strengthGap=clamp((power(s)-c.enemy.power)/120,-.25,.25);
      grade=victory?(margin-strengthGap<.2?'압도적 승리':margin-strengthGap<.55?'승리':margin-strengthGap<.82?'신승':'박빙의 승리'):(margin-strengthGap>.7?'압도적 패배':margin-strengthGap>.3?'패배':'석패');
      if(victory){income(s,c.kind==='duel'?8:12);s.swordXP+=70;const renown=c.enemy.power>power(s)?5:c.enemy.power<power(s)*.6?0:2;delta(s,'reputation',renown);text=c.kind==='duel'?'상대의 초식 사이를 읽어 비무를 마쳤다. 서로 예를 갖추고 물러났다.':'상대의 초식을 끊어 승기를 잡았다. 길을 확보했다.';
        if(c.kind!=='duel'&&random(s,'combatEnemyDeath',c.round)<(stanceId==='allout'?.25:stanceId==='forceful'?.12:stanceId==='normal'?.04:0)){text=s.hasKilled?'생사결 끝에 상대가 쓰러졌다. 그 무게가 오래 마음에 남았다.':'처음으로 사람을 죽였다. 그 기분은 결코 잊지 못할 것이다.';enemyKilled=true;s.hasKilled=true;delta(s,'happiness',-6);}
      }else{
        const severity=grade==='압도적 패배'?1.4:grade==='패배'?1:.65;
        damage=Math.round(o.injury*(.7+random(s,'combatDamage',c.round)*.7)*severity);delta(s,'injury',damage);const loss=Math.min(c.kind==='duel'?s.health-1:s.health,Math.ceil(damage*.6));delta(s,'health',-Math.max(0,loss));delta(s,'reputation',stanceId==='restrained'?-6:-2);
        const deathScale=(grade==='압도적 패배'?1.8:grade==='패배'?.7:.3)*(c.kind==='hostile'?.35:1);
        fatal=c.kind!=='duel'&&(random(s,'combatFatal',c.round)<Math.min(.8,o.fatal*deathScale)||s.health<=0);text=c.kind==='duel'?'비무에서 패해 부상을 입었다. 상대는 더 겨루지 않고 멈추었다.':'상대의 힘을 견디지 못해 패배하고 부상을 입었다.';
      }
      const woundChance=victory?({'압도적 승리':.015,'승리':.08,'신승':.22,'박빙의 승리':.42}[grade]):1;
      if(random(s,'combatWound',c.round)<woundChance*(c.kind==='duel'?.45:1)){
        const lasting=victory?(grade==='박빙의 승리'?.01:0):grade==='압도적 패배'?.12:grade==='패배'?.035:.008;
        permanent=random(s,'combatPermanent',c.round)<lasting*(c.kind==='duel'?.08:c.kind==='lethal'?1.4:1);
        const severity=victory?3+Math.round(random(s,'winWound',c.round)*5):Math.min(25,Math.max(4,Math.round(damage*.45)));
        EXP.addInjury(s,{permanent,severity,source:grade});if(victory){damage=severity;delta(s,'injury',severity);delta(s,'health',-Math.min(s.health-1,Math.ceil(severity*.4)));}
        text+=permanent?' 오래 남는 후유장애를 입었다. 소문 속 명의의 치료가 필요하다.':' 한동안 회복이 필요한 외상을 입었다.';
      }
      if(['allout','forceful'].includes(stanceId)&&random(s,'combatOverstrain',c.round)<(stanceId==='allout'?.22:.10)){const extra=8+Math.round(random(s,'innerWound',c.round)*10);delta(s,'injury',extra);innerLoss=s.inner*(.01+random(s,'innerLoss',c.round)*.03);s.inner=Math.max(0,s.inner-innerLoss);text+=` 무리한 운기로 내상을 입어 축적 내공 ${innerLoss.toFixed(3)}갑자를 잃었다.`;}
    }
    if(c.opponentId){const n=getNPC(s,c.opponentId);if(n?.alive){relationChange(s,n.id,c.kind==='duel'?victory?3:1:escaped?-3:-20);if(enemyKilled){n.alive=false;n.deathAge=n.age;n.deathTick=s.tick;}else if(c.kind!=='duel'&&!escaped)remember(s,'원한',{id:c.eventId,uid:c.uid,context:{actorId:n.id}},{id:stanceId,label:o.label},'실제로 맞선 상대와 다툼의 기억이 남았다.');}}
    if(!c.opponentId&&c.kind!=='duel'&&!escaped&&!enemyKilled){const id='opponent-'+c.uid;const n={id,name:c.enemy.name,role:'원한 상대',age:Math.max(18,s.age+2),alive:true,affinity:10,trust:10,goal:'유람',skill:c.enemy.power,office:'없음',married:false,portrait:2,martial:true,location:s.location,sectId:null};s.npcs.push(n);initializeNPC(s,n);remember(s,'원한',{id:c.eventId,uid:c.uid,context:{actorId:id}},{id:stanceId,label:COMBAT_STANCES.find(x=>x.id===stanceId).label},'실제로 맞선 상대와 다툼의 기억이 남았다.');}
    if(c.objective==='escort'){const n=getNPC(s,c.protectedId);if(victory){income(s,12+s.rank*4);relationChange(s,n?.id,6);text+=' 맡은 사람과 화물을 목적지까지 지켰다.';}else{text+=' 호위 계약을 완수하지 못해 남은 화물과 사람의 안전을 상단에 인계했다.';delta(s,'reputation',-2);}}
    if(c.warId&&!escaped){const w=s.world.wars.find(w=>w.id===c.warId);if(w?.status==='active'){const side=c.warSide===w.b?-1:1;if([w.a,w.b].includes(c.warSide))w.balance=clamp(w.balance+(victory?3*side:-side),-100,100);else if(victory)w.peace++;if(victory)s.warContributions[w.id]=(s.warContributions[w.id]||0)+3;}}
    text=grade+' · '+text;s.lastCombat={uid:c.uid,kind:c.kind,stance:stanceId,text,victory,escaped,damage,innerLoss,grade,permanent,warId:c.warId||null,age:s.age,q:s.q};s.combat=null;s.combatResultPending=true;s.latestPersonalStory=text;s.playing=false;log(s,text,'전투');
    if(fatal)die(s,'전투 중 입은 치명상');return true;
  }
  function dismissCombat(s) {if(s.combat||!s.combatResultPending)return false;s.combatResultPending=false;dispatch(s);return true;}
  function methodRisk(s,newPrinciple) {const relation=s.method.principle===newPrinciple?'동계':s.method.principle==='중정'||newPrinciple==='중정'?'유사':'상극';return relation==='동계'?{label:'동계',min:.01,max:.04,injury:.03}:relation==='유사'?{label:'유사',min:.06,max:.14,injury:.14}:{label:'상극',min:.3,max:.55,injury:.42};}
  function options(s) {const p=s.pendingEvent;if(!p)return [];const e=eventDef(p.id);return e.opts.map(o=>{let hint=o.hint,label=o.label;let disabled=!!o.cost&&s.money<o.cost;
    if(o.special==='join'){const t=SECTS.find(t=>t.id===o.sectId);hint=`입문 성공 ${Math.round(entryChance(s,t)*100)}% · 이동·소속 변경 · 기존 심법 유지`;disabled=!!s.sectId||!!s.independentSect||!s.world.sects.find(x=>x.id===t.id).alive;}
    if(o.special==='combat')hint='별도 전투 화면에서 상대와 대응 확인 · 생사전에서는 치명상 위험';
    if(o.special==='breakthrough')hint=`${RANKS[s.rank+1]?.name} 돌파 ${Math.round(breakthroughChance(s)*100)}% · 실패 시 내상 6`;
    if(o.special==='adapt'){const r=methodRisk(s,s.manual?.principle||'중정');hint=`${r.label}: 내공 ${Math.round(r.min*100)}~${Math.round(r.max*100)}% 손실 · 내상 ${Math.round(r.injury*100)}%`;}
    if(o.special==='marry'){const n=getNPC(s,p.context.partnerId);disabled=s.age<18||!!livingSpouse(s)||!n?.alive||n.age<18||n.married||n.affinity<60;hint=`${n?.name||'상대'}와 쌍방 동의 확인 · 양쪽 성인·미혼 · 무공 조건 없음`;}
    if(o.special==='sectMethod'){const t=SECTS.find(t=>t.id===p.context.sectId);const r=methodRisk(s,t?.principle||'중정');hint=`${t?.method} · 내공 ${Math.round(r.min*100)}~${Math.round(r.max*100)}% 손실 · 내상 ${Math.round(r.injury*100)}%`;disabled=!t||s.sectId!==t.id;}
    if(o.special==='alliance')disabled=!['order','sapa'].includes(sect(s)?.bloc);
    if(o.special==='teachingPermit')disabled=!s.sectId||s.trust<65||s.merit<60;
    if(o.special==='openDojo')disabled=!canOpenDojo(s);
    if(o.special==='foundSect')disabled=!canFoundSect(s);
    if(o.special==='business')disabled=s.money<80||!!s.organization||s.age<18||careerSkill(s)<52;
    if(o.special==='child')disabled=childChance(s)<=0;
    const actor=getNPC(s,p.context.actorId);
    if(o.special==='story'&&p.id==='first-pupil'&&o.id!=='wait'&&actor&&!actor.alive)disabled=true;
    if(p.id==='friend'&&o.id==='meet'&&actor?.location!==s.location){hint='방문 여비 2냥 · 피로 +5 · 해당 벗 호감 +8';disabled=s.money<2||!actor?.alive;}
    if((p.id.endsWith('-return')||Object.values(ARC_NEXT).includes(p.id))&&actor&&!actor.alive){label=e.opts.indexOf(o)===0?'남겨진 기록과 뜻을 정리한다':'남은 사람들과 기억을 나눈다';hint='고인의 기억과 남은 기록을 정리 · 추가 만남 없음';}
    if(o.special==='escort')hint=`호위 전투 · 생사 위험 · 성공 보수 ${12+s.rank*4}냥 · 피로 +12`;
    if(p.id==='transmission'){const n=getNPC(s,s.mentorId);if(o.id==='accept'){const strict=n?.alive&&n.teachingStyle==='엄격',caring=n?.alive&&n.teachingStyle==='배려';hint=strict?'초식 시연: 무공 숙련 52 이상 · 진전 전수':caring?'호흡 지도: 운용 숙련 45 이상 · 진전 전수':'원로 심사로 전수 · 사부의 부재가 성장을 막지 않음';disabled=!!s.transmission||!s.sectId||strict&&skill(s.swordXP)<52||caring&&skill(s.operationXP)<45;}}
    if(o.special==='join'){const rule=EXP.entryRule(s,SECTS.find(t=>t.id===o.sectId));if(!rule.ok){disabled=true;hint=rule.reason;}}
    if(o.special==='war'||o.special==='warAfter'){const w=s.world.wars.find(w=>w.id===p.context.warId);if(!w||s.warReceipts.includes(p.id+':'+w.id)||o.special==='war'&&w.status!=='active'||o.special==='warAfter'&&w.status!=='ended')disabled=true;if(o.id==='fight'&&s.age<18){disabled=true;hint='전투 자원은 18세부터. 구호·중재·불참을 선택할 수 있다.';}}
    return {...o,label,hint,disabled};});}
  function leaveSect(s,reason='탈퇴') {if(s.sectId){s.memberships.push({sectId:s.sectId,from:s.joinAge,to:s.age,reason,office:s.officeId});if(reason==='탈퇴'&&['장로','장문인','가주','천마','혈마','방주','무림맹주','사도련주'].includes(s.officeId)){s.sectRelations[s.sectId]=-35;delta(s,'reputation',-8);log(s,'문중의 중책을 내려놓고 떠났다. 사문은 깊은 불신을 드러냈다. 전수 허가와 사승의 정통성은 별도로 살펴야 한다.','사문');}log(s,`${sect(s).name}에서 ${reason}. 배운 무공과 사승 이력은 남았다.`);}s.sectId=null;s.discipleStatus='없음';s.officeId=null;s.transmission=false;s.successorFlag=false;s.merit=0;s.support=0;s.trust=25;}
  function join(s,t) {s.sectId=t.id;s.joinAge=s.age;s.location=t.place;s.discipleStatus=discipleNames(s,t)[0];s.merit=0;s.trust=35;s.support=8;
    const id=`mentor-${t.id}-${s.tick}-${s.npcs.length}`;s.mentorId=id;s.npcs.push({id,name:pick(s,['허','한','백','서'],'mentorName')+pick(s,['진경','청운','소현','무진'],'mentorGiven'),age:38+Math.floor(random(s,'mentorAge')*12),alive:true,role:'사부',affinity:40,trust:40,goal:'수련',skill:65,office:'교관',portrait:0});
    initializeNPC(s,getNPC(s,id),s.npcs.length-1);
    BIRTH.syncMentor(s);
    const art=MARTIAL_ARTS[t.id];if(t.id!=='guild')s.learnedSkills.push({name:art.basic,source:t.id,age:s.age,tier:'기초',weapon:art.weapon});
    // A first method is instructed; later sect changes never silently replace the core method.
    if(t.id!=='guild'&&s.inner===0&&s.methodXP===0)s.method={id:t.id,name:t.method,principle:t.principle,quality:t.quality};
    else if(t.id!=='guild'&&s.method.id!==t.id)queue(s,'methodoffer',{sectId:t.id});
    setPreset(s,t.id==='guild'?['work','social','work','rest']:['sword','inner','mission','inner']);queue(s,'entry-plan',{sectId:t.id});
    log(s,`${t.name} 입문. ${s.discipleStatus}가 되었으며 성씨·혈연·직업은 그대로다. 입문 청원을 마치고 수련 중심 일과로 바꾸었다.`);}
  function resolveEvent(s,uid,index) {
    if(!s.alive||!s.pendingEvent||s.pendingEvent.uid!==uid||s.resolved.includes(uid))return false;
    const p=s.pendingEvent,o=options(s)[index];if(!o||o.disabled)return false;
    s.pendingEvent=null;s.resolved.push(uid);s.lastCommit=uid;s.eventLast[p.id]=s.tick;s.eventCounts[p.id]=(s.eventCounts[p.id]||0)+1;
    s.choices.push({tick:s.tick,age:s.age,q:s.q,event:p.id,choice:o.id,label:o.label,actorId:p.context.actorId||null,causeId:p.context.memoryId||null});
    for(const [key,n] of Object.entries(o.effects)) {
      if(key==='careerXP')s.careerXP[s.career]=(s.careerXP[s.career]||0)+n;
      else if(key==='affinity')relationChange(s,p.context.actorId,n);
      else if(key==='spouseAffinity'){const person=getNPC(s,s.spouseId);if(person?.alive)person.affinity=clamp(person.affinity+n);}
      else if(key==='money'){if(n>=0)income(s,n);else spend(s,-n);}
      else delta(s,key,n);
    }
    if(p.id==='mentorloss'&&p.context.actorId&&!s.mentorObituaries.includes(p.context.actorId))s.mentorObituaries.push(p.context.actorId);
    if(p.id==='rumor-healer')EXP.heal(s,o.id==='care'?12:6,true);
    let result='';const roll=random(s,'choice:'+p.id);
    switch(o.special){
      case 'war':case 'warAfter':case 'cultBackground':case 'cultContact':case 'notoriety':case 'begRumor':result=EXP.handle(s,p,o,expansionAPI)||'';break;
      case 'story':result=applyStory(s,p,o);break;
      case 'join':{const t=SECTS.find(t=>t.id===o.sectId);if(roll<entryChance(s,t)){join(s,t);result='입문을 허락받았다.';}else{delta(s,'reputation',1);result='이번 심사는 통과하지 못했다. 4년 뒤 다시 도전하거나 다른 문파를 찾을 수 있다.';}break;}
      case 'leave':leaveSect(s);break;
      case 'sectMethod':{const t=SECTS.find(t=>t.id===p.context.sectId);if(t&&s.sectId===t.id){const r=methodRisk(s,t.principle);s.inner*=1-r.min-roll*(r.max-r.min);if(random(s,'sectMethodInjury')<r.injury)delta(s,'injury',12);s.method={id:t.id,name:t.method,principle:t.principle,quality:t.quality};s.methodXP*=.85;result=`손실을 치르고 ${t.method}으로 전환했다.`;}break;}
      case 'ruinCivil':case 'ruinWander':{const id=p.context.sectId||s.sectId;if(s.sectId===id)leaveSect(s,'해산');if(s.clanId===id)s.birthSupport=0;setPreset(s,o.special==='ruinCivil'?['work','social','work','rest']:['work','seek','sword','inner']);result='이름과 배움은 남았고, 삶의 길은 다시 열렸다.';break;}
      case 'promotion':{const t=sect(s);if(t&&s.trust>=45){const names=discipleNames(s,t),i=names.indexOf(s.discipleStatus);s.discipleStatus=names[Math.min(i+1,2)];if(i>=1&&s.rank>=3)s.officeId='교관';result=`${s.discipleStatus}로 인정받았다. 후계권이나 진전은 자동으로 얻지 않는다.`;}break;}
      case 'transmission':{const t=sect(s);if(t){const art=MARTIAL_ARTS[t.id];s.transmission=true;s.method.quality=Math.max(s.method.quality,t.quality*1.45);s.learnedSkills.push({name:art.secret,source:t.id,age:s.age,tier:'비전',weapon:art.weapon});result=`${art.secret}의 초식과 현재 계통을 보완하는 운기 지도를 전수받았다.`;}break;}
      case 'breakthrough':if(roll<breakthroughChance(s)){s.rank++;s.milestones.push({age:s.age,type:'경지',name:RANKS[s.rank].name});delta(s,'reputation',s.rank*2);result=`${RANKS[s.rank].name}의 경지에 올랐다.`;}else{delta(s,'injury',6);queue(s,'training-advice');result='돌파에 실패해 내상 6을 입었다. 부족한 조건과 수련의 초점을 되짚을 수 있다. 4년 뒤 다시 시도한다.';}break;
      case 'craftOrder':income(s,careerSkill(s)>=45?20:6);delta(s,'fatigue',10);s.careerXP[s.career]=(s.careerXP[s.career]||0)+65;break;
      case 'trade':spend(s,15);if(roll<.60){income(s,33);result='거래가 성사되어 순이익 18냥을 얻었다.';}else result='운송 손실로 출자금 15냥을 잃었다.';break;
      case 'herbs':if(roll<.65)income(s,15);else delta(s,'health',-8);break;
      case 'flood':s.money*=.92;delta(s,'reputation',4);break;
      case 'flee':if(!spend(s,2))delta(s,'fatigue',8);break;
      case 'negotiate':if(!spend(s,3))delta(s,'fatigue',6);break;
      case 'peace':if(!spend(s,5))delta(s,'fatigue',5);delta(s,'ethics',3);break;
      case 'combat':case 'duel':startCombat(s,o.special==='duel'?'duel':p.id==='revenge'?'lethal':'hostile',p.id,uid,p.context);result='상대를 살피고 대응 방식을 고를 때다.';break;
      case 'escort':startCombat(s,'hostile',p.id,uid);s.combat.objective='escort';s.combat.protectedId=p.context.actorId;result='사람과 화물을 지키는 호위에 나섰다. 생사 위험과 계약의 책임을 함께 살펴야 한다.';break;
      case 'retire':setPreset(s,['work','social','rest','rest']);s.retired=true;break;
      case 'manual':s.manual={name:'유수심경',progress:0,principle:pick(s,['양강','음유','중정'],'manualPrinciple'),quality:2.4,discovered:s.age};result='비급을 보관했다. 독서·연구로 뜻을 풀어야 한다.';break;
      case 'adapt':{const r=methodRisk(s,s.manual.principle);s.inner*=1-r.min-roll*(r.max-r.min);if(random(s,'adaptInjury')<r.injury)delta(s,'injury',25);s.method={id:'manual',name:s.manual.name,principle:s.manual.principle,quality:s.manual.quality};s.methodXP*=.7;s.manual.adapted=true;result='손실을 치르고 새 심법으로 운기를 바꾸었다.';break;}
      case 'marry':{const n=getNPC(s,p.context.partnerId);if(n?.alive&&!n.married&&n.affinity>=60&&n.age>=18){s.spouseId=n.id;n.married=true;n.maritalStatus='married';n.role='배우자';if(s.money>=8)spend(s,8);delta(s,'happiness',10);result=`${josa(n.name,'와/과')} 서로의 뜻을 확인하고 혼인했다.`;}break;}
      case 'child':if(childChance(s)>0){const id='child-'+s.childIds.length;const child={id,name:s.surname+pick(s,['소윤','지운','하린','연우','서하','청'],'childName',s.childIds.length),age:0,alive:true,role:'자녀',affinity:60,trust:60,goal:'가족',skill:0,office:'없음',married:false,portrait:s.childIds.length%4};s.npcs.push(child);s.childIds.push(id);child.parentIds=['player',s.spouseId];child.clanId=s.clanId;child.lineage=s.birthLineage;child.birthStatus=s.birthStatus==='recognized'?'recognized':'unrecognized';delta(s,'happiness',7);result=`두 사람의 동의로 ${josa(child.name,'을/를')} 가족으로 맞이했다.`;}break;
      case 'childTeach':{const n=s.npcs.find(n=>s.childIds.includes(n.id)&&n.alive&&n.age>=16);if(n&&n.affinity>=50){delta(s,'legacy',1);result='자녀가 배움을 청했다. 전승의 첫걸음을 함께했다.';}else result='자녀는 다른 길을 택했다. 그 뜻을 받아들였다.';break;}
      case 'meeting':{const id=`friend-${s.tick}`;s.npcs.push({id,name:pick(s,['서','백','한','송','유','임'],'meetingSurname')+pick(s,['연','청','운','소하','진','설'],'meetingGiven'),age:Math.max(18,s.age-3+Math.floor(random(s,'meetingAge')*7)),alive:true,role:'지인',affinity:65,trust:50,goal:pick(s,['가업','가족','유람'],'meetingGoal'),skill:25,office:'없음',married:false,portrait:s.npcs.length%4});result='서로를 알아 갈 새로운 인연이 생겼다.';break;}
      case 'separate':{const n=getNPC(s,s.spouseId);if(n){n.married=false;n.maritalStatus='separated';n.role='옛 배우자';s.spouseId=null;delta(s,'happiness',-4);result='혼인을 정리했다. 함께한 시간과 자녀의 기록은 남았다.';}break;}
      case 'succession':if(leadershipEligible(s)){const t=sect(s);s.officeId=t.family?'가주':t.id==='military'?'군영 통령':t.id==='guild'?'대행수':t.id==='demon'?'천마':t.id==='blood'?'혈마':t.id==='gaebang'?'방주':'장문인';s.successorFlag=true;s.milestones.push({age:s.age,type:'직위',name:s.officeId});result=`원로들의 추대로 ${s.officeId}에 취임했다.`;}break;
      case 'alliance':if(s.rank>=4&&s.support>=65&&s.reputation>=70){const b=sect(s)?.bloc;if(!['order','sapa'].includes(b))break;s.officeId=b==='order'?'무림맹주':'사도련주';s.milestones.push({age:s.age,type:'직위',name:s.officeId});result=`연합의 추대로 ${s.officeId}에 취임했다.`;}break;
      case 'business':spend(s,80);s.organization={type:'civilian',name:s.career==='doctor'?'의방':s.career==='merchant'?'상단':s.career==='teacher'?'서당':s.career==='innkeeper'?'객잔':'공방',treasury:55,members:3,age:0};result='별도 금고를 가진 생업 터전을 마련했다.';break;
      case 'teachingPermit':if(s.sectId&&s.trust>=65&&s.merit>=60){s.merit-=20;if(!s.teachingPermits.includes(s.sectId))s.teachingPermits.push(s.sectId);result=`${sect(s).name}에서 무관 전수의 범위를 정한 허가를 받았다. 개파의 정통성과는 별개다.`;}break;
      case 'openDojo':if(canOpenDojo(s)){spend(s,80);s.organization={type:'dojo',name:'호신무관',teachingSource:s.teachingSource,treasury:55,members:3,age:0};result='허가된 무학의 범위에서 가르치는 무관을 열었다.';}break;
      case 'foundSect':if(canFoundSect(s)){const art=independentArt(s);spend(s,80);const witnesses=s.npcs.filter(n=>n.alive&&n.age>=18&&n.affinity>=60).slice(0,2).map(n=>n.id);s.independentSect={id:'founded-'+s.tick,name:s.surname+'가 청계문',art:art.name,artSource:art.source,witnesses,foundedAge:s.age};s.organization={type:'sect',name:s.independentSect.name,treasury:55,members:3,age:0};s.officeId='개파조사';s.milestones.push({age:s.age,type:'개파',name:s.independentSect.name});result=`${art.name}의 맥을 바탕으로 ${s.independentSect.name}의 사승을 열었다.`;}break;
      case 'forgottenArt':s.forgottenArt={id:'cheonggye',name:'청계유수십이검',progress:0,learned:false,independent:true};result='청계문의 검보를 보관했다. 독서·연구를 통해 뜻을 풀어야 한다.';break;
      case 'invest':spend(s,15);if(s.organization)s.organization.treasury+=15;break;
      case 'closeBusiness':if(s.organization){income(s,s.organization.treasury*.6);s.organization=null;}break;
      case 'creation':s.createdArt=`${s.surname}가 유수법`;s.legacy+=5;if(!s.teachingPermits.includes('created'))s.teachingPermits.push('created');s.learnedSkills.push({name:s.createdArt,source:'created',tier:'창시 무학',age:s.age,weapon:'종합'});result=`장점과 약점을 함께 기록한 ${s.createdArt}을 남겼다.`;break;
    }
    s.npcs.forEach((n,i)=>initializeNPC(s,n,i));
    const known=s.knownMethods.findIndex(m=>m.id===s.method.id);if(known<0)s.knownMethods.push({...s.method,age:s.age});else s.knownMethods[known]={...s.method,age:s.knownMethods[known].age};
    if(p.id==='friend'&&o.id==='meet'&&getNPC(s,p.context.actorId)?.location!==s.location){spend(s,2);delta(s,'fatigue',5);}
    if(p.id==='revenge'){const m=s.memories.find(m=>m.id===p.context.memoryId);if(m){m.status='closed';m.aftermath=`${o.label}의 선택으로 당사자와 원한을 정리했다.`;relationChange(s,m.actorId,o.id==='peace'?10:0);}}
    if(['masterwork','craftorder','trade','herbs','pupil','guest'].includes(p.id)){const m=remember(s,'약속',p,o,`${career(s).name}으로서 ${o.label}의 일을 ${getNPC(s,p.context.actorId)?.name||'마을 사람'}과 함께 남겼다.`);later(s,m,p.id,8,{automatic:true});}
    if(['creation','business','openDojo','foundSect'].includes(p.id)&&!['wait'].includes(o.id)){const m=remember(s,'약속',p,o,`${s.createdArt||s.organization?.name||career(s).name}의 배움을 나눌 터전을 남겼다.`);later(s,m,'first-pupil',4);}
    if(p.id==='friend'||p.id==='parent'){const m=remember(s,'약속',p,o,'안부를 나누고 서로의 현재 삶을 기억했다.');later(s,m,p.id,8,{automatic:true});}
    if(['advice','mentorloss','transmission'].includes(p.id)){const m=remember(s,'약속',p,o,p.id==='mentorloss'?'사부의 부고 뒤에 배움과 기억을 정리했다.':p.id==='transmission'&&o.id==='decline'?'지금은 전수를 미루고 기초를 더 다듬기로 했다.':'가르침을 받았던 사람과 배움의 경위를 남겼다.');later(s,m,p.id,8,{automatic:true});}
    if(ARC_NEXT[p.id]){result=ARC_OUTCOMES[p.id]?.[o.id]||result||o.hint;const m=remember(s,['grainbook','familydebt'].includes(p.id)?'빚':p.id==='physician'?'구명':'약속',p,o,result);s.storyThreads.push({id:ARC_NEXT[p.id],dueTick:s.tick+5+Math.floor(random(s,'arcDelay:'+p.id)*7),starterChoice:o.id,actorId:m.actorId,memoryId:m.id,rootCause:p.id});}
    if(Object.values(ARC_NEXT).includes(p.id)){const m=s.memories.find(m=>m.id===p.context.memoryId);result=getNPC(s,p.context.actorId)&&!getNPC(s,p.context.actorId).alive?'고인이 남긴 기록과 약속을 정리했다. '+o.label+'의 뜻을 일대기에 남겼다.':o.label+'의 뜻을 전하고 지난 선택의 후속 책임을 정리했다.';if(m){m.status='closed';m.aftermath=result;relationChange(s,m.actorId,3);}}
    if(p.context.rumorId){const r=s.rumors.find(r=>r.id===p.context.rumorId);if(r){r.status=r.status==='investigated'?'confirmed':r.status;r.resolution=result||o.label;}}
    if(['masterwork','craftorder','trade','herbs','pupil','guest'].includes(p.id)){
      const titles={farmer:'공동 창고의 분배 기록',artisan:'이름을 건 수선 작업',merchant:'약속을 남긴 거래 장부',doctor:'의방의 약재·진료 지원 기록',teacher:'제자와 함께 읽은 독본',innkeeper:'길손을 맞은 객잔 장부'};
      s.careerRecords.push({id:p.uid,careerId:s.career,title:titles[s.career],actorId:p.context.actorId||null,eventId:p.id,choiceId:o.id,choice:o.label,tick:s.tick,age:s.age,q:s.q,result:result||o.hint});
      if(s.careerRecords.length>500)s.careerRecords.shift();
    }
    BIRTH.initialize(s);BIRTH.syncMentor(s);
    updatePeaks(s);s.lastOutcome={title:eventDef(p.id).title,text:result||o.hint,actorId:p.context.actorId||null,tick:s.tick};
    log(s,`${eventDef(p.id).title}: ${o.label}. ${result}`,'선택');s.latestPersonalStory=result||eventText(s,p.id,p.context);s.playing=false;dispatch(s);return true;
  }
  function leadershipEligible(s) {const t=sect(s);return !!t&&(t.id==='guild'?careerSkill(s)>=72:s.rank>=4)&&s.merit>=160&&s.support>=60&&s.trust>=60&&s.age>=30&&(!t.family||s.clanId===t.id&&s.birthStatus==='recognized');}
  function action(s,id) {
    const context=storyContext(s);const fit=clamp(s.health/100,.4,1)*(1-s.injury/150)*(1-s.fatigue/180)*context.boost;
    const before={swordXP:s.swordXP,operationXP:s.operationXP,methodXP:s.methodXP,inner:s.inner,money:s.money,career:careerSkill(s),merit:s.merit,happiness:s.happiness,health:s.health,fatigue:s.fatigue,knowledgeXP:s.knowledgeXP,legacy:s.legacy};
    const talent=.65+(s.aptitude.body+s.aptitude.mind)/200;
    const mentor=(getNPC(s,s.mentorId)?.alive?1.13:1)*(s.sectId?1+s.trust*.002+(s.transmission?.12:0):1);
    const resource=s.money>=.5?1:.70;
    let note='';
    if(['sword','inner','mission','explore'].includes(id)&&!canTrain(s)){id='rest';note='부상 때문에 계획 대신 휴식했다. ';}
    s.lastAction=id;
    switch(id){
      case 'sword':{spend(s,.5);const focus=s.trainingFocus==='body'?1.05:1;const teaching=getNPC(s,s.mentorId)?.alive&&getNPC(s,s.mentorId).teachingStyle==='엄격'?1.02:1;s.swordXP+=22*talent*mentor*fit*resource*focus*teaching;s.operationXP+=5*talent*fit;s.fatigue+=11;if(!s.learnedSkills.length)s.learnedSkills.push({name:'민간 기초무공',source:'public',age:s.age});break;}
      case 'inner':{spend(s,.5);const g=talent*mentor*fit*resource,focus=s.trainingFocus==='breath'?1.05:1;s.inner+=.0175*s.method.quality*g/(1+s.inner/5);s.operationXP+=23*g*focus;s.methodXP+=25*g*focus;s.fatigue+=10.6;break;}
      case 'work':{const c=career(s);const k=careerSkill(s);const a=.7+s.aptitude.mind/150;const rawVariance=1+(random(s,'work')*2-1)*c.volatility;const variance=context.outlook==='favorable'?Math.max(1.05,rawVariance):context.outlook==='poor'?Math.min(.9,rawVariance):rawVariance;const ageFactor=s.age<16?.5:1;const gross=c.base*(.60+k/34)*variance*s.world.market*regionalMultiplier(s)*fit*ageFactor;
        income(s,gross);s.careerXP[s.career]=(s.careerXP[s.career]||0)+17*a*fit;delta(s,'fatigue',10.6);delta(s,'happiness',k>50?.35:0);break;}
      case 'mission':if(s.sectId){const reward=(3.8+s.rank*7.2)*(0.65+random(s,'missionIncome')*.9);income(s,reward);s.merit+=4;s.support=clamp(s.support+.9);s.trust=clamp(s.trust+.8);if(s.sectId==='guild')s.careerXP[s.career]=(s.careerXP[s.career]||0)+12*fit;else{s.swordXP+=6*talent*fit;s.operationXP+=3*talent*fit;}s.reputation=clamp(s.reputation+.5);}else{income(s,3.2);s.reputation=clamp(s.reputation+.3);}delta(s,'fatigue',12);break;
      case 'social':{const n=socialTarget(s);const letter=s.socialMode==='letter'||n?.location!==s.location;delta(s,'happiness',letter?3:4);delta(s,'fatigue',-10);if(n){relationChange(s,n.id,letter?2:5);if(n.id===s.mentorId)delta(s,'trust',letter?1:3);note=`${n.name}${letter?'에게 서신을 보내':'와 시간을 보내'} 안부를 나누었다. `;s.lastSocialId=n.id;}break;}
      case 'beg':if(s.sectId==='gaebang'){income(s,1.8);s.knowledgeXP+=30;s.merit+=2;delta(s,'fatigue',-4);if(random(s,'beg-rumor')<.32)hearRumor(s,null,true);note='동냥으로 얻은 곡식을 나누고 방도들의 소식을 모았다. ';}else{delta(s,'happiness',1);note='개방의 방도가 아니어서 거리의 이야기를 듣고 돌아왔다. ';}break;
      case 'rest':delta(s,'health',8);delta(s,'injury',-10);delta(s,'fatigue',-25);delta(s,'happiness',2);break;
      case 'explore':if(!spend(s,1))delta(s,'fatigue',5);s.knowledgeXP+=22;s.reputation=clamp(s.reputation+.5);delta(s,'fatigue',4);break;
      case 'seek':{const t=SECTS.find(t=>t.id===s.targetSect);if(!s.sectId&&!s.independentSect&&s.world.sects.find(x=>x.id===t?.id)?.alive)queue(s,'join-'+t.id);else {setPreset(s,['sword','inner','mission','inner']);note='이미 문하에 있어 입문 청원을 마치고 수련 일과로 바꾸었다. ';}break;}
      case 'study':s.knowledgeXP+=28*(.7+s.aptitude.mind/100);delta(s,'fatigue',-5);if(s.manual&&!s.manual.adapted&&s.manual.progress<100){s.manual.progress=clamp(s.manual.progress+12+s.aptitude.mind/7);if(s.manual.progress>=100)queue(s,'adapt');}if(s.forgottenArt&&!s.forgottenArt.learned){s.forgottenArt.progress=clamp(s.forgottenArt.progress+12+s.aptitude.mind/7);if(s.forgottenArt.progress>=100){s.forgottenArt.learned=true;s.learnedSkills.push({name:s.forgottenArt.name,source:'lost',age:s.age,tier:'독립 무학',weapon:'검'});if(!s.teachingPermits.includes('lost'))s.teachingPermits.push('lost');log(s,`${s.forgottenArt.name}의 뜻을 풀었다. 지금의 사문과 다른 잊힌 무학의 맥을 이을 수 있게 되었다.`,'무학');}}if(skill(s.swordXP)>=76&&skill(s.knowledgeXP)>=50){s.creation+=8;if(s.creation>=100)queue(s,'creation');}break;
      case 'teach':if(skill(s.swordXP)>=65||careerSkill(s)>=60){s.legacy+=.35;s.reputation=clamp(s.reputation+.6);income(s,3);delta(s,'happiness',2);}else{s.knowledgeXP+=20;note='아직 전수할 준비가 부족해 기초를 복습했다. ';}break;
      case 'travel':if(s.travelTarget&&PLACES.some(p=>p.name===s.travelTarget)){if(!spend(s,2))delta(s,'fatigue',6);if(regionalState(s,s.travelTarget).conflict)delta(s,'fatigue',4);s.location=s.travelTarget;s.travelTarget=null;s.plan[s.q]='explore';s.nextPlan[s.q]='explore';note=`${s.location}에 도착했다. `;}break;
      case 'investigate':{const rumor=s.rumors.find(r=>r.id===s.targetRumorId);if(!rumor||!['heard','expired'].includes(rumor.status)){note='이 소문은 이미 추적을 마쳤다. ';break;}if(s.location!==rumor.place){note=`탐문 끝에 ${rumor.place}에 가야 한다는 것을 확인했다. `;const warning=`follow-route:${rumor.id}:${s.location}`;if(!s.storyMemory.includes(warning)){s.storyMemory.push(warning);s.playing=false;s.stopReason=`${rumor.place}에 단서가 남아 있습니다. 지도에서 이동을 예약하세요.`;}break;}const subject=getNPC(s,rumor.subjectId),truth=random(s,'rumorTruth',0,rumor.heardTick);let end=rumor.expiresTick<s.tick?'late':subject&&(!subject.alive||subject.location!==rumor.place)?'departed':truth<.58?null:truth<.72?'false':truth<.85?'notfound':'taken';rumor.status=end||'investigated';rumor.investigatedTick=s.tick;s.knowledgeXP+=end?10:25;queue(s,end?'rumor-end-'+end:'rumor-'+rumor.kind,{rumorId:rumor.id,actorId:rumor.subjectId||rumor.sourceId,rootCause:rumor.rootCause});note=end?'소문을 대조해 추적의 결말을 확인했다. ':'소문 속 자취를 찾아냈다. ';break;}
    }
    s.fatigue=clamp((s.fatigue-2)*.82);s.injury=Math.max(0,s.injury-.7);s.health=clamp(s.health+(s.age<50?.9:.45)-s.fatigue*.012-s.injury*.008);
    if(['sword','inner'].includes(id)||id==='mission'&&s.sectId&&s.sectId!=='guild')s.lifeActions.martial++;else if(id==='work'||id==='teach'&&careerSkill(s)>=60)s.lifeActions.civilian++;
    const dependent=s.childIds.filter(id=>{const n=getNPC(s,id);return n?.alive&&n.age<18;}).length;
    const familyCost=dependent*.3+(livingSpouse(s)?.2:0);
    const living=(s.age<16?.35:1.2)+(s.sectId?-.8:0)+familyCost;
    const subsidy=(s.age<18?.8:0)+(s.age<26?s.birthSupport:0)+(s.retired?.5:0);
    const bill=Math.max(0,living-subsidy);
    if(!spend(s,bill)){const short=bill-s.money;spend(s,s.money);s.debt=Math.min(30,s.debt+short);delta(s,'happiness',-.7);delta(s,'health',-.45);if(s.tick%12===0)log(s,'살림이 부족해 구휼과 이웃의 도움으로 생활을 이었다. 빚은 원금만 기록하며 이자가 불어나지 않는다.','생계');}
    else if(s.debt>0&&s.money>12){const repay=Math.min(s.debt,1.5);spend(s,repay);s.debt-=repay;}
    s.innerReserve=clamp(s.innerReserve+(id==='rest'?35:id==='inner'?20:8));
    const finish={work:context.outlook==='favorable'?'손끝에 힘이 붙고 일이 잘 풀렸다. 오늘의 수고가 넉넉한 결실로 돌아왔다.':context.outlook==='poor'?'집중이 흐트러져 평소보다 적은 품을 냈다. 내일은 몸과 마음을 먼저 살펴야겠다.':'하루하루의 품을 모아 살림을 이어 갔다.',sword:'초식의 흐름을 되짚으며 무공 수련을 마쳤다. 작은 정진이 검로에 남은 듯하다.',inner:'행공을 마치고 길게 숨을 내쉬었다. 쌓인 내공과 운용을 차분히 돌아보았다.',mission:'맡은 일을 마치고 돌아왔다. 작은 공적이라도 사문과 강호에서 제 몫을 했다는 기분이다.',social:'함께한 이의 안부를 마음에 담았다. 서로의 하루가 조금 더 가까워졌다.',rest:'충분히 쉬고 일어났다. 몸과 마음을 서두르지 않고 다스릴 수 있었다.',explore:'낯선 길과 사람을 만나고 돌아왔다. 강호에는 아직 모르는 사연이 많다.',seek:'입문을 청할 뜻을 전했다. 어떤 대답이 오더라도 앞으로의 길은 다시 고를 수 있다.',study:'한 구절씩 뜻을 풀었다. 아직 모르는 것이 많아도 배움의 길은 이어진다.',teach:'배우는 이와 함께 기초를 되짚었다. 가르침 속에서 나 역시 배운 것이 있었다.',travel:note,investigate:note};
    s.latestPersonalStory=note||(context.lines.at(-1)||finish[id]||'오늘의 일을 마쳤다.');
    actionLedger(s,id,before,context,note);
  }
  function npcQuarter(s) {for(const n of s.npcs){if(!n.alive)continue;initializeNPC(s,n);if(n.age>=8){if(n.martial)n.martialSkill=clamp(n.martialSkill+(n.goal==='수련'?.40:.20));else n.civilSkill=clamp(n.civilSkill+(n.goal==='가업'?.35:.24));}n.skill=n.martial?n.martialSkill:n.civilSkill;if(s.lastAction!=='social'||s.lastSocialId!==n.id)n.affinity=clamp(n.affinity-.035);if(s.q!==3)continue;n.age++;
      if(n.age>18&&!n.married&&n.id!==s.spouseId&&random(s,'npcMarriage',hash(n.id))<marriageChance(n.age)*(.05/.13)){n.married=true;n.maritalStatus=n.maritalStatus==='widowed'?'remarried':'married';if(n.maritalStatus==='remarried')n.spouseId=null;log(s,`${josa(n.name)} 자신의 인연을 만나 혼인했다.`,'인연');}
      if(n.martial&&n.sectId&&n.martialSkill>70&&n.office==='없음'){n.office='교관';log(s,`${josa(n.name)} 수련과 공적으로 교관이 되었다.`,'강호');}
      if(!n.martial&&n.civilSkill>70&&n.office==='없음'){n.office='숙련 생업인';log(s,`${josa(n.name)} ${CAREERS.find(c=>c.id===n.careerId).name}의 오랜 경험을 인정받았다.`,'인연');}
      const risk=n.age<50?.0015:Math.min(.75,.012*Math.exp((n.age-50)/13));if(random(s,'npcDeath',hash(n.id))<risk){n.alive=false;n.deathAge=n.age;n.deathTick=s.tick;log(s,`${josa(n.name)} ${n.age}세에 세상을 떠났다. ${n.id===s.mentorId?'사부에게 배운 것은 기록에 남았으나 더는 물을 사람이 없었다.':n.id===s.spouseId?'오랫동안 함께했던 집에 빈자리가 남았다.':n.role==='부친'||n.role==='모친'?'가문의 세월을 기억하던 목소리 하나가 사라졌다.':'함께 나누던 이야기의 뒷부분은 끝내 듣지 못했다.'}`,'인연');if(n.spouseId){const survivor=getNPC(s,n.spouseId);if(survivor?.alive){survivor.married=false;survivor.maritalStatus='widowed';}}if(n.id===s.mentorId)queue(s,'mentorloss',{actorId:n.id});if(n.id===s.spouseId){s.happiness=clamp(s.happiness-12);s.spouseId=null;}}
    }}
  function worldYear(s) {
    const r=random(s,'climate');s.world.climate=r<.13?'흉년':r>.84?'풍년':'평년';s.world.market=.8+random(s,'market')*.5;s.world.unrest=random(s,'unrest')<.17?1:0;
    if(s.world.climate!=='평년'){
      const messages=s.world.climate==='흉년' ? [
        '곡물 값이 올라 장터의 빈 수레가 늘었다. 관아의 창고 앞에 구휼을 청하는 사람이 모였다.',
        '비가 드물어 논바닥이 갈라졌다. 수확을 기다리던 집마다 끼니를 줄이기 시작했다.',
        '장터의 곡식 자루가 눈에 띄게 줄었다. 산문과 마을 사이에 서로 빌린 쌀 이야기가 오갔다.',
        '흉년이 이어져 품삯을 받아도 곡식값을 대기 어려워졌다. 상단들은 운송 일정을 다시 짰다.',
        '먹을 것을 찾는 이들이 성문에 모였다. 평소 인심 좋던 객잔도 솥을 오래 비워 두었다.'
      ]:[
        '들녘의 수확이 좋아 곡식배가 일찍 나루에 들어왔다. 장터 사람의 얼굴에 한결 여유가 돌았다.',
        '쌀값이 내리자 객잔은 먼 길손을 위해 따뜻한 죽을 더 많이 끓였다.',
        '풍년 소식이 성문을 넘어 퍼졌다. 농부의 수고와 상인의 셈법은 여전히 달랐다.',
        '곡식이 넉넉해져 마을 창고에 비축분을 채웠다. 서민들은 다음 겨울을 걱정했다.',
        '봄부터 돌보던 밭이 넉넉한 결실을 냈다. 관아와 상단은 저마다 올해의 장부를 새로 썼다.'
      ];
      log(s,storyPick(s,messages,'worldClimate:'+s.world.climate,'climate:'+s.world.climate),'강호');
    }
    for(const area of s.world.regions){const oldCrop=area.crop,oldConflict=area.conflict;const weather=random(s,'regionalCrop',hash(area.place)),conflict=random(s,'regionalConflict',hash(area.place));area.crop=weather<.14?'흉작':weather>.82?'풍작':'평년';area.conflict=conflict<(oldConflict?.26:.10);area.recovery=oldConflict&&!area.conflict?2:Math.max(0,area.recovery-1);if(oldCrop!==area.crop||oldConflict!==area.conflict)area.sinceTick=s.tick;if(area.place===s.location&&(area.crop==='흉작'||area.conflict||area.recovery))log(s,`${area.place}: ${area.crop}${area.conflict?' · 길목 분쟁':area.recovery?' · 복구 중':''}. ${career(s).name}의 일감과 수입에 이 사정이 반영된다.`,'지역');}
    if(s.organization){const org=s.organization;org.age++;const profit=(careerSkill(s)/8+s.rank*2)*(0.4+random(s,'business')*1.4)-9;org.treasury=Math.max(0,org.treasury+profit);if(org.treasury>70){const pay=Math.min(12,(org.treasury-60)*.25);org.treasury-=pay;income(s,pay);}if(org.treasury<15)queue(s,'businesscrisis');}
    for(const t of s.world.sects){if(!t.alive)continue;if(t.crisisTick!==undefined&&s.tick-t.crisisTick>=8){if(random(s,'sectCrisisOutcome',hash(t.id))<(t.response==='rebuild'?.28:.60)){t.alive=false;log(s,`${josa(SECTS.find(x=>x.id===t.id).name)} 분쟁으로 해산되었다. 앞서 전해진 위기가 끝내 문중의 지원을 끊었다.`,'강호');if(s.sectId===t.id||s.clanId===t.id)queue(s,'ruin',{sectId:t.id});}else log(s,`${SECTS.find(x=>x.id===t.id).name}의 위기가 수습되었다. 사람과 살림을 다시 돌보기 시작했다.`,'강호');delete t.crisisTick;t.response=null;}
      else if(t.crisisTick===undefined&&random(s,'sectRuin',hash(t.id))<.004*(1+s.world.unrest)){t.crisisTick=s.tick;log(s,`${SECTS.find(x=>x.id===t.id).name}에 내분과 살림의 위기가 닥쳤다. 문중은 아직 해산되지 않았다.`,'강호');if(s.sectId===t.id||s.clanId===t.id)queue(s,'sect-warning',{sectId:t.id});}
      if(t.leaderAlive&&random(s,'leaderDeath',hash(t.id))<.025){t.leaderAlive=false;log(s,`${SECTS.find(x=>x.id===t.id).name}의 지도자가 세상을 떠나 승계 논의가 시작되었다.`,'강호');}}
    if(s.age>=18){const hazard=s.age<40?.0010:.001+.009*Math.exp((s.age-50)/12);const mod=clamp(1+(75-s.health)/70+s.injury/70-s.inner*.02,.65,2.8);if(s.health<=0)die(s,'병환과 쇠약');else if(random(s,'mortality',s.age,0)<Math.min(.96,hazard*mod))die(s,s.age>=60?'노환':s.world.unrest?'난세의 사고':'급작스러운 병환');}
    if(s.age>=105&&s.alive)die(s,'천수');
    s.lastYear={income:+s.annualIncome.toFixed(2),expense:+s.annualExpense.toFixed(2),climate:s.world.climate};s.annualIncome=0;s.annualExpense=0;
  }
  function progression(s) {
    const t=sect(s);const next=RANKS[s.rank+1];
    if(next&&skill(s.swordXP)>=next.sword&&skill(s.operationXP)>=next.operation&&skill(s.methodXP)>=next.method&&s.inner>=next.inner)queue(s,'breakthrough');
    if(t){const i=discipleNames(s,t).indexOf(s.discipleStatus);if(i<2&&s.merit>=(i+1)*32&&s.trust>=45&&skill(s.swordXP)>=(i+1)*18)queue(s,'promotion');
      if(i===2&&s.trust>=65&&s.merit>=85&&!s.transmission)queue(s,'transmission');
      if(s.rank>=3&&s.merit>=110&&!s.officeId){s.officeId='장로';log(s,'원로회의가 공적과 실력을 인정해 장로로 임명했다.','직위');}
      if(leadershipEligible(s)&&!s.successorFlag&&!s.world.sects.find(x=>x.id===t.id).leaderAlive)queue(s,'succession');
      if(s.successorFlag&&s.rank>=4&&s.reputation>=70&&s.support>=65&&['정파','사파'].includes(t.faction))queue(s,'alliance');}
    if(s.age>=18&&!livingSpouse(s)&&eligible(s,'marriage')){const candidates=s.npcs.filter(n=>n.role==='지인'&&n.alive&&!n.married&&n.age>=18&&Math.abs(n.age-s.age)<=12&&n.affinity>=60);if(candidates.length&&random(s,'marriageOffer')<marriageChance(s.age))queue(s,'marriage',{partnerId:candidates[0].id});}
    if(random(s,'childOffer')<childChance(s))queue(s,'child');
  }
  function advanceQuarter(s) {
    if(!s.alive||s.pendingEvent||s.combat||s.combatResultPending||!s.started)return false;
    advanceNarrative(s,1);const oldQ=s.q;action(s,storyContext(s).actionId);npcQuarter(s);s.tick++;s.q=(s.q+1)%4;s.quarterStory=null;
    s.rumors.forEach(r=>{if(r.status==='heard'&&r.expiresTick<s.tick){r.status='expired';r.resolution='기한이 지나 현재의 의뢰나 만남으로는 유효하지 않다. 지난 소식으로 기록했다.';log(s,`${r.place}의 소문: ${r.resolution}`,'소문');}});
    if(oldQ===3){s.age++;s.plan=s.nextPlan.slice();worldYear(s);if(s.age===60)s.statsAt60=summary(s);if(!s.autoRepeat){s.playing=false;s.stopReason='새해 계획 확인';}}
    BIRTH.initialize(s);BIRTH.syncMentor(s);
    if(!s.alive)return true;
    EXP.quarter(s,expansionAPI);storyQuarter(s);progression(s);
    if(s.tick-s.lastEventTick>=7&&random(s,'generalEvent')<(s.lastAction==='explore'?.30:.12)){
      let list=EVENTS.filter(e=>e.condition(s)&&eligible(s,e.id));const replacements={guest:'chain-guest',harvest:'chain-village',advice:'chain-mentor'};list=list.filter(e=>!replacements[e.id]||!list.some(n=>n.id===replacements[e.id]));
      // Current life conditions weight candidates; no origin reserves a predetermined ending.
      const weighted=list.flatMap(e=>Array(e.id.startsWith('chain-')?3:e.id.startsWith('sect-life-')||e.id==='meeting'&&s.aptitude.social>=60?2:1).fill(e));if(weighted.length)queue(s,pick(s,weighted,'eventPick').id);
    }
    dispatch(s);
    if((s.repeatYears&&s.age-s.goalStart>=s.repeatYears)||(s.goal==='inner1'&&s.inner>=1)||(s.goal==='career60'&&careerSkill(s)>=60)||(s.goal==='rank3'&&s.rank>=3)){s.playing=false;s.stopReason='장기 계획 목표 달성';s.repeatYears=0;s.goal='none';}
    return true;
  }
  function die(s,cause) {if(!s.alive)return;updatePeaks(s);s.alive=false;s.playing=false;s.deathPresented=false;s.pendingEvent=null;s.eventQueue=[];s.combat=null;s.combatResultPending=false;s.deathCause=cause;s.deathAge=s.age;s.deathQuarter=s.q;s.inheritance=Math.max(0,s.money-s.debt)+(s.organization?s.organization.treasury*.6:0);log(s,`${josa(name(s))} ${s.age}세에 ${cause}으로 생을 마쳤다. 무공과 별개로 이 삶의 인연과 선택을 기록한다.`,'일대기');s.ending=ending(s);}
  function ending(s) {const titles=[];if(s.officeId)titles.push(s.officeId);if(careerSkill(s)>=72)titles.push(({farmer:'농사의 달인',artisan:'명장',merchant:'거상',doctor:'명의',teacher:'큰 스승',innkeeper:'길손들의 벗'})[s.career]);if(s.legacy>=5)titles.push('배움을 남긴 사람');if(s.childIds.length||s.choices.some(c=>c.choice==='yes'&&c.event==='marriage'))titles.push('인연을 이은 삶');if(s.happiness>=65)titles.push('마음에 남은 평온');if(s.money>=250)titles.push('넉넉한 살림');if(!titles.length)titles.push('자신의 길을 걸은 사람');return titles;}
  function summary(s) {return {age:s.age,alive:s.alive,origin:s.originId,rank:s.rank,inner:s.inner,sword:skill(s.swordXP),operation:skill(s.operationXP),method:skill(s.methodXP),career:careerSkill(s),wealth:s.money-s.debt,happiness:s.happiness,health:s.health,office:s.officeId,events:s.choices.length,married:!!s.spouseId,children:s.childIds.length,legacy:s.legacy};}
  function migrateSave(value) {
    try{
      if(!value||!['0.3.0','0.3.1','0.3.2','0.4.0','0.4.1',VERSION].includes(value.version))return null;
      const s=JSON.parse(JSON.stringify(value));
      if(s.version==='0.3.0'){
        s.version=VERSION;s.nextPlan=s.plan.slice();s.quarterStory=null;s.latestPersonalStory='';s.rumors=[];s.targetRumorId=null;
        s.innerReserve=100;s.combat=null;s.lastCombat=null;s.combatResultPending=false;s.teachingPermits=['public'];s.teachingSource='public';s.forgottenArt=null;s.independentSect=null;s.sectRelations={};
        if(s.createdArt)s.teachingPermits.push('created');
        if(s.organization){s.organization.type=s.organization.name==='무관'?'dojo':'civilian';if(s.organization.type==='dojo')s.organization.teachingSource='public';}
        for(const n of s.npcs){if(['부친','모친'].includes(n.role)){const other=s.npcs.find(p=>s.birthParentIds.includes(p.id)&&p.id!==n.id);n.spouseId=other?.id||null;n.married=!!other?.alive;n.maritalStatus=n.married?'married':'widowed';}}
        s.learnedSkills=s.learnedSkills.map(a=>{const art=MARTIAL_ARTS[a.source];if(!art)return a;return {...a,name:a.name.endsWith(' 비전초식')?art.secret:a.name.endsWith(' 기초무공')?art.basic:a.name};});
        const names=[s.surname+s.givenName,...s.npcs.map(n=>n.name)];
        s.logs=s.logs.map(l=>{let text=l.text;for(const n of names){text=text.split(n+'가 ').join(josa(n)+' ');text=text.split(n+'와 ').join(josa(n,'와/과')+' ');}return {...l,text};});
      }
      if(value.version!==VERSION){initializeStories(s);s.version=VERSION;if(s.sectId==='namgung'&&s.clanId==='namgung'){const i=SECTS[0].disciples.indexOf(s.discipleStatus);if(i>=0)s.discipleStatus=discipleNames(s,SECTS[0])[i];}if(s.sectId&&s.nextPlan.includes('seek')){setPreset(s,['sword','inner','mission','inner']);queue(s,'entry-plan',{sectId:s.sectId});dispatch(s);}}
      BIRTH.initialize(s);BIRTH.syncMentor(s);
      EXP.initialize(s);for(const t of SECTS)if(!s.world.sects.some(x=>x.id===t.id))s.world.sects.push({id:t.id,alive:true,leaderAlive:true});return validSave(s)?s:null;
    }catch{return null;}
  }
  function validSave(s,debug=false) {
    const invalid = reason => {if(debug)throw Error(reason);return false;};
    try{
      if(!s||s.version!==VERSION||typeof s.seed!=='string'||s.seed.length>128||typeof s.started!=='boolean'||typeof s.alive!=='boolean'||typeof s.givenName!=='string'||s.givenName.length>12||typeof s.surname!=='string')return invalid('save check 2');
      if(!BIRTH.valid(s))return invalid('birth model');if(!EXP.valid(s))return invalid('faction life state');
      if(!s.familyGraph||JSON.stringify(s.familyGraph.parents)!==JSON.stringify(s.birthParentIds)||JSON.stringify(s.familyGraph.childIds)!==JSON.stringify(s.childIds)||s.familyGraph.guardianId!==s.guardianId||s.familyGraph.spouseId!==s.spouseId||s.guardianId&&!getNPC(s,s.guardianId)||s.birthModelVersion!==BIRTH.VERSION)return invalid('family graph');
      if(!Array.isArray(s.careerRecords)||s.careerRecords.length>500||new Set(s.careerRecords.map(r=>r.id)).size!==s.careerRecords.length||!s.careerRecords.every(r=>typeof r.id==='string'&&CAREERS.some(c=>c.id===r.careerId)&&eventDef(r.eventId)&&typeof r.title==='string'&&typeof r.choice==='string'&&typeof r.result==='string'&&Number.isInteger(r.tick)&&r.tick<=s.tick&&(!r.actorId||getNPC(s,r.actorId))))return invalid('career records');
      if(!Number.isInteger(s.age)||s.age<8||s.age>105||!Number.isInteger(s.q)||s.q<0||s.q>3||s.tick!==s.age*4+s.q||!Number.isFinite(s.p)||s.p<0||s.p>=1||!Number.isInteger(s.birthYear))return invalid('save check 3');
      if(![.5,1,2,4,8,16].includes(s.speed)||!PLACES.some(p=>p.name===s.location)||!(ORIGINS.some(o=>o.id===s.originId)||BIRTH.profile(s))||!CAREERS.some(c=>c.id===s.career)||!SECTS.some(t=>t.id===s.targetSect)||s.sectId&&!SECTS.some(t=>t.id===s.sectId))return invalid('save check 4');
      if(!Array.isArray(s.plan)||s.plan.length!==4||!s.plan.every(id=>ACTIONS.some(a=>a.id===id)))return invalid('save check 5');
      for(const k of ['inner','swordXP','operationXP','methodXP','knowledgeXP','health','fatigue','injury','happiness','money','debt','merit','support','trust','reputation','legacy','creation','annualIncome','annualExpense'])if(!Number.isFinite(s[k])||s[k]<0||s[k]>1e8)return invalid('save check 6');
      if(!Number.isInteger(s.rank)||!RANKS[s.rank]||!s.method||!Number.isFinite(s.method.quality)||s.method.quality<1||s.method.quality>4)return invalid('save check 7');
      if(!s.aptitude||!['body','mind','social'].every(k=>Number.isFinite(s.aptitude[k])&&s.aptitude[k]>=0&&s.aptitude[k]<=100)||!s.careerXP||!Object.values(s.careerXP).every(x=>Number.isFinite(x)&&x>=0))return invalid('save check 8');
      if(!Array.isArray(s.npcs)||s.npcs.length>100||new Set(s.npcs.map(n=>n.id)).size!==s.npcs.length||!s.npcs.every(n=>typeof n.id==='string'&&typeof n.name==='string'&&typeof n.role==='string'&&typeof n.alive==='boolean'&&Number.isFinite(n.age)&&n.age>=0&&Number.isFinite(n.affinity)&&n.affinity>=0&&n.affinity<=100))return invalid('NPC validation: '+JSON.stringify(s.npcs.filter(n=>typeof n.id!=='string'||typeof n.name!=='string'||typeof n.role!=='string'||typeof n.alive!=='boolean'||!Number.isFinite(n.age)||!Number.isFinite(n.affinity)||n.affinity<0||n.affinity>100))+' IDs: '+s.npcs.map(n=>n.id).join(','));
      for(const k of ['logs','choices','resolved','eventQueue','memberships','childIds','birthParentIds','milestones','learnedSkills'])if(!Array.isArray(s[k])||s[k].length>10000)return invalid('save check 10');
      if(!s.logs.every(l=>Number.isInteger(l.tick)&&Number.isInteger(l.age)&&Number.isInteger(l.q)&&l.q>=0&&l.q<=3&&Number.isInteger(l.year)&&Number.isInteger(l.month)&&typeof l.text==='string'&&typeof l.type==='string')||!s.choices.every(c=>typeof c.label==='string'&&eventDef(c.event)))return invalid('save check 11');
      const validEvent=p=>p&&eventDef(p.id)&&p.context&&typeof p.context==='object'&&!Array.isArray(p.context)&&(!p.context.actorId||!!getNPC(s,p.context.actorId))&&(!p.context.partnerId||!!getNPC(s,p.context.partnerId))&&(!p.context.memoryId||s.memories?.some(m=>m.id===p.context.memoryId))&&(!p.context.rumorId||s.rumors?.some(r=>r.id===p.context.rumorId));
      if(s.pendingEvent&&(!validEvent(s.pendingEvent)||typeof s.pendingEvent.uid!=='string'||s.resolved.includes(s.pendingEvent.uid)))return invalid('save check 12');
      if(!s.eventQueue.every(validEvent)||!s.eventCounts||!s.eventLast||!s.world||!Array.isArray(s.world.sects)||s.world.sects.length!==SECTS.length)return invalid('save check 13');
      if(!s.world.sects.every(t=>SECTS.some(x=>x.id===t.id)&&typeof t.alive==='boolean'&&typeof t.leaderAlive==='boolean')||new Set(s.world.sects.map(t=>t.id)).size!==SECTS.length)return invalid('save check 14');
      if(s.manual&&(!Number.isFinite(s.manual.progress)||s.manual.progress<0||s.manual.progress>100||!['양강','음유','중정'].includes(s.manual.principle)))return invalid('save check 15');
      if(s.organization&&(!Number.isFinite(s.organization.treasury)||s.organization.treasury<0||typeof s.organization.name!=='string'))return invalid('save check 16');
      if(s.world.dynasty!=='대연'||s.world.era!=='승평'||!['평년','풍년','흉년'].includes(s.world.climate)||!Number.isFinite(s.world.market))return invalid('world fields');
      if(!s.npcs.every(n=>Number.isFinite(n.skill)&&Number.isFinite(n.trust)&&Number.isInteger(n.portrait)&&n.portrait>=0&&n.portrait<=3&&typeof n.goal==='string'&&typeof n.office==='string'))return invalid('NPC detail fields');
      if(!s.memberships.every(m=>SECTS.some(t=>t.id===m.sectId)&&Number.isFinite(m.from)&&Number.isFinite(m.to)&&typeof m.reason==='string')||!s.learnedSkills.every(m=>typeof m.name==='string'&&Number.isFinite(m.age)))return invalid('history fields');
      if(!s.childIds.every(id=>getNPC(s,id))||!s.birthParentIds.every(id=>getNPC(s,id))||s.spouseId&&!getNPC(s,s.spouseId)||s.mentorId&&!getNPC(s,s.mentorId))return invalid('relation references');
      if(!s.alive&&(typeof s.deathCause!=='string'||!Number.isFinite(s.inheritance)||!Array.isArray(s.ending)||!s.ending.every(x=>typeof x==='string')))return invalid('ending fields');
      if(!Number.isFinite(s.volume)||s.volume<0||s.volume>100||!['autoRepeat','autoSave','notifyEvents','sound','music'].every(k=>typeof s[k]==='boolean'))return invalid('preference fields');
      if(![0,1,5,10].includes(s.repeatYears)||!['none','inner1','career60','rank3'].includes(s.goal)||!Number.isFinite(s.goalStart)||!Number.isFinite(s.birthSupport))return invalid('planning fields');
      if(!Array.isArray(s.nextPlan)||s.nextPlan.length!==4||!s.nextPlan.every(id=>ACTIONS.some(a=>a.id===id)))return invalid('next-year plan');
      if(!Number.isFinite(s.innerReserve)||s.innerReserve<0||s.innerReserve>100||typeof s.combatResultPending!=='boolean')return invalid('combat resources');
      if(s.quarterStory&&(!Number.isInteger(s.quarterStory.tick)||s.quarterStory.tick!==s.tick||!ACTIONS.some(a=>a.id===s.quarterStory.actionId)||!CAREERS.some(c=>c.id===s.quarterStory.careerId)||!Number.isInteger(s.quarterStory.mask)||s.quarterStory.mask<0||s.quarterStory.mask>3||!['favorable','steady','poor'].includes(s.quarterStory.outlook)||!Number.isFinite(s.quarterStory.boost)||!Array.isArray(s.quarterStory.lines)||!s.quarterStory.lines.every(x=>typeof x==='string')))return invalid('quarter story');
      if(!Array.isArray(s.rumors)||s.rumors.length>40||new Set(s.rumors.map(r=>r.id)).size!==s.rumors.length||!s.rumors.every(r=>typeof r.id==='string'&&typeof r.text==='string'&&RUMOR_KINDS.includes(r.kind)&&PLACES.some(p=>p.name===r.place)&&['heard','investigated','confirmed','false','expired','taken','notfound','departed','late'].includes(r.status)&&Number.isInteger(r.heardTick)&&Number.isInteger(r.expiresTick)&&r.expiresTick>=r.heardTick&&(r.sourceId===null||!!getNPC(s,r.sourceId))&&(r.subjectId===null||!!getNPC(s,r.subjectId))&&typeof r.rootCause==='string'&&typeof r.sourceLabel==='string'))return invalid('rumor fields');
      if(s.combat&&(!['duel','hostile','lethal'].includes(s.combat.kind)||typeof s.combat.uid!=='string'||!eventDef(s.combat.eventId)||!Number.isInteger(s.combat.round)||s.combat.round<0||s.combat.round>3||!s.combat.enemy||typeof s.combat.enemy.name!=='string'||typeof s.combat.enemy.weapon!=='string'||typeof s.combat.enemy.style!=='string'||!Number.isFinite(s.combat.enemy.power)||s.combat.enemy.power<0||s.combat.enemy.power>200||s.pendingEvent))return invalid('combat state');
      if(s.lastCombat&&(typeof s.lastCombat.text!=='string'||typeof s.lastCombat.uid!=='string'||!Number.isFinite(s.lastCombat.damage)||!Number.isFinite(s.lastCombat.innerLoss)))return invalid('combat result');
      if(s.combatResultPending&&(!s.lastCombat||s.combat||s.pendingEvent))return invalid('unread combat result');
      const validSource=id=>['public','created','lost'].includes(id)||SECTS.some(t=>t.id===id);
      if(!Array.isArray(s.teachingPermits)||!s.teachingPermits.every(validSource)||!validSource(s.teachingSource)||!s.sectRelations||typeof s.sectRelations!=='object')return invalid('transmission rights');
      if(s.forgottenArt&&(typeof s.forgottenArt.name!=='string'||!Number.isFinite(s.forgottenArt.progress)||s.forgottenArt.progress<0||s.forgottenArt.progress>100||typeof s.forgottenArt.learned!=='boolean'))return invalid('forgotten art');
      if(s.independentSect&&(s.sectId||typeof s.independentSect.name!=='string'||typeof s.independentSect.art!=='string'||!['created','lost'].includes(s.independentSect.artSource)||!Array.isArray(s.independentSect.witnesses)||!s.independentSect.witnesses.every(id=>getNPC(s,id))))return invalid('independent lineage');
      if(s.organization&&!['civilian','dojo','sect'].includes(s.organization.type))return invalid('organization type');
      if(!Array.isArray(s.memories)||s.memories.length>2000||new Set(s.memories.map(m=>m.id)).size!==s.memories.length||!s.memories.every(m=>typeof m.id==='string'&&['구명','빚','약속','원한'].includes(m.type)&&eventDef(m.causeId)&&Number.isInteger(m.causeTick)&&m.causeTick<=s.tick&&Number.isInteger(m.age)&&typeof m.label==='string'&&typeof m.outcome==='string'&&['open','closed'].includes(m.status)&&(m.actorId===null||!!getNPC(s,m.actorId))&&PLACES.some(p=>p.name===m.place)))return invalid('causal memories');
      if(!Array.isArray(s.followUps)||s.followUps.length>200||!s.followUps.every(f=>eventDef(f.id)&&Number.isInteger(f.dueTick)&&s.memories.some(m=>m.id===f.memoryId)&&(f.actorId===null||!!getNPC(s,f.actorId))))return invalid('follow-up references');
      if(!s.npcs.every(n=>CAREERS.some(c=>c.id===n.careerId)&&typeof n.martial==='boolean'&&Number.isFinite(n.martialSkill)&&n.martialSkill>=0&&n.martialSkill<=200&&Number.isFinite(n.civilSkill)&&n.civilSkill>=0&&n.civilSkill<=100&&PLACES.some(p=>p.name===n.location)&&['엄격','배려'].includes(n.teachingStyle)))return invalid('NPC life paths');
      if(!Array.isArray(s.world.regions)||s.world.regions.length!==PLACES.length||new Set(s.world.regions.map(r=>r.place)).size!==PLACES.length||!s.world.regions.every(r=>PLACES.some(p=>p.name===r.place)&&['평년','풍작','흉작'].includes(r.crop)&&typeof r.conflict==='boolean'&&Number.isInteger(r.recovery)&&r.recovery>=0&&Number.isInteger(r.sinceTick)))return invalid('regional states');
      if(!['auto','visit','letter'].includes(s.socialMode)||s.socialTargetId!==null&&!getNPC(s,s.socialTargetId)||!['balanced','body','breath'].includes(s.trainingFocus)||typeof s.deathPresented!=='boolean')return invalid('life preferences');
      if(!s.lifeActions||!['martial','civilian'].every(k=>Number.isInteger(s.lifeActions[k])&&s.lifeActions[k]>=0)||!s.peaks||!RANKS[s.peaks.rank]||!Array.isArray(s.peaks.offices)||!s.peaks.offices.every(o=>typeof o==='string')||!s.peaks.careers||!Object.values(s.peaks.careers).every(n=>Number.isFinite(n)&&n>=0&&n<=100))return invalid('life achievements');
      if(!s.localReputation||!Object.entries(s.localReputation).every(([p,n])=>PLACES.some(x=>x.name===p)&&Number.isFinite(n)&&n>=-50&&n<=50)||!Array.isArray(s.knownMethods)||!s.knownMethods.every(m=>typeof m.name==='string'&&typeof m.id==='string'&&Number.isFinite(m.quality)&&m.quality>=1&&m.quality<=4&&Number.isFinite(m.age)))return invalid('known learning');
      if(!Array.isArray(s.storyMemory)||s.storyMemory.length>300||!s.storyMemory.every(x=>typeof x==='string'&&x.length<=180)||!Array.isArray(s.storyHashes)||s.storyHashes.length>2500||!s.storyHashes.every(x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff))return invalid('prose memory');
      if(!Array.isArray(s.storyThreads)||s.storyThreads.length>30||!s.storyThreads.every(t=>Object.values(ARC_NEXT).includes(t.id)&&Number.isInteger(t.dueTick)&&t.dueTick>=0&&(!t.actorId||!!getNPC(s,t.actorId))&&(!t.memoryId||s.memories.some(m=>m.id===t.memoryId))))return invalid('legacy story threads');
      return true;
    }catch(e){if(debug)throw e;return false;}
  }
  const origin=s=>ORIGINS.find(o=>o.id===s.originId)||BIRTH.profile(s);
  let developerConnected=false;
  function connectDeveloperTools(authorized){
    if(developerConnected||typeof authorized!=='function')throw Error('개발 도구 연결은 한 번만 허용합니다.');
    developerConnected=true;
    return (command,s,arg={})=>{
      if(!authorized(s))throw Error('테스트 모드에서만 실행할 수 있습니다.');
      if(command==='join'){const t=SECTS.find(t=>t.id===arg.id);if(!t)throw Error('문파를 찾지 못했습니다.');if(s.sectId)leaveSect(s,'테스트 전향');join(s,t);return s.mentorId;}
      if(command==='leave'){leaveSect(s,arg.reason||'탈퇴');return true;}
      if(command==='npc'){
        if(s.npcs.length>=95)throw Error('NPC 안전 한도 95명에 도달했습니다.');
        const id='dev-npc-'+s.tick+'-'+s.npcs.length;
        const n={id,name:String(arg.name||'시험 무인').slice(0,30),age:Math.max(18,Math.min(100,Number(arg.age)||40)),role:arg.role||'지인',alive:true,affinity:50,trust:50,goal:arg.martial===false?'가업':'수련',skill:Math.max(0,Math.min(100,Number(arg.skill)||65)),office:'없음',portrait:0,married:false,sectId:arg.sectId||null,location:s.location,martial:arg.martial!==false};
        initializeNPC(s,n,s.npcs.length);n.birthYear=currentYear(s)-n.age;s.npcs.push(n);return n;
      }
      if(command==='mentor'){
        const n=getNPC(s,arg.id);if(!n?.alive||n.age<18||!n.martial||n.sectId!==s.sectId||!s.sectId||n.martialSkill<45)throw Error('생존·성인·동일 문파·지도 숙련 45 이상인 스승이 필요합니다.');
        for(const e of s.discipleship)if(e.toTick===null)e.toTick=s.tick;
        s.mentorId=n.id;n.role='사부';n.trust=Math.max(n.trust,40);s.trust=n.trust;BIRTH.syncMentor(s);return n;
      }
      if(command==='npc-death'){
        const n=getNPC(s,arg.id);if(!n?.alive)throw Error('살아 있는 NPC를 선택하세요.');n.alive=false;n.deathAge=n.age;n.deathTick=s.tick;
        if(n.spouseId){const p=getNPC(s,n.spouseId);if(p?.alive){p.married=false;p.maritalStatus='widowed';}}
        if(n.id===s.spouseId)s.spouseId=null;
        if(n.id===s.mentorId)queue(s,'mentorloss',{actorId:n.id});
        log(s,n.name+'의 부고를 확인했다.','인연');dispatch(s);return true;
      }
      if(command==='combat'){startCombat(s,['duel','hostile','lethal'].includes(arg.type)?arg.type:arg.kind,arg.kind==='duel'?'duel':'bandit','dev-'+s.tick+'-'+s.resolved.length+'-'+s.choices.length);s.combat.enemy={...s.combat.enemy,...arg.enemy};s.combat.opponentId=arg.opponentId||null;s.combat.testType=arg.type||arg.kind;return s.combat;}
      if(command==='remember')return remember(s,arg.type||'약속',arg.event,arg.option||{id:'test',label:'테스트 약속'},arg.text||'테스트 맥락에서 생성한 선행 기억');
      if(command==='war'){const w=EXP.startWar(s,arg.pairId,arg.place,expansionAPI);if(!w)throw Error('진행 중인 전쟁이 있습니다.');EXP.quarter(s,expansionAPI);dispatch(s);return w;}
      if(command==='progression'){progression(s);dispatch(s);return true;}
      throw Error('지원하지 않는 개발 명령입니다.');
    };
  }
  return {VERSION,SEASONS,ORIGINS,SECTS,PLACES,CAREERS,ACTIONS,RANKS,EVENTS,MARTIAL_ARTS,GLOSSARY,COMBAT_STANCES,connectDeveloperTools,origin,
    createLife,advanceQuarter,advanceNarrative,resolveEvent,options,validSave,migrateSave,setPlan,setPreset,planAppliesNextYear,
    skill,careerSkill,career,sect,name,currentYear,summary,ending,power,random,entryChance,leadershipEligible,methodRisk,log,queue,dispatch,
    josa,marriageChance,childChance,maritalLabel,hearRumor,foundingRequirements,independentArt,canFoundSect,canOpenDojo,
    combatOptions,combatIntel,resolveCombat,dismissCombat,opponentProfile,discipleNames,entryRule:EXP.entryRule,conflictRole:s=>EXP.bloc(s,SECTS),regionalState,regionalMultiplier,socialTarget,eventPresentation,biographyLines,farewell,artProfile,artModifier,RUMOR_KINDS,eventText};
})();
if(typeof module!=='undefined')module.exports=Murim;
