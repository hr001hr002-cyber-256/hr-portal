const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');

function symbolSource(name){
  const declaration=`function ${name}(`;
  const start=source.indexOf(declaration);
  if(start===-1){
    const arrowStart=source.indexOf(`const ${name}=`);
    assert.notEqual(arrowStart,-1,`找不到 production function: ${name}`);
    const end=source.indexOf('\n',arrowStart);
    assert.notEqual(end,-1,`無法解析 production function: ${name}`);
    return source.slice(arrowStart,end);
  }
  const brace=source.indexOf('{',start);
  let depth=0;
  for(let i=brace;i<source.length;i++){
    if(source[i]==='{')depth++;
    else if(source[i]==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`無法解析 production function: ${name}`);
}

const names=['plus','days','diffYmd','newBasis','oldBasis','newSeveranceAmounts'];
const sandbox={Date,Math};
vm.createContext(sandbox);
vm.runInContext(`${names.map(symbolSource).join('\n')}\nthis.api={${names.join(',')}};`,sandbox);
const {diffYmd,newBasis,oldBasis,newSeveranceAmounts}=sandbox.api;
const d=(y,m,day)=>new Date(y,m-1,day,12);
const close=(actual,expected,epsilon=1e-12)=>assert.ok(Math.abs(actual-expected)<epsilon,`${actual} != ${expected}`);

const cases=[];
function test(name,fn){
  try{fn();cases.push({name,ok:true})}
  catch(error){cases.push({name,ok:false,error:error.message})}
}

test('官方案例：8年3個月29日、平均工資74947，新制資遣費312176',()=>{
  const start=d(2018,7,3),end=d(2026,10,31),duration=diffYmd(start,end),part=newBasis(start,end);
  assert.deepEqual({...duration},{years:8,months:3,days:29,totalDays:3043});
  close(part.basis,8+(3+29/30)/12);
  const units=part.basis*.5,amounts=newSeveranceAmounts(74947,units,0);
  close(units,4.165277777777778);
  assert.equal(amounts.total,312176);
});

test('剛好滿1年',()=>{
  const part=newBasis(d(2024,1,1),d(2024,12,31));
  assert.deepEqual({...part.duration},{years:1,months:0,days:0,totalDays:366});
  close(part.basis*.5,.5);
});

test('未滿1年',()=>{
  const part=newBasis(d(2024,1,1),d(2024,6,30));
  assert.deepEqual({...part.duration},{years:0,months:6,days:0,totalDays:182});
  close(part.basis*.5,.25);
});

test('有年＋月＋日',()=>{
  const part=newBasis(d(2022,3,15),d(2025,8,19));
  assert.deepEqual({...part.duration},{years:3,months:5,days:5,totalDays:1254});
  close(part.basis,3+(5+5/30)/12);
});

test('剩餘日數接近30日',()=>{
  const part=newBasis(d(2024,1,1),d(2024,1,30));
  assert.deepEqual({...part.duration},{years:0,months:0,days:30,totalDays:30});
  close(part.basis,1/12);
});

test('跨閏年',()=>{
  const part=newBasis(d(2024,2,29),d(2025,2,28));
  assert.deepEqual({...part.duration},{years:1,months:0,days:0,totalDays:366});
  close(part.basis*.5,.5);
});

test('月底日期：1/31、2/28、2/29、3/31',()=>{
  assert.deepEqual({...diffYmd(d(2023,1,31),d(2023,2,28))},{years:0,months:0,days:29,totalDays:29});
  assert.deepEqual({...diffYmd(d(2024,1,31),d(2024,2,29))},{years:0,months:0,days:30,totalDays:30});
  assert.deepEqual({...diffYmd(d(2024,2,29),d(2024,3,31))},{years:0,months:1,days:3,totalDays:32});
  assert.deepEqual({...diffYmd(d(2024,3,31),d(2024,4,30))},{years:0,months:1,days:0,totalDays:31});
});

test('新舊制混合：舊制基數與舊制金額算法不變',()=>{
  const start=d(2004,1,1),transition=d(2005,7,1),end=d(2006,6,30),monthly=74946.25;
  const oldPart=oldBasis(start,new Date(transition.getFullYear(),transition.getMonth(),transition.getDate()-1,12));
  const newPart=newBasis(transition,end);
  const oldUnits=oldPart.basis,newUnits=newPart.basis*.5;
  const amounts=newSeveranceAmounts(monthly,newUnits,oldUnits);
  close(amounts.oldRaw,monthly*oldUnits);
  assert.equal(Math.ceil(monthly*oldUnits),112420);
  assert.equal(amounts.total,149893);
});

test('新制計算使用畫面顯示的整數平均工資，且不提前四捨五入基數',()=>{
  const basis=newBasis(d(2018,7,3),d(2026,10,31)).basis*.5;
  const amounts=newSeveranceAmounts(74946.6,basis,0);
  assert.equal(amounts.newWage,74947);
  close(amounts.newRaw,74947*basis);
  assert.equal(amounts.total,312176);
});

test('結果畫面公式與實際計算共用相同的新制工資及基數',()=>{
  assert.match(source,/money\.format\(c\.severanceAmounts\.newWage\).*c\.newUnits\.toFixed\(6\)/);
  assert.match(source,/severanceFormula.*money\.format\(c\.severance\)/s);
  assert.doesNotMatch(source,/money\.format\(c\.monthly\).*c\.newUnits\.toFixed\(6\)/);
});

const failed=cases.filter(x=>!x.ok);
for(const item of cases)console.log(`${item.ok?'PASS':'FAIL'} - ${item.name}${item.error?`: ${item.error}`:''}`);
console.log(`${failed.length?'FAIL':'PASS'} ${cases.length-failed.length}/${cases.length}`);
if(failed.length)process.exitCode=1;
