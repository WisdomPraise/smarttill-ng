# SmartTill NG — Automated Merchant Split & Credit Recovery via Interledger Open Payments

**Primary Track:** Track 3 — Payment Automation and Financial Workflows  
**Live Prototype:** https://smarttill-ng.onrender.com/  
**Target Audience:** Nigerian informal micro-merchants & open-market traders (Persona: *Mummy Emma's Provision Store, Lagos*)

---

## 1. The Problem & Financial Inclusion Case
Over 40 million Nigerian micro-merchants and market vendors rely on fragmented payment tools that create three daily barriers:
1. **Mixing Inventory Capital with Daily Spending:** Incoming customer payments land in a single account without automated budgeting, causing vendors to accidentally spend restock money on daily household expenses.
2. **Informal Credit Defaults:** Extending "buy now, pay later" tabs to regular customers often leads to missed repayments and awkward manual chasing.
3. **High Fees, Network Friction & App Complexity:** Traditional POS terminals charge heavy flat fees, banking apps frequently fail during network congestion, and complex accounting dashboards intimidate non-technical traders.

---

## 2. How SmartTill NG Solves It
SmartTill NG turns a vendor's digital till into an automated, WhatsApp-connected cash-flow manager:
* **Automated 70/30 Open Payments Split:** Every incoming sale into the vendor's **Main Till** is automatically split behind the scenes—**70%** is routed to a locked **Restock Savings** wallet to protect inventory capital, and **30%** is routed to a **Daily Profit** wallet for immediate spending.
* **Consent-Based Micro-Credit Recovery:** Regular customers can pre-authorize a capped Open Payments grant once, enabling small installment recoveries without friction.
* **WhatsApp Settlement Alerts:** Instead of requiring vendors to navigate complex fintech dashboards, SmartTill NG triggers real-time WhatsApp notifications via Twilio whenever funds split and settle.
* **Web Monetization Storefront (`<link rel="monetization">`):** Embeds the W3C Web Monetization standard so diaspora supporters and customers can stream zero-fee micro-tips directly to the vendor's wallet.

---

## 3. Interledger Open Payments Architecture
SmartTill NG uses the official `@interledger/open-payments` SDK across three Interledger Test Wallet addresses (`Main Till`, `Restock Box`, and `Daily Profit`):
1. **Interactive Outgoing Grant (`/api/authorize` & `/api/callback`):** Requests a user-approved `outgoing-payment` authorization grant with a capped `debitAmount` limit from the vendor's Main Till authorization server, ensuring the vendor retains full control over spending limits.
2. **Programmatic Split Execution (`/api/simulate-sale`):**
   * Requests `incoming-payment` grants and creates invoices on both the **Restock Box (70%)** and **Daily Profit (30%)** resource servers.
   * Requests `quote` grants and generates payment quotes on the **Main Till**.
   * Executes two settled `outgoing-payment` transfers in real time and returns live Interledger transaction IDs.

---

## 4. Scope: Implemented vs. Simulated vs. Planned
* **Implemented (Live on Testnet):** Full Node.js/Express Open Payments integration (`grant`, `incomingPayment`, `quote`, `outgoingPayment`), interactive browser grant authorization, automated 70/30 multi-wallet splitting, live WhatsApp webhook notifications via Twilio Sandbox, and W3C Web Monetization `<link>` integration.
* **Simulated:** Naira (`₦`) storefront figures mapped 1,000:1 to Interledger Testnet `EUR` ledgers (`€10.00` = `₦10,000`), and pre-authorized customer credit installment triggers using the Main Till test grant.
* **Planned Post-Hackathon:** Direct NGN local bank-rail bridging, USSD fallback for feature phones, and production Meta-approved WhatsApp Business templates.

---

## 5. How Judges Can Test the Live Prototype
> **Note on Render Free Tier & Grant Expiry:** If the server has been idle, the first page load may take ~30–45 seconds to wake up. Open Payments test authorization tokens also expire periodically.

1. **Authorize the Till Budget (One-Time Setup):**  
   Open [https://smarttill-ng.onrender.com/api/authorize](https://smarttill-ng.onrender.com/api/authorize) while logged into an Interledger Test Wallet account and click **Accept / Approve**.
2. **Trigger a Live Split Sale:**  
   Return to [https://smarttill-ng.onrender.com/](https://smarttill-ng.onrender.com/) and click **₦5,000**, **₦10,000**, **₦20,000**, or **Auto-Collect Approved Credit Installment (₦2,000)**.
3. **Verify Settlement:**  
   Observe the updated 70/30 balances, live Interledger `outgoing-payments` transaction ID, and WhatsApp notification status directly on screen.

---

## 6. Local Installation & Setup
### Prerequisites
* Node.js (v18+ or v22 LTS)
* Three accounts/wallet addresses on [Interledger Test Wallet](https://interledger-test.dev) (`Main Till`, `Restock`, `Profit`) + Developer `private.key` and `KEY_ID` from `Main Till`.

### Steps
```bash
git clone https://github.com
cd smarttill-ng
npm install
```

Create a `.env` file in the root folder (never commit `.env` or `private.key` to version control):
```env
PORT=4000
MAIN_TILL_WALLET=https://interledger-test.dev<main-till-id>
RESTOCK_WALLET=https://interledger-test.dev<restock-id>
PROFIT_WALLET=https://interledger-test.dev<profit-id>
KEY_ID=<your-key-id>
PRIVATE_KEY_PATH=./private.key

# Optional: Twilio WhatsApp Sandbox
TWILIO_ACCOUNT_SID=<your-twilio-sid>
TWILIO_AUTH_TOKEN=<your-twilio-token>
TWILIO_WHATSAPP_FROM=whatsapp:+17372508034
VENDOR_PHONE=whatsapp:+234<your-number>
```

Place your `private.key` in the project root and run:
```bash
node server.js
```
Visit `http://localhost:4000/api/authorize` to approve the grant, then open `http://localhost:4000`.

---

## 7. Dependencies, License & Disclosures
* **Dependencies:** `express` (MIT), `cors` (MIT), `dotenv` (BSD-2-Clause), `@interledger/open-payments` (Apache-2.0).
* **License:** MIT License.
* **Prior Work & AI Assistance Disclosure:** Built from scratch during the November 2026 hackathon build window. AI coding assistance (Google Gemini) was used to accelerate Express boilerplate, Open Payments SDK integration debugging, and documentation drafting.
