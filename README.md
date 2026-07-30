# AEM Model JSON Checker

A modern, on-demand Chrome Extension (Manifest V3) designed for Adobe Experience Manager (AEM) developers, QA testers, and content authors to instantly verify if a `.model.json` endpoint exists for the current webpage and convert timestamps like `1780045190002` into human-readable dates.

---

## ✨ Features

- ⚡ **100% On-Demand Execution**: The extension runs **only** when you click its icon in the Chrome toolbar. There are zero background service workers, zero content scripts, and zero network requests made while browsing normally.
- 🔍 **Smart Endpoint Resolution**: Automatically computes candidate `.model.json` URLs for various AEM URL structures:
  - Trailing slash: `https://example.com/page/` $\rightarrow$ `https://example.com/page/.model.json`
  - HTML extension: `https://example.com/page.html` $\rightarrow$ `https://example.com/page.model.json`
  - No extension/slash: `https://example.com/page` $\rightarrow$ `https://example.com/page.model.json`
- 🌳 **Recursive `lastModifiedDate` Scanner**: AEM Sling models can be deeply nested. The extension recursively traverses the entire JSON payload to locate all `lastModifiedDate`, `lastModified`, and `cq:lastModified` properties across root and component nodes.
- 📅 **Human-Readable Timestamp Formatting**:
  - **Local Date & Time** (e.g., `July 30, 2026 at 11:15:56 AM EDT`)
  - **Relative Time Pill** (e.g., `2 hours ago`, `in 3 days`)
  - **UTC / ISO Time** (`2026-07-30 15:15:56 UTC`)
  - **Raw Timestamp** with a one-click **Copy to Clipboard** button.
- 🎨 **Premium Dark-Mode UI**: Sleek glassmorphism aesthetic, interactive status badges (`HTTP 200` vs. `HTTP 404`), and an expandable accordion to inspect every found occurrence in the JSON tree.
- 🍪 **Authenticated Page Support**: Uses Chrome's scripting API to fetch `.model.json` within the page context, seamlessly inheriting your browser login session and cookies without CORS issues.

---

## 🚀 Installation (Google Chrome / Edge / Brave)

1. Open Google Chrome and navigate to:
   ```
   chrome://extensions/
   ```
2. Enable **Developer mode** using the toggle in the top-right corner of the page.
3. Click the **Load unpacked** button in the top-left toolbar.
4. Select the extension directory:
   ```
   <path-to-your-extension-folder>
   ```
5. *(Optional)* Click the **Extensions puzzle piece** icon in Chrome's top toolbar and **Pin** 📌 **AEM Model JSON Checker** for one-click access.

---

## 📖 Usage Guide

1. **Navigate to an AEM Page**:
   Open any webpage you want to inspect (for example, `https://example.com/content/site/page/`).
2. **Click the Extension Icon**:
   Click the **AEM Model JSON Checker** icon in your Chrome toolbar.
3. **Inspect the Result**:
   - **If `.model.json` exists**: A vibrant green badge indicates success, and the primary `lastModifiedDate` is prominently displayed in local and relative time formats.
   - **Multiple Occurrences**: If the page has multiple modified timestamps across child components, click **All lastModifiedDate Occurrences** to view their full JSON paths (e.g., `root > :items > header > cq:lastModified`).
   - **If `.model.json` is missing**: An orange/red badge displays the HTTP status (e.g., `HTTP 404 Not Found`) along with the URL that was tested.
4. **Open Raw JSON**:
   Click the **open in new tab** icon button next to the endpoint URL to view the raw JSON payload in a new browser tab.
5. **Switch Candidate URLs**:
   If a page has multiple potential candidate endpoints (e.g., `/page.model.json` vs. `/page/.model.json`), use the **Try alternate path** dropdown to test them instantly.

---

## 🔒 Privacy & Architecture Guarantee
- **Manifest V3**: Complies with Google's latest Manifest V3 security and performance standards.
- **Zero Background Tracking**: No code runs in the background. Your browsing data is never tracked, stored, or transmitted to external servers.
