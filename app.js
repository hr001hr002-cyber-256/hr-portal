const form=document.querySelector('#severanceForm');
const wageRows=document.querySelector('#wageRows');
const results=document.querySelector('#results');
const money=new Intl.NumberFormat('zh-TW',{style:'currency',currency:'TWD',maximumFractionDigits:0});
let latest=null;

const COMPANIES={
  sobo:{name:'搜博科技股份有限公司',id:'29035099',representative:'陳智國',address:'新北市中和區中正路866號17樓',phone:'02-2208-2928',insuranceNo:'05722749S'},
  soshow:{name:'搜秀網路行銷有限公司',id:'53484399',representative:'臺芳蘭',address:'台中市北屯區崇德路二段256號14樓A1',phone:'04-2242-5696',insuranceNo:'05800447X'},
  socreative:{name:'搜創網路行銷有限公司',id:'91105931',representative:'陳智國',address:'高雄市苓雅區新光路38號20樓之5',phone:'07-216-1585',insuranceNo:'15061412X'},
  ideas:{name:'創思影像有限公司',id:'83116175',representative:'陳智國',address:'台南市中西區府前路二段281號3樓之2',phone:'06-298-1689',insuranceNo:'15040858G'},
  maya:{name:'馬雅科技有限公司',id:'96784466',representative:'陳智國',address:'新北市中和區中正路866-1號17樓',phone:'02-2208-2928',insuranceNo:'15151925S'}
};
const WORKPLACES={
  taipei:{label:'新北市',address:'新北市中和區中正路866號17樓'},
  taichung:{label:'台中市',address:'台中市北屯區崇德路二段256號14樓A1'},
  kaohsiung:{label:'高雄市',address:'高雄市苓雅區新光路38號20樓之5'},
  tainan:{label:'台南市',address:'台南市中西區府前路二段281號3樓之2'}
};

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const xmlEsc=s=>String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const date=v=>v?new Date(`${v}T12:00:00`):null;
const plus=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const days=(a,b)=>Math.max(0,Math.round((b-a)/86400000));
const ymd=v=>{const d=typeof v==='string'?date(v):v;return d?`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`:'—'};
const roc=v=>{const d=typeof v==='string'?date(v):v;return d?`${d.getFullYear()-1911}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`:''};
const rocLong=v=>{const d=typeof v==='string'?date(v):v;return d?`民國 ${d.getFullYear()-1911} 年 ${String(d.getMonth()+1).padStart(2,'0')} 月 ${String(d.getDate()).padStart(2,'0')} 日`:''};
function diffYmd(start,end){const stop=plus(end,1);let y=stop.getFullYear()-start.getFullYear(),cur=new Date(start);cur.setFullYear(cur.getFullYear()+y);if(cur>stop){y--;cur=new Date(start);cur.setFullYear(cur.getFullYear()+y)}let m=0;while(m<11){const n=new Date(cur);n.setMonth(n.getMonth()+1);if(n>stop)break;cur=n;m++}return{years:y,months:m,days:days(cur,stop),totalDays:days(start,end)+1}}
const duration=d=>`${d.years}年${d.months}月${d.days}日`;

function netWage(row){const original=+row.querySelector('.original').value||0;const partial=Math.floor(+row.querySelector('.partialDays').value||0);const leaveHours=Math.max(0,+row.querySelector('.leaveHours').value||0);const late=Math.floor(+row.querySelector('.lateMinutes').value||0);const other=+row.querySelector('.otherExclude').value||0;return Math.max(0,original-Math.floor(original/30*partial)-Math.floor(original/30/8*leaveHours)-Math.floor(original/30/8/60*late)-other)}
function periodValue(value){const m=String(value||'').match(/(\d{3,4})\D+(\d{1,2})/);if(!m)return-1;const year=+m[1]<1911?+m[1]+1911:+m[1];return year*12+(+m[2]-1)}
function syncLastMonthlySalary(){const rows=[...wageRows.children].filter(r=>+r.querySelector('.original').value>0).sort((a,b)=>periodValue(b.querySelector('.period').value)-periodValue(a.querySelector('.period').value));form.elements.lastMonthlySalary.value=rows.length?+rows[0].querySelector('.original').value:''}
function refreshNet(row){row.querySelector('.net-wage').value=Math.round(netWage(row));syncLastMonthlySalary()}
function addWageRow(label='',vals={}){
  const row=document.createElement('div');row.className='wage-row';
  const field=(name,title,attrs='',value='')=>`<label class="wage-field"><span>${title}</span><input class="${name}" aria-label="${title}" ${attrs} value="${value}"></label>`;
  row.innerHTML=`${field('period','年／月','placeholder="例如 115/07"',esc(label))}${field('original','原工資','type="number" min="0"',vals.original||'')}${field('partialDays','未足月天數','type="number" min="0" step="1"',vals.partialDays||'')}${field('leaveHours','事假時數','type="number" min="0" step="0.5"',vals.leaveHours??(vals.leaveDays?vals.leaveDays*8:''))}${field('lateMinutes','遲到分鐘','type="number" min="0"',vals.lateMinutes||'')}${field('otherExclude','其他排除','type="number" min="0"',vals.otherExclude||'')}${field('net-wage','應領工資','readonly','')}<button type="button" class="remove" title="刪除這筆薪資" aria-label="刪除這筆薪資">×</button>`;
  row.querySelectorAll('input:not(.net-wage)').forEach(x=>x.addEventListener('input',()=>refreshNet(row)));
  row.querySelector('.remove').onclick=()=>{row.remove();syncLastMonthlySalary()};wageRows.append(row);refreshNet(row);
}
function recentMonths(){wageRows.innerHTML='';const end=date(form.elements.endDate.value)||new Date();const cursor=new Date(end.getFullYear(),end.getMonth(),1);for(let i=0;i<6;i++){const d=new Date(cursor);d.setMonth(d.getMonth()-i);addWageRow(`${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}`)}}
document.querySelector('#addWageRow').onclick=()=>addWageRow();
document.querySelector('#fillSixMonths').onclick=recentMonths;
form.elements.companyKey.onchange=e=>{const c=COMPANIES[e.target.value]||{};for(const [field,key] of [['companyId','id'],['representative','representative'],['companyPhone','phone'],['insuranceNo','insuranceNo'],['companyAddress','address']])form.elements[field].value=c[key]||''};
form.elements.workplaceRegion.onchange=e=>form.elements.workplace.value=WORKPLACES[e.target.value]?.address||'';
form.elements.pensionSystem.onchange=e=>document.querySelector('#transitionField').hidden=e.target.value!=='mixed';
function setDepartureFlow(){
  const voluntary=form.elements.departureType.value==='voluntary';
  for(const id of ['terminationSection','wageSection']){
    const section=document.querySelector(`#${id}`);section.hidden=voluntary;
    section.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=voluntary);
  }
  document.querySelector('#submitForm').textContent=voluntary?'開啟文件產生器':'開始計算';
  results.hidden=true;latest=null;
}
form.elements.departureType.onchange=setDepartureFlow;

function readWages(){return[...wageRows.children].map(r=>{const original=+r.querySelector('.original').value||0,partialDays=Math.floor(+r.querySelector('.partialDays').value||0),leaveHours=Math.max(0,+r.querySelector('.leaveHours').value||0),lateMinutes=Math.floor(+r.querySelector('.lateMinutes').value||0),otherExclude=+r.querySelector('.otherExclude').value||0;return{period:r.querySelector('.period').value.trim(),original,partialDays,leaveHours,lateMinutes,otherExclude,partialDeduction:Math.floor(original/30*partialDays),leaveDeduction:Math.floor(original/30/8*leaveHours),lateDeduction:Math.floor(original/30/8/60*lateMinutes),net:netWage(r)}}).filter(x=>x.original||x.period)}
function newBasis(s,e){if(s>e)return{duration:{years:0,months:0,days:0,totalDays:0},basis:0};const d=diffYmd(s,e);return{duration:d,basis:d.years+(d.months+d.days/30)/12}}
function oldBasis(s,e){if(s>e)return{duration:{years:0,months:0,days:0,totalDays:0},basis:0};const d=diffYmd(s,e);return{duration:d,basis:d.years+Math.ceil(d.months+(d.days?1:0))/12}}
function tenureParts(s,e,system,transition){if(system==='new')return{newPart:newBasis(s,e),oldPart:oldBasis(e,plus(e,-1))};if(system==='old')return{newPart:newBasis(e,plus(e,-1)),oldPart:oldBasis(s,e)};if(!transition)throw Error('請填寫轉換新制日期');return{oldPart:oldBasis(s,plus(transition,-1)),newPart:newBasis(transition,e)}}
function calculate(){
  const fd=Object.fromEntries(new FormData(form)),start=date(fd.startDate),end=date(fd.endDate);
  if(!start||!end||end<start)throw Error('請確認到職日與離職日');
  const tenure=diffYmd(start,end),wages=readWages();if(!wages.length)throw Error('請輸入工資資料');
  const sortedWages=[...wages].sort((a,b)=>periodValue(b.period)-periodValue(a.period)),averageWages=sortedWages.slice(0,6);
  const totalNet=averageWages.reduce((n,x)=>n+x.net,0);if(totalNet<=0)throw Error('總應領工資必須大於 0');
  const fullSix=tenure.totalDays>=180&&averageWages.length>=6;
  const daily=totalNet/tenure.totalDays;
  const monthly=+fd.averageWageOverride||(fullSix?totalNet/6:daily*30);
  const noticeApplies=/第11條|第13條/.test(fd.legalBasis);
  const completedMonths=tenure.years*12+tenure.months+(tenure.days?tenure.days/31:0);
  const noticeDays=noticeApplies?(completedMonths>=36?30:completedMonths>=12?20:completedMonths>=3?10:0):0;
  const latestNormalWage=sortedWages[0]?.original||0,noticeMonthly=Math.max(monthly,latestNormalWage),noticeDaily=noticeMonthly/30;
  const latestNotice=noticeDays?plus(end,-noticeDays):null,actual=date(fd.actualNoticeDate),displayNoticeDate=actual||latestNotice,actualDays=actual?days(actual,end):0,shortNotice=Math.max(0,noticeDays-actualDays),noticePay=shortNotice*noticeDaily;
  const parts=tenureParts(start,end,fd.pensionSystem,date(fd.transitionDate)),newUnits=Math.min(parts.newPart.basis*.5,6),oldUnits=parts.oldPart.basis,severanceRaw=monthly*(newUnits+oldUnits),severance=Math.ceil(severanceRaw);
  return{fd,start,end,tenure,wages,averageWages,totalNet,fullSix,daily,monthly,latestNormalWage,noticeMonthly,noticeDays,latestNotice,displayNoticeDate,actualDays,shortNotice,noticeDaily,noticePay,parts,newUnits,oldUnits,severance};
}
function voluntaryContext(){const fd=Object.fromEntries(new FormData(form)),start=date(fd.startDate),end=date(fd.endDate);if(!start||!end||end<start)throw Error('請確認到職日與離職日');return{fd,start,end,tenure:diffYmd(start,end)}}
function setResultMode(voluntary){
  document.querySelector('#resultsTitle').textContent=voluntary?'離職證明文件產生器':'計算結果';
  document.querySelector('#resultMetrics').hidden=voluntary;
  document.querySelector('#calculationSheet').hidden=voluntary;
  document.querySelector('#documentsHint').textContent=voluntary?'資料已備妥，可直接預覽、列印或另存離職證明 PDF。':'依公司表單套入資料，再列印或另存為 PDF。';
  document.querySelectorAll('[data-involuntary]').forEach(button=>button.hidden=voluntary);
}
function renderVoluntary(c){latest=c;setResultMode(true);results.hidden=false;results.scrollIntoView({behavior:'smooth'})}
function render(c){
  latest=c;setResultMode(false);results.hidden=false;
  document.querySelector('#noticeDays').textContent=`${c.noticeDays} 天`;
  document.querySelector('#noticeDetail').textContent=c.noticeDays?(c.shortNotice?`實際預告 ${c.actualDays} 天，不足 ${c.shortNotice} 天`:'已足法定預告期'):'此法源不適用預告期，顯示 0 天';
  document.querySelector('#latestNotice').textContent=c.displayNoticeDate?ymd(c.displayNoticeDate):'無';
  document.querySelector('#averageMonthly').textContent=money.format(c.monthly);
  document.querySelector('#averageDetail').textContent=`最近 ${c.averageWages.length} 個月應領合計 ${money.format(c.totalNet)}；總年資 ${c.tenure.totalDays} 日`;
  document.querySelector('#severancePay').textContent=money.format(c.severance);
  document.querySelector('#severanceDetail').textContent=`新制 ${c.newUnits.toFixed(4)} 個基數；舊制 ${c.oldUnits.toFixed(4)} 個基數`;
  const noticeBasis=c.latestNormalWage>=c.monthly?'最近一個月正常工資':'最近六個月平均工資';
  document.querySelector('#calculationSheet').innerHTML=`<div class="calc-row"><span>總年資</span><b>離職日－到職日＋1＝${c.tenure.totalDays}日（${duration(c.tenure)}）</b></div><div class="calc-row"><span>最近六個月平均工資</span><b>${money.format(c.totalNet)} ${c.fullSix?'÷ 6個月':`÷ ${c.tenure.totalDays}日 × 30`}＝${money.format(c.monthly)}</b></div><div class="calc-row"><span>最近一個月正常工資</span><b>${money.format(c.latestNormalWage)}</b></div><div class="calc-row"><span>預告工資採用基準</span><b>${noticeBasis}（兩者取高）＝${money.format(c.noticeMonthly)}</b></div><div class="calc-row"><span>資遣費</span><b>${money.format(c.monthly)} × (${c.newUnits.toFixed(6)}＋${c.oldUnits.toFixed(6)})＝${money.format(c.severance)}</b></div><div class="calc-row"><span>預告期間工資（另列）</span><b>${money.format(c.noticeMonthly)} ÷ 30 × ${c.shortNotice}日＝${money.format(c.noticePay)}</b></div>${c.noticePay>0?`<div class="calc-row final-payment-row"><span>最終應支付金額</span><b>${money.format(c.severance)} ＋ ${money.format(c.noticePay)} ＝ ${money.format(c.severance+c.noticePay)}</b></div>`:''}`;
  results.scrollIntoView({behavior:'smooth'});
}
form.onsubmit=e=>{e.preventDefault();const msg=document.querySelector('#formMessage');msg.textContent='';if(!form.reportValidity())return;try{form.elements.departureType.value==='voluntary'?renderVoluntary(voluntaryContext()):render(calculate())}catch(err){msg.textContent=err.message}};
form.onreset=()=>setTimeout(()=>{wageRows.innerHTML='';addWageRow();results.hidden=true;latest=null;document.querySelector('#transitionField').hidden=true;setDepartureFlow()},0);

function setCell(xml,address,value){const doc=new DOMParser().parseFromString(xml,'application/xml'),ns=doc.documentElement.namespaceURI;let cell=[...doc.getElementsByTagNameNS(ns,'c')].find(x=>x.getAttribute('r')===address);if(!cell){const rowNum=address.match(/\d+/)[0];let row=[...doc.getElementsByTagNameNS(ns,'row')].find(x=>x.getAttribute('r')===rowNum);if(!row){row=doc.createElementNS(ns,'row');row.setAttribute('r',rowNum);doc.getElementsByTagNameNS(ns,'sheetData')[0].appendChild(row)}cell=doc.createElementNS(ns,'c');cell.setAttribute('r',address);row.appendChild(cell)}[...cell.children].forEach(x=>{if(['v','f','is'].includes(x.localName))x.remove()});cell.setAttribute('t','inlineStr');const is=doc.createElementNS(ns,'is'),t=doc.createElementNS(ns,'t');t.textContent=String(value??'');is.appendChild(t);cell.appendChild(is);return new XMLSerializer().serializeToString(doc)}
function saveBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function downloadExcel(c){
  try{
    const res=await fetch('templates/資遣通知書-現版.xlsx');if(!res.ok)throw Error('找不到 Excel 範本');const zip=await JSZip.loadAsync(await res.arrayBuffer());
    const company=COMPANIES[c.fd.companyKey];
    const common={'B1':`${company.name}\n員工資遣通知書`,'C3':c.fd.employeeName,'G3':c.fd.employeeId,'C4':c.fd.employeeAddress,'G4':c.fd.employeePhone,'C5':c.fd.department,'E5':c.fd.jobTitle,'G5':`${c.noticeDays}日`,'G6':c.displayNoticeDate?roc(c.displayNoticeDate):'無','C7':'□免職','G7':roc(c.fd.settlementDate),'C8':`■${c.fd.legalBasis}`,'G8':c.fd.reasonDetail,'C10':roc(c.start),'G10':String(c.tenure.totalDays),'C11':roc(c.end),'G11':String(Math.round(c.monthly)),'C12':String(Math.round(c.severance))};
    for(const path of ['xl/worksheets/sheet1.xml','xl/worksheets/sheet3.xml']){let xml=await zip.file(path).async('string');for(const [a,v] of Object.entries(common))xml=setCell(xml,a,v);zip.file(path,xml)}
    for(const path of ['xl/worksheets/sheet2.xml','xl/worksheets/sheet4.xml']){let xml=await zip.file(path).async('string');c.wages.slice(0,7).forEach((w,i)=>{const r=i+3,m=w.period.match(/(\d{3,4})\D+(\d{1,2})/);const values={B:m?m[1]:w.period,C:m?m[2]:'',D:Math.round(w.original),G:Math.round(w.original),H:-Math.round(w.partialDeduction),I:Math.round(w.lateMinutes),J:-Math.round(w.lateDeduction),K:w.leaveHours,L:-Math.round(w.leaveDeduction),M:-Math.round(w.otherExclude),N:Math.round(w.net)};for(const [col,val] of Object.entries(values))xml=setCell(xml,`${col}${r}`,val)});xml=setCell(xml,'N10',Math.round(c.totalNet));xml=setCell(xml,'N11',Math.round(c.monthly));zip.file(path,xml)}
    saveBlob(await zip.generateAsync({type:'blob'}),`${c.fd.employeeName}_資遣通知書.xlsx`);
  }catch(err){alert(`無法產生 Excel：${err.message}`)}
}
function legalCheckboxes(value){const opts=['勞動基準法第11條第1款－歇業或轉讓','勞動基準法第11條第2款－虧損或業務緊縮','勞動基準法第11條第3款－不可抗力暫停工作逾一個月','勞動基準法第11條第4款－業務性質變更，有減少勞工必要','勞動基準法第11條第5款－勞工對所擔任工作確不能勝任','勞動基準法第13條但書','勞動基準法第20條－事業單位改組或轉讓','勞動基準法第14條－勞工不經預告終止契約'];return opts.map(x=>`${x===value?'■':'□'}${x}`).join('\n')}
function tokenXml(value){return xmlEsc(value).replace(/\r?\n/g,'</w:t><w:br/><w:t xml:space="preserve">')}
async function downloadDocx(type,c){
  try{
    const isService=type==='service',file=isService?'離職證明單-範本.docx':'非自願離職證明書-範本.docx',res=await fetch(`templates/${file}`);if(!res.ok)throw Error('找不到 Word 範本');const zip=await JSZip.loadAsync(await res.arrayBuffer());let xml=await zip.file('word/document.xml').async('string');const company=COMPANIES[c.fd.companyKey],work=WORKPLACES[c.fd.workplaceRegion];
    const id=(c.fd.employeeId||'').padEnd(10,' '),tokens=isService?{
      EMPLOYEE_NAME:c.fd.employeeName,BIRTH_DATE:rocLong(c.fd.birthDate),GENDER:c.fd.gender==='female'?'女':'男',EMPLOYEE_ID:c.fd.employeeId,DEPARTMENT:c.fd.department,JOB_TITLE:c.fd.jobTitle,START_DATE:rocLong(c.start),END_DATE:rocLong(c.end),COMPANY_NAME:company.name,COMPANY_ID:company.id,WORKPLACE_ADDRESS:c.fd.workplace,REPRESENTATIVE:company.representative,COMPANY_PHONE:company.phone,ISSUE_DATE:rocLong(new Date())
    }:{
      EMPLOYEE_NAME:c.fd.employeeName,BIRTH_DATE:rocLong(c.fd.birthDate),GENDER_CHECK:c.fd.gender==='female'?'□男\n■女':'■男\n□女',EMPLOYEE_ADDRESS:c.fd.employeeAddress,EMPLOYEE_PHONE:c.fd.employeePhone,LAST_MONTH_WAGE:Math.round(+c.fd.lastMonthlySalary||c.wages.at(-1)?.net||0).toLocaleString('zh-TW'),END_DATE_SHORT:roc(c.end),WORKPLACE_REGION:work?.label||'',LEGAL_CHECKBOXES:legalCheckboxes(c.fd.legalBasis),INSURANCE_BLOCK:`投保單位名稱：${company.name}\n\n保險證字號：${company.insuranceNo}              投保單位電話：${company.phone}\n投保單位地址：${company.address}\n本表粗框內所記載資料內容，業經投保單位複核無誤，如有不實願負一切法律責任。\n投保單位聯絡人：            聯絡電話：${company.phone}`,...Object.fromEntries([...id].map((ch,i)=>[`ID_${i}`,ch]))
    };
    for(const [key,val] of Object.entries(tokens))xml=xml.split(`{{${key}}}`).join(tokenXml(val));zip.file('word/document.xml',xml);saveBlob(await zip.generateAsync({type:'blob'}),`${c.fd.employeeName}_${isService?'離職證明單':'非自願離職證明書'}.docx`);
  }catch(err){alert(`無法產生 Word：${err.message}`)}
}
function docTable(rows){return `<table class="doc-table">${rows.map(r=>`<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td><th>${esc(r[2]||'')}</th><td>${esc(r[3]||'')}</td></tr>`).join('')}</table>`}
function noticePdf(c){const company=COMPANIES[c.fd.companyKey];return `<div class="notice-document"><header class="notice-heading"><h1 class="doc-subtitle">${esc(company.name)}</h1><h2 class="doc-title">員 工 資 遣 通 知 書</h2></header><table class="doc-table paired-form"><colgroup><col class="label"><col class="value"><col class="label"><col class="value"></colgroup><tr class="section-row"><th colspan="4">一、員工資料</th></tr><tr><th>姓名</th><td>${esc(c.fd.employeeName)}</td><th>身分證字號</th><td>${esc(c.fd.employeeId)}</td></tr><tr><th>通訊地址</th><td>${esc(c.fd.employeeAddress)}</td><th>聯絡電話</th><td>${esc(c.fd.employeePhone)}</td></tr><tr><th>部門</th><td>${esc(c.fd.department)}</td><th>職稱</th><td>${esc(c.fd.jobTitle)}</td></tr><tr class="section-row"><th colspan="4">二、資遣資料</th></tr><tr><th>預告期</th><td>${c.noticeDays}日</td><th>實際預告日</th><td>${c.fd.actualNoticeDate?roc(c.fd.actualNoticeDate):'無'}</td></tr><tr><th>引用條款</th><td colspan="3">${esc(c.fd.legalBasis)}</td></tr><tr><th>理由</th><td colspan="3">${esc(c.fd.reasonDetail)}</td></tr><tr><th>到職日</th><td>${roc(c.start)}</td><th>總年資</th><td>${c.tenure.totalDays}日</td></tr><tr><th>離職日</th><td>${roc(c.end)}</td><th>薪資發放日</th><td>${roc(c.fd.settlementDate)}</td></tr><tr class="section-row"><th colspan="4">三、資遣費金額</th></tr><tr><th>平均工資</th><td class="right">${Math.round(c.monthly).toLocaleString()} 元</td><th>資遣費</th><td class="amount-box">${c.severance.toLocaleString()} 元</td></tr></table><div class="notice-statement"><b>說明：</b><br>離職同仁應遵守保密協定之相關規定，並且不挪用或損毀公司財物與資料、不持有、洩漏或使用因職務獲取之資料及秘密，若有違反公司將請求賠償並應負擔相關法律責任。</div>${c.noticePay>0?`<div class="final-payment notice-final-payment"><span>最終應支付金額</span><strong>${Math.round(c.severance+c.noticePay).toLocaleString()} 元</strong><small>資遣費 ${c.severance.toLocaleString()} 元 ＋ 預告期間工資 ${Math.round(c.noticePay).toLocaleString()} 元 ＝ ${Math.round(c.severance+c.noticePay).toLocaleString()} 元</small></div>`:'' }<div class="employee-signature"><span>員工簽名：</span><span class="signature-space"></span><span>日期：</span><span class="date-space"></span></div></div>`}
function averagePdf(c){
  const company=COMPANIES[c.fd.companyKey],noticeBasis=c.latestNormalWage>=c.monthly?'最近一個月正常工資':'最近六個月平均工資';
  const rows=c.wages.map(w=>`<tr><td>${esc(w.period)}</td><td class="right">${Math.round(w.original).toLocaleString()}</td><td class="right">${Math.round(w.partialDeduction).toLocaleString()}</td><td class="right">${Math.round(w.leaveDeduction).toLocaleString()}</td><td class="right">${Math.round(w.lateDeduction).toLocaleString()}</td><td class="right">${Math.round(w.otherExclude).toLocaleString()}</td><td class="right">${Math.round(w.net).toLocaleString()}</td></tr>`).join('');
  return `<div class="average-document"><header class="average-heading"><h1 class="doc-subtitle">${esc(company.name)}</h1><h2 class="doc-title">平 均 工 資 計 算 明 細</h2></header>${docTable([['員工姓名',c.fd.employeeName,'計算類型',c.fullSix?'滿六個月':'未滿六個月'],['到職日',roc(c.start),'離職日',roc(c.end)],['總年資',`${c.tenure.totalDays}日`,'部門／職稱',`${c.fd.department}／${c.fd.jobTitle}`]])}<table class="doc-table wage-detail average-wages"><tr><th>年／月</th><th>原工資</th><th>未足月扣款</th><th>事假扣款</th><th>遲到扣款</th><th>其他排除</th><th>應領工資</th></tr>${rows}<tr><th colspan="6">總應領工資</th><td class="right">${Math.round(c.totalNet).toLocaleString()}</td></tr></table><div class="formula-box average-formula"><b>平均工資算式</b><br>${c.fullSix?`${Math.round(c.totalNet).toLocaleString()} ÷ 6個月`:`${Math.round(c.totalNet).toLocaleString()} ÷ ${c.tenure.totalDays}日 × 30`} ＝ ${Math.round(c.monthly).toLocaleString()} 元</div><div class="severance-total"><span>資遣費總金額</span><strong>${c.severance.toLocaleString()} 元</strong></div>${c.noticePay>0?`<div class="final-payment"><span>最終應支付金額</span><strong>${Math.round(c.severance+c.noticePay).toLocaleString()} 元</strong><small>資遣費 ${c.severance.toLocaleString()} 元 ＋ 預告期間工資 ${Math.round(c.noticePay).toLocaleString()} 元</small></div>`:'' }<section class="notice-summary"><h3>預告工資說明</h3><dl><div><dt>法定預告天數</dt><dd>${c.noticeDays} 日</dd></div><div><dt>預告日期</dt><dd>${c.displayNoticeDate?roc(c.displayNoticeDate):'無'}</dd></div><div><dt>最近六個月平均工資</dt><dd>${Math.round(c.monthly).toLocaleString()} 元</dd></div><div><dt>最近一個月正常工資</dt><dd>${Math.round(c.latestNormalWage).toLocaleString()} 元</dd></div><div><dt>預告工資採用基準</dt><dd>${noticeBasis}：${Math.round(c.noticeMonthly).toLocaleString()} 元</dd></div><div><dt>預告期間工資（另列）</dt><dd>${Math.round(c.noticeMonthly).toLocaleString()} ÷ 30 × ${c.shortNotice} 日 ＝ ${Math.round(c.noticePay).toLocaleString()} 元</dd></div></dl></section><table class="doc-table approval-table approval-three"><tr><th>製表</th><th>審查</th><th>核准</th></tr><tr><td></td><td></td><td></td></tr></table></div>`;
}
function servicePdf(c){const company=COMPANIES[c.fd.companyKey];return `<div class="service-document"><header class="service-heading"><h1>離 職 證 明 單</h1><div class="service-title-rule"><span></span><i></i><span></span></div></header><section class="service-section employee-section"><h2>員工基本資料</h2><table class="doc-table service-employee-table"><colgroup><col class="service-label"><col class="service-value"><col class="service-label"><col class="service-value"></colgroup><tr><th>姓名</th><td>${esc(c.fd.employeeName)}</td><th>出生年月日</th><td>${rocLong(c.fd.birthDate)}</td></tr><tr><th>性別</th><td>${c.fd.gender==='female'?'女':'男'}</td><th>身分證字號</th><td>${esc(c.fd.employeeId)}</td></tr><tr><th>服務部門</th><td>${esc(c.fd.department)}</td><th>職稱</th><td>${esc(c.fd.jobTitle)}</td></tr><tr><th>到職日期</th><td>${rocLong(c.start)}</td><th>離職日期</th><td>${rocLong(c.end)}</td></tr></table></section><div class="service-statement"><span></span><b>上列各項確實無訛，特此證明</b><span></span></div><section class="service-section company-section"><h2>公司資訊</h2><div class="company-info-layout"><div class="company-details"><p><strong>公司名稱：</strong>${esc(company.name)}</p><p><strong>營利事業登記證字號：</strong>${esc(company.id)}</p><p><strong>地址：</strong>${esc(c.fd.workplace)}</p><p><strong>負責人：</strong>${esc(company.representative)}</p><p><strong>電話：</strong>${esc(company.phone)}</p></div><div class="company-seals"><div><span>公司章</span><i></i></div><div><span>負責人簽章</span><i></i></div></div></div></section><div class="service-issue-date">${rocLong(new Date())}</div></div>`}
function involuntaryPdf(c){const company=COMPANIES[c.fd.companyKey],work=WORKPLACES[c.fd.workplaceRegion];return `<h1 class="doc-title">非 自 願 離 職 證 明 書</h1><p class="doc-note">本證明書依就業保險相關規定使用，內容請於送出前再次核對。</p>${docTable([['姓名',c.fd.employeeName,'出生日期',rocLong(c.fd.birthDate)],['性別',c.fd.gender==='female'?'□男　■女':'■男　□女','身分證號碼',c.fd.employeeId],['住址',c.fd.employeeAddress,'電話',c.fd.employeePhone],['離職當月工資',Math.round(+c.fd.lastMonthlySalary||c.wages.at(-1)?.net||0).toLocaleString(),'離職日',roc(c.end)],['實際工作地',work?.label||'','職稱',c.fd.jobTitle]])}<table class="doc-table"><tr><th>離職原因<br>（僅可勾選一項）</th><td class="checkboxes">${esc(legalCheckboxes(c.fd.legalBasis))}<br>事實說明：${esc(c.fd.reasonDetail)}</td></tr><tr><th>投保單位證明欄</th><td>投保單位名稱：${esc(company.name)}<br>保險證字號：${esc(company.insuranceNo)}　投保單位電話：${esc(company.phone)}<br>投保單位地址：${esc(company.address)}<br><br>本表所記載資料內容，業經投保單位複核無誤。</td></tr><tr><th>投保單位蓋章</th><td style="height:80px"></td></tr></table>`}
let previewZoomed=false;
function fitDocumentPreview(){const preview=document.querySelector('#documentPreview'),dialog=document.querySelector('#documentDialog');if(!dialog.open)return;preview.style.setProperty('--preview-scale','1');const available=Math.max(280,dialog.clientWidth-24),paperWidth=preview.getBoundingClientRect().width,fit=Math.min(1,available/paperWidth),scale=previewZoomed&&innerWidth<=760?Math.min(1,Math.max(.72,fit)):fit;preview.style.setProperty('--preview-scale',String(scale));document.querySelector('#togglePreviewZoom').textContent=previewZoomed?'符合寬度':'放大閱讀';dialog.classList.toggle('preview-zoomed',previewZoomed)}
document.querySelectorAll('[data-doc]').forEach(b=>b.onclick=()=>{if(!latest)return;previewZoomed=false;const type=b.dataset.doc,titles={notice:'資遣通知書',average:'平均工資計算明細',service:'離職證明單',involuntary:'非自願離職證明書'};document.querySelector('#dialogTitle').textContent=`${titles[type]}－列印／另存 PDF`;document.querySelector('#documentPreview').innerHTML=type==='notice'?noticePdf(latest):type==='average'?averagePdf(latest):type==='service'?servicePdf(latest):involuntaryPdf(latest);document.querySelector('#documentDialog').showModal();requestAnimationFrame(fitDocumentPreview)});
document.querySelector('#togglePreviewZoom').onclick=()=>{previewZoomed=!previewZoomed;fitDocumentPreview()};
window.addEventListener('resize',fitDocumentPreview);
document.querySelector('#closeDialog').onclick=()=>document.querySelector('#documentDialog').close();
document.querySelector('#printDocument').onclick=()=>window.print();
addWageRow();
