const log = document.getElementById('log');
const msg = document.getElementById('msg');
const btn = document.getElementById('send');

function add(role, text){
  const div = document.createElement('div');
  div.className = 'msg ' + (role === 'user' ? 'user' : 'bot');
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

async function send(){
  const q = (msg.value || '').trim();
  if (!q) return;
  add('user', q);
  msg.value = '';
  btn.disabled = true;

  try{
    const r = await fetch('/.netlify/functions/chat', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ message: q })
    });
    const data = await r.json();
    add('bot', data.reply || '(keine Antwort)');
  }catch(e){
    add('bot', 'Fehler: ' + e.message);
  }finally{
    btn.disabled = false;
    msg.focus();
  }
}

btn.addEventListener('click', send);
msg.addEventListener('keydown', e => { if(e.key === 'Enter') send(); });
