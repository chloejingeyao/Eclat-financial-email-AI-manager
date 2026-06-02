# Eclat (financial email manager)

Eclat is a privacy-first financial email manager that runs entirely on your machine.

## Overview

I built Eclat because I kept missing things that cost me money. A credit card reward quietly expiring. A free trial I forgot to cancel. A reimbursement deadline buried under 200 unread emails. The signals were always there — just invisible.

Manually triaging an inbox is tedious, especially when you're sitting on 1000+ unreads. And handing your inbox to a cloud AI tool felt like overkill for what should be a simple problem.

So I built a lightweight alternative. Eclat runs a two-agent AI pipeline entirely on your own machine: Agent 1 screens senders and subjects to filter out the noise, Agent 2 classifies the rest for financial signals — deadlines, perks, billing alerts, refunds, and more. Nothing leaves your device except the API call to the model of your choice. You get a clean, prioritized feed of what actually needs your attention, right inside Gmail.

While building this, I caught my ClassPass trial one day before it renewed — and dug up a Robinhood Gold subscription I'd completely forgotten about.

## Features

🔒 **Privacy first:** Your API keys never leave your device. They go directly from your machine to Google or Anthropic — Eclat never sees them.

| Feature | Description |
| :---- | :---- |
| Model Selection | Choose between Gemini 2.5 Flash or Claude Haiku as your AI. |
| Open Source & Free | 100% open-source and free to use. |
| Pick Date | Scan emails from a specific date range. |
| History | Browse all previous scans and their results. |
| Exclude Senders | Skip emails from senders you don't care about. |

## What you'll need before starting

- **Node.js** — download at [nodejs.org](https://nodejs.org/) (choose the LTS version)
- **Google Chrome**
- A **Gemini** or **Claude** API key (you'll set this up inside the extension — no config file needed)
- A **Gmail account** you want to scan

## Installation

> ⚠️ **Note:** Eclat is pending Google's OAuth verification. Setting up Gmail access requires a few extra steps for now — see [Gmail Setup](#gmail-setup) below.

**Step 1 — Download the project**

Click the green **Code** button on this page → **Download ZIP** → unzip it somewhere on your computer.

Or if you use Git:
```bash
git clone https://github.com/chloejingeyao/Eclat-financial-email-AI-manager.git
cd Eclat-financial-email-AI-manager
```

**Step 2 — Install packages**

Open Terminal, navigate to the project folder, and run:
```bash
npm install
```

**Step 3 — Connect your Gmail account**

Follow the [Gmail Setup](#gmail-setup) steps below, then come back here.

**Step 4 — Start the server**

In Terminal, run:
```bash
npm run server
```

Keep this window open while using the extension — it's what powers the AI scanning in the background.

**Step 5 — Load the extension into Chrome**

1. Open Chrome and go to `chrome://extensions/`
2. Turn on **Developer mode** using the toggle in the top-right corner
3. Click **Load unpacked**
4. Select the `extension` folder inside the project

**Step 6 — Add your AI API key**

1. Click the Eclat icon in your Chrome toolbar
2. Go to the **Settings** tab
3. Paste in your Gemini or Claude API key

You're ready to scan.

---

## Gmail Setup

This is a one-time process to give Eclat permission to read your Gmail.

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and sign in with your Google account
2. Click **Select a project** at the top → **New Project** → give it any name → **Create**
3. In the search bar, search for **Gmail API** → click it → click **Enable**
4. Go to **APIs & Services → Credentials** → click **Create Credentials** → choose **OAuth 2.0 Client ID**
5. If prompted to configure the consent screen, choose **External** → fill in any app name → save
6. Set application type to **Desktop App** → click **Create**
7. Copy the **Client ID** and **Client Secret** shown on screen
8. In the project folder, create a new file named `.env` and paste in:
```
GOOGLE_CLIENT_ID=paste_your_client_id_here
GOOGLE_CLIENT_SECRET=paste_your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
PORT=3001
```
9. In Terminal, run:
```bash
npm run auth
```
A browser window will open — sign in with Gmail and click **Allow**. Done.

---

## Contact

Built by Chloe Yao — feel free to reach out or connect.

- 🌐 [chloeyao.com](https://chloeyao.com/)
- 💼 [linkedin.com/in/jychloe](https://www.linkedin.com/in/jychloe/)
- ✉️ jy126c@gmail.com
