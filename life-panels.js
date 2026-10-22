'use strict';
/* Panels use production engine state; labels never expose internal clan/source IDs. */
let selectedLearning='',selectedCareer='',selectedAchievement='';
const sourceLabel=id=>({public:'공개 기초무공',created:'창시 무학',lost:'잊힌 무학',basic:'민간 기초'}[id]||Murim.SECTS.find(t=>t.id===id)?.name||'별도 전승');
const rumorStatus=r=>({heard:'추적 가능',investigated:'확인 중',confirmed:'확인 완료',false:'헛소문',expired:'기한 만료',taken:'다른 이가 가져감',notfound:'흔적을 찾지 못함',departed:'당사자 부재',late:'때를 놓침'}[r.status]||'기록');
function rumorPanel(){
  if(!state.rumors.length)return '';
  const active=state.rumors.filter(r=>r.status==='heard'),archive=state.rumors.filter(r=>r.status!=='heard').slice().reverse();
  const row=r=>`<article class="rumor-row" data-key="${esc(r.id)}"><div><p>${esc(r.text)}</p><small>${esc(r.sourceLabel)}에게 들음 · ${esc(r.place)} · ${rumorStatus(r)}${r.status==='heard'?` · ${Math.max(0,r.expiresTick-state.tick)}분기 남음`:''}${state.targetRumorId===r.id?' · 현재 추적 대상':''}</small>${r.resolution?`<p class="rumor-resolution">${esc(r.resolution)}</p>`:''}</div>${['heard','expired'].includes(r.status)?button(r.status==='expired'?'늦은 자취 확인':state.location===r.place?'이 소문 추적':'장소 살피기',`data-rumor="${esc(r.id)}"`,'map','secondary small'):''}</article>`;
  return `<section class="rumor-strip dark-panel"><h2>${icon('scroll')}들려온 소문 <small>유효한 소문 ${active.length}개</small></h2>${active.map(row).join('')}${archive.length?`<details class="rumor-archive" data-key="rumor-archive"><summary>지난 소문과 확인 결과 ${archive.length}개</summary>${archive.map(row).join('')}</details>`:''}</section>`;
}
function promptRumor(id){
  const r=state.rumors.find(r=>r.id===id);if(!r||!['heard','expired'].includes(r.status)||!state.alive)return;
  if(state.pendingEvent||state.combat||state.combatResultPending){navigate('event');notify('기다리는 선택부터 확인하세요.');return;}
  state.playing=false;
  $('modal').innerHTML=`<button class="modal-close" data-action="closeModal" aria-label="닫기">${icon('close')}</button><h2>${r.place===state.location?'이 소문을 따라갈까요?':esc(r.place)+'(으)로 이동할까요?'}</h2><p>${esc(r.text)}</p><p>${state.location===r.place?'소문 추적을 한 분기의 주요 행동으로 예약합니다.':`이동에 한 분기와 여비 2냥이 들며, 도착 다음 계절에 소문을 추적합니다. ${Murim.regionalState(state,r.place).conflict?'길목에 분쟁이 있어 이동 피로가 더 듭니다.':''}`}</p><p>${r.status==='expired'?'기한이 지나 보상이나 만남은 종료되었습니다. 늦은 자취를 확인합니다.':'유효 기간 안에도 거짓 소문이거나 누군가 먼저 다녀갔을 수 있습니다.'}</p><div class="save-actions">${button('예약한다',`data-rumor-confirm="${esc(id)}"`,'check')}${button('지금은 보류한다','data-action="closeModal"','','secondary')}</div>`;
  $('modal').showModal();updatePlaybackControls();
}
function reserveRumor(id){
  const r=state.rumors.find(r=>r.id===id);if(!r)return;state.targetRumorId=id;
  const q=Murim.planAppliesNextYear(state,state.q)?(state.q+1)%4:state.q;
  if(state.location!==r.place){state.travelTarget=r.place;Murim.setPlan(state,q,'travel');Murim.setPlan(state,(q+1)%4,'investigate');}
  else Murim.setPlan(state,q,'investigate');
  closeModal();persist();navigate('plan');notify('선택한 소문의 이동·추적을 예약했습니다. 다른 소문도 목록에 남아 있습니다.');
}
function recapPanel(){return `<section class="life-recap"><h3>선택이 이어진 자리</h3>${Murim.biographyLines(state).map(t=>`<p>${esc(t)}</p>`).join('')}</section>`;}
function learningList(){
  return [...state.knownMethods.map((m,i)=>({key:'method-'+i,name:m.name,type:'심법',data:m})),...state.learnedSkills.map((a,i)=>({key:'art-'+i,name:a.name,type:a.tier||'외공',data:a})),...(state.manual&&!state.knownMethods.some(m=>m.name===state.manual.name)?[{key:'manual',name:state.manual.name,type:'해독 중인 심법',data:state.manual}]:[]),...(state.forgottenArt&&!state.forgottenArt.learned?[{key:'forgotten',name:state.forgottenArt.name,type:'해독 중인 검보',data:state.forgottenArt}]:[])];
}
function achievementList(){return [
  ...state.milestones.map((m,i)=>({key:'milestone-'+i,name:m.name,text:`${m.age}세 · ${m.type}의 성취를 이루었다.`})),
  ...state.memories.map((m,i)=>({key:'memory-'+i,name:`${m.age}세 · ${m.label}`,text:`${m.outcome} ${m.aftermath||'이후의 기록은 아직 남아 있다.'}`})),
  ...state.memberships.map((m,i)=>({key:'membership-'+i,name:sourceLabel(m.sectId)+'의 배움',text:`${m.from}~${m.to}세 · ${m.reason} · 당시 직위 ${m.office||'없음'}. 배움과 사승 이력은 보존된다.`})),
  ...state.peaks.offices.map((o,i)=>({key:'office-'+i,name:o,text:'한때 맡았던 책임이다. 마지막 직위와 별도로 기록한다.'})),
  ...Object.entries(state.peaks.careers).filter(([,v])=>v>=65).map(([id,v])=>({key:'career-'+id,name:Murim.CAREERS.find(c=>c.id===id).name+'의 숙련',text:`살아오며 숙련 ${f(v)}에 닿았다. 현재 전업 여부와 무관한 배움이다.`}))
];}
function detailedCharacterView(){
  if(detailTab==='심법')detailTab='무공';
  const origin=Murim.origin(state),tab=detailTab,learned=learningList(),achievements=achievementList();
  let side='',body='';
  const item=(n,v,d)=>`<div class="detail-stat"><div><b>${n}</b><strong>${v}</strong></div><p>${d}</p></div>`;
  if(tab==='기본'){
    side=`<dl class="identity-right"><div><dt>출생과 혈연</dt><dd>${esc(MurimBirth.describe(state))} · ${esc(state.birthPlace)}<br>${esc(state.lineage)} · ${state.clanId?sourceLabel(state.clanId):'혈연 가문 없음'}</dd></div><div><dt>사승과 제자 신분</dt><dd>${esc(state.npcs.find(n=>n.id===state.mentorId)?.name||'사부 없음')} · ${esc(state.discipleStatus)}</dd></div><div><dt>전수와 권한</dt><dd>진전 ${state.transmission?'전수받음':'미전수'} · 후계 지정 ${state.successorFlag?'있음':'없음'}<br>${Murim.sect(state)?.family&&state.clanId!==state.sectId?'외성 문하: 가문의 혈족 상속권 없음':'혈연·직위·후계 자격을 각각 심사'}</dd></div></dl>`;
    body=`<h3>지금까지의 짧은 생애</h3><p>${esc(origin.name)}에서 자라 여덟 살부터 자신의 일을 골랐다. ${state.memberships.length?`지난 사문 ${state.memberships.length}곳의 이력을 간직하고, `:''}지금은 ${esc(sectName())}에서 ${Murim.career(state).name}의 일과 ${state.lifeActions.martial?'무학':'일상'}을 이어 간다.</p>${item('현재의 몸과 마음',`건강 ${f(state.health)} · 피로 ${f(state.fatigue)} · 행복 ${f(state.happiness)}`,'식사와 수면은 자동 처리한다. 과로가 쌓이면 휴식과 교류로 회복할 수 있다.')}<p>전수 허가: ${state.teachingPermits.map(sourceLabel).map(esc).join(', ')}. 허가받은 무관과 독자 무학을 갖춘 개파는 별도의 길이다.</p>`;
  }else if(tab==='능력'){
    side=radar();
    body=`<div class="stat-grid">${item('근골',state.aptitude.body,'타고난 신체 재능. 무공·내공 수련 효율에 반영되며 일반 행동으로 올리지 않는다.')}${item('오성',state.aptitude.mind,'무학의 이해와 독서·생업 효율, 돌파 가능성에 반영되는 타고난 재능.')}${item('친화',state.aptitude.social,'친화 60 이상이면 낯선 인연을 만나는 사건의 추첨 비중이 커진다. 실제 관계는 교류와 선택으로 가꾼다.')}${item('무공 숙련',f(Murim.skill(state.swordXP)),'공통 숙련 축. 무공 수련·실전·지도로 높인다. 이름별 개별 숙련을 뜻하지 않는다.')}${item('내공 운용',f(Murim.skill(state.operationXP)),'축적된 기운을 활용하는 능력. 내공 수련과 초식 연마로 높인다.')}${item('생업 숙련',f(Murim.careerSkill(state)),Murim.career(state).name+'의 일을 반복하고 직업 사건과 전승으로 높인다.')}${item('심법 숙련',f(Murim.skill(state.methodXP)),'주력 심법의 이해. 내공 수련과 사부의 지도, 연구로 높인다.')}${item('학식',f(Murim.skill(state.knowledgeXP)),'독서·연구와 견문으로 높이며 비급 해독·상대 정보 파악에 쓰인다.')}${item('축적 내공',f(state.inner,3)+'갑자','내공 수련으로 축적한다. 전투의 가용 내력과 구분하며 무리한 운기의 내상 때 손실될 수 있다.')}</div>`;
    const next=Murim.RANKS[state.rank+1];if(next)body+=`<p class="training-threshold">다음 경지 ${next.name}: 무공 ${f(Murim.skill(state.swordXP))}/${next.sword} · 운용 ${f(Murim.skill(state.operationXP))}/${next.operation} · 심법 ${f(Murim.skill(state.methodXP))}/${next.method} · 내공 ${f(state.inner,3)}/${next.inner}갑자. 조건 충족 후 돌파 사건을 기다립니다.</p>`;
  }else if(tab==='무공'){
    const selected=learned.find(a=>a.key===selectedLearning)||learned[0];
    side=`<div class="detail-buttons" aria-label="배운 무학">${learned.map(a=>`<button data-learning="${a.key}" class="${a.key===selected?.key?'active':''}" aria-pressed="${a.key===selected?.key}"><strong>${esc(a.name)}</strong><small>${a.type}</small></button>`).join('')||'<p>익힌 무공이 없습니다.</p>'}</div>`;
    if(selected){const a=selected.data,isMethod=selected.type.includes('심법'),p=Murim.artProfile(state,a);body=`<h3>${esc(selected.name)}</h3><p>${isMethod?`${a.principle||'해독 필요'} 계통 · 품질 ${f(a.quality||1,2)}. ${a.id===state.method.id?'현재 주력 심법이다.':'주력 심법과 별도로 보존한 지식이다.'}`:`${p.weapon} 계열 · ${p.use}. ${p.weakness}.`}</p><p>${selected.type.includes('해독')?`해독 ${f(a.progress||0,0)}%. 발견만으로 습득하거나 전수권을 얻지는 않는다.`:isMethod?`현재 심법 숙련 ${f(Murim.skill(state.methodXP))}, 운용 ${f(Murim.skill(state.operationXP))}. 내공 수련은 1분기 약재비 0.5냥을 쓰며 품질·재능·사부·피로에 따라 내공과 숙련이 함께 증가한다. 기본 증가량은 0.0175갑자×심법 품질, 운용 23 XP·심법 25 XP이며 내공량에 따른 둔화와 현재 조건이 반영된다.`:`${sourceLabel(a.source)} · ${a.age}세 습득. 현재 공통 무공 숙련 ${f(Murim.skill(state.swordXP))}. 무공 수련은 1분기 0.5냥, 기본 22 XP에 재능·사부·몸 상태가 반영된다. 실전 보정은 ${f(p.bonus*100,1)}% 이내이며 주로 쓰는 마지막 전승 하나만 적용한다.`}</p><p>심법 교체는 내공 손실과 내상 위험을 확인한 사건에서만 진행합니다. 다른 외공을 배우는 것과 구분합니다.</p>`;}
  }else if(tab==='생업'){
    const c=Murim.CAREERS.find(c=>c.id===selectedCareer)||Murim.career(state),xp=state.careerXP[c.id]||0;
    side=`<div class="detail-buttons" aria-label="생업 목록">${Murim.CAREERS.map(x=>`<button data-career-detail="${x.id}" class="${x.id===c.id?'active':''}" aria-pressed="${x.id===c.id}"><strong>${x.name}${x.id===state.career?' · 현재':''}</strong><small>숙련 ${f(Murim.skill(state.careerXP[x.id]||0))}</small></button>`).join('')}</div>`;
    const stories={farmer:'종자를 고르고 물꼬를 돌리며 한 해의 끼니를 일군다. 흉작의 장부에는 이웃과 가족에게 고른 책임도 남는다.',artisan:'재료의 결, 납기와 품질을 함께 살핀다. 대표 작업과 손끝의 배움은 다음 장인에게 이어진다.',merchant:'물목과 장부 너머로 거래 상대와 약속을 쌓는다. 풍년이 곧 모든 물목의 높은 이익을 뜻하지는 않는다.',doctor:'약초와 의서를 살피고 환자를 맡는다. 이름난 의원의 성취에는 몸을 맡긴 사람과 지킨 책임이 남는다.',teacher:'글을 배우려는 아이와 일상의 질문을 나눈다. 큰 스승의 이름은 제자에게 무엇을 전했는가로 남는다.',innkeeper:'한 끼와 잠자리를 마련하며 오가는 길손을 만난다. 빈자리 하나가 훗날 돌아오는 인연이 될 수 있다.'};
    body=`<h3>${c.name}의 날들</h3><p>${stories[c.id]}</p>${item('보존한 숙련',f(Murim.skill(xp)),`누적 ${f(xp,0)} XP. 전업해도 잃지 않는다. 생업 한 분기 기본 17 XP에 오성과 몸 상태가 반영된다.`)}${item('기본 수입 계수',c.base+'냥',`변동 폭 ±${Math.round(c.volatility*100)}%. 실제 수입은 숙련·나이·시장·지역·컨디션으로 달라진다.`)}<p>현재 재산 ${f(state.money)}냥 · 부채 ${f(state.debt)}냥${state.organization?` · ${esc(state.organization.name)} 별도 금고 ${f(state.organization.treasury)}냥`:''}. 계획 화면에서 생업을 바꿀 수 있습니다.</p>`;
    const records=state.careerRecords.filter(r=>r.careerId===c.id);
    body+=`<h3>내가 남긴 일</h3>${records.length?records.slice().reverse().map(r=>`<article class="career-record"><strong>${esc(r.title)}</strong><p>${r.age}세 ${seasons[r.q]} · ${esc(state.npcs.find(n=>n.id===r.actorId)?.name||'지역 사람들')} · ${esc(r.choice)}</p><p>${esc(r.result)}</p></article>`).join(''):'<p>아직 대표 작업 기록이 없습니다. 앞으로의 생업 사건에서 선택과 당사자를 남깁니다.</p>'}`;
  }else if(tab==='상태'){
    side=`<div class="rpg-stats">${[['건강',state.health],['피로',state.fatigue],['부상·내상',state.injury],['행복',state.happiness],['가용 내력',state.innerReserve],['명성',state.reputation],['문중 신뢰',state.trust],['문중 지지',state.support]].map(([n,v])=>`<div><span>${n}</span><meter min="0" max="100" value="${v}">${f(v)}</meter><strong>${f(v)}</strong></div>`).join('')}</div>`;
    body=`<h3>몸과 마음을 살피다</h3><p>생업·수련만 계속하면 피로가 누적되어 효율이 낮아집니다. 휴식·교류는 회복에 도움이 됩니다. 부상이 심하면 위험한 수련을 휴식으로 바꿉니다.</p><p>공헌 ${f(state.merit)} · 의협 ${f(state.ethics)} · 현재 지역 신뢰 ${f(state.localReputation[state.location]||0)}. 지역과 특정 인물의 평가는 전체 명성과 구분됩니다.</p>`;
  }else if(tab==='업적'){
    const a=achievements.find(a=>a.key===selectedAchievement)||achievements.at(-1);
    side=`<div class="detail-buttons" aria-label="남긴 성취">${achievements.map(a=>`<button data-achievement="${a.key}" class="${a.key===selectedAchievement?'active':''}">${esc(a.name)}</button>`).join('')||'<p>아직 특별한 업적이 없습니다. 매일의 선택도 기록에 남습니다.</p>'}</div>`;
    body=a?`<h3>${esc(a.name)}</h3><p>${esc(a.text)}</p>`:'<p>일생은 최고 직위만으로 평가하지 않습니다. 인연·생업·전승·평온도 삶에 남는 성취입니다.</p>';
  }else {side=`<div class="detail-buttons">${Object.keys(Murim.GLOSSARY).map(n=>`<button data-term="${esc(n)}">${n}</button>`).join('')}</div>`;body=`<dl class="context-glossary">${Object.entries(Murim.GLOSSARY).map(([n,d])=>`<div id="term-${n}"><dt>${n}</dt><dd>${d}</dd></div>`).join('')}</dl>`;}
  return heading('한 사람의 모습','배운 무학과 생업, 인연과 권한을 하나씩 살펴봅니다.')+`<section class="paper character-paper"><nav class="detail-navigation">${['기본','능력','무공','생업','상태','업적','용어'].map(n=>`<button data-detail="${n}" class="${tab===n?'active':''}" aria-pressed="${tab===n}">${icon(n==='무공'?'sword':n==='생업'?'coin':'scroll')}${n}</button>`).join('')}</nav><div class="character-body"><div class="character-top"><div class="portrait character-portrait p1"></div><div class="character-intro"><h2>${esc(displayName())}</h2><p>${state.age}세 · ${esc(sectName())}<br>${esc(roleName())}</p>${fact('내공',f(state.inner,3)+'갑자','meditate')}${fact('경지',Murim.RANKS[state.rank].name,'sword')}${fact('생업',Murim.career(state).name,'coin')}${fact('재산',f(state.money)+'냥','coin')}${fact('직위',state.officeId||'없음','shield')}</div><div class="detail-side">${side}</div></div><div class="character-bio">${body}<p class="seed-note">생애 시드 ${esc(state.seed)} · 규칙 ${Murim.VERSION}</p></div></div></section>`;
}
function storyEventView(){
  const p=state.pendingEvent;if(!p)return BaseViews.eventView();const e=Murim.eventPresentation(state);
  return heading('갈림길의 이야기',`${p.age}세 · ${seasons[p.q]} · 선택할 때까지 시간과 인물의 삶이 멈춥니다.`)+`<section class="paper event-paper"><div class="event-art"><div class="event-copy"><div class="event-tag">${icon('pause')}${esc(state.location)}${e.actor?' · '+esc(e.actor):''}</div><h2>${esc(e.title)}</h2><p>${esc(e.text)}</p></div></div>${e.cause?`<p class="event-cause">이어진 사정: ${esc(e.cause)}</p>`:''}<div class="choices">${Murim.options(state).map((o,i)=>`<button class="choice" data-choice="${i}" data-event-uid="${esc(p.uid)}" ${o.disabled?'disabled':''}><span class="choice-number">${i+1}</span><span class="choice-text">${esc(o.label)}</span><span class="choice-result">${esc(o.hint)}${o.disabled?' · 현재 조건 부족':''}</span>${icon('chevron')}</button>`).join('')}</div><div class="event-footnote">표시한 비용과 현재 조건을 확인하세요. 이후 사람과 세계의 변화는 선택 뒤에도 이어집니다.</div></section>`;
}
function passingSequence(){
  let overlay=$('passingOverlay');
  if(state.alive||state.deathPresented){if(overlay){clearTimeout(overlay._timer);overlay.remove();}$('main').inert=false;$('navigation').inert=false;document.querySelector('.app').inert=false;return;}
  if(overlay&&overlay.dataset.life===state.seed)return;
  if(overlay){clearTimeout(overlay._timer);overlay.remove();}
  overlay=document.createElement('section');overlay.id='passingOverlay';overlay.dataset.life=state.seed;overlay.className='passing-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','passingName');
  overlay.innerHTML=`<div class="passing-copy"><span class="eyebrow">한 삶이 저물다</span><h1 id="passingName">${esc(displayName())}</h1><p class="passing-age">${state.age}세 · ${esc(state.deathCause)}</p><p>${esc(Murim.farewell(state))}</p>${button('남긴 일대기 보기','data-action="finishPassing"','scroll')}</div>`;
  document.body.append(overlay);$('main').inert=true;$('navigation').inert=true;document.querySelector('.app').inert=true;overlay.querySelector('button').focus();
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)overlay._timer=setTimeout(()=>finishPassing(),6500);
}
function finishPassing(){const overlay=$('passingOverlay');if(overlay){clearTimeout(overlay._timer);overlay.classList.add('leaving');}state.deathPresented=true;$('main').inert=false;$('navigation').inert=false;document.querySelector('.app').inert=false;persist();setTimeout(()=>{overlay?.remove();render();document.querySelector('.ending-paper .button')?.focus();},matchMedia('(prefers-reduced-motion: reduce)').matches?0:650);}
function biography(){download(`${displayName()}의 일대기\n시드 ${state.seed} · 규칙 ${Murim.VERSION}\n${Murim.ending(state).join(' · ')}\n\n${Murim.biographyLines(state).join('\n\n')}\n\n상세 기록\n`+state.logs.map(l=>`${l.year}년 / ${l.age}세 ${seasons[l.q]} [${l.type}] ${l.text}`).join('\n'),`무협생활_${displayName()}_일대기.txt`,'text/plain;charset=utf-8');}
document.addEventListener('click',e=>{const t=e.target.closest('button');if(!t||t.disabled)return;
  if(t.dataset.rumor){e.stopImmediatePropagation();promptRumor(t.dataset.rumor);}
  if(t.dataset.rumorConfirm){e.stopImmediatePropagation();reserveRumor(t.dataset.rumorConfirm);}
  if(t.dataset.learning){selectedLearning=t.dataset.learning;render();}
  if(t.dataset.careerDetail){selectedCareer=t.dataset.careerDetail;render();}
  if(t.dataset.achievement){selectedAchievement=t.dataset.achievement;render();}
  if(t.dataset.term)$('term-'+t.dataset.term)?.scrollIntoView({block:'center'});
  if(t.dataset.socialPerson){state.socialTargetId=t.dataset.socialPerson;state.socialMode='auto';persist();render();notify('이 인연에게 다음 교류 시간을 쓰기로 했습니다.');}
  if(t.dataset.action==='finishPassing')finishPassing();
});
document.addEventListener('change',e=>{const t=e.target;if(t.id==='socialTarget'){state.socialTargetId=t.value||null;persist();}if(t.id==='socialMode'){state.socialMode=t.value;persist();}});
document.addEventListener('keydown',e=>{const overlay=$('passingOverlay');if(!overlay)return;if(e.key==='Tab'){e.preventDefault();overlay.querySelector('button')?.focus();}if(e.key==='Escape')finishPassing();});
