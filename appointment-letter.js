(() => {
  "use strict";
  const printCore=document.createElement("link");printCore.rel="stylesheet";printCore.href="print-core.css?v=20260902-mobile-print-v1";document.head.append(printCore);const settingsStyle=document.createElement("link");settingsStyle.rel="stylesheet";settingsStyle.href="appointment-settings.css?v=20260902";document.head.append(settingsStyle);

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
  const originalPageTitle=document.title;
  let locationManuallyChanged = false;
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  $("documentDate").value = localToday;
  const contentStorageKey="soberHrAppointmentTemplateV1";
  const editableSections=[{key:"general",label:"一般版通知內容",selector:"#generalTerms",mode:"paragraphs"},{key:"sales",label:"業務版通知內容",selector:"#salesTerms",mode:"paragraphs"},{key:"documents",label:"報到文件清單",selector:".onboarding-documents ol",mode:"list"},{key:"notes",label:"注意事項",selector:".important-notes",mode:"list"}].filter(item=>document.querySelector(item.selector));
  const defaults=Object.fromEntries(editableSections.map(item=>{const node=document.querySelector(item.selector),parts=item.mode==="list"?[...node.querySelectorAll("li")]:[...node.querySelectorAll(":scope > p")];return[item.key,(parts.length?parts:[node]).map(part=>part.textContent.trim()).filter(Boolean).join("\n")]}));
  function applyTemplateContent(values){editableSections.forEach(item=>{const node=document.querySelector(item.selector),lines=String(values[item.key]??defaults[item.key]??"").split(/\r?\n/).map(line=>line.trim()).filter(Boolean);if(item.mode==="list")node.replaceChildren(...lines.map(line=>{const li=document.createElement("li");li.textContent=line;return li}));else node.replaceChildren(...lines.map(line=>{const p=document.createElement("p");p.textContent=line;return p}))})}
  function savedTemplate(){try{return{...defaults,...JSON.parse(localStorage.getItem(contentStorageKey)||"{}")}}catch{return{...defaults}}}
  function fitLetterPreview(){const letter=$("letter"),area=letter.closest(".preview-area"),scale=innerWidth<=980?Math.min(1,area.clientWidth/794):1;letter.style.setProperty("--letter-preview-scale",String(scale));area.style.setProperty("--letter-preview-height",`${Math.ceil(letter.scrollHeight*scale+28)}px`)}
  function fitTemplateContent(){const letter=$("letter");letter.classList.remove("content-compact","content-tight");requestAnimationFrame(()=>{if(letter.scrollHeight>1123)letter.classList.add("content-compact");requestAnimationFrame(()=>{if(letter.scrollHeight>1123)letter.classList.add("content-tight");const status=$("templateSettingsStatus");if(status&&letter.scrollHeight>1123)status.textContent="內容仍超出版面，請縮短文字後再匯出。";fitLetterPreview()})})}
  function installTemplateSettings(){if(!editableSections.length)return;const details=document.createElement("details");details.className="template-settings";details.innerHTML=`<summary>後台｜聘任通知書內容設定</summary><div class="template-settings__body"><p>只調整制式文字；姓名、職稱、薪資與日期仍由上方欄位帶入。</p>${editableSections.map(item=>`<label>${item.label}<textarea data-template-key="${item.key}" rows="4"></textarea></label>`).join("")}<div class="template-settings__actions"><button type="button" id="saveTemplateSettings">儲存設定</button><button type="button" id="resetTemplateSettings">恢復原始內容</button></div><p id="templateSettingsStatus" aria-live="polite"></p></div>`;form.insertBefore(details,form.querySelector(".privacy-note"));const values=savedTemplate();details.querySelectorAll("textarea").forEach(area=>area.value=values[area.dataset.templateKey]||"");$("saveTemplateSettings").onclick=()=>{const next={};details.querySelectorAll("textarea").forEach(area=>next[area.dataset.templateKey]=area.value);localStorage.setItem(contentStorageKey,JSON.stringify(next));applyTemplateContent(next);render();$("templateSettingsStatus").textContent="設定已儲存在這台裝置的瀏覽器。"};$("resetTemplateSettings").onclick=()=>{localStorage.removeItem(contentStorageKey);details.querySelectorAll("textarea").forEach(area=>area.value=defaults[area.dataset.templateKey]||"");applyTemplateContent(defaults);render();$("templateSettingsStatus").textContent="已恢復原始內容。"};applyTemplateContent(values)}
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

  function render() {
    const company = companies[$("company").value];
    const version = form.querySelector('input[name="version"]:checked').value;
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
    text("outTaxId", company.taxId);
    $("generalTerms").hidden = version === "sales";
    $("salesTerms").hidden = version !== "sales";
    $("laptopDocument").hidden = version === "general";
    fitTemplateContent();
  }

  function printDocument(showHint) {
    if (!form.reportValidity()) return;
    $("pdfHint").hidden = !showHint;
    document.title="聘任通知書";
    requestAnimationFrame(() => window.print());
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
  $("printButton").addEventListener("click", () => printDocument(false));
  $("pdfButton").addEventListener("click", () => printDocument(true));
  window.addEventListener("afterprint", () => { $("pdfHint").hidden = true; document.title=originalPageTitle; });
  $("location").value = companies[$("company").value].defaultLocation;
  window.addEventListener("resize",fitLetterPreview);
  render();
})();
