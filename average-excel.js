(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./vendor/jszip.min.js'));
  else root.HrAverageExcel=factory(root.JSZip);
})(typeof globalThis!=='undefined'?globalThis:this,function(JSZip){
  'use strict';

  const MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const xml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
  const safeName=value=>String(value??'').trim().replace(/[\\/:*?"<>|]/g,'-');
  const textCell=(address,value,style=1)=>`<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  const numberCell=(address,value,style=6)=>`<c r="${address}" s="${style}"><v>${Number.isFinite(Number(value))?Number(value):0}</v></c>`;
  const formulaCell=(address,formula,cachedValue,style=6)=>`<c r="${address}" s="${style}"><f>${xml(formula)}</f><v>${Number.isFinite(Number(cachedValue))?Number(cachedValue):0}</v></c>`;
  const row=(index,cells,height=22)=>`<row r="${index}" ht="${height}" customHeight="1">${cells.join('')}</row>`;
  const columnsBetween=(start,end)=>Array.from({length:end.charCodeAt(0)-start.charCodeAt(0)+1},(_,index)=>String.fromCharCode(start.charCodeAt(0)+index));
  const mergedTextCells=(start,end,index,value,style=1)=>columnsBetween(start,end).map((column,offset)=>textCell(`${column}${index}`,offset?'':value,style));
  const mergedNumberCells=(start,end,index,value,style=6)=>columnsBetween(start,end).map((column,offset)=>offset?textCell(`${column}${index}`,'',style):numberCell(`${column}${index}`,value,style));

  function buildSheet(model){
    const wages=Array.isArray(model.wages)?model.wages:[];
    const rows=[];
    const merges=['A2:H2','A3:H3','A5:H5','B6:D6','F6:H6','B7:D7','F7:H7','B8:D8','F8:H8','B9:D9','F9:H9'];
    rows.push(row(1,[],10));
    rows.push(row(2,mergedTextCells('A','H',2,model.companyName,14),24));
    rows.push(row(3,mergedTextCells('A','H',3,'平 均 工 資 計 算 明 細',15),30));
    rows.push(row(4,[],10));
    rows.push(row(5,mergedTextCells('A','H',5,'員工基本資料',4),23));
    rows.push(row(6,[textCell('A6','員工姓名',2),...mergedTextCells('B','D',6,model.employeeName),textCell('E6','計算類型',2),...mergedTextCells('F','H',6,model.calculationType,12)]));
    rows.push(row(7,[textCell('A7','到職日',2),...mergedTextCells('B','D',7,model.startDate),textCell('E7','離職日',2),...mergedTextCells('F','H',7,model.endDate,12)]));
    rows.push(row(8,[textCell('A8','總年資',2),...mergedTextCells('B','D',8,model.tenureText),textCell('E8','部門／職稱',2),...mergedTextCells('F','H',8,model.departmentTitle,12)]));
    rows.push(row(9,[textCell('A9','計算期間',2),...mergedTextCells('B','D',9,model.calculationPeriod),textCell('E9','計算日數',2),...mergedNumberCells('F','H',9,model.tenureDays,12)]));
    rows.push(row(10,[],10));
    rows.push(row(11,['年／月','原工資','獎金','未足月扣款','事假扣款','遲到扣款','其他排除','應領工資'].map((value,index)=>textCell(`${String.fromCharCode(65+index)}11`,value,5)),25));
    let current=12;
    const firstWageRow=current;
    for(const wage of wages){
      rows.push(row(current,[
        textCell(`A${current}`,wage.period,12),numberCell(`B${current}`,wage.original),numberCell(`C${current}`,wage.bonus),numberCell(`D${current}`,wage.partialDeduction),numberCell(`E${current}`,wage.leaveDeduction),numberCell(`F${current}`,wage.lateDeduction),numberCell(`G${current}`,wage.otherExclude),formulaCell(`H${current}`,`SUM(B${current}:C${current})-SUM(D${current}:G${current})`,wage.net)
      ]));
      current++;
    }
    const lastWageRow=current-1;
    const totalRow=current++;
    merges.push(`A${totalRow}:G${totalRow}`);
    rows.push(row(totalRow,[...mergedTextCells('A','G',totalRow,'總應領工資',7),wages.length?formulaCell(`H${totalRow}`,`SUM(H${firstWageRow}:H${lastWageRow})`,model.totalNet,8):numberCell(`H${totalRow}`,model.totalNet,8)],24));
    rows.push(row(current++,[],9));
    const formulaRow=current++;
    merges.push(`A${formulaRow}:F${formulaRow}`);
    merges.push(`G${formulaRow}:H${formulaRow}`);
    rows.push(row(formulaRow,[...mergedTextCells('A','F',formulaRow,'平均工資算式',9),...mergedTextCells('G','H',formulaRow,model.fullSix?'總應領工資 ÷ 6個月':'總應領工資 ÷ 計算日數 × 30',13)],34));
    const averageRow=current++;
    merges.push(`A${averageRow}:G${averageRow}`);
    const averageFormula=model.fullSix?`H${totalRow}/6`:`H${totalRow}/F9*30`;
    rows.push(row(averageRow,[...mergedTextCells('A','G',averageRow,'平均工資',9),formulaCell(`H${averageRow}`,averageFormula,model.averageWage,10)],25));
    const severanceRow=current++;
    merges.push(`A${severanceRow}:G${severanceRow}`);
    rows.push(row(severanceRow,[...mergedTextCells('A','G',severanceRow,'資遣費總金額',9),numberCell(`H${severanceRow}`,model.severance,10)],25));
    if(Number(model.noticePay)>0){
      const finalPaymentRow=current++;
      merges.push(`A${finalPaymentRow}:G${finalPaymentRow}`);
      rows.push(row(finalPaymentRow,[...mergedTextCells('A','G',finalPaymentRow,'最終應支付金額',9),numberCell(`H${finalPaymentRow}`,Number(model.severance)+Number(model.noticePay),10)],28));
    }
    rows.push(row(current++,[],9));
    const noticeBand=current++;
    merges.push(`A${noticeBand}:H${noticeBand}`);
    rows.push(row(noticeBand,mergedTextCells('A','H',noticeBand,'預告工資說明',4),23));
    const summary=[
      ['法定預告天數',`${model.noticeDays} 日`,'預告日期',model.noticeDate],
      ['最近六個月平均工資',model.averageWage,'最近一個月正常工資',model.latestNormalWage],
      ['預告工資採用基準',model.noticeBasis,'預告期間工資（另列）',model.noticePay]
    ];
    for(const item of summary){
      const r=current++;
      merges.push(`B${r}:D${r}`,`F${r}:H${r}`);
      const left=typeof item[1]==='number'?mergedNumberCells('B','D',r,item[1],6):mergedTextCells('B','D',r,item[1]);
      const right=typeof item[3]==='number'?mergedNumberCells('F','H',r,item[3],6):mergedTextCells('F','H',r,item[3]);
      rows.push(row(r,[textCell(`A${r}`,item[0],2),...left,textCell(`E${r}`,item[2],2),...right],26));
    }
    rows.push(row(current++,[],10));
    const approvalHead=current++;
    rows.push(row(approvalHead,[...mergedTextCells('A','B',approvalHead,'製表',11),...mergedTextCells('C','E',approvalHead,'審查',11),...mergedTextCells('F','H',approvalHead,'核准',11)],24));
    merges.push(`A${approvalHead}:B${approvalHead}`,`C${approvalHead}:E${approvalHead}`,`F${approvalHead}:H${approvalHead}`);
    const approvalBody=current++;
    rows.push(row(approvalBody,[...mergedTextCells('A','B',approvalBody,'',11),...mergedTextCells('C','E',approvalBody,'',11),...mergedTextCells('F','H',approvalBody,'',11)],52));
    merges.push(`A${approvalBody}:B${approvalBody}`,`C${approvalBody}:E${approvalBody}`,`F${approvalBody}:H${approvalBody}`);

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1" autoPageBreaks="0"/></sheetPr><dimension ref="A1:H${current-1}"/><sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols><col min="1" max="1" width="15" customWidth="1"/><col min="2" max="2" width="13" customWidth="1"/><col min="3" max="3" width="10" customWidth="1"/><col min="4" max="4" width="13" customWidth="1"/><col min="5" max="5" width="12" customWidth="1"/><col min="6" max="6" width="13" customWidth="1"/><col min="7" max="7" width="12" customWidth="1"/><col min="8" max="8" width="14" customWidth="1"/></cols><sheetData>${rows.join('')}</sheetData><mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells><printOptions horizontalCentered="1" verticalCentered="0" gridLines="0" headings="0"/><pageMargins left="0.35" right="0.35" top="0.35" bottom="0.35" header="0.15" footer="0.15"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="1" horizontalDpi="600" verticalDpi="600"/></worksheet>`;
  }

  function styles(){return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts><fonts count="5"><font><sz val="10"/><name val="Microsoft JhengHei"/></font><font><b/><sz val="10"/><name val="Microsoft JhengHei"/></font><font><b/><sz val="15"/><color rgb="FF294F43"/><name val="Microsoft JhengHei"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Microsoft JhengHei"/></font><font><b/><sz val="11"/><color rgb="FF294F43"/><name val="Microsoft JhengHei"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE9F0ED"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF294F43"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF5F7F6"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="5"><border/><border><left style="thin"><color rgb="FF465B52"/></left><right style="thin"><color rgb="FF465B52"/></right><top style="thin"><color rgb="FF465B52"/></top><bottom style="thin"><color rgb="FF465B52"/></bottom><diagonal/></border><border><left style="medium"><color rgb="FF294F43"/></left><right style="medium"><color rgb="FF294F43"/></right><top style="medium"><color rgb="FF294F43"/></top><bottom style="medium"><color rgb="FF294F43"/></bottom><diagonal/></border><border><left style="medium"><color rgb="FF294F43"/></left><right style="medium"><color rgb="FF294F43"/></right><top style="medium"><color rgb="FF294F43"/></top><bottom/><diagonal/></border><border><left style="medium"><color rgb="FF294F43"/></left><right style="medium"><color rgb="FF294F43"/></right><top/><bottom style="medium"><color rgb="FF294F43"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="16"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="2" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="2" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="164" fontId="1" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="2" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="1" fillId="2" borderId="2" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="2" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="4" fillId="2" borderId="3" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="4" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`}

  async function createWorkbook(model,options={}){
    if(!JSZip)throw new Error('Excel 元件未載入');
    const zip=new JSZip(),now=new Date().toISOString(),lastRow=24+(Array.isArray(model.wages)?model.wages.length:0)+(Number(model.noticePay)>0?1:0);
    zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
    zip.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
    zip.file('docProps/app.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>SOBER HR Tools</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>工作表</vt:lpstr></vt:variant><vt:variant><vt:i4>1</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>平均工資計算明細</vt:lpstr></vt:vector></TitlesOfParts></Properties>`);
    zip.file('docProps/core.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>平均工資計算明細</dc:title><dc:creator>SOBER HR Tools</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
    zip.file('xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews><sheets><sheet name="平均工資計算明細" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'平均工資計算明細'!$A$1:$H$${lastRow}</definedName></definedNames><calcPr calcId="191029" calcMode="auto"/></workbook>`);
    zip.file('xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    zip.file('xl/styles.xml',styles());
    zip.file('xl/worksheets/sheet1.xml',buildSheet(model));
    const type=options.type||(typeof Blob==='undefined'?'nodebuffer':'blob');
    return zip.generateAsync({type,mimeType:MIME,compression:'DEFLATE',compressionOptions:{level:6}});
  }

  function fileName(employeeName){return `${[safeName(employeeName),'平均工資計算明細'].filter(Boolean).join('-')}.xlsx`}
  return{createWorkbook,fileName,buildSheet};
});
