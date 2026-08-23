# ⚡ Quick Start Guide - Price Scanner Chat with Ollama

Get your AI-powered price scanner running locally in 5 minutes!

## Prerequisites
- Node.js 16+ ([Download](https://nodejs.org))
- Ollama ([Download](https://ollama.ai))
- ~4-8GB RAM (depending on model choice)
- Terminal/Command Prompt

## Step-by-Step Setup

### 1️⃣ Install Ollama (5 minutes)

**macOS:**
- Download from https://ollama.ai/download/mac
- Run the installer
- Ollama starts automatically

**Linux:**
```bash
curl https://ollama.ai/install.sh | sh
```

**Windows (WSL2):**
1. Install WSL2
2. Run Linux instructions above

### 2️⃣ Download an AI Model (varies by model)

In your terminal:
```bash
# Recommended: Neural Chat (4GB, fast)
ollama pull neural-chat

# Or try these alternatives:
ollama pull mistral          # Excellent quality (4GB)
ollama pull tinyllama        # Ultra-lightweight (637MB)
```

### 3️⃣ Start Ollama Service

```bash
ollama serve
```

✅ Ollama now runs on `http://localhost:11434`

### 4️⃣ Clone & Setup Price Scanner (in new terminal)

```bash
# Navigate to project
cd nova-browser

# Install dependencies
npm install

# Start development server
npm run dev
```

### 5️⃣ Open in Browser

```
http://localhost:3000
```

You should see a green ✅ indicator showing Ollama is connected!

## 🎯 Start Using It

Try these example queries:

- "What is the price of iPhone 15?"
- "How much does MacBook Pro cost?"
- "Scan prices for AirPods Pro"
- "Find me deals on PS5"

## ⚙️ Settings

Click the ⚙️ button to:
- **Switch AI Models** - Select different Ollama models
- **Toggle Local AI** - Use AI or fallback responses
- **Adjust Currency** - USD, EUR, GBP
- **Configure Filters** - New/used items, max results

## 📊 Model Recommendations

| Use Case | Model | Command |
|----------|-------|---------|
| **Best Overall** | neural-chat | `ollama pull neural-chat` |
| **Best Quality** | mistral | `ollama pull mistral` |
| **Low RAM** | tinyllama | `ollama pull tinyllama` |
| **Powerful Machine** | dolphin-mixtral | `ollama pull dolphin-mixtral` |

## 🆘 Troubleshooting

### ❌ "Ollama is offline"
```bash
# Start Ollama in another terminal
ollama serve
```

### ❌ "Model not found"
```bash
# Download the model
ollama pull neural-chat

# List available models
ollama list
```

### 🐢 Slow responses?
- Use `tinyllama` for speed
- Close other applications
- Check [OLLAMA_SETUP.md](./OLLAMA_SETUP.md) for optimization

## 📚 Full Documentation

- **[README.md](./README.md)** - Complete feature overview
- **[OLLAMA_SETUP.md](./OLLAMA_SETUP.md)** - Detailed Ollama guide
- **[package.json](./package.json)** - Dependencies and scripts

## 🚀 What's Included?

✅ ChatGPT-like interface  
✅ Price scanning & comparison  
✅ Local AI responses (Ollama)  
✅ Customizable settings  
✅ Dark mode support  
✅ No external APIs needed  
✅ 100% private & offline capable  

## 💡 Pro Tips

1. **Switch models anytime** - Settings → Select different model
2. **Leave Ollama running** - It stays in background
3. **First response slower** - Model loads into memory
4. **Try different models** - Find what works best for you

## Next Steps

- Explore different Ollama models
- Customize settings for your hardware
- Integrate real price APIs in `lib/priceScanner.ts`
- Deploy to production with `npm run build`

---

**Stuck?** Check [OLLAMA_SETUP.md](./OLLAMA_SETUP.md) for detailed troubleshooting or visit the [Ollama GitHub](https://github.com/jmorganca/ollama).

**Enjoy your local AI price scanner! 🚀**
