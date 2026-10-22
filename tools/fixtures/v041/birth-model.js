'use strict';
const MurimBirth = (() => {
  const VERSION='1.0.0';
  const HOUSEHOLDS=[{id:'orphan',name:'천애고아',originId:'orphan'},{id:'farm',name:'농가',originId:'farm'},{id:'craft',name:'장인의 집',originId:'craft'},{id:'merchant',name:'상인 가구',originId:'merchant'},{id:'martial',name:'하급 무가',originId:'martial'},{id:'clan',name:'명문세가',originId:'noble'},{id:'fallen',name:'몰락가문',originId:'martial'}];
  const CLANS=[{id:'namgung',name:'남궁세가',surname:'남궁',region:'안휘',settlement:'합비',source:'02_세력문파!A13:E13'},{id:'tang',name:'사천당가',surname:'당',region:'사천',settlement:'성도 인근',source:'02_세력문파!A14:E14'},{id:'paeng',name:'하북팽가',surname:'팽',region:'하북',settlement:'보정 인근',source:'02_세력문파!A15:E15'},{id:'zhuge',name:'제갈세가',surname:'제갈',region:'호북',settlement:'무창 인근',source:'02_세력문파!A16:E16'},{id:'murong',name:'모용세가',surname:'모용',region:'요동',settlement:'요양 인근',source:'02_세력문파!A17:E17'}];
  function initialize(s,options=null){
    const b=options?.birth;
    s.householdType??=s.originId==='noble'?'clan':s.originId;
    if(s.branchId===undefined)s.branchId=s.clanId?'main':null;
    s.birthLineage??=s.clanId?'direct':'none';s.birthStatus??=s.originId==='orphan'?'unknown':'recognized';
    s.heirCandidate??=s.clanId==='namgung'&&s.originId==='noble';
    s.familyTransmissionPermits??=[];s.mentorHistory??=[];s.discipleship??=[];
    s.schemaVersion=2;s.rulesVersion=s.version;s.contentVersion='0.4.1-120';s.birthModelVersion=VERSION;s.careerRecords??=[];
    if(b){
      if(HOUSEHOLDS.some(h=>h.id===b.householdType))s.householdType=b.householdType;
      const requestedClan=b.clanId||(s.householdType==='clan'?'namgung':null);
      const c=requestedClan?CLANS.find(c=>c.id===requestedClan):null;
      if(b.clanId&&!c)throw Error('기획에 없는 가문입니다.');
      s.clanId=c?.id||null;s.branchId=c?(b.branchId||'main'):null;s.birthLineage=c?(b.lineage||'direct'):'none';
      s.lineage=c?(s.birthLineage==='direct'?'직계 혈족':'방계 혈족'):'민간';
      s.birthStatus=b.birthStatus||(s.householdType==='orphan'?'unknown':s.householdType==='fallen'?'fallen':'recognized');
      s.heirCandidate=!!c&&s.birthLineage==='direct';
      if(s.householdType==='fallen')s.originId='fallen';
      else if(c&&(c.id!=='namgung'||s.branchId!=='main'||s.birthLineage!=='direct'))s.originId='clan-'+c.id;
      if(c){s.surname=c.surname;s.clanRegion=c.region;s.clanSeat=c.settlement;const f=s.npcs.find(n=>n.id===s.birthParentIds[0]);if(f)f.name=s.surname+'정호';}
      if(b.place)s.location=s.birthPlace=b.place;
      for(const n of s.npcs.filter(n=>s.birthParentIds.includes(n.id)||n.id===s.guardianId))n.location=s.location;
    }
    s.familyGraph={parents:[...s.birthParentIds],guardianId:s.guardianId,spouseId:s.spouseId,childIds:[...s.childIds]};
    return s;
  }
  function syncMentor(s){
    if(!s.mentorId)return;
    const n=s.npcs.find(n=>n.id===s.mentorId);if(!n)return;
    const e=s.discipleship.find(e=>e.mentorId===n.id&&e.discipleId==='player');
    if(!e)s.discipleship.push({mentorId:n.id,discipleId:'player',sectId:n.sectId||s.sectId,fromTick:s.tick,toTick:null,transmission:!!s.transmission});else e.transmission=!!s.transmission;
    if(!s.mentorHistory.includes(n.id))s.mentorHistory.push(n.id);
  }
  function valid(s){return HOUSEHOLDS.some(h=>h.id===s.householdType)&&(!s.clanId||CLANS.some(c=>c.id===s.clanId))&&['direct','collateral','none'].includes(s.birthLineage)&&(s.clanId?['main','branch'].includes(s.branchId)&&s.birthLineage!=='none':s.branchId===null&&s.birthLineage==='none')&&['unknown','recognized','adopted','unrecognized','fallen'].includes(s.birthStatus)&&typeof s.heirCandidate==='boolean'&&Array.isArray(s.familyTransmissionPermits)&&s.familyTransmissionPermits.every(x=>typeof x==='string')&&Array.isArray(s.mentorHistory)&&s.mentorHistory.every(id=>s.npcs.some(n=>n.id===id))&&Array.isArray(s.discipleship)&&s.discipleship.every(e=>e.discipleId==='player'&&s.npcs.some(n=>n.id===e.mentorId)&&Number.isInteger(e.fromTick)&&(e.toTick===null||Number.isInteger(e.toTick))&&typeof e.transmission==='boolean')&&s.schemaVersion===2&&s.rulesVersion===s.version&&typeof s.contentVersion==='string';}
  function describe(s){const c=CLANS.find(c=>c.id===s.clanId);return `${HOUSEHOLDS.find(h=>h.id===s.householdType)?.name||'이전 가구'} · ${c?c.name+' '+(s.branchId==='main'?'본가':'분가')+' '+(s.birthLineage==='direct'?'직계':'방계')+' · 가문 연고 '+c.region+' '+c.settlement:'혈연 가문 미지정'} · ${s.birthStatus==='fallen'?'몰락 이력':s.birthStatus==='unknown'?'출생 불명':'출생 기록 보존'}`;}
  function profile(s){if(s.originId==='fallen')return {id:'fallen',name:'몰락가문',weight:0};const c=CLANS.find(c=>'clan-'+c.id===s.originId&&s.clanId===c.id);return c?{id:s.originId,name:c.name+' '+(s.branchId==='main'?'본가':'분가')+' '+(s.birthLineage==='direct'?'직계':'방계'),weight:0}:null;}
  return {VERSION,HOUSEHOLDS,CLANS,initialize,syncMentor,valid,describe,profile};
})();
globalThis.MurimBirth=MurimBirth;
if(typeof module!=='undefined')module.exports=MurimBirth;
