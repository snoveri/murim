'use strict';
/* Keep live DOM nodes, focus, open details and scroll positions across state updates. */
let yearNoticeText='',yearNoticeTimer;
function nodeKey(node){if(node.nodeType!==1)return '';return node.id||node.getAttribute('data-key')||(node.hasAttribute('data-choice')?'choice:'+node.getAttribute('data-event-uid')+':'+node.getAttribute('data-choice'):'')||['data-view','data-person','data-quarter','data-preset','data-choice','data-combat-stance','data-place','data-region','data-people-tab','data-detail','data-settings-tab','data-history-tab','data-action'].map(a=>node.hasAttribute(a)?a+':'+node.getAttribute(a):'').find(Boolean)||'';}
function compatible(a,b){return a&&b&&a.nodeType===b.nodeType&&(a.nodeType!==1||(a.tagName===b.tagName&&nodeKey(a)===nodeKey(b)));}
function patchNode(oldNode,newNode){
  if(oldNode.nodeType===3){if(oldNode.nodeValue!==newNode.nodeValue)oldNode.nodeValue=newNode.nodeValue;return;}
  if(oldNode.nodeType!==1)return;
  for(const attr of [...oldNode.attributes])if(!newNode.hasAttribute(attr.name)&&attr.name!=='open')oldNode.removeAttribute(attr.name);
  for(const attr of [...newNode.attributes])if(oldNode.getAttribute(attr.name)!==attr.value)oldNode.setAttribute(attr.name,attr.value);
  patchChildren(oldNode,newNode);
  if(oldNode instanceof HTMLInputElement){if(oldNode.type==='checkbox'||oldNode.type==='radio')oldNode.checked=newNode.checked;else if(oldNode!==document.activeElement&&oldNode.value!==newNode.value)oldNode.value=newNode.value;}
  if(oldNode instanceof HTMLSelectElement&&oldNode.value!==newNode.value)oldNode.value=newNode.value;
  if(oldNode instanceof HTMLButtonElement)oldNode.disabled=newNode.disabled;
}
function patchChildren(parent,next){
  const keyed=new Map([...parent.childNodes].filter(n=>nodeKey(n)).map(n=>[nodeKey(n),n]));let cursor=parent.firstChild;
  for(const desired of [...next.childNodes]){
    let existing=nodeKey(desired)?keyed.get(nodeKey(desired)):cursor;
    if(!compatible(existing,desired)){existing=desired.cloneNode(true);parent.insertBefore(existing,cursor);}
    else{if(existing!==cursor)parent.insertBefore(existing,cursor);patchNode(existing,desired);}
    cursor=existing.nextSibling;
  }
  while(cursor){const nextSibling=cursor.nextSibling;cursor.remove();cursor=nextSibling;}
}
function patchHTML(target,html){const template=document.createElement('template');template.innerHTML=html;patchChildren(target,template.content);}
function textIfChanged(id,value){const node=$(id);if(node&&node.textContent!==value)node.textContent=value;}
function updateClock(){
  textIfChanged('sidebarAge',state.started?`${state.age}세 · ${seasons[state.q]}`:'새로운 삶');textIfChanged('sidebarYear',state.started?`${state.world.era} ${year()}년`:state.world.dynasty);
  const symbol=document.querySelector('.season-symbol'),season=['春','夏','秋','冬'][state.q];if(symbol.textContent!==season)symbol.textContent=season;
  textIfChanged('yearReadout',`${state.age}세 · ${seasons[state.q]}`);textIfChanged('secondReadout',`${f(state.q*3+state.p*3)}초 / 12초`);
  if($('timeProgress'))$('timeProgress').style.width=`${state.p*100}%`;updatePlaybackControls();
}
function chronicle(){
  const template=document.createElement('template');template.innerHTML=BaseViews.chronicle();const hero=template.content.querySelector('.hero');
  if(!hero){const ending=template.content.querySelector('.ending-paper');if(ending)ending.querySelector('.save-actions').insertAdjacentHTML('beforebegin',recapPanel());return template.innerHTML;}
  const active=state.quarterStory?.actionId||state.plan[state.q];
  const local=Murim.regionalState(state);template.content.querySelector('.location-badge').innerHTML=`${icon('pin')}${esc(state.location)} · ${local.crop}${local.conflict?' · 길목 분쟁':''}`;
  template.content.querySelector('.story-overline').textContent=`${displayName()} · ${state.age}세의 ${seasons[state.q]}`;
  const opening=state.age===8&&state.tick===32?'어린 시절을 지나, 이제 스스로 삶의 일을 정한다. 출신이 삶의 끝을 정하지는 않는다.':'작은 일과 사람들의 이야기가 모여 한 삶을 이룬다.';
  template.content.querySelector('.hero-story p').textContent=`${sectName()} · ${Murim.career(state).name} · ${actionFor(active).name}\n${state.latestPersonalStory||opening}`;
  const notice=document.createElement('div');notice.id='yearNotice';notice.className='year-notice';notice.setAttribute('aria-live','polite');notice.textContent=yearNoticeText;hero.append(notice);
  if(state.lastOutcome&&state.tick-state.lastOutcome.tick<=2)template.content.append(document.createRange().createContextualFragment(`<section class="last-outcome dark-panel"><h2>${esc(state.lastOutcome.title)} 뒤에</h2><p>${esc(state.lastOutcome.text)}</p></section>`));
  template.content.append(document.createRange().createContextualFragment(rumorPanel()));
  const war=state.world.wars.find(w=>w.status==='active')||state.world.wars.filter(w=>state.tick-w.endTick<=4).at(-1);
  if(war)template.content.append(document.createRange().createContextualFragment(`<section class="war-status dark-panel"><h2>${esc(MurimFactionLife.BLOCS[war.a])} · ${esc(MurimFactionLife.BLOCS[war.b])}의 분쟁</h2><p>${esc(war.place)} · ${war.status==='active'?`전쟁 진행 중 · 예정 기간 ${Math.max(0,war.endTick-state.tick)}분기`:`${esc(war.outcome)} · 복구 중`}<br>현재 ${esc(MurimFactionLife.BLOCS[Murim.conflictRole(state)])}의 입장 · 남긴 기여 ${state.warContributions[war.id]||0}. 참전과 구호, 중재와 불참은 선택할 수 있습니다.</p></section>`));
  return template.innerHTML;
}
function organizationPanel(){
  const sourceNames={public:'공개 기초무공',created:state.createdArt||'창시 무공',lost:state.forgottenArt?.name||'잊힌 무공',...Object.fromEntries(Murim.SECTS.map(t=>[t.id,t.name+'의 전수 무공']))};
  if(state.organization)return `<details class="lineage-panel"><summary>사문과 생업의 터전 · ${esc(state.organization.name)}</summary><p>${state.organization.type==='sect'?`개파의 근거: ${esc(state.independentSect?.art)} · 함께 뜻을 세운 인연 ${state.independentSect?.witnesses.length||0}명`:state.organization.type==='dojo'?`전수 범위: ${esc(sourceNames[state.organization.teachingSource]||'공개 기초무공')}`:'문파와 별도로 운영하는 민간 생업의 터전입니다.'}</p><p>별도 금고 ${f(state.organization.treasury)}냥</p></details>`;
  const requirements=Murim.foundingRequirements(state);
  return `<details class="lineage-panel"><summary>사문과 전승 · 무관·문파·생업 터전</summary><p>무관은 허가받은 무공을 가르칩니다. 독립 문파를 열려면 자신의 상승무공 또는 습득한 잊힌 무학과 함께할 인연이 필요합니다.</p><label>무관에서 전할 무학 <select id="teachingSource">${Object.entries(sourceNames).filter(([id])=>id==='public'||id==='created'&&state.createdArt||id==='lost'&&state.forgottenArt?.learned||Murim.SECTS.some(t=>t.id===id)&&state.learnedSkills.some(a=>a.source===id)).map(([id,n])=>`<option value="${id}" ${state.teachingSource===id?'selected':''}>${esc(n)}${state.teachingPermits.includes(id)?' · 허가 있음':' · 허가 필요'}</option>`).join('')}</select></label><div class="plan-presets">${button('사문에 전수 허가 청하기',`data-institution="teachingPermit" ${!state.sectId||state.trust<65||state.merit<60?'disabled':''}`,'book','secondary small')}${button('무관 열기',`data-institution="openDojo" ${Murim.canOpenDojo(state)?'':'disabled'}`,'home','secondary small')}${button('독립 문파 개파',`data-institution="foundSect" ${Murim.canFoundSect(state)?'':'disabled'}`,'shield','secondary small')}${button('생업 터전 마련',`data-institution="business" ${state.money>=80&&Murim.careerSkill(state)>=52&&state.age>=18?'':'disabled'}`,'coin','secondary small')}</div><p class="muted">전수 허가: 신뢰 65 · 공헌 60 이상, 승인 시 공헌 20을 사용합니다. 무관은 무공 숙련 65와 80냥이 필요합니다.</p><ul class="founding-requirements">${requirements.map(r=>`<li class="${r.ok?'met':''}">${r.ok?'✓':'·'} ${esc(r.label)}</li>`).join('')}</ul></details>`;
}
function plan(){const l=state.lastYear;return heading('사계절 계획','배치한 행동은 해마다 반복됩니다. 이미 지난 분기는 다음 해부터 적용됩니다.')+`
  <section class="paper plan-paper"><div class="paper-heading"><div><h2>${state.age}세의 계획</h2><p>완료된 일은 그대로 기록하고, 다음 해에 할 일을 미리 정합니다.</p></div><div class="plan-options"><span>1년 ${12/state.speed}초</span><label class="switch-label">자동 반복 <input class="switch" type="checkbox" data-setting="autoRepeat" ${state.autoRepeat?'checked':''}></label></div></div>
  <div class="life-selectors"><label>생업 <select id="careerSelect">${Murim.CAREERS.map(c=>`<option value="${c.id}" ${c.id===state.career?'selected':''}>${c.name} · 숙련 ${f(Murim.skill(state.careerXP[c.id]||0),0)}</option>`).join('')}</select></label><label>입문 청원 대상 <select id="targetSect" ${state.sectId||state.independentSect?'disabled':''}>${Murim.SECTS.map(t=>`<option value="${t.id}" ${state.targetSect===t.id?'selected':''}>${t.name} · ${t.faction}</option>`).join('')}</select></label></div>
  <div class="life-selectors social-selectors"><label>교류 대상 <select id="socialTarget"><option value="">가까운 인연 자동 추천</option>${state.npcs.filter(n=>n.alive&&n.age>=8&&n.role!=='원한 상대').map(n=>`<option value="${esc(n.id)}" ${state.socialTargetId===n.id?'selected':''}>${esc(n.name)} · ${esc(n.role)} · ${esc(n.location)}</option>`).join('')}</select></label><label>교류 방식 <select id="socialMode">${[['auto','가까우면 만남, 멀면 서신'],['visit','같은 거점에서 만남'],['letter','서신으로 안부']].map(([v,n])=>`<option value="${v}" ${state.socialMode===v?'selected':''}>${n}</option>`).join('')}</select></label></div>
  <div class="plan-presets">${[['civil','생업과 인연'],['martial','무공과 사문'],['hybrid','생업과 무공'],['retire','휴식과 은거']].map(([id,n])=>button(n,`data-preset="${id}"`,'','secondary small')).join('')}${[['entry','입문 우선'],['entryWork','입문과 생업 병행']].map(([id,n])=>button(n,`data-entry-preset="${id}" ${state.sectId||state.independentSect?'disabled':''}`,'home','secondary small')).join('')}${state.sectId?button('문파 떠나기','data-action="leaveSect"','','secondary small'):''}</div>
  <div class="season-grid">${seasons.map((n,i)=>{const a=actionFor(state.plan[i]),next=actionFor(state.nextPlan[i]);const later=Murim.planAppliesNextYear(state,i);return `<article class="season-card ${i===state.q?'current':''} ${i<state.q?'past-season':''}" data-key="season-${i}"><div class="season-card-head"><strong>${n}</strong><small>${i<state.q?'완료된 계절':i===state.q?'현재 계절':'다가올 계절'}</small></div><div class="season-image"></div><div class="season-card-body">${icon(a.icon)}<h3>${a.name}</h3><p>${a.desc}</p><p class="next-plan">다음 해 ${n}: <b>${next.name}</b></p>${button(later?'다음 해 계획 변경':'변경',`data-quarter="${i}" ${!state.alive?'disabled':''}`,'','small')}</div></article>`;}).join('')}</div>
  <div class="long-plan"><label>장기 예약 <select id="repeatYears">${[0,1,5,10].map(n=>`<option value="${n}" ${state.repeatYears===n?'selected':''}>${n?`${n}년 뒤 정지`:'계속 반복'}</option>`).join('')}</select></label><label>목표 도달 시 정지 <select id="goal">${[['none','없음'],['inner1','내공 1갑자'],['career60','생업 숙련 60'],['rank3','일류 경지']].map(([id,n])=>`<option value="${id}" ${state.goal===id?'selected':''}>${n}</option>`).join('')}</select></label></div>
  <div class="year-summary"><div><h3>지난 해 살림</h3><div class="summary-values">${l?`<span>수입 ${f(l.income)}냥</span><span>지출 ${f(l.expense)}냥</span><span>${esc(l.climate)}</span>`:'아직 한 해가 지나지 않았습니다.'}</div></div>${button('계획대로 진행','data-action="play"','play')}</div>${organizationPanel()}</section><div class="paper-note">${icon('scroll')}진행 중인 행동의 발자취가 이미 기록됐다면 그 계절의 변경도 다음 해부터 적용됩니다. 입문·전향은 직업과 혈연을 바꾸지 않습니다.</div>`;}
function combatView(){
  const c=state.combat;if(!c){const r=state.lastCombat;return heading('승부 뒤에 남은 것',`${r.age}세 · ${seasons[r.q]} · ${r.kind==='duel'?'비무':'강호의 승부'}`)+`<section class="paper combat-paper combat-result"><div class="eyebrow">AFTER THE ENCOUNTER</div><h2>${r.escaped?'몸을 보전한 길':r.victory?'승부를 마치다':'패배를 돌아보다'}</h2><p>${esc(r.text)}</p><p>가용 내력 ${f(state.innerReserve,0)} / 100 · 축적 내공 ${f(state.inner,3)}갑자 · 부상 ${f(state.injury)}</p>${button('이야기 이어 가기','data-action="combatContinue"','arrow')}</section>`;}
  const intel=Murim.combatIntel(state),duel=c.kind==='duel';
  return heading(duel?'비무장에 서다':'강호의 승부',duel?'생사를 겨루지 않습니다. 전력을 아끼거나 무리하면 부상과 명망이 달라집니다.':'상대를 살피고 대응을 고르세요. 선택할 때까지 생애는 멈춥니다.')+`<section class="paper combat-paper"><div class="combat-opponents"><article><span class="eyebrow">그대의 상태</span><h2>${esc(displayName())}</h2><p>${Murim.RANKS[state.rank].name} · ${esc(state.method.name)}</p><dl><div><dt>현재 전투력</dt><dd>${f(Murim.power(state),1)}</dd></div><div><dt>축적 내공</dt><dd>${f(state.inner,3)}갑자</dd></div><div><dt>가용 내력</dt><dd>${f(state.innerReserve,0)} / 100</dd></div><div><dt>건강 · 부상</dt><dd>${f(state.health,0)} · ${f(state.injury,0)}</dd></div></dl></article><span class="combat-versus">對</span><article><span class="eyebrow">상대의 알려진 정보</span><h2>${esc(intel.name)}</h2><p>무기: ${esc(intel.weapon)}</p><p>${esc(intel.style)}</p><p>${esc(intel.estimate)}</p><p>${esc(intel.details||" ")}</p><p>${esc(intel.basis)}</p><small>${intel.level==='detailed'?'견문이 쌓여 상대의 전력을 구체적으로 가늠할 수 있다.':intel.level==='partial'?'전해 들은 이야기와 관찰로 일부만 짐작한다.':'아직 상대의 경지와 내공을 단정할 수 없다.'}</small></article></div><div class="combat-choices">${Murim.combatOptions(state).map(o=>{const odds=intel.level==='detailed'?`${o.id==='flee'?'도주':'승리'} 추정 ${Math.round(o.win*100)}%`:'상대와의 실제 실력 차이에 따라 판정';const desc=duel?(o.id==='flee'?'겨룸을 중단하고 물러날 길을 찾는다. 실패하면 부상을 입을 수 있다.':`가용 내력 ${o.cost} · 비무에서는 사망하지 않는다. 패배 시 경상~중상${['allout','forceful'].includes(o.id)?', 무리한 운기에는 내상·내공 손실 위험':''}.`):o.desc;return `<button class="combat-choice" data-key="combat-${esc(c.uid)}-${c.round}-${o.id}" data-combat-round="${c.round}" data-combat-stance="${o.id}" data-combat-uid="${esc(c.uid)}" ${o.disabled?'disabled':''}><strong>${o.label}</strong><span>${esc(desc)}</span><small>${odds}${o.disabled?' · 가용 내력 부족':''}</small></button>`;}).join('')}</div><p class="combat-note">${duel?'생사결이 아닌 비무의 치명상 확률은 0입니다.':'전력으로 맞서거나 힘을 아끼다 패배하면 치명상 위험이 커집니다.'} 가용 내력은 쉬거나 행공하면 회복됩니다. 축적 내공은 무리한 운기로 내상을 입었을 때만 손실될 수 있습니다.</p></section>`;
}
function eventView(){return state.combat||state.combatResultPending?combatView():storyEventView();}
function birthSequence(){
  if(!state.birthIntroPending){document.getElementById('birthPrologue')?.remove();return;}
  state.playing=false;if(document.getElementById('birthPrologue'))return;
  const overlay=document.createElement('section');overlay.id='birthPrologue';overlay.className='birth-prologue';overlay.setAttribute('aria-label','출생과 어린 시절');
  const lines=state.logs.filter(l=>['출생','유년'].includes(l.type));
  overlay.innerHTML=`<div><span class="eyebrow">한 사람의 생이 열리다</span><h1>${esc(displayName())}</h1><div class="birth-lines">${lines.map((l,i)=>`<p style="--line:${i}">${esc(l.text)}</p>`).join('')}</div><button class="button" data-action="beginLife">스스로 삶을 살아가기 ${icon('arrow')}</button><button class="button secondary small" data-action="birthReplay">유년기 다시 읽기</button></div>`;
  document.body.append(overlay);overlay.querySelector('button').focus();
}
function characterView(){
  const template=document.createElement('template');template.innerHTML=detailedCharacterView();
  if(detailTab==='상태'){const rows=state.infirmities.filter(i=>i.severity>0);template.content.querySelector('.character-bio').insertAdjacentHTML('beforeend',`<h3>외상과 후유장애</h3>${rows.length?rows.map(i=>`<p class="wound-record">${esc(i.source)} · ${i.permanent?'지속 후유장애':'일시적 '+esc(i.kind)} · 정도 ${f(i.severity,0)}<br>${i.permanent?'자연 회복되지 않습니다. 소문 속 의원을 찾아 치료받을 수 있습니다.':'시간이 지나면 분기마다 1, 휴식하면 4씩 회복됩니다.'}</p>`).join(''):'<p>지속 중인 외상·후유장애가 없습니다.</p>'}<p>추가 전투력 감소 ${f(MurimFactionLife.penalty(state)*100,1)}% · 악명 ${f(state.notoriety,0)}</p>`);}
  return template.innerHTML;
}
function peopleView(){const template=document.createElement('template');template.innerHTML=BaseViews.peopleView();const n=state.npcs[personIndex]||state.npcs[0];template.content.querySelector('.person-detail').insertAdjacentHTML('beforeend',`<div class="person-life"><p>${esc(n.location)} · ${n.martial?'무인':Murim.CAREERS.find(c=>c.id===n.careerId).name}<br>무학 ${f(n.martialSkill)} · 생업 ${f(n.civilSkill)}</p>${n.alive&&n.age>=8&&n.role!=='원한 상대'?button('다음 교류 대상으로 정하기',`data-social-person="${esc(n.id)}"`,'people','secondary small'):''}<p>${state.memories.filter(m=>m.actorId===n.id).map(m=>esc(m.age+'세 · '+m.label)).join('<br>')||'아직 함께 남긴 약속의 기록이 없습니다.'}</p></div>`);return template.innerHTML;}
function mapView(){const template=document.createElement('template');template.innerHTML=BaseViews.mapView();const r=Murim.regionalState(state,selectedPlace);if(r)template.content.querySelector('.map-info').insertAdjacentHTML('beforeend',`<p class="regional-notice">현재 작황: ${r.crop}${r.conflict?' · 길목 분쟁: 이동 피로 +4':''}${r.recovery?' · 복구 중':''}. 생산과 물자 수요가 직업에 따라 다르게 반영됩니다.</p>`);return template.innerHTML;}
function historyView(){
  const rows=state.logs.filter(l=>historyTab==='전체'||historyTab==='주요 선택'&&l.type==='선택'||historyTab==='인연'&&l.type==='인연'||historyTab==='강호'&&l.type==='강호'||historyTab==='행동'&&l.type==='행동'||historyTab==='발자취'&&l.type==='발자취'||historyTab==='소문'&&l.type==='소문'||historyTab==='전투'&&l.type==='전투').slice().reverse();
  return heading('살아온 날들',`${esc(displayName())} · 출생부터 ${state.alive?'지금까지':'생의 마지막까지'} 모든 기록을 보존합니다.`,button('일대기 내보내기','data-action="biography"','download','secondary small'))+`<section class="paper history-paper">${tabs(['전체','발자취','주요 선택','인연','강호','행동','소문','전투'],historyTab,'data-history-tab')}<div class="history-layout"><div class="history-list">${rows.map((l,i)=>`<div class="history-row" data-key="log-${state.logs.indexOf(l)}"><time>${l.age}세 ${seasons[l.q]}<br>${l.year}년</time>${icon(l.type==='인연'?'people':l.type==='전투'?'sword':'scroll')}<span>${esc(l.text)}</span></div>`).join('')}</div><div class="history-illustration"><div><strong>${esc(displayName())}의 강호</strong><p>${state.choices.length}번의 선택 · ${state.logs.length}개의 기록<br>${Murim.ending(state).map(esc).join(' · ')}</p></div></div></div></section>`;
}
function render(force=false){
  const screens={chronicle,plan,map:mapView,event:eventView,people:peopleView,character:characterView,history:historyView,settings:settingsView};
  const html=`<div class="screen-enter" id="liveScreen">${!state.started&&view!=='settings'?birthView():screens[view]()}</div>`;
  if(force||!$('main').firstChild)$('main').innerHTML=html;else patchHTML($('main'),html);
  patchHTML($('navigation'),navs.map(([id,ic,n])=>`<button class="nav-button ${view===id?'active':''}" data-view="${id}" ${view===id?'aria-current="page"':''}>${icon(ic)}${n}${id==='event'&&(state.pendingEvent||state.combat||state.combatResultPending)?'<i class="event-dot"></i>':''}</button>`).join(''));
  patchHTML($('quickSave'),icon('save'));patchHTML($('soundToggle'),icon(state.sound?'sound':'mute'));$('soundToggle').setAttribute('aria-label',state.sound?'효과음 끄기':'효과음 켜기');updateClock();applyTextSize();passingSequence();document.body.classList.toggle("birth-stage",(!state.started||state.birthIntroPending)&&view!=="settings");birthSequence();
}
function navigate(next,force=false){if(!navs.some(n=>n[0]===next))next='chronicle';if(['plan','map','event','settings'].includes(next))state.playing=false;view=next;render(force);if(location.hash!==`#${next}`)history.replaceState(null,'',`#${next}`);}
function togglePlay(){if(!state.started||!state.alive||state.birthIntroPending){view='chronicle';render();return;}if(state.pendingEvent||state.combat||state.combatResultPending){view='event';render();notify('기다리는 선택이나 승부의 결과부터 확인하세요.');return;}state.playing=!state.playing;state.stopReason='';clockLast=performance.now();updatePlaybackControls();}
function finishQuarter(){
  const age=state.age;Murim.advanceQuarter(state);
  if(state.age!==age){yearNoticeText=`${state.age}세가 되었습니다. 또 한 해의 삶이 시작됩니다.`;clearTimeout(yearNoticeTimer);yearNoticeTimer=setTimeout(()=>{yearNoticeText='';if($('yearNotice'))$('yearNotice').textContent='';},3600);}
  if(!state.alive)view='chronicle';else if(state.pendingEvent||state.combat){view='event';if(state.notifyEvents)notify('삶의 갈림길을 만났습니다. 시간이 멈춥니다.');}else if(state.stopReason){notify(state.stopReason);view='plan';state.stopReason='';}
  render();if(state.autoSave)persist();
}
function choose(index,uid=state.pendingEvent?.uid){const edit=state.pendingEvent?.id==='entry-plan'&&Murim.options(state)[index]?.id==='edit';if(Murim.resolveEvent(state,uid,index)){view=state.pendingEvent||state.combat?'event':edit?'plan':'chronicle';render();persist();notify(state.combat?'상대를 살피고 대응을 고르세요.':state.pendingEvent?'이어지는 선택이 기다립니다.':edit?'원하는 생업과 수련을 계획하세요.':'선택과 달라진 사정을 기록했습니다.');}}
function editQuarter(i){if(!state.alive)return;state.playing=false;selectedQuarter=i;const later=Murim.planAppliesNextYear(state,i);$('modal').innerHTML=`<button class="modal-close" data-action="closeModal" aria-label="닫기">${icon('close')}</button><div class="eyebrow">FOUR SEASONS PLAN</div><h2>${later?'다음 해 ':''}${seasons[i]}에 할 일</h2><p>${later?'올해의 발자취는 유지하고 다음 해부터 적용합니다.':'아직 시작하지 않은 계절의 계획을 바꿉니다.'}</p><div class="action-options">${actions.filter(a=>a.id!=='travel').map(a=>`<button class="action-option" data-select-action="${a.id}" ${a.id==='seek'&&(state.sectId||state.independentSect)?'disabled':''}>${icon(a.icon)}<span><strong>${a.name}</strong><small>${a.desc}</small></span></button>`).join('')}</div>`;$('modal').showModal();updatePlaybackControls();}
function advanceClock(dt){
  if(!state.playing||!state.alive||state.birthIntroPending||state.pendingEvent||state.combat||state.combatResultPending||$('modal').open)return;
  let progress=state.p+dt*state.speed/3;
  while(progress>=1){state.p=0;Murim.advanceNarrative(state,1);progress-=1;finishQuarter();if(!state.playing){state.p=0;updateClock();return;}}
  state.p=progress;if(Murim.advanceNarrative(state,progress))render();updateClock();
}
document.addEventListener('click',e=>{
  const t=e.target.closest('button');if(!t||t.disabled)return;
  if(t.dataset.entryPreset){Murim.setPreset(state,t.dataset.entryPreset==='entry'?['seek','sword','inner','seek']:['work','seek','work','seek']);persist();render();notify('입문을 청하는 일정을 배치했습니다. 완료된 계절의 변경은 다음 해부터 적용됩니다.');}
  if(t.dataset.institution){if(state.pendingEvent||state.combat||state.combatResultPending){view='event';render();return;}state.playing=false;Murim.queue(state,t.dataset.institution);Murim.dispatch(state);view='event';render();persist();}
  if(t.dataset.combatStance&&Murim.resolveCombat(state,t.dataset.combatUid,t.dataset.combatStance,+t.dataset.combatRound)){view=state.alive?'event':'chronicle';render();persist();}
  if(t.dataset.action==='combatContinue'){Murim.dismissCombat(state);view=state.pendingEvent?'event':'chronicle';render();persist();}
  if(t.dataset.action==='beginLife'){state.birthIntroPending=false;document.getElementById('birthPrologue')?.remove();render();persist();}
  if(t.dataset.action==='birthReplay'){document.getElementById('birthPrologue')?.remove();birthSequence();}
  if(t.dataset.rumor){const r=state.rumors.find(r=>r.id===t.dataset.rumor);if(!r)return;state.playing=false;state.targetRumorId=r.id;if(state.location===r.place){const q=Murim.planAppliesNextYear(state,state.q)?(state.q+1)%4:state.q;Murim.setPlan(state,q,'investigate');notify(`${seasons[q]}에 소문 추적을 계획했습니다.`);view='plan';}else{selectedPlace=r.place;region='전체';view='map';notify(`${r.place}에서 소문을 추적할 수 있습니다. 이동 후 소문 추적을 배치하세요.`);}render();persist();}
});
document.addEventListener('change',e=>{if(e.target.id==='teachingSource'){state.teachingSource=e.target.value;persist();render();}});
navigate(state.pendingEvent||state.combat||state.combatResultPending?'event':location.hash.slice(1)||'chronicle');requestAnimationFrame(tick);
