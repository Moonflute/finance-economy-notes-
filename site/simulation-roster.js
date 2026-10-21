import {PARTICIPANT_ATTRIBUTES,REACTIONS,MAX_PARTICIPANTS,defaultPopulation,distributionGroups,allocatePopulation} from './simulation-engine.js';

export function defaultRosterPlan(count=20,attributes=PARTICIPANT_ATTRIBUTES){
  return {count,allocations:Object.fromEntries(attributes.map(attribute=>[attribute.key,Object.fromEntries(distributionGroups(attribute).map(group=>[group.key,null]))])),overrides:{}};
}

export function rosterCounts(raw,attribute,count){
  const groups=distributionGroups(attribute),defaults=defaultPopulation([attribute]).distributions[attribute.key];
  const values=groups.map(group=>{
    const value=raw?.[group.key];
    if(value==null || value==='')return null;
    const number=Number(value);
    if(!Number.isInteger(number) || number<0 || number>count)throw new Error(`${attribute.label}: 인원은 0~${count}명의 정수로 입력하세요.`);
    return number;
  });
  const fixed=values.reduce((sum,value)=>sum+(value ?? 0),0),automatic=values.flatMap((value,i)=>value===null?[i]:[]);
  if(fixed>count)throw new Error(`${attribute.label}: 지정 인원 ${fixed}명이 전체 ${count}명을 초과합니다.`);
  if(!automatic.length && fixed!==count)throw new Error(`${attribute.label}: 합계를 ${count}명으로 맞추거나 일부 칸을 비워 자동 배정하세요.`);
  if(automatic.length){
    let weights=automatic.map(i=>defaults[groups[i].key]);
    if(!weights.some(value=>value>0))weights=weights.map(()=>1);
    const counts=allocatePopulation(count-fixed,weights);
    automatic.forEach((index,i)=>{values[index]=counts[i];});
  }
  return Object.fromEntries(groups.map((group,i)=>[group.key,values[i]]));
}

function normalizeCell(key,value,attributes){
  if(key==='name'){
    const name=String(value).trim();
    if(!name || name.length>24)throw new Error('참여자 이름은 1~24자로 입력하세요.');
    return name;
  }
  const attribute=attributes.find(item=>item.key===key);
  if(attribute.type==='reaction' || attribute.type==='choice'){
    const valid=attribute.type==='reaction'?Object.hasOwn(REACTIONS,value):attribute.options.some(option=>option.key===value);
    if(!valid)throw new Error(`${attribute.label}: 올바른 항목을 선택하세요.`);
    return value;
  }
  const number=Number(value);
  if(!Number.isFinite(number) || number<attribute.min || number>attribute.max || (key==='wealth' && !Number.isSafeInteger(number*10000)))throw new Error(`${attribute.label}: ${attribute.min}~${attribute.max}${attribute.unit || ''} 범위로 입력하세요.`);
  return number;
}

export function normalizeRosterPlan(raw,attributes=PARTICIPANT_ATTRIBUTES){
  const count=Number(raw?.count);
  if(!Number.isInteger(count) || count<2 || count>MAX_PARTICIPANTS)throw new Error(`전체 참여자는 2~${MAX_PARTICIPANTS}명으로 설정하세요.`);
  const allocations={};
  for(const attribute of attributes){
    rosterCounts(raw.allocations?.[attribute.key],attribute,count);
    allocations[attribute.key]=Object.fromEntries(distributionGroups(attribute).map(group=>{
      const value=raw.allocations?.[attribute.key]?.[group.key];
      return [group.key,value==null || value===''?null:Number(value)];
    }));
  }
  const overrides={};
  for(const [index,row] of Object.entries(raw.overrides || {})){
    if(!/^(0|[1-9]\d?)$/.test(index) || !row || typeof row!=='object')continue;
    const values={};
    for(const key of ['name',...attributes.map(attribute=>attribute.key)]){
      const value=row[key];
      if(value!=null && value!==''){
        try{values[key]=normalizeCell(key,value,attributes);}
        catch(error){throw new Error(`${Number(index)+1}번 참여자 ${error.message}`);}
      }
    }
    if(Object.keys(values).length)overrides[index]=values;
  }
  return {count,allocations,overrides};
}

// Exact integer groups are shuffled independently. Individual overrides win over
// group allocation and are retained when a smaller roster is expanded again.
export function generateRoster(raw,seed,attributes=PARTICIPANT_ATTRIBUTES){
  const plan=normalizeRosterPlan(raw,attributes);
  const rows=Array.from({length:plan.count},(_,i)=>({name:`참여자 ${String(i+1).padStart(2,'0')}`}));
  for(const attribute of attributes){
    const groups=distributionGroups(attribute),counts=rosterCounts(plan.allocations[attribute.key],attribute,plan.count);
    const values=groups.flatMap(group=>Array(counts[group.key]).fill(group.value));
    let state=Number(seed)>>>0;
    for(const char of attribute.key)state=Math.imul(state^char.charCodeAt(0),16777619)>>>0;
    for(let i=values.length-1;i>0;i--){
      state=(Math.imul(state,1664525)+1013904223)>>>0;
      const j=Math.floor(state/4294967296*(i+1));
      [values[i],values[j]]=[values[j],values[i]];
    }
    rows.forEach((row,index)=>{row[attribute.key]=values[index];});
  }
  return rows.map((row,index)=>({...row,...plan.overrides[index]}));
}

export function rosterGroupCounts(rows,attribute){
  const groups=distributionGroups(attribute),counts=Object.fromEntries(groups.map(group=>[group.key,0]));
  let custom=0;
  for(const row of rows){
    const value=row[attribute.key] ?? attribute.default;
    const group=groups.find(item=>item.min!=null || item.max!=null ? Number(value)>=(item.min ?? -Infinity) && Number(value)<=(item.max ?? Infinity) : value===item.value);
    if(group)counts[group.key]++;else custom++;
  }
  return {counts,custom};
}

export function rosterPlanFromPopulation(population){
  const plan=defaultRosterPlan(Number(population.count));
  for(const attribute of PARTICIPANT_ATTRIBUTES){
    const groups=distributionGroups(attribute),defaults=defaultPopulation().distributions[attribute.key];
    const counts=allocatePopulation(plan.count,groups.map(group=>Number(population.distributions?.[attribute.key]?.[group.key] ?? defaults[group.key])));
    plan.allocations[attribute.key]=Object.fromEntries(groups.map((group,i)=>[group.key,counts[i]]));
  }
  return plan;
}
