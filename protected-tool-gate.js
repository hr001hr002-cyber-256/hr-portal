(() => {
  "use strict";
  const gate=document.getElementById("protectedToolGate"),form=document.getElementById("protectedToolForm"),password=document.getElementById("protectedToolPassword"),error=document.getElementById("protectedToolError"),button=document.getElementById("protectedToolSubmit");
  const storageKey="soberHrSessionSecret",encoder=new TextEncoder();
  const bytes=base64=>Uint8Array.from(atob(base64),char=>char.charCodeAt(0));
  async function verify(secret){
    const material=await crypto.subtle.importKey("raw",encoder.encode(secret),"PBKDF2",false,["deriveKey"]);
    const key=await crypto.subtle.deriveKey({name:"PBKDF2",salt:bytes(window.SECURE_PAGE.salt),iterations:250000,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["decrypt"]);
    await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(window.SECURE_PAGE.iv)},key,bytes(window.SECURE_PAGE.ciphertext));
  }
  const protectedNodes=[...document.body.children].filter(node=>node!==gate&&node.tagName!=="SCRIPT"),originalHidden=new Map(protectedNodes.map(node=>[node,node.hidden]));protectedNodes.forEach(node=>{node.inert=true;node.hidden=true});
  function unlock(){document.body.classList.remove("tool-locked");protectedNodes.forEach(node=>{node.inert=false;node.hidden=originalHidden.get(node)});gate.hidden=true}
  async function restore(){const secret=sessionStorage.getItem(storageKey);if(!secret)return;try{await verify(secret);unlock()}catch{sessionStorage.removeItem(storageKey)}}
  form.addEventListener("submit",async event=>{event.preventDefault();error.textContent="";button.disabled=true;button.textContent="驗證中…";try{await verify(password.value);sessionStorage.setItem(storageKey,password.value);unlock()}catch{error.textContent="密碼不正確，請重新輸入。";password.select();button.disabled=false;button.textContent="進入功能區"}});
  restore();
})();
