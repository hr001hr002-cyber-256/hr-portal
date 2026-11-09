const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');
function getFunction(name){
  const start=source.indexOf(`function ${name}(`),brace=source.indexOf('{',start);
  assert.ok(start>=0,`missing ${name}`);
  let depth=0;for(let i=brace;i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&--depth===0)return source.slice(start,i+1)}
  throw Error(`unterminated ${name}`);
}
const ctx={Math,Date,BigInt,Number,String};vm.createContext(ctx);
vm.runInContext(`${getFunction('roundedDailyWage')}\n${getFunction('newSeveranceAmounts')}\nthis.api={roundedDailyWage,newSeveranceAmounts}`,ctx);
const {roundedDailyWage,newSeveranceAmounts}=ctx.api;
const cases=[[38000,19,24067,38000],[39000,19,24700,39000],[38001,19,24068,38002],[35000,10,11667,35001],[42000,25,35000,42000],[38000,29,36734,38001]];
for(const [salary,days,net,expected] of cases){
  const old=net/days*30,daily=roundedDailyWage(net,days),monthly=daily*30,units=days/720;
  assert.equal(Math.round(monthly),expected);
  const before=newSeveranceAmounts(old,units,0).total,after=newSeveranceAmounts(monthly,units,0).total;
  assert.equal(after,before,`資遣費異常變動: ${salary}/${days}`);
  console.log(`PASS 月薪 ${salary} 日數 ${days} 工資 ${net} 月平均 ${Math.round(old)} → ${Math.round(monthly)} 資遣費 ${before} → ${after}`);
}
for(const [amount,days,expected] of [[1.005,1,1.01],[1.0049,1,1],[2.675,1,2.68],[24067,19,1266.68],[24068,19,1266.74],[1e-7,1,0]])assert.equal(roundedDailyWage(amount,days),expected);
assert.equal(roundedDailyWage(38000+1200-2000-237-125,19),1938.84);
assert.match(source,/const daily=fullSix\?totalNet\/tenure\.totalDays:roundedDailyWage\(totalNet,tenure\.totalDays\)/);
assert.match(source,/const monthly=\+fd\.averageWageOverride\|\|\(fullSix\?totalNet\/6:daily\*30\)/);
assert.match(source,/money\.format\(c\.totalNet\).*tenure\.totalDays/);
assert.match(source,/Math\.round\(c\.totalNet\)\.toLocaleString\(\).*tenure\.totalDays/);
const oldPart=newSeveranceAmounts(38000.4,0,1.5);assert.equal(oldPart.total,57001);
console.log('PASS 精度、獎金扣款、六個月分支、手動指定及舊制邏輯');
