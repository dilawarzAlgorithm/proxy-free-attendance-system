# 🎓 Offline-First, Proxy-Free Attendance System

A highly secure, offline-first attendance tracking system designed for large college lecture halls. It eliminates proxy attendance through cryptographic time-sync (TOTP), hardware device binding, and on-device WebAssembly (WASM) biometrics, all while functioning perfectly during total classroom internet blackouts.

## 📖 Project Overview

Traditional attendance apps fail due to spotty classroom internet and rampant proxy marking (sharing links, sending screenshots, or carrying multiple phones). Our architecture is built **offline-first**, utilizing a Zero-Infrastructure Trust Triangle:

1.  **Dynamic TOTP QR Codes:** Generated offline to stop screenshot sharing.
2.  **Client-side WASM facial recognition:** Prevents physical phone mules.
3.  **Local IndexedDB caching:** Ensures zero data loss during internet drops.

## 🚀 Key Features

- **Zero-Install PWA:** Runs directly in mobile browsers (Chrome/Safari) with offline caching.
- **1:1 Hardware Device Binding:** Cryptographically locks the student account to their physical phone hardware via WebAuthn.
- **On-Device Biometric Face Matching:** Compares live facial landmarks locally using MediaPipe.
- **Offline Dynamic QR Engine:** Renders time-synchronized cryptographic QR codes locally on the professor's laptop every 5 seconds.
- **Asynchronous Batch Export:** One-click instant download (.xlsx) or batched background push to Google Sheets.

## 🏗️ System Architecture & Design

To keep this repository clean, our detailed system architecture, flowcharts, and design diagrams are organized in the /docs folder.

- 🗺️ [**High-Level Design (HLD)**](https://github.com/dilawarzAlgorithm/proxy-free-attendance-system/blob/main/docs/DFD-College_Attendance_System.md)**:** System architecture overview, offline-sync pipeline, and node infrastructure.
- 🧩 [**Low-Level Design (LLD)**](https://github.com/dilawarzAlgorithm/proxy-free-attendance-system/blob/main/docs/HLD-College_Attendance_System.md)**:** UML class diagrams, database entities, and design patterns (Singleton, Strategy).
- 🔄 [**Data Flow Diagrams (DFD)**](https://github.com/dilawarzAlgorithm/proxy-free-attendance-system/blob/main/docs/LLD-College_Attendance_System.md)**:** Level 0 Context Diagram and Level 1 Sub-Process routing.

## 🛠️ Local Development Setup

### Prerequisites

- Node.js (v18+)
- Python (3.10+)
- Docker & Docker Compose (Optional for DB)

### 1. Clone the Repository

```bash
git clone https://github.com/dilawarzAlgorithm/proxy-free-attendance-system.git
git cd proxy-free-attendance
```

### 2. Backend Setup (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### 3. Frontend Setup (React PWA)

```bash
cd frontend
npm install
npm run dev
```

<!--
## 👥 Team Members

- **[Dilawar Singh]** - System Architect & Backend
- **[Likhit]** - Frontend UI/UX
- **[Atharv]** - Database & Integrations
- **[Nisarg]** - QA & Testing -->

## 📝 License

This project is submitted as part of the System Design Tools and Techniques coursework.
