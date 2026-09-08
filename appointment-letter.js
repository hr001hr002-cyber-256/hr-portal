(() => {
  "use strict";

  const settingsStyle = document.createElement("link");
  settingsStyle.rel = "stylesheet";
  settingsStyle.href = "appointment-settings.css?v=20260902-content-settings-v2";
  document.head.append(settingsStyle);

  const companies = {
    sober: { name: "搜博科技股份有限公司", taxId: "29035099", logo: "assets/logos/sober.jpg", defaultLocation: "taipei", centeredLogo: false },
    maya: { name: "馬雅科技股份有限公司", taxId: "96784466", logo: "assets/logos/maya.png", defaultLocation: "taipei", centeredLogo: true },
    ideas: { name: "創思影像有限公司", taxId: "83116175", logo: "assets/logos/ideas.jpg", defaultLocation: "tainan" },
    show: { name: "搜秀網路行銷有限公司", taxId: "53484399", logo: "assets/logos/soshow.jpg", defaultLocation: "taichung" },
    create: { name: "搜創網路行銷有限公司", taxId: "91105931", logo: "assets/logos/socreative.jpg", defaultLocation: "kaohsiung" }
  };
  const locations = {
    taipei: { address: "新北市中和區中正路866號17樓", company: "搜博科技" },
    tainan: { address: "台南市中西區府前路二段281號3樓之2", company: "創思影像" },
    taichung: { address: "台中市北屯區崇德路二段256號14樓A1", company: "搜秀網路行銷" },
    kaohsiung: { address: "高雄市苓雅區新光路38號20樓之5", company: "搜創網路行銷" }
  };

  const $ = (id) => document.getElementById(id);
  const form = $("appointmentForm");
  const pageTitle = document.title;
  const wordButton = $("printButton");
  const pdfHint = $("pdfHint");
  const pdfHintText = pdfHint.textContent;
  let wordExporterPromise;
  let locationManuallyChanged = false;
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  $("documentDate").value = localToday;

  const contentStorageKey = "soberHrAppointmentTemplateV1";
  const editableSections = [
    { key: "general", label: "一般版通知內容", selector: "#generalTerms", mode: "paragraphs" },
    { key: "sales", label: "業務版通知內容", selector: "#salesTerms", mode: "paragraphs" },
    { key: "documents", label: "報到文件清單", selector: ".onboarding-documents ol", mode: "list", preserveSelector: "#laptopDocument" },
    { key: "notes", label: "注意事項", selector: ".important-notes", mode: "list" }
  ].filter(item => document.querySelector(item.selector));
  const defaultTemplateContent = Object.fromEntries(editableSections.map(item => {
    const node = document.querySelector(item.selector);
    const parts = item.mode === "list" ? [...node.querySelectorAll("li")].filter(part => !item.preserveSelector || !part.matches(item.preserveSelector)) : [...node.querySelectorAll(":scope > p")];
    return [item.key, (parts.length ? parts : [node]).map(part => part.textContent.trim()).filter(Boolean).join("\n")];
  }));
  const templateBaselineHeight = Math.max(1123, $("letter").scrollHeight);
  let templateContentFits = true;

  function templateLines(value) {
    return String(value ?? "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  }

  function appendTemplateText(element, line, section) {
    if (section !== "documents") {
      element.textContent = line;
      return;
    }
    // Keep company data dynamic when editable list items are rebuilt. Older saved
    // settings contain the rendered tax ID instead of the original inline span.
    const parts = line.replace(/(統編[\s：:]*)\d{8}/g, "$1{{公司統編}}")
      .split("{{公司統編}}");
    parts.forEach((part, index) => {
      if (index) {
        const taxId = document.createElement("span");
        taxId.dataset.companyTaxId = "";
        taxId.textContent = companies[$("company").value].taxId;
        element.append(taxId);
      }
      element.append(document.createTextNode(part));
    });
  }

  function applyTemplateContent(values) {
    editableSections.forEach(item => {
      const node = document.querySelector(item.selector);
      const preservedElement = item.preserveSelector ? node.querySelector(item.preserveSelector) : null;
      const preservedText = preservedElement?.textContent.trim() || "";
      const lines = templateLines(values[item.key] ?? defaultTemplateContent[item.key])
        .filter(line => !preservedText || line !== preservedText);
      const elements = lines.map(line => {
        const element = document.createElement(item.mode === "list" ? "li" : "p");
        appendTemplateText(element, line, item.key);
        return element;
      });
      node.replaceChildren(...elements);
      if (preservedElement) node.append(preservedElement);
    });
  }

  function savedTemplateContent() {
    try {
      return { ...defaultTemplateContent, ...JSON.parse(localStorage.getItem(contentStorageKey) || "{}") };
    } catch {
      return { ...defaultTemplateContent };
    }
  }

  function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(resolve));
  }

  async function fitTemplateContent() {
    const letter = $("letter");
    letter.classList.remove("content-compact", "content-tight");
    await nextFrame();
    if (letter.scrollHeight > templateBaselineHeight) letter.classList.add("content-compact");
    await nextFrame();
    if (letter.scrollHeight > templateBaselineHeight) letter.classList.add("content-tight");
    await nextFrame();
    templateContentFits = letter.scrollHeight <= templateBaselineHeight;
    return templateContentFits;
  }

  function setTemplateStatus(message, isError = false) {
    const status = $("templateSettingsStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  function installTemplateSettings() {
    if (!editableSections.length) return;
    const details = document.createElement("details");
    details.className = "template-settings";
    details.innerHTML = `<summary>後台｜聘任通知書內容設定</summary><div class="template-settings__body"><p>只調整制式文字；姓名、職稱、薪資、報到日期與地點仍由原欄位帶入。每一行會建立為一個段落或清單項目，設定只儲存在目前瀏覽器。</p>${editableSections.map(item => `<label>${item.label}<textarea data-template-key="${item.key}" rows="4"></textarea></label>`).join("")}<div class="template-settings__actions"><button type="button" id="saveTemplateSettings">儲存設定</button><button type="button" id="resetTemplateSettings">恢復原始內容</button></div><p class="template-settings__status" id="templateSettingsStatus" aria-live="polite"></p></div>`;
    form.insertBefore(details, form.querySelector(".privacy-note"));
    const values = savedTemplateContent();
    details.querySelectorAll("textarea").forEach(area => { area.value = values[area.dataset.templateKey] || ""; });

    $("saveTemplateSettings").addEventListener("click", async () => {
      const previous = savedTemplateContent();
      const next = {};
      details.querySelectorAll("textarea").forEach(area => { next[area.dataset.templateKey] = area.value; });
      applyTemplateContent(next);
      if (!(await fitTemplateContent())) {
        applyTemplateContent(previous);
        await fitTemplateContent();
        setTemplateStatus("內容過長，已保留原設定。請縮短文字後再儲存。", true);
        return;
      }
      localStorage.setItem(contentStorageKey, JSON.stringify(next));
      setTemplateStatus("設定已儲存，後續新產生的文件會直接套用。", false);
    });

    $("resetTemplateSettings").addEventListener("click", async () => {
      localStorage.removeItem(contentStorageKey);
      details.querySelectorAll("textarea").forEach(area => { area.value = defaultTemplateContent[area.dataset.templateKey] || ""; });
      applyTemplateContent(defaultTemplateContent);
      await fitTemplateContent();
      setTemplateStatus("已恢復原始制式內容。", false);
    });
    applyTemplateContent(values);
  }

  installTemplateSettings();

  function text(id, value, fallback = "—") { $(id).textContent = value || fallback; }
  function formatMoney(value) { return value ? `新臺幣 ${Number(value).toLocaleString("zh-TW")} 元整` : "新臺幣 — 元整"; }
  function formatDate(value) {
    if (!value) return "—";
    const [year, month, day] = value.split("-").map(Number);
    return `民國 ${year - 1911} 年 ${month} 月 ${day} 日`;
  }
  function rocToIso(value) {
    const digits = value.replace(/\D/g, "");
    if (!/^\d{7}$/.test(digits)) return "";
    const year = Number(digits.slice(0, 3)) + 1911;
    const month = Number(digits.slice(3, 5));
    const day = Number(digits.slice(5, 7));
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "";
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  function isoToRoc(value) {
    if (!value) return "";
    const [year, month, day] = value.split("-");
    return `${String(Number(year) - 1911).padStart(3, "0")}${month}${day}`;
  }
  function formatTime(value) {
    if (!value) return "—";
    const [hour, minute] = value.split(":").map(Number);
    return `${hour < 12 ? "上午" : "下午"} ${hour % 12 || 12}:${String(minute).padStart(2, "0")}`;
  }

  function syncDocumentVersion() {
    const version = form.querySelector('input[name="version"]:checked')?.value || "general";
    const generalTerms = $("generalTerms");
    const salesTerms = $("salesTerms");
    const showSales = version === "sales";
    generalTerms.hidden = showSales;
    salesTerms.hidden = !showSales;
    const laptopDocument = $("laptopDocument");
    if (laptopDocument) laptopDocument.hidden = !showSales;
    $("letter").dataset.documentVersion = version;
    return version;
  }

  function render() {
    const company = companies[$("company").value];
    $("companyLogo").src = company.logo;
    $("companyLogo").alt = `${company.name} Logo`;
    $("companyLogo").classList.toggle("company-logo--centered", company.centeredLogo === true);
    text("closingCompany", company.name);
    text("outName", $("candidateName").value, "求職者姓名");
    text("outSalutation", $("salutation").value);
    text("outDepartment", $("department").value);
    text("outPosition", $("position").value);
    text("outSalary", `${formatMoney($("salary").value)}（內含全勤 1,000 元）`);
    text("outStartDate", formatDate($("startDate").value));
    text("outStartTime", formatTime($("startTime").value));
    const selectedLocation = $("location").value;
    const location = locations[selectedLocation];
    const locationText = location
      ? `${location.address}${selectedLocation !== company.defaultLocation ? `（${location.company}）` : ""}`
      : "";
    text("outLocation", locationText);
    text("outDocumentDate", formatDate($("documentDate").value));
    $("letter").querySelectorAll("#outTaxId, [data-company-tax-id]").forEach(node => {
      node.textContent = company.taxId;
    });
    syncDocumentVersion();
    void fitTemplateContent();
  }

  async function downloadPdf() {
    if (!form.reportValidity()) return;
    syncDocumentVersion();
    if (!templateContentFits) {
      const settings = document.querySelector(".template-settings");
      if (settings) settings.open = true;
      setTemplateStatus("內容超出版面，請縮短制式文字後再匯出。", true);
      return;
    }
    try {
      await import("./pdf-export.js?v=20260903-direct-pdf-1");
      await window.HrPdf.download({ root: $("letter"), title: "聘任通知書", name: $("candidateName").value,
        button: $("pdfButton"), status: pdfHint });
    } catch (error) {
      pdfHint.hidden = false;
      pdfHint.textContent = "PDF 元件載入失敗，請重新整理後再試。";
      console.error(error);
    }
  }

  function loadWordExporter() {
    if (window.AppointmentWordExporter) return Promise.resolve(window.AppointmentWordExporter);
    if (wordExporterPromise) return wordExporterPromise;
    wordExporterPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "appointment-word.js?v=20260903-word-export-2";
      script.onload = () => window.AppointmentWordExporter
        ? resolve(window.AppointmentWordExporter)
        : reject(new Error("Word 元件未完成載入"));
      script.onerror = () => {
        wordExporterPromise = undefined;
        script.remove();
        reject(new Error("Word 元件載入失敗"));
      };
      document.head.append(script);
    });
    return wordExporterPromise;
  }

  async function downloadWord() {
    if (!form.reportValidity()) return;
    syncDocumentVersion();
    if (!templateContentFits) {
      const settings = document.querySelector(".template-settings");
      if (settings) settings.open = true;
      setTemplateStatus("內容超出版面，請縮短制式文字後再匯出。", true);
      return;
    }
    const company = companies[$("company").value];
    const letter = $("letter").cloneNode(true);
    const candidateName = $("candidateName").value.trim().replace(/[\\/:*?"<>|]/g, "_");
    const filename = candidateName ? `聘任通知書-${candidateName}` : "聘任通知書";
    const originalLabel = wordButton.textContent;
    wordButton.disabled = true;
    wordButton.textContent = "建立 Word…";
    pdfHint.hidden = true;
    try {
      const exporter = await loadWordExporter();
      await exporter.download({ filename, companyName: company.name, logoUrl: company.logo, letter });
      pdfHint.textContent = "Word 文件已下載。";
      pdfHint.hidden = false;
    } catch (error) {
      console.error(error);
      pdfHint.textContent = "Word 建立失敗，請重新整理後再試。";
      pdfHint.hidden = false;
    } finally {
      wordButton.disabled = false;
      wordButton.textContent = originalLabel;
    }
  }

  form.addEventListener("input", render);
  form.addEventListener("change", render);
  $("company").addEventListener("change", () => {
    if (!locationManuallyChanged) $("location").value = companies[$("company").value].defaultLocation;
    render();
  });
  $("location").addEventListener("change", () => {
    locationManuallyChanged = true;
    render();
  });
  $("startDateRoc").addEventListener("input", () => {
    const iso = rocToIso($("startDateRoc").value);
    if (iso) $("startDate").value = iso;
    render();
  });
  $("startDate").addEventListener("change", () => {
    $("startDateRoc").value = isoToRoc($("startDate").value);
    render();
  });
  form.addEventListener("reset", () => {
    setTimeout(() => {
      locationManuallyChanged = false;
      $("documentDate").value = localToday;
      $("startTime").value = "09:00";
      $("location").value = companies[$("company").value].defaultLocation;
      render();
    }, 0);
  });
  wordButton.textContent = "下載 Word";
  wordButton.addEventListener("click", downloadWord);
  $("pdfButton").addEventListener("click", downloadPdf);
  window.addEventListener("afterprint", () => {
    pdfHint.hidden = true;
    pdfHint.textContent = pdfHintText;
    document.title = pageTitle;
  });
  $("location").value = companies[$("company").value].defaultLocation;
  render();
})();
