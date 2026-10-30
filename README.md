# 🎓 TrustAttendance: Offline-First, Proxy-Free Attendance System

A zero-infrastructure, cryptographically secured, offline-first attendance tracking system engineered for university lecture halls. It completely eliminates proxy attendance through a **5-Layer Defense-in-Depth Security Matrix** combining dynamic time-synchronized QR codes (TOTP), 1:1 WebAuthn hardware device binding, AI-powered facial verification with intra-session proxy detection, and local IndexedDB caching with digital anti-tamper signatures.

---

## 📖 Problem Statement & Core Concept

Traditional attendance systems in universities fail because of two fundamental challenges:

1. **The Classroom Network Blackout**: Basements, dense concrete lecture halls, and overloaded campus Wi-Fi cause mobile apps and cloud forms to stall or fail completely.
2. **Rampant Proxy Attendance**:
   - **Link & QR Sharing**: Students take photos of static QR codes or share web links via WhatsApp/Telegram to absent friends.
   - **Phone Muling**: A present student physically carries 2–3 phones of absent classmates into the hall and scans on their behalf.
   - **Camera Obscuration / Spoofing**: Students block the camera or flash printed photos to bypass simple camera checks.

### 🛡️ The Zero-Infrastructure Trust Triangle

TrustAttendance solves all these vectors without requiring expensive biometric hardware turnstiles or dedicated classroom internet:

1. **Dynamic TOTP QR Engine**: Rotates cryptographic tokens every 5 seconds on the professor's screen; static photos or forwarded screenshots expire immediately.
2. **1:1 Hardware Device Binding (WebAuthn)**: Locks each student account to their physical phone's Secure Enclave/Platform Authenticator. An account cannot log in from a friend's phone, and one phone cannot be bound to multiple students.
3. **AI Face Recognition & Intra-Session Proxy Detection**: Extracts 128D facial embeddings via OpenCV and SFace ONNX. If the same physical person scans for two different student IDs, the system detects cosine similarity clustering ($\ge 0.68$) and flags both as **Proxy Detected**.
4. **Offline Time-Machine Verification**: Scans captured in zero-connectivity environments are cryptographically signed (SHA-256) and queued in IndexedDB. When internet connectivity is restored, the backend verifies the scan against historical session token archives.

---

## 🚀 Key Features

- 📱 **Zero-Install Progressive Web App (PWA)**: Runs natively in mobile browsers (Chrome / Safari / Edge) with Service Worker offline asset caching.
- 🔐 **1:1 Hardware Binding via WebAuthn**: Cryptographic device locking using hardware-backed biometric platform authenticators (ES256/RS256) or UUID failover.
- 📷 **Automated Dual-Camera Two-Step Flow**:
  1. _Back Camera_: Instant scanning of professor's dynamic QR code.
  2. _Front Camera_: Automatic 3-second selfie capture with facial validation.
- 🧠 **AI Face Verification & Anti-Evasion**:
  - Rejects camera obscuration, finger coverings, and flat textures via Haar cascade aspect ratio and grayscale variance checks.
  - Generates visual audit thumbnails stamped with alert frames for suspicious evasion attempts.
- 👥 **Real-Time WebSocket Professor Dashboard**: Live headcount stream, instant proxy alerts, student selfie thumbnail inspector, and one-tap **Confirm** or **Dismiss** proxy overrides.
- 📊 **Multi-Format Export Engine**: One-click generation of beautifully formatted Excel spreadsheets (`.xlsx`), audit-ready PDF reports (`.pdf`), and standard CSV files (`.csv`) per session or course.
- 🏛️ **Admin Management Portal**: Comprehensive controls to manage users, assign course subjects, and reset device hardware bindings when students change phones.

---

## 🏗️ System Architecture & Design Documentation

Detailed system architecture diagrams, UML class models, and data flow pipelines are maintained in the [`/docs`](./docs/) directory:

- 🗺️ [**High-Level Design (HLD)**](./docs/HLD-College_Attendance_System.md): Node architecture, network boundaries, edge layers, and resilience strategies.
- 🧩 [**Low-Level Design (LLD)**](./docs/LLD-College_Attendance_System.md): UML class diagrams, database schemas, API controllers, client state machines, and design patterns.
- 🔄 [**Data Flow Diagrams (DFD)**](./docs/DFD-College_Attendance_System.md): Level 0 Context Diagram and Level 1 Sub-Process data flows.

---

## 🛠️ Tech Stack

| Layer                    | Technologies                                                                       |
| :----------------------- | :--------------------------------------------------------------------------------- |
| **Frontend Client**      | React 19, Vite 8, Tailwind CSS v4, Lucide Icons, `idb` (IndexedDB), `html5-qrcode` |
| **PWA & Offline**        | Vite-PWA (Workbox), Service Workers, Web Crypto API (SHA-256), WebAuthn API        |
| **Backend API**          | FastAPI (Python 3.10+), Uvicorn, Pydantic, WebSockets                              |
| **Security & Auth**      | PyOTP (TOTP RFC 6238), Bcrypt, Cryptography, ECDSA                                 |
| **Computer Vision / AI** | OpenCV (Haar Cascade), DeepFace SFace ONNX Runtime (128D Face Embeddings)          |
| **Database & Cache**     | Neon PostgreSQL (SQLAlchemy 2.0 ORM), Redis / In-Memory Fallback Cache             |
| **Export Engines**       | OpenPyXL (Excel `.xlsx`), FPDF2 (Official PDF Audit Reports), Python CSV           |

---

## 💻 Local Development Setup

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **Python**: v3.10 or higher
- **PostgreSQL / Neon DB connection**
- **Redis** (optional; built-in in-memory fallback activates automatically if Redis is absent)

---

### 1. Clone the Repository

```bash
git clone https://github.com/dilawarzAlgorithm/proxy-free-attendance-system.git
cd proxy-free-attendance-system
```

### 2. Backend Setup (FastAPI)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file inside `backend/`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/attendance_db
REDIS_URL=redis://localhost:6379
ADMIN_EMAIL=admin@college.edu
ADMIN_PASSWORD=adminpassword
```

Start the backend server:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

> The API will be available at `http://localhost:8000`. Swagger documentation is accessible at `http://localhost:8000/docs`.

### 3. Frontend Setup (React PWA)

```bash
cd ../frontend
npm install
npm run dev
```

> The frontend dev server launches with HTTPS enabled (via `@vitejs/plugin-basic-ssl`) at `https://localhost:5173`. HTTPS is required by modern mobile browsers to activate the camera and WebAuthn platform authenticators.

---

## 👥 Roles & Workflows

1. **Admin**:
   - Manages user accounts (Students, Professors, Admins).
   - Creates and configures academic courses and subject codes.
   - Clears 1:1 hardware device bindings when a student legitimately replaces their smartphone.
2. **Professor**:
   - Selects a subject and starts an active attendance session.
   - Projects the live dynamic TOTP QR code (refreshes every 5 seconds).
   - Monitors live attendance stream with student selfie thumbnails via WebSockets.
   - Inspects facial similarity flags and one-tap overrides ("Confirm Proxy" or "Dismiss").
   - Reviews historical attendance records for the last 2 sessions.
   - Exports formatted reports in Excel, PDF, or CSV formats.
3. **Student**:
   - First-time enrollment: Performs 1:1 hardware device binding via WebAuthn platform biometric prompt.
   - Attendance marking:
     - Scans professor's dynamic QR code with rear camera.
     - Front camera opens automatically with a 3-second timer to capture selfie.
     - If online: Instant verification against active session and proxy check.
     - If offline: Signs payload locally with SHA-256 and caches in IndexedDB; auto-syncs when network is restored.

---

## 📝 License

This project is developed as part of the **System Design Tools and Techniques (SDTT)** coursework.
