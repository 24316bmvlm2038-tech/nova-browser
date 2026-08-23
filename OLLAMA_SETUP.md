# 🚀 Ollama Setup Guide for Price Scanner Chat

This guide will help you set up Ollama to power the Price Scanner Chat application locally on your laptop.

## What is Ollama?

Ollama is a lightweight, open-source framework for running large language models (LLMs) locally on your machine. With Ollama, you can:
- Run AI models privately (no data sent to external servers)
- Use the Price Scanner Chat offline
- Customize AI behavior without API costs
- Run models optimized for your hardware

## System Requirements

- **RAM**: 4GB minimum (8GB+ recommended)
- **Storage**: 5-15GB depending on model size
- **Processor**: Modern CPU (Apple Silicon, Intel, or AMD)
- **OS**: macOS, Linux, or Windows (with WSL2)

## Installation

### macOS
1. Download from https://ollama.ai/download/mac
2. Run the installer and follow the prompts
3. Ollama will start automatically and run in the background

### Linux
```bash
curl https://ollama.ai/install.sh | sh
```

### Windows (WSL2)
1. Install Windows Subsystem for Linux 2 (WSL2)
2. Install Ubuntu 20.04+ in WSL2
3. Install Ollama for Linux (see Linux instructions above)

## Starting Ollama

### Background Service (Recommended)
```bash
# macOS (already running)
# Linux/Windows
ollama serve
```

The service will start on `http://localhost:11434` by default.

### Verify Installation
```bash
ollama --version
```

## Downloading Models

Ollama hosts various LLM models optimized for different use cases. Download models based on your needs:

### Recommended Models for Price Scanner Chat

**Fast & Lightweight (4-7GB RAM):**
```bash
ollama pull neural-chat
```
- **Size**: ~4GB
- **Speed**: Very fast ⚡⚡⚡
- **Quality**: Good for chat
- **Best for**: Budget laptops, quick responses

**Balanced (6-10GB RAM):**
```bash
ollama pull mistral
```
- **Size**: ~4.1GB
- **Speed**: Fast ⚡⚡
- **Quality**: Excellent
- **Best for**: Most users

**High Quality (10-15GB RAM):**
```bash
ollama pull dolphin-mixtral
```
- **Size**: ~26GB
- **Speed**: Moderate ⚡
- **Quality**: Excellent
- **Best for**: Powerful machines

**Small & Efficient (2-3GB RAM):**
```bash
ollama pull tinyllama
```
- **Size**: ~637MB
- **Speed**: Very fast ⚡⚡⚡
- **Quality**: Basic
- **Best for**: Testing/limited hardware

### List Downloaded Models
```bash
ollama list
```

### Remove a Model
```bash
ollama rm neural-chat
```

## Configuring the Price Scanner Chat

### 1. Create `.env.local` file
Create a `.env.local` file in the project root:

```bash
cp .env.example .env.local
```

### 2. Edit Configuration (Optional)
Customize settings in `.env.local`:

```env
# Point to your Ollama server (default is localhost:11434)
NEXT_PUBLIC_OLLAMA_URL=http://localhost:11434

# Set your default model (must be installed)
NEXT_PUBLIC_OLLAMA_MODEL=neural-chat
```

### 3. Run the Application
```bash
npm install
npm run dev
```

Visit `http://localhost:3000`

## Using the Application

### First Time Setup
1. Start Ollama: `ollama serve`
2. Download a model: `ollama pull neural-chat`
3. Start the app: `npm run dev`
4. Open browser to `http://localhost:3000`
5. You should see a green connection indicator ✅

### Switching Models at Runtime
1. Click the ⚙️ Settings button
2. Look for "🤖 Ollama AI Settings"
3. Select a different model from the dropdown
4. Changes apply immediately

### Disable Local AI
If Ollama is offline or you want to use fallback responses:
- Uncheck "Use Local AI for Responses" in settings
- The chat will use pre-written responses instead

## Troubleshooting

### Ollama Connection Failed
**Error**: "Ollama is offline"

**Solutions**:
```bash
# 1. Check if Ollama is running
ollama list

# 2. Start Ollama service
ollama serve

# 3. Verify it's accessible
curl http://localhost:11434/api/tags
```

### Model Not Found
**Error**: "Model not available"

**Solution**:
```bash
# Download the model first
ollama pull neural-chat

# List available models
ollama list
```

### Out of Memory
**Error**: "Allocating X.XGB failed"

**Solutions**:
1. Use a smaller model:
   ```bash
   ollama pull tinyllama  # 637MB
   ```

2. Close other applications to free up RAM

3. Adjust model settings for less memory:
   ```bash
   # Reduce context window
   OLLAMA_NUM_PREDICT=100
   ```

### Slow Responses
**Cause**: Model too large for your hardware

**Solutions**:
1. Switch to a faster model
2. Add more RAM or close other apps
3. Use CPU-only mode (no GPU acceleration needed)

## Performance Tips

### Optimize for Speed
```bash
# Use smaller models
ollama pull neural-chat

# Or tiny models
ollama pull tinyllama
```

### Optimize for Quality
```bash
# Use higher quality models
ollama pull mistral

# Or use larger models
ollama pull dolphin-mixtral
```

### Enable GPU Acceleration (if available)
Ollama automatically uses GPU if available:
- **NVIDIA**: CUDA support included
- **Apple Silicon**: Metal framework (automatic)
- **AMD**: ROCm support available

## Model Recommendations by Hardware

| Hardware | RAM | Recommended Model | Speed |
|----------|-----|-------------------|-------|
| MacBook Air M1/M2 | 8GB | neural-chat | ⚡⚡⚡ |
| MacBook Pro | 16GB | mistral | ⚡⚡ |
| Windows Laptop | 8GB | neural-chat | ⚡⚡⚡ |
| Gaming PC (RTX) | 12GB+ | dolphin-mixtral | ⚡⚡ |
| Low-end Laptop | 4GB | tinyllama | ⚡⚡⚡ |

## Advanced Configuration

### Custom Ollama URL
If running Ollama on a different machine:

```env
# .env.local
NEXT_PUBLIC_OLLAMA_URL=http://192.168.1.100:11434
```

### Model Parameters
Customize model behavior by editing `lib/ollama.ts`:

```typescript
const generateResponse = async (prompt: string) => {
  // Adjust these parameters:
  temperature: 0.7,      // 0=deterministic, 1=creative
  top_k: 40,            // Vocabulary size
  top_p: 0.9,           // Nucleus sampling
  // Add more...
};
```

## Keeping Ollama Updated

```bash
# macOS
brew upgrade ollama

# Linux
curl https://ollama.ai/install.sh | sh

# Or check for updates
ollama --version
```

## Privacy & Data

✅ **All processing happens locally**
- No data sent to external servers
- Your queries stay on your machine
- No API keys needed
- Completely offline capable

## Resources

- **Ollama Website**: https://ollama.ai
- **Model Library**: https://ollama.ai/library
- **GitHub**: https://github.com/jmorganca/ollama
- **Discord Community**: https://discord.gg/ollama

## Quick Start Commands

```bash
# Download and start in one go
ollama pull neural-chat
ollama serve

# In another terminal:
cd nova-browser
npm install
npm run dev

# Visit http://localhost:3000 in your browser
```

## Performance Benchmarks

Example response times (on MacBook Pro M1, 16GB RAM):

| Model | Model Size | Response Time | Memory Used |
|-------|-----------|---------------|------------|
| tinyllama | 637MB | 0.5s | 2GB |
| neural-chat | 4GB | 2s | 6GB |
| mistral | 4.1GB | 3s | 8GB |
| dolphin-mixtral | 26GB | 5s | 12GB |

---

**Need help?** Check the main README.md or visit the Ollama GitHub repository.
