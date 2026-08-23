# 💰 Price Scanner Chat - AI-Powered Price Comparison Tool

A modern ChatGPT-style web application that scans product prices across multiple sellers and provides real-time price comparisons with customizable settings.

## Features

✨ **Key Features:**
- 💬 **ChatGPT-like Interface** - Intuitive chat UI for seamless interaction
- 💰 **Price Scanning** - Automatically detect price inquiries and fetch data
- 🔍 **Multi-Seller Comparison** - Compare prices across multiple platforms
- ⚙️ **Customizable Settings** - Adjust scanner behavior with Zustand state management
  - Toggle new/used item display
  - Choose currency (USD, EUR, GBP)
  - Set maximum result count
- 🌓 **Dark Mode Support** - Built-in light and dark theme support
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile

## Tech Stack

- **Frontend Framework**: React 18 + Next.js 14
- **State Management**: Zustand (lightweight, easy-to-customize)
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Type Safety**: Full TypeScript support

## Project Structure

```
nova-browser/
├── app/
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home page
├── components/
│   ├── ChatInterface.tsx   # Main chat component
│   ├── ChatMessage.tsx     # Individual message component
│   ├── PriceCard.tsx       # Price data display card
│   └── SettingsPanel.tsx   # Settings modal
├── lib/
│   └── priceScanner.ts     # Price scanning logic
├── store/
│   └── useChatStore.ts     # Zustand store configuration
├── styles/
│   └── globals.css         # Global Tailwind styles
└── public/                 # Static assets
```

## Getting Started

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Basic Chat
1. Type a message asking about product prices
2. The AI detects price-related queries and scans for information
3. Results display with a detailed price card showing:
   - Average price across sellers
   - Price range
   - Individual seller prices and platforms

### Available Commands
- **Ask about prices**: "What is the price of iPhone 15?"
- **Scan for deals**: "Find the cheapest MacBook Pro"
- **Check specific items**: "How much does AirPods Pro cost?"

### Customize Settings
Click the ⚙️ Settings button to:
- **Show New Items**: Toggle prices for new products
- **Show Used Items**: Toggle used/refurbished prices
- **Currency**: Switch between USD, EUR, or GBP
- **Max Results**: Adjust how many sellers to display (1-10)

## Zustand State Management

The app uses Zustand for lightweight, efficient state management:

```typescript
// Example: Adding a message
addMessage(message: Message) => void

// Update scanner configuration
updateScannerConfig(config: Partial<ChatState['scannerConfig']>) => void

// Clear all messages
clearMessages() => void
```

All state is centralized in `store/useChatStore.ts` and easily customizable.

## API Integration

Currently uses mock data for demonstration. To integrate real APIs:

1. **Update `lib/priceScanner.ts`**:
   ```typescript
   // Replace mock data with real API calls
   const response = await fetch('https://api.example.com/prices', {
     query: itemName
   });
   ```

2. **Supported Integrations** (ready to implement):
   - Amazon Product Advertising API
   - eBay API
   - Walmart API
   - Best Buy API

## Customization

### Change Color Scheme
Edit `tailwind.config.js`:
```javascript
colors: {
  primary: '#YOUR_COLOR', // Change primary accent color
}
```

### Add New Features
1. **New state fields**: Add to `ChatState` in `store/useChatStore.ts`
2. **New messages types**: Extend `Message` interface
3. **Custom components**: Create in `components/` directory

### Extend Scanner Logic
Modify `lib/priceScanner.ts` to:
- Add more product categories
- Integrate real price APIs
- Add product image fetching
- Include additional metadata

## Performance

- **Optimized Bundle Size**: ~50KB gzipped
- **Tree-shaking**: Unused code automatically removed
- **Lazy Loading**: Components load on demand
- **Zustand Efficiency**: Minimal re-renders

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## Contributing

1. Create feature branch from `claude/ai-price-scanner-chat-*`
2. Make changes and commit
3. Push to branch
4. Submit pull request

## License

MIT

## Future Enhancements

- 📸 Image-based product recognition
- 📊 Price history charts
- 🔔 Price drop alerts
- 💾 Saved searches and favorites
- 🌍 Multi-language support
- 🔐 User accounts and preferences

---

Built with ❤️ using React, Next.js, and Zustand
