(() => {
  "use strict";

  const form = document.getElementById("announcementForm");
  const preview = document.getElementById("announcementPreview");
  const pageTemplate = document.getElementById("pageTemplate");
  const closingTemplate = document.getElementById("closingTemplate");
  const fields = {
    number: document.getElementById("documentNumber"),
    recipient: document.getElementById("recipient"),
    subject: document.getElementById("subject"),
    reasonLead: document.getElementById("reasonLead"),
    reason: document.getElementById("reasonEditor"),
    fund: document.getElementById("showFund"),
    customDate: document.getElementById("customDate")
  };
  const finalReserveMm = 70;
  let renderFrame = 0;
  let savedEditorRange = null;
  let activeTableCell = null;

  function value(node, fallback = "") {
    return node.value.trim() || fallback;
  }

  function makePage(continuation = false) {
    const page = pageTemplate.content.firstElementChild.cloneNode(true);
    if (continuation) page.classList.add("announcement-page--continuation");
    page.querySelector("[data-document-number]").textContent = value(fields.number);
    page.querySelector("[data-footer-number]").textContent = value(fields.number);
    page.querySelector("[data-recipient]").textContent = value(fields.recipient);
    page.querySelector("[data-subject]").textContent = value(fields.subject);
    page.querySelector("[data-reason-lead]").textContent = value(fields.reasonLead);
    page.querySelector("[data-fund]").hidden = !fields.fund.checked;
    preview.append(page);
    if (!continuation) {
      const body = page.querySelector(".document-body");
      const fieldBottom = page.querySelector(".document-fields").getBoundingClientRect().bottom;
      const pageTop = page.getBoundingClientRect().top;
      const pxPerMm = 96 / 25.4;
      body.style.top = `${Math.max(96 * pxPerMm, fieldBottom - pageTop + 2 * pxPerMm)}px`;
    }
    return page;
  }

  function paragraph(text) {
    const block = document.createElement("p");
    block.className = text ? "reason-paragraph" : "reason-paragraph reason-paragraph--blank";
    block.textContent = text || "\u00a0";
    return block;
  }

  function fits(container) {
    return container.scrollHeight <= container.clientHeight + 1;
  }

  function usedHeight(container) {
    const last = container.lastElementChild;
    return last ? last.getBoundingClientRect().bottom - container.getBoundingClientRect().top : 0;
  }

  function largestFittingPrefix(container, text) {
    let low = 1;
    let high = text.length;
    let best = 0;
    const probe = paragraph("測");
    probe.textContent = "";
    container.append(probe);
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      probe.textContent = text.slice(0, mid);
      if (fits(container)) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    probe.remove();
    if (!best) return 0;
    const candidate = text.slice(0, best);
    const naturalBreak = Math.max(candidate.lastIndexOf(" "), candidate.lastIndexOf("　"), candidate.lastIndexOf("，"), candidate.lastIndexOf("。"), candidate.lastIndexOf("；"));
    return naturalBreak > Math.floor(best * .55) ? naturalBreak + 1 : best;
  }

  function appendText(text, state) {
    let remaining = text;
    while (remaining.length) {
      const block = paragraph(remaining);
      state.container.append(block);
      if (fits(state.container)) return;
      block.remove();
      const count = largestFittingPrefix(state.container, remaining);
      if (!count) {
        state.page = makePage();
        state.container = state.page.querySelector(".reason-content");
        continue;
      }
      state.container.append(paragraph(remaining.slice(0, count)));
      remaining = remaining.slice(count);
      state.page = makePage(true);
      state.container = state.page.querySelector(".reason-content");
    }
  }

  function paginateReason() {
    const state = { page: makePage() };
    state.container = state.page.querySelector(".reason-content");
    const sourceBlocks = Array.from(fields.reason.childNodes).filter(node => node.nodeType === Node.ELEMENT_NODE || node.textContent.trim());
    const blocks = sourceBlocks.length ? sourceBlocks : [document.createElement("p")];
    blocks.forEach(source => {
      const block = source.nodeType === Node.ELEMENT_NODE ? source.cloneNode(true) : paragraph(source.textContent);
      state.container.append(block);
      if (!fits(state.container)) {
        block.remove();
        state.page = makePage(true);
        state.container = state.page.querySelector(".reason-content");
        state.container.append(block);
      }
    });
    return state;
  }

  function reserveLastPage(state) {
    const body = state.page.querySelector(".document-body");
    const content = state.container;
    const reservePx = finalReserveMm * 96 / 25.4;
    const finalCapacity = body.clientHeight - reservePx;

    if (usedHeight(content) > finalCapacity && content.textContent.trim()) {
      state.page = makePage(true);
      state.container = state.page.querySelector(".reason-content");
      reserveLastPage(state);
      return;
    }

    body.style.bottom = `${29 + finalReserveMm}mm`;
    const closing = closingTemplate.content.firstElementChild.cloneNode(true);
    const date = closing.querySelector(".document-date");
    date.replaceChildren(...formatDate(selectedDate()).split("　").map(part => {
      const span = document.createElement("span");
      span.textContent = part;
      return span;
    }));
    body.after(closing);
  }

  function selectedDate() {
    const custom = document.querySelector('input[name="dateMode"]:checked').value === "custom";
    if (custom && fields.customDate.value) return new Date(`${fields.customDate.value}T12:00:00`);
    return new Date();
  }

  function formatDate(date) {
    const year = String(date.getFullYear() - 1911);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `中 華 民 國　${year}　年　${month}　月　${day}　日`;
  }

  function render() {
    preview.replaceChildren();
    const state = paginateReason();
    reserveLastPage(state);
    const pages = Array.from(preview.children);
    pages.forEach((page, index) => page.querySelector(".page-number").textContent = `${index + 1}-${pages.length}`);
    document.getElementById("pageCount").textContent = `${pages.length} 頁`;
  }

  function scheduleRender() {
    cancelAnimationFrame(renderFrame);
    renderFrame = requestAnimationFrame(render);
  }

  function safeFilename() {
    const number = value(fields.number, "公告");
    const subject = value(fields.subject, "未命名主旨");
    return `${number}-${subject}`.replace(/[\\/:*?"<>|]/g, "_").slice(0, 120);
  }

  function setParagraphText(xml, paragraph, text, options = {}) {
    const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    Array.from(paragraph.children).forEach(child => {
      if (child.localName !== "pPr") child.remove();
    });
    const run = xml.createElementNS(ns, "w:r");
    const runProperties = xml.createElementNS(ns, "w:rPr");
    const fonts = xml.createElementNS(ns, "w:rFonts");
    ["ascii", "hAnsi", "eastAsia"].forEach(name => fonts.setAttributeNS(ns, `w:${name}`, "標楷體"));
    runProperties.append(fonts);
    const size = xml.createElementNS(ns, "w:sz");
    size.setAttributeNS(ns, "w:val", String(options.size || 28));
    runProperties.append(size);
    const sizeCs = xml.createElementNS(ns, "w:szCs");
    sizeCs.setAttributeNS(ns, "w:val", String(options.size || 28));
    runProperties.append(sizeCs);
    if (options.bold) runProperties.append(xml.createElementNS(ns, "w:b"));
    run.append(runProperties);
    const textNode = xml.createElementNS(ns, "w:t");
    textNode.setAttribute("xml:space", "preserve");
    textNode.textContent = text;
    run.append(textNode);
    paragraph.append(run);
  }

  function paragraphText(paragraph) {
    return Array.from(paragraph.getElementsByTagNameNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "t")).map(node => node.textContent).join("");
  }

  function setParagraphAlignment(xml, paragraph, alignment) {
    const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    let properties = Array.from(paragraph.children).find(node => node.localName === "pPr");
    if (!properties) {
      properties = xml.createElementNS(ns, "w:pPr");
      paragraph.prepend(properties);
    }
    let justification = Array.from(properties.children).find(node => node.localName === "jc");
    if (!justification) {
      justification = xml.createElementNS(ns, "w:jc");
      properties.append(justification);
    }
    justification.setAttributeNS(ns, "w:val", alignment);
  }

  function stripAutomaticNumbering(paragraph) {
    const properties = Array.from(paragraph.children).find(node => node.localName === "pPr");
    const numbering = properties && Array.from(properties.children).find(node => node.localName === "numPr");
    if (numbering) numbering.remove();
  }

  function setParagraphIndent(xml, paragraph, left = 680, hanging = 0) {
    const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    let properties = Array.from(paragraph.children).find(node => node.localName === "pPr");
    if (!properties) {
      properties = xml.createElementNS(ns, "w:pPr");
      paragraph.prepend(properties);
    }
    Array.from(properties.children).filter(node => node.localName === "ind").forEach(node => node.remove());
    const indent = xml.createElementNS(ns, "w:ind");
    indent.setAttributeNS(ns, "w:left", String(left));
    if (hanging) indent.setAttributeNS(ns, "w:hanging", String(hanging));
    properties.append(indent);
  }

  function createNumberingManager(xml) {
    const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const root = xml.documentElement;
    const abstractNodes = Array.from(root.children).filter(node => node.localName === "abstractNum");
    const numberNodes = Array.from(root.children).filter(node => node.localName === "num");
    let nextAbstractId = Math.max(-1, ...abstractNodes.map(node => Number(node.getAttributeNS(ns, "abstractNumId")) || 0)) + 1;
    let nextNumId = Math.max(0, ...numberNodes.map(node => Number(node.getAttributeNS(ns, "numId")) || 0)) + 1;
    const abstractByStyle = new Map();
    const lastNumberByStyle = new Map();
    const definitions = {
      "ordered:decimal-dot": { format: "decimal", text: "%1." },
      "ordered:decimal-cjk": { format: "decimal", text: "%1、" },
      "ordered:cjk-ideographic": { format: "taiwaneseCountingThousand", text: "%1、" },
      "ordered:cjk-financial": { format: "ideographTraditional", text: "%1、" },
      "ordered:upper-roman": { format: "upperRoman", text: "%1、" },
      "ordered:lower-roman": { format: "lowerRoman", text: "%1、" },
      "ordered:heavenly-stem": { format: "ideographZodiac", text: "%1、" },
      "bullet:disc": { format: "bullet", text: "●" },
      "bullet:circle": { format: "bullet", text: "○" },
      "bullet:square": { format: "bullet", text: "■" },
      "bullet:dash": { format: "bullet", text: "—" }
    };

    const addElement = (parent, name, value) => {
      const node = xml.createElementNS(ns, `w:${name}`);
      if (value !== undefined) node.setAttributeNS(ns, "w:val", String(value));
      parent.append(node);
      return node;
    };

    const ensureAbstract = styleKey => {
      if (abstractByStyle.has(styleKey)) return abstractByStyle.get(styleKey);
      const definition = definitions[styleKey] || definitions["ordered:decimal-dot"];
      const id = nextAbstractId++;
      const abstract = xml.createElementNS(ns, "w:abstractNum");
      abstract.setAttributeNS(ns, "w:abstractNumId", String(id));
      addElement(abstract, "multiLevelType", "singleLevel");
      const level = xml.createElementNS(ns, "w:lvl");
      level.setAttributeNS(ns, "w:ilvl", "0");
      addElement(level, "start", "1");
      addElement(level, "numFmt", definition.format);
      addElement(level, "lvlText", definition.text);
      addElement(level, "lvlJc", "left");
      const paragraphProperties = xml.createElementNS(ns, "w:pPr");
      const tabs = xml.createElementNS(ns, "w:tabs");
      const tab = addElement(tabs, "tab");
      tab.setAttributeNS(ns, "w:val", "num");
      tab.setAttributeNS(ns, "w:pos", "720");
      paragraphProperties.append(tabs);
      const indent = addElement(paragraphProperties, "ind");
      indent.setAttributeNS(ns, "w:left", "720");
      indent.setAttributeNS(ns, "w:hanging", "360");
      level.append(paragraphProperties);
      if (styleKey.startsWith("bullet:")) {
        const runProperties = xml.createElementNS(ns, "w:rPr");
        const fonts = addElement(runProperties, "rFonts");
        ["ascii", "hAnsi", "eastAsia"].forEach(name => fonts.setAttributeNS(ns, `w:${name}`, "標楷體"));
        level.append(runProperties);
      }
      abstract.append(level);
      const firstNumber = Array.from(root.children).find(node => node.localName === "num");
      root.insertBefore(abstract, firstNumber || null);
      abstractByStyle.set(styleKey, id);
      return id;
    };

    return {
      numIdFor(styleKey, shouldContinue) {
        if (shouldContinue && lastNumberByStyle.has(styleKey)) return lastNumberByStyle.get(styleKey);
        const abstractId = ensureAbstract(styleKey);
        const id = nextNumId++;
        const number = xml.createElementNS(ns, "w:num");
        number.setAttributeNS(ns, "w:numId", String(id));
        addElement(number, "abstractNumId", abstractId);
        root.append(number);
        lastNumberByStyle.set(styleKey, id);
        return id;
      }
    };
  }

  function setParagraphNumbering(xml, paragraph, numId, level = 0) {
    const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    let properties = Array.from(paragraph.children).find(node => node.localName === "pPr");
    if (!properties) {
      properties = xml.createElementNS(ns, "w:pPr");
      paragraph.prepend(properties);
    }
    Array.from(properties.children).filter(node => node.localName === "numPr").forEach(node => node.remove());
    const numbering = xml.createElementNS(ns, "w:numPr");
    const levelNode = xml.createElementNS(ns, "w:ilvl");
    levelNode.setAttributeNS(ns, "w:val", "0");
    const idNode = xml.createElementNS(ns, "w:numId");
    idNode.setAttributeNS(ns, "w:val", String(numId));
    numbering.append(levelNode, idNode);
    properties.append(numbering);
  }

  function appendRichRun(xml, paragraph, text, options = {}) {
    if (!text) return;
    const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    if (text.includes("\n")) {
      text.split("\n").forEach((part, index) => {
        if (part) appendRichRun(xml, paragraph, part, options);
        if (index < text.split("\n").length - 1) {
          const breakRun = xml.createElementNS(ns, "w:r");
          breakRun.append(xml.createElementNS(ns, "w:br"));
          paragraph.append(breakRun);
        }
      });
      return;
    }
    const run = xml.createElementNS(ns, "w:r");
    const properties = xml.createElementNS(ns, "w:rPr");
    const fonts = xml.createElementNS(ns, "w:rFonts");
    ["ascii", "hAnsi", "eastAsia"].forEach(name => fonts.setAttributeNS(ns, `w:${name}`, "標楷體"));
    properties.append(fonts);
    const sizeValue = String(options.size || 28);
    ["sz", "szCs"].forEach(name => {
      const size = xml.createElementNS(ns, `w:${name}`);
      size.setAttributeNS(ns, "w:val", sizeValue);
      properties.append(size);
    });
    if (options.bold) properties.append(xml.createElementNS(ns, "w:b"));
    if (options.italic) properties.append(xml.createElementNS(ns, "w:i"));
    if (options.underline) {
      const underline = xml.createElementNS(ns, "w:u");
      underline.setAttributeNS(ns, "w:val", "single");
      properties.append(underline);
    }
    if (options.strike) properties.append(xml.createElementNS(ns, "w:strike"));
    run.append(properties);
    const textNode = xml.createElementNS(ns, "w:t");
    textNode.setAttribute("xml:space", "preserve");
    textNode.textContent = text;
    run.append(textNode);
    paragraph.append(run);
  }

  function appendHtmlRuns(xml, paragraph, node, inherited = {}) {
    if (node.nodeType === Node.TEXT_NODE) {
      appendRichRun(xml, paragraph, node.textContent, inherited);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    const next = { ...inherited };
    const style = node.style || {};
    if (["b", "strong"].includes(tag) || style.fontWeight === "bold" || Number(style.fontWeight) >= 600) next.bold = true;
    if (["i", "em"].includes(tag) || style.fontStyle === "italic") next.italic = true;
    if (tag === "u" || String(style.textDecoration).includes("underline")) next.underline = true;
    if (["s", "strike"].includes(tag) || String(style.textDecoration).includes("line-through")) next.strike = true;
    if (style.fontSize) {
      const numericSize = parseFloat(style.fontSize);
      if (numericSize) next.size = Math.round(numericSize * (style.fontSize.endsWith("px") ? 1.5 : 2));
    } else if (tag === "font" && node.getAttribute("size")) {
      next.size = ({ 1: 16, 2: 20, 3: 24, 4: 28, 5: 36, 6: 48, 7: 72 })[node.getAttribute("size")] || next.size;
    }
    if (tag === "br") appendRichRun(xml, paragraph, "\n", next);
    else Array.from(node.childNodes).forEach(child => appendHtmlRuns(xml, paragraph, child, next));
  }

  function makeRichParagraph(xml, prototype, htmlNode, options = {}) {
    const paragraph = prototype.cloneNode(true);
    stripAutomaticNumbering(paragraph);
    Array.from(paragraph.children).forEach(child => { if (child.localName !== "pPr") child.remove(); });
    setParagraphIndent(xml, paragraph, options.left ?? 680, options.hanging || 0);
    const alignment = options.alignment || (htmlNode.style && htmlNode.style.textAlign);
    if (alignment) setParagraphAlignment(xml, paragraph, ({ start: "left", end: "right", justify: "both" })[alignment] || alignment);
    if (options.prefix) appendRichRun(xml, paragraph, options.prefix, { size: options.size || 28, bold: options.bold });
    appendHtmlRuns(xml, paragraph, htmlNode, { size: options.size || 28, bold: options.bold });
    if (!paragraphText(paragraph)) appendRichRun(xml, paragraph, " ", { size: options.size || 28 });
    return paragraph;
  }

  function makeWordTable(xml, htmlTable, prototype) {
    const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const rows = Array.from(htmlTable.rows);
    const columnCount = Math.max(1, ...rows.map(row => row.cells.length));
    const totalWidth = 8840;
    const htmlColumns = Array.from(htmlTable.querySelectorAll(":scope > colgroup > col"));
    let proportions = htmlColumns.map(column => parseFloat(column.style.width) || 0);
    if (proportions.length !== columnCount || !proportions.every(Boolean)) proportions = Array(columnCount).fill(100 / columnCount);
    const proportionTotal = proportions.reduce((sum, width) => sum + width, 0);
    const columnWidths = proportions.map(width => Math.floor(totalWidth * width / proportionTotal));
    const table = xml.createElementNS(ns, "w:tbl");
    const properties = xml.createElementNS(ns, "w:tblPr");
    const width = xml.createElementNS(ns, "w:tblW");
    width.setAttributeNS(ns, "w:w", String(totalWidth)); width.setAttributeNS(ns, "w:type", "dxa");
    const borders = xml.createElementNS(ns, "w:tblBorders");
    ["top", "left", "bottom", "right", "insideH", "insideV"].forEach(name => {
      const border = xml.createElementNS(ns, `w:${name}`);
      border.setAttributeNS(ns, "w:val", "single"); border.setAttributeNS(ns, "w:sz", "6"); border.setAttributeNS(ns, "w:color", "000000");
      borders.append(border);
    });
    properties.append(width, borders); table.append(properties);
    const grid = xml.createElementNS(ns, "w:tblGrid");
    for (let i = 0; i < columnCount; i += 1) { const col = xml.createElementNS(ns, "w:gridCol"); col.setAttributeNS(ns, "w:w", String(columnWidths[i])); grid.append(col); }
    table.append(grid);
    rows.forEach(row => {
      const tr = xml.createElementNS(ns, "w:tr");
      Array.from(row.cells).forEach((cell, cellIndex) => {
        const tc = xml.createElementNS(ns, "w:tc");
        const tcPr = xml.createElementNS(ns, "w:tcPr");
        const tcW = xml.createElementNS(ns, "w:tcW"); tcW.setAttributeNS(ns, "w:w", String(columnWidths[cellIndex] || columnWidths[0])); tcW.setAttributeNS(ns, "w:type", "dxa");
        tcPr.append(tcW);
        if (cell.dataset.cellShade === "gray" || getComputedStyle(cell).backgroundColor !== "rgba(0, 0, 0, 0)") {
          const shade = xml.createElementNS(ns, "w:shd"); shade.setAttributeNS(ns, "w:fill", "D9D9D9"); tcPr.append(shade);
        }
        if (cell.dataset.textDirection === "vertical") {
          const direction = xml.createElementNS(ns, "w:textDirection"); direction.setAttributeNS(ns, "w:val", "tbRl"); tcPr.append(direction);
        }
        const verticalAlign = xml.createElementNS(ns, "w:vAlign"); verticalAlign.setAttributeNS(ns, "w:val", "center"); tcPr.append(verticalAlign);
        tc.append(tcPr, makeRichParagraph(xml, prototype, cell, { left: 0, size: 24, alignment: cell.style.textAlign || "left" })); tr.append(tc);
      });
      table.append(tr);
    });
    return table;
  }

  function makeReasonNodes(xml, prototype, numberingManager) {
    const result = [];
    const appendList = (list, level = 0) => {
      const ordered = list.tagName.toLowerCase() === "ol";
      const numberingStyle = list.dataset.numberingStyle || list.style.listStyleType || "decimal-dot";
      const bulletStyle = list.dataset.bulletStyle || list.style.listStyleType || "disc";
      const styleKey = ordered ? `ordered:${numberingStyle}` : `bullet:${bulletStyle === "list-dash" ? "dash" : bulletStyle}`;
      const numId = numberingManager.numIdFor(styleKey, ordered && list.dataset.continueNumbering === "true");
      Array.from(list.children).forEach(item => {
        if (item.tagName.toLowerCase() !== "li") return;
        const content = item.cloneNode(true);
        Array.from(content.querySelectorAll(":scope > ul, :scope > ol")).forEach(nested => nested.remove());
        const paragraph = makeRichParagraph(xml, prototype, content, { left: 1080 + level * 480, hanging: 400 });
        setParagraphNumbering(xml, paragraph, numId, level);
        result.push(paragraph);
        Array.from(item.children).filter(child => ["ul", "ol"].includes(child.tagName.toLowerCase())).forEach(nested => appendList(nested, level + 1));
      });
    };
    Array.from(fields.reason.childNodes).forEach(block => {
      if (block.nodeType === Node.TEXT_NODE) {
        block.textContent.replace(/\r/g, "").split("\n").forEach(line => {
          const paragraph = document.createElement("p"); paragraph.textContent = line || " ";
          result.push(makeRichParagraph(xml, prototype, paragraph));
        });
        return;
      }
      if (block.nodeType !== Node.ELEMENT_NODE) return;
      const tag = block.tagName.toLowerCase();
      if (tag === "table") { result.push(makeWordTable(xml, block, prototype)); return; }
      const nestedList = block.querySelector(":scope > ul, :scope > ol");
      if (nestedList) { appendList(nestedList, tag === "blockquote" ? 1 : 0); return; }
      if (["ul", "ol"].includes(tag)) {
        appendList(block);
        return;
      }
      if (tag === "blockquote") {
        Array.from(block.children).forEach(child => result.push(makeRichParagraph(xml, prototype, child, { left: 1160 })));
        return;
      }
      if (!["p", "div", "h2", "h3"].includes(tag) && block.innerText.includes("\n")) {
        block.innerText.replace(/\r/g, "").split("\n").forEach(line => {
          const paragraph = document.createElement("p"); paragraph.textContent = line || " ";
          result.push(makeRichParagraph(xml, prototype, paragraph, { bold: ["b", "strong"].includes(tag) }));
        });
        return;
      }
      result.push(makeRichParagraph(xml, prototype, block, { size: tag === "h2" ? 36 : tag === "h3" ? 32 : 28, bold: ["h2", "h3", "b", "strong"].includes(tag) }));
    });
    return result.length ? result : [makeRichParagraph(xml, prototype, document.createElement("p"))];
  }

  function makeSignaturePageSpacer(xml, prototype) {
    const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const spacer = prototype.cloneNode(true);
    stripAutomaticNumbering(spacer);
    setParagraphText(xml, spacer, " ", { size: 28 });
    let properties = Array.from(spacer.children).find(node => node.localName === "pPr");
    if (!properties) {
      properties = xml.createElementNS(ns, "w:pPr");
      spacer.prepend(properties);
    }
    Array.from(properties.children).filter(node => node.localName === "spacing").forEach(node => node.remove());
    properties.append(xml.createElementNS(ns, "w:pageBreakBefore"));
    const spacing = xml.createElementNS(ns, "w:spacing");
    spacing.setAttributeNS(ns, "w:before", "0");
    spacing.setAttributeNS(ns, "w:after", "0");
    spacing.setAttributeNS(ns, "w:line", "9200");
    spacing.setAttributeNS(ns, "w:lineRule", "exact");
    properties.append(spacing);
    return spacer;
  }

  async function buildDocx() {
    const pageCount = preview.querySelectorAll(".announcement-page").length;
    const longTemplate = pageCount > 1;
    const templatePath = longTemplate ? "templates/announcement-sb115035.docx" : "templates/announcement-sb115036.docx";
    const zip = await JSZip.loadAsync(await fetch(templatePath).then(response => response.arrayBuffer()));
    const parser = new DOMParser();
    const serializer = new XMLSerializer();
    const documentXml = parser.parseFromString(await zip.file("word/document.xml").async("text"), "application/xml");
    const numberingXml = parser.parseFromString(await zip.file("word/numbering.xml").async("text"), "application/xml");
    const numberingManager = createNumberingManager(numberingXml);
    const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const body = documentXml.getElementsByTagNameNS(ns, "body")[0];
    const sectionProperties = Array.from(body.children).find(node => node.localName === "sectPr");
    const originalParagraphs = Array.from(body.children).filter(node => node.localName === "p");
    const signatureIndex = originalParagraphs.findIndex((node, index) => index > 6 && paragraphText(node) === "搜博科技股份有限公司");
    const suffixStart = signatureIndex;
    const prefix = originalParagraphs.slice(0, 6).map(node => node.cloneNode(true));
    const reasonPrototype = originalParagraphs[6].cloneNode(true);
    const suffix = originalParagraphs.slice(suffixStart).map(node => node.cloneNode(true));
    const signatureLead = [];

    setParagraphText(documentXml, prefix[2], `公告字號：${value(fields.number)}`, { size: 20 });
    setParagraphAlignment(documentXml, prefix[2], "right");
    setParagraphText(documentXml, prefix[3], `受文者：${value(fields.recipient)}`, { size: 32 });
    setParagraphText(documentXml, prefix[4], `主旨：${value(fields.subject)}`, { size: 32 });
    setParagraphText(documentXml, prefix[5], `事由：${value(fields.reasonLead)}`, { size: 32 });

    const reasonParagraphs = makeReasonNodes(documentXml, reasonPrototype, numberingManager);

    const dateText = formatDate(selectedDate());
    const signatureCompany = suffix.find(node => paragraphText(node) === "搜博科技股份有限公司");
    const signatureLine = suffix.find(node => paragraphText(node).includes("_____"));
    const signatureDate = suffix.find(node => paragraphText(node).includes("中 華 民 國"));
    if (signatureCompany) setParagraphText(documentXml, signatureCompany, "搜博科技股份有限公司", { size: 40, bold: true });
    if (signatureLine) setParagraphText(documentXml, signatureLine, "_____________________", { size: 44, bold: true });
    if (signatureDate) {
      setParagraphText(documentXml, signatureDate, dateText, { size: 28 });
      setParagraphAlignment(documentXml, signatureDate, "distribute");
    }
    const compactSuffix = longTemplate ? suffix : suffix.filter(node => paragraphText(node).trim() || node === signatureCompany || node === signatureLine || node === signatureDate);
    if (!longTemplate && signatureLine) {
      const properties = Array.from(signatureLine.children).find(node => node.localName === "pPr");
      if (properties) {
        Array.from(properties.children).filter(node => node.localName === "spacing").forEach(node => node.remove());
        const spacing = documentXml.createElementNS(ns, "w:spacing");
        spacing.setAttributeNS(ns, "w:before", "1500");
        spacing.setAttributeNS(ns, "w:after", "0");
        properties.append(spacing);
      }
    }
    body.replaceChildren(...prefix, ...reasonParagraphs, ...signatureLead, ...compactSuffix, sectionProperties);
    zip.file("word/document.xml", serializer.serializeToString(documentXml));
    zip.file("word/numbering.xml", serializer.serializeToString(numberingXml));

    const footerXml = parser.parseFromString(await zip.file("word/footer1.xml").async("text"), "application/xml");
    const footerParagraphs = Array.from(footerXml.getElementsByTagNameNS(ns, "p"));
    setParagraphText(footerXml, footerParagraphs[0], `公告字號：${value(fields.number)}`, { size: 20 });
    if (fields.fund.checked) setParagraphText(footerXml, footerParagraphs[1], "(公基金)", { size: 20 });
    else footerParagraphs[1].remove();
    const pageFieldParagraph = footerParagraphs[2];
    if (pageFieldParagraph) {
      const cachedTexts = Array.from(pageFieldParagraph.getElementsByTagNameNS(ns, "t"));
      const numericTexts = cachedTexts.filter(node => /^\d+$/.test(node.textContent));
      if (numericTexts[0]) numericTexts[0].textContent = "1";
      if (numericTexts[1]) numericTexts[1].textContent = String(pageCount);
      Array.from(pageFieldParagraph.getElementsByTagNameNS(ns, "r")).forEach(run => {
        let properties = Array.from(run.children).find(node => node.localName === "rPr");
        if (!properties) {
          properties = footerXml.createElementNS(ns, "w:rPr");
          run.prepend(properties);
        }
        const color = footerXml.createElementNS(ns, "w:color");
        color.setAttributeNS(ns, "w:val", "000000");
        properties.append(color);
      });
    }
    zip.file("word/footer1.xml", serializer.serializeToString(footerXml));
    if (zip.file("word/settings.xml")) {
      const settingsXml = parser.parseFromString(await zip.file("word/settings.xml").async("text"), "application/xml");
      const settings = settingsXml.documentElement;
      let updateFields = Array.from(settings.children).find(node => node.localName === "updateFields");
      if (!updateFields) {
        updateFields = settingsXml.createElementNS(ns, "w:updateFields");
        settings.append(updateFields);
      }
      updateFields.setAttributeNS(ns, "w:val", "true");
      zip.file("word/settings.xml", serializer.serializeToString(settingsXml));
    }
    return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }

  async function downloadWord() {
    const button = document.getElementById("downloadWord");
    button.disabled = true;
    try {
      const blob = await buildDocx();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${safeFilename()}.docx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      document.getElementById("actionHint").textContent = "範本式 Word 文件已建立。";
    } catch (error) {
      console.error(error);
      document.getElementById("actionHint").textContent = "Word 建立失敗，請重新整理後再試。";
    } finally {
      button.disabled = false;
    }
  }

  async function exportPdf() {
    const button = document.getElementById("exportPdf");
    button.disabled = true;
    document.getElementById("actionHint").textContent = "正在建立 PDF…";
    try {
      await document.fonts.ready;
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const pages = Array.from(preview.querySelectorAll(".announcement-page"));
      for (let index = 0; index < pages.length; index += 1) {
        if (index) pdf.addPage("a4", "portrait");
        const canvas = await html2canvas(pages[index], { scale: 2, backgroundColor: "#ffffff", logging: false, useCORS: true });
        pdf.addImage(canvas.toDataURL("image/jpeg", .96), "JPEG", 0, 0, 210, 297, undefined, "FAST");
      }
      pdf.save(`${safeFilename()}.pdf`);
      document.getElementById("actionHint").textContent = "PDF 已建立。";
    } catch (error) {
      console.error(error);
      document.getElementById("actionHint").textContent = "PDF 建立失敗，請重新整理後再試。";
    } finally {
      button.disabled = false;
    }
  }

  function saveEditorSelection() {
    const selection = window.getSelection();
    if (selection.rangeCount && fields.reason.contains(selection.anchorNode)) savedEditorRange = selection.getRangeAt(0).cloneRange();
  }

  function restoreEditorSelection() {
    const range = savedEditorRange;
    fields.reason.focus();
    if (!range) return;
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function runEditorCommand(command, value = null) {
    restoreEditorSelection();
    document.execCommand(command, false, value);
    saveEditorSelection();
    scheduleRender();
  }

  function selectedOrderedList() {
    const selection = window.getSelection();
    const anchor = selection && selection.anchorNode;
    const element = anchor && (anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement);
    return element && element.closest("ol");
  }

  function selectedUnorderedList() {
    const selection = window.getSelection();
    const anchor = selection && selection.anchorNode;
    const element = anchor && (anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement);
    return element && element.closest("ul");
  }

  function applySelectedNumberingStyle() {
    const list = selectedOrderedList();
    if (!list || !fields.reason.contains(list)) return;
    const style = document.getElementById("numberingStyle").value;
    list.dataset.numberingStyle = style;
    list.style.listStyleType = style === "decimal-dot" ? "decimal" : style;
    stripManualListMarker(list, true);
    scheduleRender();
  }

  function applySelectedBulletStyle() {
    const list = selectedUnorderedList();
    if (!list || !fields.reason.contains(list)) return;
    const style = document.getElementById("bulletStyle").value;
    list.dataset.bulletStyle = style;
    list.style.listStyleType = style === "dash" ? "list-dash" : style;
    stripManualListMarker(list, false);
    scheduleRender();
  }

  function initializeToolVisibility() {
    const defaults = ["font", "bullet"];
    let visible = defaults;
    try {
      const stored = JSON.parse(sessionStorage.getItem("announcementToolGroups") || "null");
      if (Array.isArray(stored)) visible = stored;
    } catch (error) { visible = defaults; }
    const apply = () => {
      const selected = Array.from(document.querySelectorAll("[data-tool-toggle]:checked"), input => input.dataset.toolToggle);
      document.querySelectorAll("[data-tool-group]").forEach(group => { group.hidden = !selected.includes(group.dataset.toolGroup); });
      sessionStorage.setItem("announcementToolGroups", JSON.stringify(selected));
    };
    document.querySelectorAll("[data-tool-toggle]").forEach(input => {
      input.checked = visible.includes(input.dataset.toolToggle);
      input.addEventListener("change", apply);
    });
    apply();
  }

  function tableColumnCount(table) {
    return Math.max(1, ...Array.from(table.rows, row => Array.from(row.cells).reduce((sum, cell) => sum + (cell.colSpan || 1), 0)));
  }

  function ensureTableColumns(table, reset = false) {
    const count = tableColumnCount(table);
    let colgroup = table.querySelector(":scope > colgroup");
    if (!colgroup || colgroup.children.length !== count) {
      if (colgroup) colgroup.remove();
      colgroup = document.createElement("colgroup");
      for (let index = 0; index < count; index += 1) colgroup.append(document.createElement("col"));
      table.prepend(colgroup);
      reset = true;
    }
    if (reset || Array.from(colgroup.children).some(col => !parseFloat(col.style.width))) {
      Array.from(colgroup.children).forEach(col => { col.style.width = `${100 / count}%`; });
    }
    return Array.from(colgroup.children);
  }

  function normalizeTable(table) {
    table.removeAttribute("width");
    Object.assign(table.style, { width: "100%", maxWidth: "100%", tableLayout: "fixed" });
    table.querySelectorAll("tr,td,th").forEach(element => {
      element.removeAttribute("width");
      element.style.removeProperty("width");
      element.style.removeProperty("min-width");
      element.style.removeProperty("max-width");
    });
    ensureTableColumns(table);
  }

  function normalizeAllTables() {
    fields.reason.querySelectorAll("table").forEach(normalizeTable);
  }

  function selectedTableCell() {
    const selection = window.getSelection();
    const anchor = selection && selection.anchorNode;
    const element = anchor && (anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement);
    const cell = element && element.closest("td,th");
    return cell && fields.reason.contains(cell) ? cell : activeTableCell;
  }

  function resizeSelectedColumn(delta) {
    const cell = selectedTableCell();
    if (!cell) {
      document.getElementById("actionHint").textContent = "請先點選要調整的表格欄位。";
      return;
    }
    const table = cell.closest("table");
    const columns = ensureTableColumns(table);
    const index = cell.cellIndex;
    if (columns.length < 2) return;
    const widths = columns.map(col => parseFloat(col.style.width) || 100 / columns.length);
    const next = Math.max(8, Math.min(92, widths[index] + delta));
    const change = next - widths[index];
    const others = columns.length - 1;
    if (widths.some((width, position) => position !== index && width - change / others < 8)) return;
    widths[index] = next;
    widths.forEach((width, position) => { if (position !== index) widths[position] = width - change / others; });
    columns.forEach((col, position) => { col.style.width = `${widths[position]}%`; });
    document.getElementById("actionHint").textContent = "表格欄寬已調整。";
    scheduleRender();
  }

  function updateSelectedTableCell(change, successMessage) {
    const cell = selectedTableCell();
    if (!cell) {
      document.getElementById("actionHint").textContent = "請先點選要設定的表格儲存格。";
      return;
    }
    change(cell);
    document.getElementById("actionHint").textContent = successMessage;
    scheduleRender();
  }

  function addTableRow() {
    const cell = selectedTableCell();
    if (!cell) {
      document.getElementById("actionHint").textContent = "請先點選要新增列的位置。";
      return;
    }
    const currentRow = cell.parentElement;
    const newRow = currentRow.cloneNode(true);
    Array.from(newRow.cells).forEach(newCell => { newCell.innerHTML = "&nbsp;"; });
    currentRow.insertAdjacentElement("afterend", newRow);
    activeTableCell = newRow.cells[0] || null;
    normalizeTable(currentRow.closest("table"));
    document.getElementById("actionHint").textContent = "已在目前位置下方新增一列。";
    scheduleRender();
  }

  function removeTableRow() {
    const cell = selectedTableCell();
    if (!cell) {
      document.getElementById("actionHint").textContent = "請先點選要刪除的列。";
      return;
    }
    const row = cell.parentElement;
    const table = row.closest("table");
    if (table.rows.length <= 1) {
      document.getElementById("actionHint").textContent = "表格至少需要保留一列。";
      return;
    }
    const fallbackRow = row.previousElementSibling || row.nextElementSibling;
    row.remove();
    activeTableCell = fallbackRow?.cells[0] || null;
    document.getElementById("actionHint").textContent = "目前列已刪除。";
    scheduleRender();
  }

  function stripManualListMarker(list, ordered) {
    const pattern = ordered
      ? /^\s*(?:\d+[.、)]|[一二三四五六七八九十百壹貳參肆伍陸柒捌玖拾佰甲乙丙丁戊己庚辛壬癸]+[、.)]|[IVXLCDMivxlcdmⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+[.、)])\s*/
      : /^\s*[•●○■▪▫◆◇－—–-]\s*/;
    Array.from(list.children).filter(child => child.tagName === "LI").forEach(item => {
      const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
      const text = walker.nextNode();
      if (text) text.nodeValue = text.nodeValue.replace(pattern, "");
    });
  }

  function continueSelectedNumbering() {
    restoreEditorSelection();
    const list = selectedOrderedList();
    const lists = Array.from(fields.reason.querySelectorAll("ol"));
    const index = lists.indexOf(list);
    if (!list || index <= 0) {
      document.getElementById("actionHint").textContent = "請先把游標放在要接續的編號段落內。";
      return;
    }
    const currentStyle = list.dataset.numberingStyle || list.style.listStyleType || "decimal-dot";
    const previous = lists.slice(0, index).reverse().find(candidate => (candidate.dataset.numberingStyle || candidate.style.listStyleType || "decimal-dot") === currentStyle);
    if (!previous) {
      document.getElementById("actionHint").textContent = "前方沒有相同樣式的編號可接續。";
      return;
    }
    const previousStart = Math.max(1, Number(previous.getAttribute("start")) || 1);
    const previousCount = Array.from(previous.children).filter(child => child.tagName.toLowerCase() === "li").length;
    list.start = previousStart + previousCount;
    list.dataset.continueNumbering = "true";
    document.getElementById("actionHint").textContent = `已從第 ${list.start} 項接續編號。`;
    saveEditorSelection();
    scheduleRender();
  }

  form.addEventListener("input", scheduleRender);
  form.addEventListener("change", event => {
    if (event.target.name === "dateMode") {
      fields.customDate.disabled = event.target.value !== "custom";
      if (!fields.customDate.disabled && !fields.customDate.value) fields.customDate.valueAsDate = new Date();
    }
    scheduleRender();
  });
  form.addEventListener("reset", () => setTimeout(() => {
    fields.customDate.disabled = true;
    fields.reason.innerHTML = "<p><br></p>";
    scheduleRender();
  }));
  fields.reason.addEventListener("keyup", saveEditorSelection);
  fields.reason.addEventListener("mouseup", saveEditorSelection);
  const rememberTableCell = event => {
    const cell = event.target.closest("td,th");
    if (cell) activeTableCell = cell;
  };
  fields.reason.addEventListener("pointerdown", rememberTableCell);
  fields.reason.addEventListener("click", rememberTableCell);
  fields.reason.addEventListener("focusin", rememberTableCell);
  fields.reason.addEventListener("paste", () => setTimeout(() => {
    normalizeAllTables();
    scheduleRender();
  }, 0));
  document.addEventListener("selectionchange", saveEditorSelection);
  document.querySelector(".editor-toolbar").addEventListener("mousedown", event => {
    saveEditorSelection();
    if (event.target.closest("button")) event.preventDefault();
  });
  document.querySelectorAll("[data-command]").forEach(button => button.addEventListener("click", () => {
    runEditorCommand(button.dataset.command);
    if (button.dataset.command === "insertOrderedList") applySelectedNumberingStyle();
    if (button.dataset.command === "insertUnorderedList") applySelectedBulletStyle();
  }));
  document.getElementById("numberingStyle").addEventListener("change", () => {
    restoreEditorSelection();
    applySelectedNumberingStyle();
    saveEditorSelection();
  });
  document.getElementById("continueNumbering").addEventListener("click", continueSelectedNumbering);
  document.getElementById("bulletStyle").addEventListener("change", () => {
    restoreEditorSelection();
    applySelectedBulletStyle();
    saveEditorSelection();
  });
  document.getElementById("paragraphStyle").addEventListener("change", event => {
    runEditorCommand("formatBlock", event.target.value);
  });
  document.getElementById("fontSize").addEventListener("input", event => {
    restoreEditorSelection();
    document.execCommand("fontSize", false, "7");
    fields.reason.querySelectorAll('font[size="7"]').forEach(font => {
      font.removeAttribute("size");
      font.style.fontSize = `${event.target.value}pt`;
    });
    saveEditorSelection();
    scheduleRender();
  });
  document.getElementById("insertTable").addEventListener("click", () => {
    const rows = Math.max(1, Math.min(12, Number(document.getElementById("tableRows").value) || 3));
    const columns = Math.max(1, Math.min(8, Number(document.getElementById("tableColumns").value) || 3));
    const table = document.createElement("table");
    const tbody = table.createTBody();
    for (let row = 0; row < rows; row += 1) {
      const tr = tbody.insertRow();
      for (let column = 0; column < columns; column += 1) {
        const cell = tr.insertCell();
        cell.innerHTML = "&nbsp;";
      }
    }
    normalizeTable(table);
    activeTableCell = table.rows[0]?.cells[0] || null;
    const selection = window.getSelection();
    if (selection.rangeCount && fields.reason.contains(selection.anchorNode)) {
      const anchorElement = selection.anchorNode.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode.parentElement;
      const block = anchorElement && anchorElement.closest("p,div,h2,h3,ul,ol,table");
      if (block && block.parentElement === fields.reason) block.insertAdjacentElement("afterend", table);
      else fields.reason.append(table);
    } else fields.reason.append(table);
    fields.reason.append(document.createElement("p"));
    fields.reason.focus();
    scheduleRender();
  });
  document.getElementById("narrowTableColumn").addEventListener("click", () => resizeSelectedColumn(-5));
  document.getElementById("widenTableColumn").addEventListener("click", () => resizeSelectedColumn(5));
  document.getElementById("equalizeTableColumns").addEventListener("click", () => {
    const cell = selectedTableCell();
    if (!cell) {
      document.getElementById("actionHint").textContent = "請先點選要調整的表格欄位。";
      return;
    }
    ensureTableColumns(cell.closest("table"), true);
    document.getElementById("actionHint").textContent = "表格欄寬已平均分配。";
    scheduleRender();
  });
  document.getElementById("addTableRow").addEventListener("click", addTableRow);
  document.getElementById("removeTableRow").addEventListener("click", removeTableRow);
  document.getElementById("shadeTableCell").addEventListener("click", () => updateSelectedTableCell(cell => {
    cell.dataset.cellShade = "gray";
    cell.style.backgroundColor = "#d9d9d9";
  }, "儲存格已設為灰底。"));
  document.getElementById("clearTableCellShade").addEventListener("click", () => updateSelectedTableCell(cell => {
    delete cell.dataset.cellShade;
    cell.style.removeProperty("background-color");
  }, "儲存格灰底已取消。"));
  document.getElementById("verticalTableCell").addEventListener("click", () => updateSelectedTableCell(cell => {
    cell.dataset.textDirection = "vertical";
  }, "儲存格文字已改為直排。"));
  document.getElementById("horizontalTableCell").addEventListener("click", () => updateSelectedTableCell(cell => {
    delete cell.dataset.textDirection;
  }, "儲存格文字已改為橫排。"));
  document.getElementById("downloadWord").addEventListener("click", downloadWord);
  document.getElementById("exportPdf").addEventListener("click", exportPdf);
  document.getElementById("printDocument").addEventListener("click", () => window.print());
  window.addEventListener("resize", scheduleRender);
  initializeToolVisibility();
  normalizeAllTables();
  render();
})();
