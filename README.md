# 🎓 Offline-First, Proxy-Free Attendance System

A highly secure, offline-first attendance tracking system designed for large college lecture halls. It eliminates proxy attendance through cryptographic time-sync (TOTP), hardware device binding, and on-device WebAssembly (WASM) biometrics, all while functioning perfectly during total classroom internet blackouts.

## 📖 Project Overview

Traditional attendance apps fail due to spotty classroom internet and rampant proxy marking (sharing links, sending screenshots, or carrying multiple phones). Our architecture is built **offline-first**, utilizing a Zero-Infrastructure Trust Triangle:

1.  **Dynamic TOTP QR Codes** generated offline to stop screenshot sharing.
2.  **Client-side WASM facial recognition** to prevent physical phone mules.
3.  **Local IndexedDB caching** for zero data loss during internet drops.

## 🚀 Key Features

### Student Module (PWA)

- **Zero-Install PWA:** Runs directly in mobile browsers (Chrome/Safari) with offline caching.
- **1:1 Hardware Device Binding:** Cryptographically locks the student account to their physical phone hardware via WebAuthn.
- **On-Device Biometric Face Matching:** Compares live facial landmarks against a pre-registered 128D embedding locally using MediaPipe.
- **Gaze Liveness Challenge:** Requires following a randomized moving dot to defeat pre-recorded videos.
- **Offline Queue (IndexedDB):** Encrypts and saves attendance tokens locally, auto-syncing when internet restores.

### Faculty Module (Web App)

- **Offline Dynamic QR Engine:** Renders time-synchronized cryptographic QR codes locally every 5 seconds.
- **Projector Optimization:** Large-module QR layouts optimized for optical line-of-sight scanning in 240-seat halls.
- **Manual Override:** Toggle to manually mark students present in cases of hardware failure.
- **Asynchronous Batch Export:** One-click instant download (.xlsx) or batched background push to Google Sheets.

## 🏗️ System Architecture & Design

Our system follows a **Client-Server architecture with an Offline-First Edge layer**.

- **Backend:** Python FastAPI (Dockerized on Render) handling JWT auth and payload decryption.
- **Database:** PostgreSQL (Neon DB) for primary relational data.
- **Frontend:** React.js / Next.js Progressive Web App (hosted on Vercel).
- **Anti-Rate Limiting:** Background queues (Celery/BackgroundTasks) batch-sync records to Google Sheets.

_(Note: Detailed System Design documentation including SRS, HLD, LLD, and DFDs are located in the /docs folder)._

## 🛠️ Local Development Setup

### Prerequisites

- Node.js (v18+)
- Python (3.10+)
- Docker & Docker Compose

### 1\. Clone the Repository

```bash
git clone https://github.com/dilawarzAlgorithm/proxy-free-attendance-system.git
git  cd proxy-free-attendance
```

### 2\. Backend Setup (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### 3\. Frontend Setup (React PWA)

```bash
cd frontend
npm install
npm start
```

## <!-- 👥 Team Members

- **\[Your Name\]** - System Architect & Backend
- **\[Member 2\]** - Frontend UI/UX
- **\[Member 3\]** - Database & Integrations
- **\[Member 4\]** - QA & Testing
  -->

## 📝 License

This project is submitted as part of the System Design Tools and Techniques coursework.
