// Wir nutzen "marked" über CDN für Markdown → füge dies in index.html ein:
// <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

// DOM-Elemente
const log = document.getElementById("log");
const msgInput = document.getElementById("msg");
const sendBtn = document.getElementById("send");

// Scroll zum letzten Eintrag
function scrollToBottom() {
  log.scrollTop = log.scrollHeight;
}

// Nachricht ins Log schreiben
function appendMessage(text, type = "ai") {
  const div = document.createElement("div");
  div.classList.add(type);

  if (type === "ai") {
    // Markdown rendern
    div.innerHTML = marked.parse(text);
  } else {
    // Plain Text für User
    div.textContent = text;
  }

  log.appendChild(div);
  scrollToBottom();
}

// Anfrage an Netlify-Function
async function sendMessage() {
  const message = msgInput.value.trim();
  if (!message) return;

  // User anzeigen
  appendMessage(message, "user");
  msgInput.value = "";

  try {
    const response = await fetch("/.netlify/functions/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    const data = await response.json();
    appendMessage(data.reply, "ai");
  } catch (err) {
    appendMessage("⚠️ Fehler beim Abrufen der Antwort.", "ai");
    console.error(err);
  }
}

// Event-Listener
sendBtn.addEventListener("click", sendMessage);
msgInput.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});
