(() => {
  "use strict";
  if (window.HrPdf) return;
  const assetBase = new URL(".", import.meta.url);
  const A4_WIDTH = 210 * 96 / 25.4;
  const A4_HEIGHT = 297 * 96 / 25.4;
  const libraryLoads = new Map();
  let busy = false;

  function loadLibrary(path, available) {
    if (available()) return Promise.resolve();
    if (!libraryLoads.has(path)) {
      const promise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = new URL(path, assetBase).href;
        script.onload = () => available() ? resolve() : reject(new Error("PDF 元件載入不完整"));
        script.onerror = () => { script.remove(); reject(new Error("PDF 元件載入失敗，請確認網路後重試")); };
        document.head.append(script);
      }).catch(error => { libraryLoads.delete(path); throw error; });
      libraryLoads.set(path, promise);
    }
    return libraryLoads.get(path);
  }

  function filename(title, name = "") {
    const clean = text => String(text ?? "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim().replace(/[. ]+$/, "");
    return [clean(title) || "文件", clean(name)].filter(Boolean).join("-") + ".pdf";
  }

  function physicalPages(root) {
    const announcement = [...root.querySelectorAll(".announcement-page")];
    if (announcement.length) return announcement;
    const sheets = [...root.querySelectorAll(".combined-sheet")];
    if (sheets.length) return sheets.flatMap(sheet => {
      const official = [...sheet.querySelectorAll(".official-page")];
      return official.length ? official : [sheet];
    });
    const official = [...root.querySelectorAll(".official-page")];
    return official.length ? official : [root];
  }

  // Reuse the document's existing print layout at a fixed desktop viewport.
  // Only the isolated export document gets these rules; live preview is untouched.
  function exportRules(rules) {
    return [...rules].map(rule => {
      if (rule.type === CSSRule.IMPORT_RULE) return exportRules(rule.styleSheet.cssRules);
      if (rule.type === CSSRule.MEDIA_RULE && /\bprint\b/.test(rule.conditionText) && !/\bnot\s+print\b/.test(rule.conditionText)) {
        return exportRules(rule.cssRules);
      }
      return rule.cssText;
    }).join("\n");
  }

  function snapshot(root) {
    const sheets = [...document.styleSheets].filter(sheet => !sheet.disabled);
    const styles = sheets.map(sheet => {
      try { return exportRules(sheet.cssRules); }
      catch { throw new Error("文件樣式尚未載入完成，請稍後重試"); }
    }).join("\n");
    const pages = physicalPages(root).map(page => {
      const copy = page.cloneNode(true);
      copy.classList.add("pdf-export-page");
      copy.removeAttribute("hidden");
      let tree = copy;
      for (let ancestor = page.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
        const shell = ancestor.cloneNode(false);
        shell.removeAttribute("hidden");
        shell.setAttribute("data-pdf-ancestor", "");
        if (shell.tagName === "DIALOG") shell.setAttribute("open", "");
        shell.append(tree);
        tree = shell;
      }
      tree.querySelectorAll("script,iframe,object,embed").forEach(node => node.remove());
      tree.querySelectorAll("[contenteditable]").forEach(node => node.removeAttribute("contenteditable"));
      return tree;
    });
    return { pages, styles, base: document.baseURI, bodyClass: document.body.className };
  }

  async function readyImages(doc) {
    await doc.fonts.ready;
    await Promise.all([...doc.images].map(async img => {
      if (img.decode) {
        try { await img.decode(); } catch { /* Validate dimensions below. */ }
      } else if (!img.complete) {
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error("文件圖片載入失敗"));
        });
      }
      if (!img.naturalWidth) throw new Error("文件圖片載入失敗，未建立不完整 PDF");
    }));
  }

  async function makeFrame(state, revealPrintBody) {
    const frame = document.createElement("iframe");
    frame.title = "PDF 文件轉換";
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.cssText = "position:fixed;left:-12000px;top:0;width:1440px;height:1200px;border:0;pointer-events:none;";
    const loaded = new Promise(resolve => { frame.onload = resolve; });
    frame.src = "about:blank";
    document.body.append(frame);
    await loaded;
    const doc = frame.contentDocument;
    const base = doc.createElement("base"); base.href = state.base; doc.head.append(base);
    const style = doc.createElement("style");
    style.textContent = state.styles + `
      html,body{margin:0!important;padding:0!important;width:1440px!important;height:auto!important;overflow:visible!important;background:#fff!important;-webkit-text-size-adjust:none!important;text-size-adjust:none!important}
      ${revealPrintBody ? "body > *:not(dialog){display:block!important}" : ""}
      [data-pdf-ancestor]{display:block!important;position:static!important;inset:auto!important;width:210mm!important;height:auto!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;overflow:visible!important;transform:none!important;zoom:1!important;box-shadow:none!important}
      .pdf-export-page{display:block!important;box-sizing:border-box!important;width:210mm!important;min-width:210mm!important;max-width:210mm!important;min-height:297mm!important;max-height:none!important;margin:0!important;border:0!important;box-shadow:none!important;transform:none!important;zoom:1!important;background:#fff!important;overflow:hidden!important}
      .pdf-export-page [hidden]{display:none!important}
    `;
    doc.head.append(style);
    doc.body.className = state.bodyClass;
    return frame;
  }

  function save(blob, name, host) {
    // A real, named PDF download, not a print dialog or a page-title suggestion.
    const file = new File([blob], name, { type: "application/pdf" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = name;
    link.textContent = "若未自動下載，點此儲存 " + name;
    link.style.cssText = "display:block;margin-top:8px;overflow-wrap:anywhere;";
    host.append(link);
    link.click();
    // Keep a user-activated retry available for mobile browsers that block an
    // automatic download after async rendering. No document content is stored.
    setTimeout(() => { URL.revokeObjectURL(link.href); link.remove(); }, 300000);
  }

  async function download({ root, title, name = "", fileName, button, status, revealPrintBody = false }) {
    if (busy) return;
    if (!root) throw new Error("找不到文件預覽");
    busy = true;
    const originalLabel = button?.textContent;
    if (button) { button.disabled = true; button.textContent = "建立 PDF…"; }
    const message = status || document.createElement("p");
    if (!status) {
      message.setAttribute("role", "status");
      message.className = "pdf-export-status no-print";
      (button?.parentElement || root.parentElement).append(message);
    }
    message.hidden = false;
    message.textContent = "正在建立 PDF，請稍候…";
    let frame;
    try {
      // Snapshot before any await: later edits cannot change an export in progress.
      const state = snapshot(root);
      if (!state.pages.length) throw new Error("目前沒有可匯出的頁面");
      await Promise.all([
        loadLibrary("vendor/html2canvas.min.js", () => !!window.html2canvas),
        loadLibrary("vendor/jspdf.umd.min.js", () => !!window.jspdf?.jsPDF)
      ]);
      frame = await makeFrame(state, revealPrintBody);
      const doc = frame.contentDocument;
      const pdf = new window.jspdf.jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const outputName = fileName ? filename(String(fileName).replace(/\.pdf$/i, "")) : filename(title, name);
      pdf.setProperties({ title: outputName.replace(/\.pdf$/i, ""), creator: "SOBER HR Tools" });
      for (let index = 0; index < state.pages.length; index++) {
        message.textContent = `正在建立 PDF：第 ${index + 1}／${state.pages.length} 頁`;
        doc.body.replaceChildren(doc.importNode(state.pages[index], true));
        await readyImages(doc);
        const page = doc.querySelector(".pdf-export-page");
        if (page.scrollHeight > A4_HEIGHT + 3 || page.scrollWidth > A4_WIDTH + 3) {
          throw new Error(`第 ${index + 1} 頁內容超出 A4 範圍，請縮短內容後重試（不會截斷文件）`);
        }
        // One bounded canvas per physical page, independent of device pixel ratio.
        // Releasing it each time avoids iOS memory limits on merged documents.
        const canvas = await window.html2canvas(page, { scale: 1.8, width: A4_WIDTH, height: A4_HEIGHT,
          windowWidth: 1440, windowHeight: 1200, scrollX: 0, scrollY: 0, backgroundColor: "#fff", logging: false, useCORS: true });
        if (index) pdf.addPage("a4", "portrait");
        pdf.addImage(canvas.toDataURL("image/jpeg", .98), "JPEG", 0, 0, 210, 297, undefined, "FAST");
        canvas.width = 0; canvas.height = 0;
      }
      const blob = pdf.output("blob");
      message.textContent = `PDF 已建立（${state.pages.length} 頁）：${outputName}`;
      save(blob, outputName, message);
      return { pages: state.pages.length, filename: outputName };
    } catch (error) {
      console.error(error);
      message.textContent = `PDF 未建立：${error.message}`;
      return null;
    } finally {
      frame?.remove();
      busy = false;
      if (button) { button.disabled = false; button.textContent = originalLabel; }
    }
  }
  window.HrPdf = { download, filename };
})();
