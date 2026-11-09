document.querySelector('#login').addEventListener('submit',async e=>{
 e.preventDefault();const button=document.querySelector('button'),error=document.querySelector('#error');button.disabled=true;error.textContent=''
 try{const r=await fetch('/api/guest/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:document.querySelector('#code').value.trim()}),credentials:'same-origin'});const data=await r.json();if(!r.ok)throw Error(data.error||'验证未完成');location.replace('/')}catch(e){error.textContent=e.message;button.disabled=false}
})
