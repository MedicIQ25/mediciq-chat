const sendBtn = document.getElementById("send");
const input = document.getElementById("msg");
const chatLog = document.getElementById("log");

// Nachricht in den Chat hängen (User oder KI)
function addMessage(role, content) {
  const msg = document.createElement("div");
  msg.className = role;

  if (role === "assistant" && window.marked) {
    // KI-Antwort als Markdown rendern
    msg.innerHTML = marked.parse(content);
  } else {
    // User-Eingaben als Plaintext
    msg.textContent = content;
  }

  chatLog.appendChild(msg);
  chatLog.scrollTop = chatLog.scrollHeight; // autoscroll
}

// Nachricht an die Netlify-Funktion schicken
async function sendMessage() {
  const message = input.value.trim();
  if (!message) return;

  addMessage("user", message);
  input.value = "";

  try {
    const res = await fetch("/.netlify/functions/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const data = await res.json();

    if (data.reply) {
      addMessage("assistant", data.reply);
    } else {
      addMessage("assistant", "⚠️ Keine Antwort erhalten.");
    }
  } catch (err) {
    console.error(err);
    addMessage("assistant", "⚠️ Fehler bei der Anfrage.");
  }
}

// Klick & Enter
sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});
