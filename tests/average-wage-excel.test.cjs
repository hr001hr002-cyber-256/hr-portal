"use strict";

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const JSZip=require('../vendor/jszip.min.js');
const AverageExcel=require('../average-excel.js');

const outputDir=path.resolve(__dirname,'..','..','tmp','average-wage-excel');
const outputPath=path.join(outputDir,'王小明-平均工資計算明細.xlsx');
const wages=['115/10','115/09','115/08','115/07','115/06','115/05'].map(period=>({period,original:74947,bonus:0,partialDeduction:0,leaveDeduction:0,lateDeduction:0,otherExclude:0,net:74947}));
const model={companyName:'搜博科技股份有限公司',employeeName:'王小明',calculationType:'滿六個月',fullSix:true,startDate:'民國107年07月03日',endDate:'民國115年10月31日',tenureText:'3043日（8年3月29日）',tenureDays:3043,departmentTitle:'測試部門／測試職稱',calculationPeriod:'115/05 ～ 115/10',wages,totalNet:449682,averageWage:74947,severance:312176,noticeDays:30,noticeDate:'民國115年10月01日',latestNormalWage:74947,noticeBasis:'最近一個月正常工資：74,947 元',noticePay:74947};

(async()=>{
  fs.mkdirSync(outputDir,{recursive:true});
  const buffer=await AverageExcel.createWorkbook(model,{type:'nodebuffer'});
  fs.writeFileSync(outputPath,buffer);
  const zip=await JSZip.loadAsync(buffer),required=['[Content_Types].xml','_rels/.rels','xl/workbook.xml','xl/_rels/workbook.xml.rels','xl/styles.xml','xl/worksheets/sheet1.xml'];
  required.forEach(name=>assert.ok(zip.file(name),`缺少 ${name}`));
  const sheet=await zip.file('xl/worksheets/sheet1.xml').async('string');
  const workbook=await zip.file('xl/workbook.xml').async('string');
  assert.equal(AverageExcel.fileName('王小明'),'王小明-平均工資計算明細.xlsx');
  assert.equal(AverageExcel.fileName(''),'平均工資計算明細.xlsx');
  for(const text of ['王小明','民國107年07月03日','民國115年10月31日','3043日（8年3月29日）','115/05 ～ 115/10','總應領工資 ÷ 6個月'])assert.ok(sheet.includes(text),`找不到 ${text}`);
  for(const value of [449682,74947,312176])assert.match(sheet,new RegExp(`<v>${value}<\\/v>`),`找不到數值 ${value}`);
  assert.equal((sheet.match(/<row r="1[2-7]"/g)||[]).length,6,'工資資料列應為 6 列');
  assert.doesNotMatch(sheet,/undefined|null/);
  for(let row=12;row<=17;row++)assert.ok(sheet.includes(`<f>SUM(B${row}:C${row})-SUM(D${row}:G${row})</f>`),`H${row} 應使用應領工資公式`);
  assert.ok(sheet.includes('<f>SUM(H12:H17)</f>'),'總應領工資應使用 SUM 公式');
  assert.ok(sheet.includes('<f>H18/6</f>'),'平均工資應連動總額與六個月基準');
  const partialSheet=AverageExcel.buildSheet({...model,fullSix:false,wages:wages.slice(0,1),totalNet:74947,averageWage:74947*30/3043});
  assert.ok(partialSheet.includes('<f>H13/F9*30</f>'),'未滿六個月平均工資應連動總額與正式日數基準');
  assert.match(sheet,/<c r="H22" s="10"><v>312176<\/v><\/c>/,'資遣費必須維持固定正式結果');
  assert.doesNotMatch(sheet,/<c r="H22"[^>]*><f>/,'資遣費不得使用 Excel 公式');
  assert.ok(sheet.includes('<printOptions horizontalCentered="1" verticalCentered="0" gridLines="0" headings="0"/>'),'列印內容應水平置中且不列印格線／標題');
  assert.ok(sheet.includes('<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="1"'),'列印應為 A4 直式一頁寬 × 一頁高');
  assert.ok(sheet.includes('<pageMargins left="0.35" right="0.35" top="0.35" bottom="0.35"'),'列印頁邊距應接近 PDF');
  for(const address of ['B6','C6','D6','F6','G6','H6','A5','H5','A30','B30','C30','E30','F30','H30'])assert.match(sheet,new RegExp(`<c r="${address}"`),`${address} 合併範圍必須保留完整框線儲存格`);
  for(const address of ['A2','B2','C2','D2','E2','F2','G2','H2','A3','B3','C3','D3','E3','F3','G3','H3'])assert.match(sheet,new RegExp(`<c r="${address}" s="1[45]"`),`${address} 標題區應具備連續淺綠底色與外框`);
  assert.match(sheet,/<c r="H23" s="10"><v>387123<\/v><\/c>/,'最終應支付金額應直接使用匯出當下正式結果');
  assert.ok(workbook.includes('<definedName name="_xlnm.Print_Area" localSheetId="0">\'平均工資計算明細\'!$A$1:$H$31</definedName>'),'列印範圍應固定為單頁內容');
  assert.ok(buffer.length>5000,'XLSX 檔案大小異常');
  console.log(`PASS 25/25\nOUTPUT ${outputPath}`);
})().catch(error=>{console.error(error);process.exitCode=1});
