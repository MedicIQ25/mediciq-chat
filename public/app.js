// Pfad zur Netlify Function
const API = '/.netlify/functions/chat';

const box  = document.getElementById('chat-box');
const send = document.getElementById('send');
const msg  = document.getElementById('msg');

// kleine Begrüßung
addMsg('wie geht es dir?', 'user');
addMsg('Mir geht es gut, danke! Und dir?', 'ai');

// Utility: Nachricht als Bubble anhängen (Markdown → HTML)
function addMsg(text, role = 'ai'){
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  // Markdown rendern (falls vorhanden)
  try {
    el.innerHTML = window.marked ? marked.parse(text) : text;
  } catch {
    el.textContent = text;
  }
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

// Senden-Handler
async function handleSend(){
  const q = msg.value.trim();
  if(!q) return;
  addMsg(q, 'user');
  msg.value = '';
  msg.focus();

  send.disabled = true;
  try{
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ message: q })
    });
    if(!res.ok){
      const t = await res.text();
      throw new Error(t || `HTTP ${res.status}`);
    }
    const data = await res.json();
    addMsg(data.reply || 'Es kam keine Antwort zurück.', 'ai');
  }catch(err){
    console.error(err);
    addMsg('⚠️ Es ist ein Fehler aufgetreten. Bitte später erneut versuchen.', 'ai');
  }finally{
    send.disabled = false;
  }
}

// Events
send.addEventListener('click', handleSend);
msg.addEventListener('keydown', (e) => {
  if(e.key === 'Enter') handleSend();
});
