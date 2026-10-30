# Data Flow Diagrams (DFD)

_**Project**: TrustAttendance: Offline-First, Proxy-Free College Attendance System_  
_**Course**: System Design Tools and Techniques (SDTT)_

---

## 1. Level 0 DFD (System Context Diagram)

**Purpose**: The Context Diagram establishes the boundary of the TrustAttendance system. It portrays the entire application as a single high-level process (`0.0`) interacting with external actors (**Student**, **Professor**, and **Admin**).

### Entities & Information Flows

- **Student**:
  - *Inputs to System*: Login credentials, WebAuthn platform authenticator credentials, scanned dynamic TOTP tokens, client timestamps, SHA-256 digital signatures, front-facing selfie camera frames.
  - *Outputs from System*: Device binding confirmation, real-time verification response, offline queue status, toast notifications.
- **Professor**:
  - *Inputs to System*: Course selection, start/end session commands, proxy confirmation or dismissal actions, export format requests (`csv`, `excel`, `pdf`).
  - *Outputs from System*: 5-second dynamic TOTP QR stream, real-time live attendance feed, student selfie thumbnails with bounding boxes, facial proxy alerts, multi-format attendance reports.
- **Admin**:
  - *Inputs to System*: User creation (Students, Professors), course subject creation, 1:1 hardware device binding reset requests.
  - *Outputs from System*: User listings with binding statuses, subject listings, system administrative confirmations.

### Level 0 Visual Diagram (Mermaid)

```mermaid
graph LR
  %% Styling
  classDef actor fill:#e0f2fe,stroke:#0284c7,stroke-width:2px;
  classDef system fill:#f3e8ff,stroke:#9333ea,stroke-width:3px;

  %% Actors
  S[Student]:::actor
  P[Professor]:::actor
  A[System Admin]:::actor

  %% Central System Process
  SYS((0.0 <br> TrustAttendance <br> Core System)):::system

  %% Student Flows
  S -- "1. Login Credentials<br>2. WebAuthn Hardware Key<br>3. Signed Offline/Online Scans<br>4. Live Selfie Image" --> SYS
  SYS -- "1. Auth Confirmation<br>2. Device Lock Status<br>3. Verification Result<br>4. Offline Sync Status" --> S

  %% Professor Flows
  P -- "1. Start / End Session<br>2. Export Request (CSV/XLSX/PDF)<br>3. Proxy Overrides (Confirm/Dismiss)" --> SYS
  SYS -- "1. Dynamic 5s QR Token Stream<br>2. Live WebSocket Headcount<br>3. Face Audit Thumbnails & Alerts<br>4. Formatted Export Documents" --> P

  %% Admin Flows
  A -- "1. Onboard Users<br>2. Create Subjects<br>3. Reset Device Bindings" --> SYS
  SYS -- "1. User & Binding Roster<br>2. Course Catalog<br>3. Action Confirmations" --> A
```

---

## 2. Level 1 DFD (Sub-Process Decomposition)

**Purpose**: The Level 1 DFD decomposes the central system into distinct functional sub-processes (`1.0` through `7.0`) and shows how data is written to and read from the underlying data stores.

### Data Stores (D1 – D6)

- **D1: Users Store**: Student, Professor, and Admin records, salted password hashes, and 1:1 `hardware_id` locks.
- **D2: Subjects Store**: Course codes, names, and academic department details.
- **D3: Class Sessions Store**: Session start/end timestamps, associated subject, professor ID, and active status flag.
- **D4: Attendance Logs Store**: Verified check-ins, student IDs, session IDs, timestamps, tokens used, and status badges (`verified`, `flagged_proxy`, `flagged_no_face`, `confirmed_proxy`).
- **D5: Redis Cache & 7-Day Session Archive**: Active session TOTP secrets, 2-hour active TTL keys, and 7-day session archives for time-machine verification.
- **D6: Session Face Records Store**: In-memory and persisted JSON records containing SFace 128D embeddings, cosine similarity pairings, and compressed audit thumbnails.

---

### Level 1 Sub-Process Map (Mermaid)

```mermaid
graph TD
  %% Styling
  classDef actor fill:#e0f2fe,stroke:#0284c7,stroke-width:2px;
  classDef process fill:#f3e8ff,stroke:#9333ea,stroke-width:2px;
  classDef store fill:#ffedd5,stroke:#ea580c,stroke-width:2px;

  %% External Entities
  Student[Student Client]:::actor
  Prof[Professor Client]:::actor
  Admin[Admin Client]:::actor

  %% Data Stores
  D1[(D1: Users DB)]:::store
  D2[(D2: Subjects DB)]:::store
  D3[(D3: Class Sessions DB)]:::store
  D4[(D4: Attendance Logs DB)]:::store
  D5[(D5: Redis & Session Archive)]:::store
  D6[(D6: Session Face Records)]:::store

  %% Sub-Processes
  P1((1.0 Auth & Device<br>Binding Engine)):::process
  P2((2.0 Session Lifecycle<br>& TOTP Generator)):::process
  P3((3.0 PWA Offline Queue<br>& Auto-Sync Engine)):::process
  P4((4.0 Anti-Tamper & Time<br>Machine Verifier)):::process
  P5((5.0 AI Facial Liveness<br>& Proxy Clustering)):::process
  P6((6.0 Live WebSocket<br>& Audit Controller)):::process
  P7((7.0 Multi-Format Export<br>& History Engine)):::process

  %% 1.0 Auth & Device Binding
  Student -- "Login & WebAuthn Key" --> P1
  Admin -- "Reset Device Binding" --> P1
  Admin -- "Create Users & Subjects" --> P1
  P1 <-->|"Read / Write Credentials & HW Keys"| D1
  P1 -->|"Write New Subjects"| D2
  P1 -- "Binding Status Token" --> Student

  %% 2.0 Session Lifecycle
  Prof -- "Start Session (Subject Code)" --> P2
  Prof -- "End Session" --> P2
  P2 <-->|"Validate Subject & Professor"| D2
  P2 -->|"Create / Update Session"| D3
  P2 -->|"Set TOTP Secret & 7-Day Archive"| D5
  P2 -- "Dynamic QR Stream (5s)" --> Prof

  %% 3.0 Offline Queue & Auto-Sync
  Student -- "Dual Camera (QR + Selfie)" --> P3
  P3 -.->|"Offline: Save Signed Payload"| P3
  P3 -- "Online: Forward Payload" --> P4

  %% 4.0 Anti-Tamper & Time Machine Verification
  P4 <-->|"Verify Student & Hardware 1:1"| D1
  P4 <-->|"Verify Time-Machine TOTP Window"| D5
  P4 <-->|"Prevent Duplicate Check-in"| D4
  P4 -- "Validated Frame & Metadata" --> P5

  %% 5.0 AI Face Liveness & Proxy Clustering
  P5 <-->|"Haar Liveness / SFace Embeddings"| D6
  P5 -->|"Persist Verified / Flagged Status"| D4
  P5 -- "Alert Event Data" --> P6

  %% 6.0 Real-time WebSocket & Audit Controller
  P6 <-->|"Read Session Faces & Logs"| D4
  P6 <-->|"Read Audit Thumbnails"| D6
  P6 -- "Live Headcount & Proxy Alerts" --> Prof
  Prof -- "Confirm / Dismiss Proxy" --> P6
  P6 -->|"Update Status Override"| D4
  P6 -->|"Update Status Override"| D6

  %% 7.0 Multi-Format Export & History Engine
  Prof -- "Export Cmd (CSV/XLSX/PDF)" --> P7
  P7 <-->|"Query Session / Subject Logs"| D4
  P7 <-->|"Query Recent 2 Sessions"| D3
  P7 -- "Excel / PDF / CSV Stream" --> Prof
```

---

## 3. Sub-Process Functional Breakdown

### Process 1.0: Authentication & Device Binding Engine
- Validates user email and salted bcrypt password hashes against **D1**.
- Facilitates 1:1 device binding via the WebAuthn standard:
  - If a student tries to bind a second phone while an existing `hardware_id` is present, raises HTTP 403.
  - If a student tries to bind a phone already bound to another student ID, raises HTTP 403.
- Provides administrators with an explicit unlock route to clear `hardware_id` upon verified device loss.

### Process 2.0: Session Lifecycle & Dynamic TOTP Engine
- Receives professor session start requests, marks past sessions inactive in **D3**, and commits a new active session.
- Generates a random base32 secret via PyOTP and writes it to **D5** under `session:{subject_code}` with a 2-hour TTL.
- Copies the secret to `session_archive:{session_id}` with a 7-day retention period.
- Serves dynamic TOTP tokens every 5 seconds to the professor's projected browser display.

### Process 3.0: PWA Offline Queue & Auto-Sync Engine
- Coordinates rear-camera QR code decoding (`Html5Qrcode`) and automatically triggers the front-camera selfie capture.
- Signs the payload using the client's Web Crypto API (`SHA-256(student_id:token:timestamp)`).
- When offline, serializes the package and stores it in the local browser IndexedDB (`offline-queue`).
- Monitors the browser's `online` event with a 1.5-second debounce to drain the queue when connectivity is restored.

### Process 4.0: Cryptographic Payload & Time-Machine Verifier
- Verifies the incoming payload's digital signature against the client timestamp.
- Evaluates the TOTP token against the active session secret or past session archives in **D5** using `pyotp.verify(valid_window=60, for_time=client_time)`.
- Validates the incoming `hardware_id` against the student's registered `hardware_id` in **D1**.
- Checks **D4** to ensure the student has not already logged an attendance entry for the active session.

### Process 5.0: AI Facial Liveness & Proxy Clustering
- Runs Haar Cascade face detection on the decoded base64 camera frame. Checks aspect ratio and pixel standard deviation ($\ge 16.0$) to reject walls, blacked-out lenses, or finger coverings.
- If no face is detected, stamps an alert thumbnail with a hazard frame, records `flagged_no_face` in **D4**, and halts execution.
- If a valid face is detected, extracts a 128D embedding vector using SFace ONNX.
- Executes cosine similarity matching against all previously saved face vectors for that session in **D6**. If similarity $\ge 0.68$ with a different student ID, flags both as `flagged_proxy`.

### Process 6.0: Real-time WebSocket & Audit Controller
- Maintains an open WebSocket connection with the professor's dashboard (`/ws/session/{subject_code}`).
- Broadcasts `NEW_ATTENDANCE` and `PROXY_STATUS_UPDATED` JSON events whenever check-ins occur or proxy states change.
- Serves captured face audit records (including face bounding boxes, match similarity scores, and obscured thumbnails) for professor inspection.
- Processes manual professor override actions (`/professor/confirm-proxy` and `/professor/dismiss-proxy`) and updates **D4** and **D6** atomically.

### Process 7.0: Multi-Format Export & History Engine
- Queries **D3** to populate the "Last 2 Sessions" overview card for quick professor reference.
- Streams multi-format reports from **D4**:
  - *Excel (`.xlsx`)*: Formatted workbook with university brand headers, column widths, and highlighted proxy flags via OpenPyXL.
  - *PDF (`.pdf`)*: Official audit report with custom headers, tabular records, and page counters via FPDF2.
  - *CSV (`.csv`)*: Standard comma-separated format for quick ingestion into external university systems.
