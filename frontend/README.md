# 📱 TrustAttendance Client (React 19 PWA)

The frontend client for **TrustAttendance**, an offline-first, proxy-free university attendance tracking platform. Built with React 19, Vite 8, Tailwind CSS v4, and modern browser hardware APIs.

---

## 🌟 Key Capabilities

1. **Progressive Web App (PWA)**:
   - Zero-installation mobile web application.
   - Fully precached static assets via Workbox service worker for cold offline boot in dead zones.
   - Home screen installation prompts (`beforeinstallprompt`) for Android and iOS Safari.
2. **1:1 Hardware Device Locking (WebAuthn)**:
   - Uses `navigator.credentials.create` to register the student's device using Platform Authenticators (Face ID, Touch ID, Android Biometrics).
   - Enforces single-device-per-student and single-student-per-device policies.
3. **Automated Dual-Camera Two-Step Flow**:
   - **Step 1 (Rear Camera)**: Real-time dynamic QR code scanning using `Html5Qrcode`.
   - **Step 2 (Front Camera)**: Automated 3-second countdown selfie capture for facial verification.
4. **Offline Queue & Resilient Auto-Sync (`idb`)**:
   - When offline, attendance scans and face frames are signed with client-side SHA-256 (`crypto.subtle.digest`) and saved into browser IndexedDB.
   - Automatically synchronizes with the FastAPI server upon internet restoration with a 1.5-second debounce window.
5. **Real-Time Professor Dashboard**:
   - Projects 5-second dynamic TOTP QR code.
   - Subscribes to live attendance streams via WebSockets (`/ws/session/{subject_code}`).
   - Interactive Face Audit Modal with bounding boxes, similarity metrics, and one-tap proxy confirmation/dismissal.
   - Multi-format file export (CSV, formatted Excel `.xlsx`, official audit PDF `.pdf`).
6. **Administrator Portal**:
   - User creation, role assignment (Admin, Professor, Student).
   - Subject & course catalog management.
   - Hardware binding reset utility for verified device replacements.

---

## 🛠️ Tech Stack & Dependencies

- **Framework**: React 19, Vite 8
- **Styling**: Tailwind CSS v4, Lucide React icons
- **PWA & Offline**: `vite-plugin-pwa`, Workbox, `idb` (IndexedDB wrapper)
- **Scanning & Media**: `html5-qrcode`, `navigator.mediaDevices.getUserMedia`
- **Security & Cryptography**: WebAuthn API, Web Crypto API (`SubtleCrypto` SHA-256)
- **Networking**: Axios, Native WebSockets

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18.0.0 or higher)
- Running backend API (at `http://127.0.0.1:8000`)

### Installation & Run

```bash
# 1. Install dependencies
npm install

# 2. Start local HTTPS development server
npm run dev
```

> **Why HTTPS is required**: Browsers strictly forbid camera access and WebAuthn platform authenticators on insecure HTTP origins (other than localhost). `@vitejs/plugin-basic-ssl` is pre-configured to generate trusted local SSL certificates automatically.

---

## 📁 Project Structure

```
frontend/
├── dev-dist/             # Workbox Service Worker bundles
├── public/               # Static assets & web manifest icons
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── assets/           # Media and graphics
│   ├── App.css           # Custom styling rules
│   ├── App.jsx           # Master UI Controller & Role Portals (Admin, Professor, Student)
│   ├── db.js             # IndexedDB wrapper (TrustAttendanceDB offline-queue)
│   ├── index.css         # Tailwind CSS directives
│   └── main.jsx          # React DOM entrypoint
├── index.html            # PWA shell & meta viewport tags
├── package.json          # Dependencies & scripts
└── vite.config.js        # Vite, PWA, Basic-SSL, and API Reverse-Proxy config
```
