(() => {
  "use strict";

  const xmlEscape = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);

  function runXml(text, { bold = false, size = 18 } = {}) {
    return `<w:r><w:rPr><w:rFonts w:ascii="Microsoft JhengHei" w:hAnsi="Microsoft JhengHei" w:eastAsia="Microsoft JhengHei"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${bold ? "<w:b/><w:bCs/>" : ""}</w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
  }

  function paragraphXml(text, { bold = false, size = 18, align = "left", before = 0, after = 70, line = 280, left = 0, hanging = 0, keepNext = false } = {}) {
    const indentation = left || hanging ? `<w:ind w:left="${left}"${hanging ? ` w:hanging="${hanging}"` : ""}/>` : "";
    return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:before="${before}" w:after="${after}" w:line="${line}" w:lineRule="auto"/>${indentation}${keepNext ? "<w:keepNext/>" : ""}</w:pPr>${runXml(text || " ", { bold, size })}</w:p>`;
  }

  function listParagraphXml(text, { numId, size = 17, after = 30, line = 245 } = {}) {
    return `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr><w:spacing w:after="${after}" w:line="${line}" w:lineRule="auto"/></w:pPr>${runXml(text, { size })}</w:p>`;
  }

  function tableCellXml(label, value, isHeader) {
    const width = isHeader ? 1900 : 8200;
    return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="center"/>${isHeader ? '<w:shd w:val="clear" w:fill="F0F3F1"/>' : ""}<w:tcMar><w:top w:w="70" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tcMar></w:tcPr>${paragraphXml(isHeader ? label : value, { bold: isHeader, size: 18, after: 0, line: 250 })}</w:tc>`;
  }

  function tableXml(rows) {
    const border = name => `<w:${name} w:val="single" w:sz="6" w:space="0" w:color="89938E"/>`;
    return `<w:tbl><w:tblPr><w:tblW w:w="10100" w:type="dxa"/><w:tblInd w:w="0" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(border).join("")}</w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="1900"/><w:gridCol w:w="8200"/></w:tblGrid>${rows.map(([label, value]) => `<w:tr>${tableCellXml(label, value, true)}${tableCellXml(label, value, false)}</w:tr>`).join("")}</w:tbl>`;
  }

  function numberingXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="right"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="420"/></w:tabs><w:ind w:left="420" w:hanging="300"/></w:pPr></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="2"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="360"/></w:tabs><w:ind w:left="360" w:hanging="240"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num></w:numbering>`;
  }

  function pictureXml(relationshipId, width, height) {
    return `<w:p><w:pPr><w:jc w:val="left"/><w:spacing w:after="80"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${width}" cy="${height}"/><wp:docPr id="1" name="Company Logo"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="Company Logo"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  }

  async function imagePart(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("公司 Logo 載入失敗");
    const blob = await response.blob();
    const type = blob.type.includes("png") ? "png" : "jpeg";
    const extension = type === "png" ? "png" : "jpg";
    let sourceWidth = 900;
    let sourceHeight = 150;
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(blob);
      sourceWidth = bitmap.width;
      sourceHeight = bitmap.height;
      bitmap.close();
    }
    const maximumWidth = 6100000;
    const maximumHeight = 650000;
    const scale = Math.min(maximumWidth / sourceWidth, maximumHeight / sourceHeight);
    return { bytes: await blob.arrayBuffer(), extension, contentType: type === "png" ? "image/png" : "image/jpeg", width: Math.round(sourceWidth * scale), height: Math.round(sourceHeight * scale) };
  }

  function documentXml(image, companyName, letter) {
    const nodeText = selector => letter.querySelector(selector)?.textContent.trim() || "";
    const visibleListItems = selector => [...letter.querySelectorAll(`${selector} > li`)].filter(item => !item.hidden).map(item => item.textContent.trim()).filter(Boolean);
    const directParagraphs = selector => [...letter.querySelectorAll(`${selector} > p`)].map(item => item.textContent.trim()).filter(Boolean);
    const activeTerms = letter.querySelector("#salesTerms")?.hidden ? "#generalTerms" : "#salesTerms";
    const rows = [
      ["應徵部門", nodeText("#outDepartment")], ["應徵職缺", nodeText("#outPosition")], ["月薪", nodeText("#outSalary")],
      ["報到日期", nodeText("#outStartDate")], ["報到時間", nodeText("#outStartTime")], ["報到地點", nodeText("#outLocation")]
    ];
    const onboardingHeading = nodeText(".onboarding-documents > p");
    const body = [
      pictureXml("rId1", image.width, image.height),
      '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="14" w:space="1" w:color="203B34"/></w:pBdr><w:spacing w:after="170"/></w:pPr></w:p>',
      paragraphXml("聘 任 通 知 書", { bold: true, size: 37, align: "center", after: 180, keepNext: true }),
      paragraphXml(`${nodeText("#outName")} ${nodeText("#outSalutation")} 鈞鑒：`, { size: 20, after: 90 }),
      paragraphXml(nodeText(".addressee + p") || "感謝您參與本公司的招募甄選。經審慎評估後，我們誠摯邀請您加入本公司，相關聘任及報到資訊如下：", { size: 18, after: 100 }),
      tableXml(rows),
      ...directParagraphs(activeTerms).map(text => paragraphXml(text, { size: 18, before: 70, after: 70 })),
      paragraphXml(onboardingHeading, { bold: true, size: 18, before: 70, after: 40, keepNext: true }),
      ...visibleListItems(".onboarding-documents ol").map(text => listParagraphXml(text, { numId: 1, size: 17, after: 30, line: 245 })),
      paragraphXml(nodeText(".hr-contact > strong"), { bold: true, size: 17, before: 70, after: 25 }),
      paragraphXml([...letter.querySelectorAll(".hr-contact > div > strong")].map(item => item.textContent.trim()).join("　　　　　　　　　"), { bold: true, size: 17, after: 60 }),
      ...visibleListItems(".important-notes").map(text => listParagraphXml(text, { numId: 2, size: 16, after: 35, line: 235 })),
      paragraphXml(nodeText(".important-notes + p"), { size: 17, before: 50, after: 50 }),
      paragraphXml("此致", { size: 18, align: "right", before: 70, after: 25 }),
      paragraphXml(companyName, { bold: true, size: 20, align: "right", after: 25 }),
      paragraphXml(nodeText("#outDocumentDate"), { size: 18, align: "right", after: 0 })
    ].join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="510" w:right="907" w:bottom="454" w:left="907" w:header="0" w:footer="0" w:gutter="0"/><w:cols w:space="708"/><w:docGrid w:linePitch="312"/></w:sectPr></w:body></w:document>`;
  }

  async function ensureJsZip() {
    if (window.JSZip) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "vendor/jszip.min.js?v=3.10.1";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Word 元件載入失敗"));
      document.head.append(script);
    });
  }

  async function download({ filename, companyName, logoUrl, letter }) {
    await ensureJsZip();
    const image = await imagePart(logoUrl);
    const zip = new window.JSZip();
    const now = new Date().toISOString();
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="${image.extension}" ContentType="${image.contentType}"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
    zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
    const word = zip.folder("word");
    word.file("document.xml", documentXml(image, companyName, letter));
    word.file("numbering.xml", numberingXml());
    word.folder("_rels").file("document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.${image.extension}"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`);
    word.folder("media").file(`logo.${image.extension}`, image.bytes);
    const props = zip.folder("docProps");
    props.file("core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(filename)}</dc:title><dc:creator>SOBER HR Tools</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
    props.file("app.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>SOBER HR Tools</Application></Properties>');
    const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", compression: "DEFLATE" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.docx`;
    link.hidden = true;
    document.body.append(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(link.href);
      link.remove();
    }, 60000);
  }

  window.AppointmentWordExporter = { download };
})();
