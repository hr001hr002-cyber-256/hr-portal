(() => {
  "use strict";
  const $=id=>document.getElementById(id),form=$("confirmationForm"),message=$("formMessage");
  const pad=n=>String(n).padStart(2,"0");
  function validDate(y,m,d){const value=new Date(y,m-1,d,12);return value.getFullYear()===y&&value.getMonth()===m-1&&value.getDate()===d?value:null}
  function parseDate(value){
    const text=String(value||"").trim();if(!text)return null;
    let m=text.match(/^(\d{7})$/);if(m)return validDate(+m[1].slice(0,3)+1911,+m[1].slice(3,5),+m[1].slice(5,7));
    m=text.match(/^(\d{8})$/);if(m)return validDate(+m[1].slice(0,4),+m[1].slice(4,6),+m[1].slice(6,8));
    m=text.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(m)return validDate(+m[1],+m[2],+m[3]);
    m=text.match(/^(?:民國\s*)?(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?$/);if(m)return validDate(+m[1]+1911,+m[2],+m[3]);
    m=text.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);if(m)return validDate(+m[1],+m[2],+m[3]);
    return null;
  }
  const roc=d=>d?`民國${d.getFullYear()-1911}年${pad(d.getMonth()+1)}月${pad(d.getDate())}日`:"";
  const iso=d=>d?`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`:"";
  function installDate(field){
    const text=$(field),picker=$(`${field}Picker`),choose=$(`${field}Choose`),today=$(`${field}Today`);
    const sync=()=>{if(!text.value){text.setCustomValidity("");text.classList.remove("native-date-error");picker.value="";return true}const d=parseDate(text.value);if(!d){text.setCustomValidity("請輸入有效日期，例如 1000803、1150803 或 20260803");text.classList.add("native-date-error");return false}text.value=roc(d);picker.value=iso(d);text.setCustomValidity("");text.classList.remove("native-date-error");render();return true};
    text.addEventListener("input",()=>{text.setCustomValidity("");text.classList.remove("native-date-error")});text.addEventListener("blur",sync);
    picker.addEventListener("change",()=>{const d=parseDate(picker.value);text.value=roc(d);sync()});
    choose.addEventListener("click",()=>typeof picker.showPicker==="function"?picker.showPicker():picker.click());
    today.addEventListener("click",()=>{text.value=roc(new Date());sync()});
    return sync;
  }
  function installOptionalTextDate(field){
    const text=$(field);
    const sync=()=>{if(!text.value){text.setCustomValidity("");text.classList.remove("native-date-error");return true}const d=parseDate(text.value);if(!d){text.setCustomValidity("請輸入正確日期，例如 1150731 或 20260731");text.classList.add("native-date-error");return false}text.value=roc(d);text.setCustomValidity("");text.classList.remove("native-date-error");render();return true};
    text.addEventListener("input",()=>{text.setCustomValidity("");text.classList.remove("native-date-error")});text.addEventListener("blur",sync);
    return sync;
  }
  const syncDates=[installDate("startDate"),installDate("documentDate"),installOptionalTextDate("lastWorkDate")];
  const REQUIRED_FIELDS=["employeeName","employeeNo","department","jobTitle","startDate","documentDate"];
  const OPTIONAL_FIELDS=["terminationReason","improvementRecord","lastWorkDate","supervisorName","hrReceiver","check-notice","check-insurance","check-payroll","check-leave","check-documents","check-archive"];
  const DOCUMENT_NOTE="備註：本表為內部作業文件，供主管與人資確認資遣流程及後續行政事項。";
  const LAST_WORK_DATE_BLANK="____ / ____ / ____";
  const INPUT_LIMITS={employeeName:30,employeeNo:30,department:40,jobTitle:40,terminationReason:180,improvementRecord:300,lastWorkDate:30,supervisorName:40,hrReceiver:40};
  for(const id of REQUIRED_FIELDS)$(id).required=true;
  for(const id of OPTIONAL_FIELDS)$(id).required=false;
  document.querySelectorAll(".doc-note").forEach(note=>note.textContent=DOCUMENT_NOTE);
  for(const [id,maxLength] of Object.entries(INPUT_LIMITS))$(id).maxLength=maxLength;
  function value(id,fallback=""){return $(id).value.trim()||fallback}
  function check(id){return $(id).checked?"☑":"☐"}
  function render(){
    $("outName").textContent=value("employeeName");$("outNo").textContent=value("employeeNo");$("outDepartment").textContent=value("department");$("outJobTitle").textContent=value("jobTitle");$("outStartDate").textContent=value("startDate");$("outDocumentDate").textContent=value("documentDate");$("outReason").textContent=value("terminationReason");$("outImprovement").textContent=value("improvementRecord");$("outLastDate").textContent=value("lastWorkDate",LAST_WORK_DATE_BLANK);$("outSupervisor").textContent=value("supervisorName");$("outHr").textContent=value("hrReceiver");
    for(const id of ["notice","insurance","payroll","leave","documents","archive"]){$(`out-${id}`).textContent=`${check(`check-${id}`)} ${$(`label-${id}`).textContent}`}
  }
  function validate(){
    message.textContent="";
    const datesValid=syncDates.every(fn=>fn());
    const missingRequired=REQUIRED_FIELDS.some(id=>!value(id));
    if(missingRequired){message.textContent="請完成所有必填欄位。";form.reportValidity();return false}
    if(!datesValid||!form.reportValidity()){message.textContent="請修正日期格式。";return false}
    return true;
  }
  const esc=s=>String(s??"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
  function wordText(value){return esc(value).replace(/\r\n?|\n/g,'</w:t><w:br/><w:t xml:space="preserve">')}
  function replaceToken(xml,key,value){return xml.split(`{{${key}}}`).join(wordText(value))}
  async function downloadWord(){
    if(!validate())return;
    try{const response=await fetch("templates/資遣確認單-範本.docx");if(!response.ok)throw Error("找不到 Word 範本");const zip=await JSZip.loadAsync(await response.arrayBuffer());let xml=await zip.file("word/document.xml").async("string");const tokens={EMPLOYEE_NAME:value("employeeName"),EMPLOYEE_NO:value("employeeNo"),DEPARTMENT:value("department"),JOB_TITLE:value("jobTitle"),START_DATE:value("startDate"),DOCUMENT_DATE:value("documentDate"),TERMINATION_REASON:value("terminationReason"),IMPROVEMENT_RECORD:value("improvementRecord"),LAST_WORK_DATE:value("lastWorkDate",LAST_WORK_DATE_BLANK),SUPERVISOR_NAME:value("supervisorName"),HR_RECEIVER:value("hrReceiver"),CHECK_NOTICE:check("check-notice"),CHECK_INSURANCE:check("check-insurance"),CHECK_PAYROLL:check("check-payroll"),CHECK_LEAVE:check("check-leave"),CHECK_DOCUMENTS:check("check-documents"),CHECK_ARCHIVE:check("check-archive")};for(const [key,val] of Object.entries(tokens))xml=replaceToken(xml,key,val);zip.file("word/document.xml",xml);const blob=await zip.generateAsync({type:"blob"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${value("employeeName","員工")}_資遣確認單.docx`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}catch(error){message.textContent=`無法產生 Word：${error.message}`}
  }
  function fitDialog(){const dialog=$("pdfDialog"),paper=$("dialogPaper");if(!dialog.open)return;paper.innerHTML=$("previewPaper").innerHTML;const fit=Math.min(1,(dialog.clientWidth-24)/794);dialog.style.setProperty("--fit-scale",String(fit))}
  $("previewPdf").addEventListener("click",()=>{if(!validate())return;$("pdfDialog").showModal();requestAnimationFrame(fitDialog)});$("printPdf").addEventListener("click",()=>{document.body.classList.add("printing-dialog");window.print()});window.addEventListener("afterprint",()=>document.body.classList.remove("printing-dialog"));$("closeDialog").addEventListener("click",()=>$("pdfDialog").close());$("toggleZoom").addEventListener("click",()=>{$("pdfDialog").classList.toggle("zoomed");$("toggleZoom").textContent=$("pdfDialog").classList.contains("zoomed")?"符合寬度":"放大閱讀"});$("downloadWord").addEventListener("click",downloadWord);window.addEventListener("resize",fitDialog);form.addEventListener("input",render);form.addEventListener("change",render);form.addEventListener("reset",()=>setTimeout(()=>{message.textContent="";$("documentDate").value=roc(new Date());syncDates.forEach(fn=>fn());render()},0));$("documentDate").value=roc(new Date());syncDates.forEach(fn=>fn());render();
})();
