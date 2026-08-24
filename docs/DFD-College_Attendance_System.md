# Data Flow Diagrams (DFD)

_**Project**: Offline-First, Proxy-Free College Attendance System_

## 1. Level 0 DFD (Context Diagram)

**Purpose**: The Context Diagram provides a 10,000-foot view of the system. It shows the system as a single central process communicating with external entities (Student, Professor, Admin, and External APIs).

### Entities and Data Flows:

- **Student**: Submits login credentials, hardware tokens (`WebAuthn`), and scanned attendance payloads. Receives sync status and attendance analytics.

- **Professor**: Submits class session requests and manual overrides. Receives the real-time dynamic QR stream, live headcount, and exported `.xlsx` files.

- **Admin**: Submits bulk rosters and approves device resets. Receives system audit logs.

- **Google Sheets (External)**: Receives batched attendance rows.

### Level 0 Visual Map

```mermaid
graph LR
  %% Entities
  S[Student]
  P[Professor]
  A[Admin]
  G[Google Sheets API]

  %% Central Process
  SYS((0.0 <br> Proxy-Free <br> Attendance System))

  %% Flows from/to Student
  S -- "WebAuthn, Face Biometrics,<br>Scanned QR Payload" --> SYS
  SYS -- "Sync Status,<br>Overall Attendance %" --> S

  %% Flows from/to Professor
  P -- "Session Config,<br>Manual Overrides,<br>Export Cmd" --> SYS
  SYS -- "Dynamic QR Stream,<br>Live Headcount,<br>Excel (.xlsx)" --> P

  %% Flows from/to Admin
  A -- "Bulk CSV Rosters,<br>Device Reset Approvals" --> SYS
  SYS -- "Audit Logs,<br>Fraud Alerts" --> A

  %% Flows to Google Sheets
  SYS -- "Batched Verified Logs" --> G
```

## 2. Level 1 DFD (System Sub-Processes)

**Purpose**: The Level 1 DFD breaks down the central system into its primary sub-processes and introduces the Database Stores. This is what your professor will look at to understand how data moves internally.

### Database Stores (D1-D4):

- **D1 - Users DB**: Stores profiles, passwords, WebAuthn public keys, and 128D face vectors.

- **D2 - Classes DB**: Stores course mappings and Professor/Student enrollment mapping.

- **D3 - Sessions DB**: Stores active/past class sessions, start times, and course metadata.

- **D4 - Attendance Logs DB**: Stores the actual verified check-ins and the is_synced status.

### Main Processes (1.0 - 5.0):

1. **Manage Auth & Device Binding**: Handles WebAuthn 1:1 hardware locking and initial logins.

2. **Manage Lecture Sessions**: Validates Professor requests and generates the WebSocket dynamic QR token stream.

3. **Process & Validate Attendance (Core Engine)**: Validates the encrypted offline payloads, checks the timestamp/nonce, and enforces biometric matching.

4. **Data Sync & Export**: Background worker that generates Excel files and communicates with Google Sheets.

5. **Admin Operations**: Manages bulk uploads and device reset workflows.

### Level 1 Visual Map (Mermaid)

```mermaid
graph LR
  %% --- Style Settings ---
  classDef actor fill:#f9f,stroke:#333,stroke-width:1px;
  classDef process fill:#bbf,stroke:#333,stroke-width:1px;
  classDef database fill:#dfd,stroke:#333,stroke-width:1px;

  %% --- Actors ---
  Student[Student]:::actor
  Prof[Professor]:::actor
  Admin[Admin]:::actor
  GSheets[Google Sheets API]:::actor

  %% --- SUBFLOW 1: Authentication & Admin ---
  subgraph Auth & Administration
    P1((1.0 Manage Auth<br>& Device Binding)):::process
    P5((5.0 Admin<br>Operations)):::process
    D1_A[(D1: Users DB)]:::database
    D2_A[(D2: Classes DB)]:::database
    Student -- "Login + WebAuthn Key" --> P1
    P1 -- "Auth Token" --> Student
    P1 == "Read/Write Keys" ==> D1_A
    Admin -- "Upload Bulk CSV,<br>Approve Resets" --> P5
    Student -- "Request Device Reset" --> P5
    expand
    tune
    chat_spark
    P5 -- "Clear Device_Hash" --> D1_A
    P5 -- "Update Rosters" --> D2_A
  end

  %% --- SUBFLOW 2: Lecture Sessions ---
  subgraph Session Management
    P2((2.0 Manage<br>Lecture Sessions)):::process
    D2_B[(D2: Classes DB)]:::database
    D3_B[(D3: Sessions DB)]:::database
    Prof -- "Start Session<br>(Course ID)" --> P2
    P2 -- "Verify Assignment" --> D2_B
    P2 -- "Create Active Session" --> D3_B
    P2 -- "Stream 5s<br>Dynamic QR" --> Prof
  end

  %% --- SUBFLOW 3: Attendance Payload ---
  subgraph Payload Validation
    P3((3.0 Validate<br>Attendance Payload)):::process
    D1_C[(D1: Users DB)]:::database
    D3_C[(D3: Sessions DB)]:::database
    D4_C[(D4: Attendance Logs DB)]:::database
    Student -- "Offline Payload<br>(QR Nonce, Time, Biometrics)" --> P3
    P3 -- "Validate Device ID" --> D1_C
    P3 -- "Validate Session & Time" --> D3_C
    P3 -- "Save Verified Log" --> D4_C
    P3 -- "Live Counter Update" --> Prof
  end

  %% --- SUBFLOW 4: Sync & Export ---
    subgraph Sync & Report Export
    P4((4.0 Offline Sync<br>& Report Export)):::process
    D4_D[(D4: Attendance Logs DB)]:::database
    Prof -- "Request Export" --> P4
    P4 -- "Format .xlsx" --> Prof
    P4 == "Query & Mark<br>Unsynced Records" ==> D4_D
    P4 -- "Batch Append" --> GSheets
    GSheets -- "200 OK" --> P4
  end
```
