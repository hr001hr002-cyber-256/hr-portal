(() => {
  "use strict";

  const companies = {
    sober: { name: "搜博科技股份有限公司", taxId: "29035099", logo: "assets/logos/sober.jpg", defaultLocation: "taipei" },
    maya: { name: "馬雅科技股份有限公司", taxId: "96784466", logo: "assets/logos/maya.png", defaultLocation: "taipei" },
    ideas: { name: "創思影像有限公司", taxId: "83116175", logo: "assets/logos/ideas.jpg", defaultLocation: "tainan" },
    show: { name: "搜秀網路行銷有限公司", taxId: "53484399", logo: "assets/logos/soshow.jpg", defaultLocation: "taichung" },
    create: { name: "搜創網路行銷有限公司", taxId: "91105931", logo: "assets/logos/socreative.jpg", defaultLocation: "kaohsiung" }
  };
  const locations = {
    taipei: "新北市中和區中正路866號17樓（搜博科技）",
    tainan: "台南市中西區府前路二段281號3樓之2（創思影像）",
    taichung: "台中市北屯區崇德路二段256號14樓A1（搜秀網路行銷）",
    kaohsiung: "高雄市苓雅區新光路38號20樓之5（搜創網路行銷）"
  };

  const $ = (id) => document.getElementById(id);
  const form = $("appointmentForm");
  let locationManuallyChanged = false;
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  $("documentDate").value = localToday;

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
    text("closingCompany", company.name);
    text("outName", $("candidateName").value, "求職者姓名");
    text("outSalutation", $("salutation").value);
    text("outDepartment", $("department").value);
    text("outPosition", $("position").value);
    text("outSalary", `${formatMoney($("salary").value)}（內含全勤 1,000 元）`);
    text("outStartDate", formatDate($("startDate").value));
    text("outStartTime", formatTime($("startTime").value));
    text("outLocation", locations[$("location").value]);
    text("outDocumentDate", formatDate($("documentDate").value));
    text("outTaxId", company.taxId);
    $("generalTerms").hidden = version === "sales";
    $("salesTerms").hidden = version !== "sales";
    $("laptopDocument").hidden = version === "general";
  }

  function printDocument(showHint) {
    if (!form.reportValidity()) return;
    $("pdfHint").hidden = !showHint;
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
  window.addEventListener("afterprint", () => { $("pdfHint").hidden = true; });
  $("location").value = companies[$("company").value].defaultLocation;
  render();
})();
