// ---- Settings: change these to match what you installed in Ollama ----
const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "gemma3:270m"; // run `ollama list` to see your exact model name
// ----------------------------------------------------------------------

const form = document.getElementById("form");
const button = document.getElementById("go");
const statusEl = document.getElementById("status");
const results = document.getElementById("results");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const prefs = {
    mood: data.get("mood"),
    time: data.get("time"),
    genre: data.get("genre"),
  };

  button.disabled = true;
  results.innerHTML = "";
  setStatus("Asking Gemma... this can take 10-60 seconds on the first run.");

  try {
    const games = await getRecommendations(prefs);
    showGames(games);
    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus(friendlyError(err), true);
  } finally {
    button.disabled = false;
  }
});

function buildPrompt({ mood, time, genre }) {
  return `Recommend 3 real, popular PC games for a player who feels ${mood}, has ${time}, and wants ${genre} games.

Reply with JSON only, like this example:
{"games":[
{"title":"Hades","description":"A fast roguelike where you fight out of the underworld.","why":"Short runs fit a quick session."},
{"title":"Portal 2","description":"A clever puzzle game with portals and humor.","why":"Great when you want to think."},
{"title":"Stardew Valley","description":"A cozy farming game.","why":"Relaxing at any length."}
]}

Now write your own 3 games for this player. Use different games than the example.`;
}

async function getRecommendations(prefs, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await askOllama(prefs);
    } catch (err) {
      if (err instanceof TypeError || String(err.message).includes("404")) throw err; // connection/model problems: don't retry
      lastError = err; // bad JSON from the small model: try again
    }
  }
  throw lastError;
}

async function askOllama(prefs) {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      prompt: buildPrompt(prefs),
      format: "json", // forces valid JSON output
      stream: false,
      options: { temperature: 0.7 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}: ${await response.text()}`);
  }

  const body = await response.json();
  const parsed = JSON.parse(body.response);
  const games = (parsed.games || []).filter((g) => g && g.title && g.description);
  if (games.length < 3) throw new Error("AI returned fewer than 3 usable games");
  return games.slice(0, 3).map((g) => ({ ...g, why: g.why || "" }));
}

function showGames(games) {
  results.innerHTML = "";
  for (const game of games) {
    const card = document.createElement("article");
    card.className = "game";
    // textContent (not innerHTML) so model output can never inject HTML
    const title = document.createElement("h2");
    title.textContent = game.title;
    const desc = document.createElement("p");
    desc.textContent = game.description;
    const why = document.createElement("p");
    why.className = "why";
    why.textContent = game.why;
    card.append(title, desc, why);
    results.append(card);
  }
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function friendlyError(err) {
  if (err instanceof TypeError) {
    return "Can't reach Ollama. Make sure it's running, and serve this page from http://localhost (see README).";
  }
  if (String(err.message).includes("404")) {
    return `Model "${MODEL}" not found. Run: ollama pull ${MODEL}`;
  }
  return "Something went wrong. Try again, or check the browser console.";
}
