# Eclat (financial email manager)

Eclat is a privacy-first financial email manager that runs entirely on your machine.

## Overview

I built Eclat because I kept missing things that cost me money. A credit card reward quietly expiring. A free trial I forgot to cancel. A reimbursement deadline buried under 200 unread emails. The signals were always there — just invisible.  
Manually triaging an inbox is tedious, especially when you're sitting on 100+ unreads. And handing your inbox to a cloud AI tool felt like overkill for what should be a simple problem.  
So I built a lightweight alternative. Eclat runs a two-agent AI pipeline entirely on your own machine: Agent 1 screens senders and subjects to filter out the noise, Agent 2 classifies the rest for financial signals — deadlines, perks, billing alerts, refunds, and more. Nothing leaves your device except the API call to the model of your choice. You get a clean, prioritized feed of what actually needs your attention, right inside Gmail.

While building this, I caught my ClassPass trial one day before it renewed — and dug up a Robinhood Gold subscription I'd completely forgotten about.

## Features

🔒 Privacy & Security: Your API keys are stored locally in your browser's extension storage (chrome.storage). They are sent directly from your machine to the respective AI provider (Google/Anthropic) to handle your requests. Your keys are never collected, shared, or sent to any external servers.

| Feature Module | Description |
| :---- | :---- |
| Model Selection | Switch between Gemini 2.5 Flash and Claude Haiku — each uses its own API key and model ID. |
| Open Source & Free | 100% open-source and free to use. |
| Pick Date  | Select a date range to classify emails from that period. |
| Generation History | Browse all previously classified emails and their detected financial signals. |
| Configure Exclusion | Skip emails from senders you don't want processed, keeping your results focused and efficient. |

## Installation

⚠️ **Note on Gmail Authorization:** Eclat is currently pending Google's OAuth verification. Until approved, you'll need to create your own Google Cloud project and OAuth credentials to connect your Gmail account. Full setup instructions [here](#gmail-setup).

1. Clone the repository
```bash
git clone https://github.com/chloejingeyao/Eclat-financial-email-AI-manager.git
cd Eclat-financial-email-AI-manager
```

2. Install dependencies
```bash
npm install
```

3. Connect your Gmail account — [see Gmail Setup](#gmail-setup)

4. Start the local server
```bash
npm run server
```

5. Load the Chrome extension
   - Navigate to `chrome://extensions/`
   - Toggle on **Developer mode** (top-right)
   - Click **Load unpacked** → select the `extension/` folder

6. Add your AI API key
   - Open the Eclat extension → **Settings** tab
   - Paste your Gemini or Claude API key

## Gmail Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a new project
2. Enable the **Gmail API** for your project
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Set application type to **Desktop App**
5. Copy the **Client ID** and **Client Secret**
6. In the project root, copy `.env.example` to `.env` and fill in your credentials:
```
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```
7. Run the auth flow — a browser window will open to sign in with Gmail:
```bash
npm run auth
```

## Contact

Built by Chloe Yao — feel free to reach out or connect.

- 🌐 [chloeyao.com](https://chloeyao.com/)
- 💼 [linkedin.com/in/jychloe](https://www.linkedin.com/in/jychloe/)
- ✉️ jy126c@gmail.com
