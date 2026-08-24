# Choosing and running a model

The [README](./README.md) covers install and setup. This is the detail on which
model to run and how to keep it fast.

## Picking a model

Ollama models are sized in billions of parameters. A rough rule: a model needs
about 1.5× its download size in free RAM to run comfortably.

| Model | Download | Needs ~ | Notes |
|---|---|---|---|
| `llama3.2:1b` | 1.3 GB | 3 GB | Fastest. Fine for short chat, weak at reasoning. |
| `llama3.2` (3B) | 2.0 GB | 4 GB | **Best default.** Good quality, quick. |
| `phi3` | 2.3 GB | 4 GB | Strong at reasoning for its size. |
| `mistral` | 4.1 GB | 8 GB | Noticeably better writing, slower. |
| `llama3.1:8b` | 4.7 GB | 8 GB | Best quality that still fits 16 GB machines. |
| `qwen2.5:14b` | 9.0 GB | 16 GB | Excellent, needs a well-specced laptop. |

```bash
ollama pull llama3.2
ollama list          # what you have
ollama rm <model>    # free the disk back
```

Switch between installed models any time from Settings — no restart needed.

## By hardware

| Machine | Start with |
|---|---|
| 8 GB RAM (MacBook Air, most laptops) | `llama3.2` |
| 16 GB RAM | `llama3.1:8b` or `mistral` |
| 32 GB+ or a discrete GPU | `qwen2.5:14b` |
| Very tight on RAM or disk | `llama3.2:1b` |

Apple Silicon uses the GPU through Metal automatically. NVIDIA cards are used via
CUDA if the drivers are installed. Neither needs configuration.

## Keeping it responsive

**The first message is always slowest** — that's the model loading into RAM.
Ollama keeps it there for 5 minutes after the last request; to hold it longer:

```bash
OLLAMA_KEEP_ALIVE=30m ollama serve
```

**If replies crawl or the machine swaps**, the model is too big for your free RAM.
Drop a size tier. `llama3.2:1b` runs on almost anything.

**If a reply gets cut off**, the app allows 90 seconds per reply. A large model on
a slow machine can exceed that — use a smaller model, or raise `TIMEOUT_MS` in
`app/api/chat/route.ts`.

## Running Ollama elsewhere

To use a model on another machine on your network, set both the host it binds to
and the URL the app calls:

```bash
# On the machine running Ollama:
OLLAMA_HOST=0.0.0.0 ollama serve

# In .env.local on the machine running Can Ai:
OLLAMA_URL=http://192.168.1.50:11434
```

Only do this on a network you trust — Ollama has no authentication.

## Why the app doesn't call Ollama from the browser

Ollama rejects cross-origin requests, so a `fetch` from the page to
`localhost:11434` fails even though both are on your machine. Every call goes
through the Next.js server instead (`lib/ollamaServer.ts`), which is a normal
server-to-server request with no CORS involved.

You could instead set `OLLAMA_ORIGINS=http://localhost:3000`, but proxying is
better anyway: it keeps any search API keys out of the browser bundle.

## Troubleshooting

**`ollama serve` says the address is in use** — it's already running (the macOS
app starts it in the background). Check with `curl http://127.0.0.1:11434/api/tags`.

**Model not found** — pull it first. The name in Settings must match `ollama list`
exactly, tag included.

**Out of memory during a reply** — close other apps, or use a smaller model. Ollama
does not swap gracefully.
