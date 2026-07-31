(() => {
  "use strict";

  const companies = {
    sober: { name: "搜博科技股份有限公司", mark: "SOBER", sub: "SOBER TECHNOLOGY", color: "#203b34" },
    maya: { name: "馬雅科技股份有限公司", mark: "MAYA", sub: "MAYA TECHNOLOGY", color: "#334e5c" },
    ideas: { name: "創思影像有限公司", mark: "IDEAS", sub: "CREATIVE IMAGING", color: "#4f5149" },
    show: { name: "搜秀網路行銷有限公司", mark: "SHOW", sub: "DIGITAL MARKETING", color: "#315d50" },
    create: { name: "搜創網路行銷有限公司", mark: "CREATE", sub: "DIGITAL MARKETING", color: "#3d554b" }
  };

  const $ = (id) => document.getElementById(id);
  const form = $("appointmentForm");
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
  function formatTime(value) {
    if (!value) return "—";
    const [hour, minute] = value.split(":").map(Number);
    return `${hour < 12 ? "上午" : "下午"} ${hour % 12 || 12}:${String(minute).padStart(2, "0")}`;
  }

  function render() {
    const company = companies[$("company").value];
    const version = form.querySelector('input[name="version"]:checked').value;
    text("companyMark", company.mark);
    $("companyMark").style.backgroundColor = company.color;
    text("companyName", company.name);
    text("companySub", company.sub);
    text("closingCompany", company.name);
    text("outName", $("candidateName").value, "求職者姓名");
    text("outSalutation", $("salutation").value);
    text("outDepartment", $("department").value);
    text("outPosition", $("position").value);
    text("outSalary", formatMoney($("salary").value));
    text("outStartDate", formatDate($("startDate").value));
    text("outStartTime", formatTime($("startTime").value));
    text("outLocation", $("location").value);
    text("outDocumentDate", formatDate($("documentDate").value));
    $("generalTerms").hidden = version === "sales";
    $("salesTerms").hidden = version !== "sales";
  }

  function printDocument(showHint) {
    if (!form.reportValidity()) return;
    $("pdfHint").hidden = !showHint;
    requestAnimationFrame(() => window.print());
  }

  form.addEventListener("input", render);
  form.addEventListener("change", render);
  form.addEventListener("reset", () => {
    setTimeout(() => { $("documentDate").value = localToday; $("startTime").value = "09:00"; render(); }, 0);
  });
  $("printButton").addEventListener("click", () => printDocument(false));
  $("pdfButton").addEventListener("click", () => printDocument(true));
  window.addEventListener("afterprint", () => { $("pdfHint").hidden = true; });
  render();
})();
