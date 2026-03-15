# Trackr — Chrome Extension

A Chrome MV3 extension for [Trackr](https://github.com/wbharath/trackr-frontend), the AI-powered job application tracker. Automatically extracts job details from any job board and syncs your Gmail inbox to detect job-related emails.

---

## Features

- **AI Job Extraction** — Visit any job posting (LinkedIn, Indeed, Workday, etc.) and the extension automatically extracts the position, company, and location using Claude AI
- **Save Job** — One-click save to your Trackr dashboard without leaving the page
- **Gmail Sync** — Connect your Gmail account via OAuth and sync job-related emails automatically
- **Auto-categorization** — Claude reads your emails and categorizes them as Applied, Interview, Rejected, or Offer
- **Duplicate prevention** — Already-synced emails are skipped on subsequent syncs

---

## Tech Stack

- Chrome MV3 (Manifest V3)
- Vanilla JavaScript
- Chrome Identity API (OAuth2)
- Gmail API
- Anthropic Claude API (via Trackr backend)

---

## File Structure

```
trackr-extension/
├── manifest.json      # MV3 manifest with permissions and OAuth config
├── popup.html         # Extension popup UI
├── popup.js           # All popup logic — login, job saving, Gmail sync
├── background.js      # Service worker — handles OAuth token retrieval
└── content.js         # Content script — scrapes page text for AI extraction
```

---

## Setup

### Prerequisites
- Trackr backend running (see [trackr-backend](https://github.com/wbharath/trackr-backend))
- Google Cloud project with Gmail API enabled
- Chrome extension OAuth2 client ID

### 1. Google Cloud Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable the **Gmail API**
4. Go to **Credentials** → Create **OAuth 2.0 Client ID**
5. Select **Chrome Extension** as application type
6. Add your extension ID as the Item ID
7. Add your Gmail account as a test user under **OAuth consent screen**

### 2. Update manifest.json
```json
"oauth2": {
  "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
  "scopes": ["https://www.googleapis.com/auth/gmail.readonly"]
}
```

### 3. Update API base URL
In `popup.js`, update the backend URL:
```javascript
const API_BASE = 'https://your-backend-url.com/api/v1'
```

### 4. Load in Chrome
1. Open `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked**
4. Select the extension folder

---

## Usage

### Save Job Tab
1. Navigate to any job posting
2. Open the extension — fields are auto-filled using AI
3. Adjust if needed and click **Save Job**

### Gmail Sync Tab
1. Click **Connect Gmail** and authorize
2. Click **Sync Emails** to scan your inbox
3. Job-related emails are automatically saved to your dashboard
4. Subsequent syncs skip already-saved emails

---

## Key Gotcha

Chrome MV3 blocks all inline `onclick` handlers due to Content Security Policy. Every event handler must be attached via `addEventListener` in an external JS file — inline `onclick="..."` in HTML silently fails with a CSP violation error.

---

## Related Repositories

- [trackr-backend](https://github.com/wbharath/trackr-backend) — Spring Boot 4 REST API
- [trackr-frontend](https://github.com/wbharath/trackr-frontend) — React dashboard
