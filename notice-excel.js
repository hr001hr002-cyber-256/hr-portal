(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./vendor/jszip.min.js'));
  else root.HrNoticeExcel=factory(root.JSZip);
})(typeof globalThis!=='undefined'?globalThis:this,function(JSZip){
  'use strict';

  const MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const xml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
  const safeName=value=>String(value??'').trim().replace(/[\\/:*?"<>|]/g,'-');
  const textCell=(address,value,style=1)=>`<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  const numberCell=(address,value,style=5)=>`<c r="${address}" s="${style}"><v>${Number.isFinite(Number(value))?Number(value):0}</v></c>`;
  const formulaCell=(address,formula,cachedValue,style=7)=>`<c r="${address}" s="${style}"><f>${xml(formula)}</f><v>${Number.isFinite(Number(cachedValue))?Number(cachedValue):0}</v></c>`;
  const row=(index,cells,height=24)=>`<row r="${index}" ht="${height}" customHeight="1">${cells.join('')}</row>`;
  const columnsBetween=(start,end)=>Array.from({length:end.charCodeAt(0)-start.charCodeAt(0)+1},(_,index)=>String.fromCharCode(start.charCodeAt(0)+index));
  const mergedTextCells=(start,end,index,value,style=1)=>columnsBetween(start,end).map((column,offset)=>textCell(`${column}${index}`,offset?'':value,style));
  const mergedNumberCells=(start,end,index,value,style=5)=>columnsBetween(start,end).map((column,offset)=>offset?textCell(`${column}${index}`,'',style):numberCell(`${column}${index}`,value,style));
  const mergedFormulaCells=(start,end,index,formula,cachedValue,style=7)=>columnsBetween(start,end).map((column,offset)=>offset?textCell(`${column}${index}`,'',style):formulaCell(`${column}${index}`,formula,cachedValue,style));

  function buildSheet(model){
    const rows=[];
    const merges=['A2:H2','A3:H3','A5:H5'];
    const pairRow=(index,leftLabel,leftValue,rightLabel,rightValue,height=27)=>{
      merges.push(`B${index}:D${index}`,`F${index}:H${index}`);
      rows.push(row(index,[textCell(`A${index}`,leftLabel,2),...mergedTextCells('B','D',index,leftValue,3),textCell(`E${index}`,rightLabel,2),...mergedTextCells('F','H',index,rightValue,3)],height));
    };
    const wideRow=(index,label,value,height=30)=>{
      merges.push(`B${index}:H${index}`);
      rows.push(row(index,[textCell(`A${index}`,label,2),...mergedTextCells('B','H',index,value,3)],height));
    };

    rows.push(row(1,[],9));
    rows.push(row(2,mergedTextCells('A','H',2,model.companyName,8),25));
    rows.push(row(3,mergedTextCells('A','H',3,'員 工 資 遣 通 知 書',9),31));
    rows.push(row(4,[],10));
    rows.push(row(5,mergedTextCells('A','H',5,'一、員工資料',4),24));
    pairRow(6,'姓名',model.employeeName,'身分證字號',model.employeeId);
    pairRow(7,'通訊地址',model.employeeAddress,'聯絡電話',model.employeePhone,32);
    pairRow(8,'部門',model.department,'職稱',model.jobTitle);
    merges.push('A9:H9');
    rows.push(row(9,mergedTextCells('A','H',9,'二、資遣資料',4),24));
    pairRow(10,'預告期',`${model.noticeDays}日`,'實際預告日',model.actualNoticeDate);
    wideRow(11,'引用條款',model.legalBasis,30);
    wideRow(12,'理由',model.reasonDetail,38);
    pairRow(13,'到職日',model.startDate,'總年資',`${model.tenureDays}日`);
    pairRow(14,'離職日',model.endDate,'薪資發放日',model.settlementDate);
    merges.push('A15:H15');
    rows.push(row(15,mergedTextCells('A','H',15,'三、資遣費金額',4),24));
    merges.push('B16:D16','F16:H16');
    rows.push(row(16,[textCell('A16','平均工資',2),...mergedNumberCells('B','D',16,model.averageWage,5),textCell('E16','資遣費',2),...mergedNumberCells('F','H',16,model.severance,6)],29));

    let current=17;
    if(Number(model.noticePay)>0){
      merges.push(`B${current}:D${current}`,`F${current}:H${current}`);
      rows.push(row(current,[textCell(`A${current}`,'預告期間工資',2),...mergedNumberCells('B','D',current,model.noticePay,5),textCell(`E${current}`,'最終應支付金額',10),...mergedFormulaCells('F','H',current,`F16+B${current}`,Number(model.severance)+Number(model.noticePay),7)],30));
      current++;
    }
    rows.push(row(current++,[],9));
    const statementRow=current++;
    merges.push(`A${statementRow}:H${statementRow}`);
    rows.push(row(statementRow,mergedTextCells('A','H',statementRow,'說明：\n離職同仁應遵守保密協定之相關規定，並且不挪用或損毀公司財物與資料、不持有、洩漏或使用因職務獲取之資料及秘密，若有違反公司將請求賠償並應負擔相關法律責任。',11),70));
    rows.push(row(current++,[],10));
    const signatureRow=current++;
    merges.push(`A${signatureRow}:B${signatureRow}`,`C${signatureRow}:E${signatureRow}`,`G${signatureRow}:H${signatureRow}`);
    rows.push(row(signatureRow,[...mergedTextCells('A','B',signatureRow,'員工簽名：',12),...mergedTextCells('C','E',signatureRow,'',13),textCell(`F${signatureRow}`,'日期：',12),...mergedTextCells('G','H',signatureRow,'',13)],38));
    const lastRow=current-1;

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1" autoPageBreaks="0"/></sheetPr><dimension ref="A1:H${lastRow}"/><sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols><col min="1" max="1" width="15" customWidth="1"/><col min="2" max="2" width="13" customWidth="1"/><col min="3" max="3" width="10" customWidth="1"/><col min="4" max="4" width="13" customWidth="1"/><col min="5" max="5" width="15" customWidth="1"/><col min="6" max="6" width="13" customWidth="1"/><col min="7" max="7" width="12" customWidth="1"/><col min="8" max="8" width="14" customWidth="1"/></cols><sheetData>${rows.join('')}</sheetData><mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells><printOptions horizontalCentered="1" verticalCentered="0" gridLines="0" headings="0"/><pageMargins left="0.45" right="0.45" top="0.4" bottom="0.4" header="0.15" footer="0.15"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="1" horizontalDpi="600" verticalDpi="600"/></worksheet>`;
  }

  function styles(){return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0&quot; 元&quot;"/></numFmts><fonts count="6"><font><sz val="10"/><name val="Microsoft JhengHei"/></font><font><b/><sz val="10"/><name val="Microsoft JhengHei"/></font><font><b/><sz val="15"/><color rgb="FF173F34"/><name val="Microsoft JhengHei"/></font><font><b/><sz val="16"/><color rgb="FF173F34"/><name val="Microsoft JhengHei"/></font><font><b/><sz val="11"/><color rgb="FF173F34"/><name val="Microsoft JhengHei"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Microsoft JhengHei"/></font></fonts><fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE9F0ED"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF294F43"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF7F8F8"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE3ECE8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="4"><border/><border><left style="thin"><color rgb="FF687A73"/></left><right style="thin"><color rgb="FF687A73"/></right><top style="thin"><color rgb="FF687A73"/></top><bottom style="thin"><color rgb="FF687A73"/></bottom><diagonal/></border><border><left style="medium"><color rgb="FF294F43"/></left><right style="medium"><color rgb="FF294F43"/></right><top style="medium"><color rgb="FF294F43"/></top><bottom style="medium"><color rgb="FF294F43"/></bottom><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF222222"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="14"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="4" fillId="2" borderId="2" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="164" fontId="1" fillId="2" borderId="2" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="164" fontId="1" fillId="5" borderId="2" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="5" borderId="2" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="3" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;}

  async function createWorkbook(model,options={}){
    if(!JSZip)throw new Error('Excel 元件未載入');
    const zip=new JSZip(),now=new Date().toISOString(),lastRow=Number(model.noticePay)>0?21:20;
    zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
    zip.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
    zip.file('docProps/app.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>SOBER HR Tools</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>工作表</vt:lpstr></vt:variant><vt:variant><vt:i4>1</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>資遣通知書</vt:lpstr></vt:vector></TitlesOfParts></Properties>`);
    zip.file('docProps/core.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>資遣通知書</dc:title><dc:creator>SOBER HR Tools</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
    zip.file('xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews><sheets><sheet name="資遣通知書" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'資遣通知書'!$A$1:$H$${lastRow}</definedName></definedNames><calcPr calcId="191029" calcMode="auto"/></workbook>`);
    zip.file('xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    zip.file('xl/styles.xml',styles());
    zip.file('xl/worksheets/sheet1.xml',buildSheet(model));
    const type=options.type||(typeof Blob==='undefined'?'nodebuffer':'blob');
    return zip.generateAsync({type,mimeType:MIME,compression:'DEFLATE',compressionOptions:{level:6}});
  }

  function fileName(employeeName){return `${[safeName(employeeName),'資遣通知書'].filter(Boolean).join('-')}.xlsx`;}
  return{createWorkbook,fileName,buildSheet};
});
