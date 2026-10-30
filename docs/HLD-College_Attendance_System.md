# High-Level Design (HLD) & System Architecture

_**Project**: TrustAttendance: Offline-First, Proxy-Free College Attendance System_  
_**Course**: System Design Tools and Techniques (SDTT)_

---

## 1. System Architecture Overview

The **TrustAttendance** platform is an offline-first, client-server system designed to operate reliably in harsh university network environments (such as basement auditoriums and dense lecture halls with zero cellular reception) while enforcing zero-trust anti-proxy guarantees.

The architecture solves the classic trilemma of modern attendance tracking:
1. **Network Independence**: The classroom can experience total network blackout; both professor and students can conduct attendance without an active internet connection.
2. **Cryptographic Anti-Proxy Defense**: Eliminates link forwarding, screenshot sharing, phone muling, and camera obscuration through a 5-layer defense pipeline.
3. **High-Throughput Concurrency**: Accommodates 200+ students syncing their attendance payloads simultaneously upon exiting the lecture hall without server crashes or duplicate entries.

---

## 2. High-Level Architecture Diagram

The system comprises three physical and logical tiers: the **Edge / Client Tier**, the **Application & Processing Tier**, and the **Persistence & Caching Tier**.

```mermaid
graph TD
  %% Styling
  classDef client fill:#e0f2fe,stroke:#0284c7,stroke-width:2px;
  classDef gateway fill:#f1f5f9,stroke:#64748b,stroke-width:2px;
  classDef backend fill:#f3e8ff,stroke:#9333ea,stroke-width:2px;
  classDef ai fill:#fef3c7,stroke:#d97706,stroke-width:2px;
  classDef storage fill:#ffedd5,stroke:#ea580c,stroke-width:2px;
  classDef export fill:#ecfdf5,stroke:#059669,stroke-width:2px;

  %% Client Tier
  subgraph Client_Tier [Edge / Client Tier (Mobile PWA & Browser)]
    S[Student Mobile PWA<br>React 19 + Service Worker]:::client
    P[Professor Dashboard<br>React 19 Web App]:::client
    IDB[(Browser IndexedDB<br>Offline Queue)]:::storage
    Crypto[Web Crypto API<br>SHA-256 Signer]:::client
    WAuthn[WebAuthn API<br>Platform Authenticator]:::client

    S <-->|Offline Read / Write| IDB
    S -->|Local Sign Payload| Crypto
    S -->|1:1 Hardware Lock| WAuthn
  end

  %% Network Gateway
  subgraph Gateway_Tier [Network & Gateway Tier]
    Proxy[Reverse Proxy / TLS Termination<br>Basic SSL / NGINX / Vite Proxy]:::gateway
  end

  %% Application Tier
  subgraph App_Tier [Application Tier (FastAPI Backend)]
    API[FastAPI REST Controllers<br>Uvicorn ASGI Server]:::backend
    WS[WebSocket ConnectionManager<br>Live Stream & Alerts]:::backend
    AuthMod[Auth & Device Binding Manager]:::backend
    VerifyEng[Anti-Tamper & Time-Machine<br>Verification Engine]:::backend

    subgraph AI_Engine [AI & Biometric Engine]
      Haar[Haar Cascade Face Detector<br>Aspect Ratio & Contrast Filter]:::ai
      SFace[SFace ONNX Runtime<br>128D Embedding Extractor]:::ai
      Clustering[Cosine Similarity Engine<br>Cross-Student Proxy Clustering]:::ai
    end

    subgraph Export_Engine [Multi-Format Export Engine]
      XLSX[OpenPyXL Exporter<br>Styled Spreadsheets]:::export
      PDF[FPDF2 Exporter<br>Official Audit Records]:::export
      CSV[Native CSV Streamer]:::export
    end
  end

  %% Persistence Tier
  subgraph Data_Tier [Persistence & State Tier]
    PG[(Neon PostgreSQL<br>ACID Relational DB)]:::storage
    Redis[(Redis / In-Memory Fallback<br>Session State & 7-Day Archive)]:::storage
    FaceStore[(Session Face Store<br>JSON & Obscured Thumbs)]:::storage
  end

  %% Inter-tier Data Flows
  S -- "HTTPS / REST (Sync Payload)" --> Proxy
  P -- "HTTPS / REST & WSS" --> Proxy
  Proxy --> API
  Proxy --> WS

  API --> AuthMod
  API --> VerifyEng
  VerifyEng --> AI_Engine
  AI_Engine --> Haar --> SFace --> Clustering

  API <-->|"Validate Tokens / Time-Machine"| Redis
  API <-->|"Persist Logs, Users, Sessions"| PG
  Clustering <-->|"Read / Write Face Embeddings"| FaceStore

  API --> Export_Engine
  VerifyEng -- "Broadcast Real-time Events" --> WS
  WS -.->|"Push Headcount & Proxy Alerts"| P
```

---

## 3. Core Component Breakdown

### 3.1. Edge Layer (Client Devices)

#### A. Student Progressive Web App (PWA)
- **Zero-Install Deployment**: Built with React 19 and Vite-PWA (Workbox). Caches all assets locally, allowing cold boot without cellular connectivity.
- **Hardware Device Binding**: Integrates with the browser's `navigator.credentials.create` (WebAuthn API) to bind the student's account to the smartphone's platform authenticator (Apple FaceID/TouchID or Android Biometric Prompt). Falls back to a persistent hardware-generated credential ID.
- **Dual-Camera Two-Step Capture Flow**:
  1. *Back Camera (`Html5Qrcode`)*: Scans the professor's projected dynamic QR code.
  2. *Front Camera (`MediaDevices.getUserMedia`)*: Automatically triggers a 3-second countdown selfie capture.
- **Web Crypto Digital Signature**: Offline payloads are signed with `crypto.subtle.digest("SHA-256", studentId:token:timestamp)` before storage.
- **Local Persistence (`idb`)**: Pending attendance records are stored in the `offline-queue` store in browser IndexedDB.
- **Debounced Auto-Sync Engine**: Listens to the browser's `online` event. When internet connectivity is restored, it stabilizes connection for 1.5 seconds, then batches pending records to the backend. Confirmed items and duplicates are safely purged, while network drops leave records intact.

#### B. Professor Management Dashboard
- **Dynamic TOTP Projection**: Computes and displays the time-synchronized QR code refreshing every 5 seconds.
- **Live Headcount via WebSockets**: Subscribes to the course channel (`/ws/session/{subject_code}`) to receive real-time check-in events.
- **Live Proxy Audit Inspector**: Interactive modal displaying captured selfie thumbnails with face bounding boxes, match similarity scores ($\ge 0.68$), and flagged evasion notices.
- **Administrative Overrides**: Provides one-click endpoints to either confirm a flagged proxy attempt or dismiss false alarms.
- **History Viewer**: Displays attendance analytics and proxy counts for the last 2 sessions of each course.

---

### 3.2. Application Layer (FastAPI Backend)

#### A. Authentication & Device Binding Service
- Verifies user credentials using salted `bcrypt` password hashing.
- Enforces strict 1:1 hardware device constraints:
  - **Constraint 1**: A student account cannot bind to a new phone if already registered to another hardware ID (requires Admin reset).
  - **Constraint 2**: A physical phone cannot be registered to more than one student account (prevents carrying friends' phones).

#### B. Time-Machine Verification Engine
- Generates base32 TOTP secrets per session (RFC 6238 standard with 5-second interval).
- **Time-Machine Historical Window**: Active session secrets and historical session secrets are stored in Redis (or in-memory cache) with a 7-day retention window (`session_archive:{session_id}`).
- When an offline student submits a payload recorded 45 minutes prior during total internet blackout, the server uses the verified payload timestamp to evaluate whether the token was mathematically valid at the exact second the QR was scanned.

#### C. AI Biometric & Anti-Proxy Engine (`face_recognition_service.py`)
- **Stage 1 (Liveness & Face Detection)**: Executes OpenCV Haar Cascade (`haarcascade_frontalface_default.xml`) with histogram equalization.
  - Rejects flat textures, finger coverings, and walls via standard deviation ($\sigma \ge 16.0$) and luminance thresholds ($20 \le \mu \le 248$).
  - Enforces human frontal facial aspect ratio bounds ($0.72 \le \frac{w}{h} \le 1.28$).
- **Stage 2 (Evasion Stamping)**: If camera is obscured or no face is found, stamps an alert thumbnail with a red hazard border and flags the student as `flagged_no_face`.
- **Stage 3 (128D Embedding Extraction)**: Feeds cropped face crops into SFace ONNX model (`face_recognition_sface_2021dec.onnx`) running via `onnxruntime` to generate a 128-dimensional normalized unit vector.
- **Stage 4 (Intra-Session Proxy Clustering)**: Computes cosine similarity against all other face vectors collected in the same session:
  $$\text{Similarity}(\mathbf{u}, \mathbf{v}) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|_2 \|\mathbf{v}\|_2}$$
  If similarity $\ge 0.68$ between two different student IDs, **both** records are immediately escalated to `flagged_proxy`.

#### D. Multi-Format Export Engine
- **Excel (.xlsx)**: Uses OpenPyXL to format attendance sheets with university header banners, alternating zebra stripes, and colored status badges.
- **Official PDF (.pdf)**: Uses FPDF2 to generate formal audit sheets complete with header metadata, student identifiers, device binding indicators, and footer pagination.
- **CSV (.csv)**: Delivers fast standard raw streams for SIS/LMS integration.

---

### 3.3. Persistence & State Layer

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Relational DB** | Neon PostgreSQL (via SQLAlchemy 2.0) | Durable storage for Users, Courses/Subjects, ClassSessions, and AttendanceLogs. |
| **Cache & State Store** | Redis (with `InMemoryRedis` fallback) | Active session TOTP secrets (2-hr TTL) and 7-day Session Archive for offline token verification. |
| **Biometric Store** | JSON Session Face Store | Session-scoped 128D embeddings, similarity pairings, and compressed 320x240 audit thumbnails. |
| **Client Storage** | IndexedDB (`TrustAttendanceDB`) | Client-side queue for zero data loss during network partitions. |

---

## 4. Key Architectural Decisions & Resilience Strategies

### 4.1. The "Thundering Herd" Offline Synchronization Problem
- **Scenario**: 200+ students leave a basement hall simultaneously, reconnecting to cellular/Wi-Fi at the doorway.
- **Resilience Mechanism**:
  1. Client-side 1.5-second connection debounce prevents incomplete DNS lookups from firing broken requests.
  2. Idempotency checks on `(student_id, session_id)` guarantee that repeated sync attempts never result in double attendance.
  3. Non-blocking async endpoints process verification, face extraction, and database persistence in sub-100ms.
  4. Any submission with an already recorded status returns HTTP 400 with duplicate notice, allowing the client to safely purge the local IndexedDB item.

### 4.2. Graceful Degradation & Zero-Dependency Failover
- **Redis Failover**: If the Redis server or Upstash connection drops, `redis_client.py` transparently switches to `InMemoryRedis` without raising exceptions or breaking active sessions.
- **ONNX Failover**: If the SFace ONNX runtime weights are missing, the system automatically falls back to normalized 128-bin grayscale histogram vectors.
- **WebAuthn Failover**: If the student's browser does not support WebAuthn platform authenticators, the client falls back to a persistent hardware-generated UUID.
