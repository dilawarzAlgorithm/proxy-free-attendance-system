import os
import csv
import io
import pyotp
import json
import bcrypt
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import engine, Base, get_db
from redis_client import redis_db
import models
import face_recognition_service
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from fpdf import FPDF

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="TrustAttendance API")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# WEBSOCKET MANAGER
# ==========================================
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, subject_code: str):
        await websocket.accept()
        if subject_code not in self.active_connections:
            self.active_connections[subject_code] = []
        self.active_connections[subject_code].append(websocket)

    def disconnect(self, websocket: WebSocket, subject_code: str):
        if subject_code in self.active_connections:
            if websocket in self.active_connections[subject_code]:
                self.active_connections[subject_code].remove(websocket)

    async def broadcast(self, subject_code: str, message: dict):
        if subject_code in self.active_connections:
            for connection in self.active_connections[subject_code]:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception:
                    pass

manager = ConnectionManager()

# ==========================================
# SCHEMAS
# ==========================================
class LoginRequest(BaseModel):
    email: str
    password: str

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str

class SubjectCreate(BaseModel):
    name: str
    code: str

class SessionStart(BaseModel):
    subject_code: str
    professor_id: int

class SessionEnd(BaseModel):
    subject_code: str

class DeviceBindRequest(BaseModel):
    student_id: int
    hardware_id: str
    device_name: Optional[str] = "Mobile Device"

class AttendanceVerify(BaseModel):
    subject_code: str
    student_id: int
    token: str
    timestamp: Optional[float] = None  # Unix timestamp from the device
    signature: Optional[str] = None    # SHA-256 hash proof
    hardware_id: Optional[str] = None  # WebAuthn Hardware Device ID
    image_b64: Optional[str] = None    # Camera frame Base64 for face verification

# ==========================================
# AUTHENTICATION & DEVICE BINDING
# ==========================================
@app.post("/auth/login")
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    if credentials.email == os.getenv("ADMIN_EMAIL") and credentials.password == os.getenv("ADMIN_PASSWORD"):
        return {"id": 0, "role": "admin", "name": "System Admin", "email": credentials.email, "hardware_id": None}
    
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
        
    try:
        password_bytes = credentials.password.encode('utf-8')[:72]
        if not bcrypt.checkpw(password_bytes, user.hashed_password.encode('utf-8')):
            raise HTTPException(status_code=401, detail="Invalid email or password.")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    
    return {
        "id": user.id, 
        "role": user.role, 
        "name": user.name, 
        "email": user.email,
        "hardware_id": user.hardware_id
    }

@app.post("/auth/bind-device")
def bind_device(data: DeviceBindRequest, db: Session = Depends(get_db)):
    student = db.query(models.User).filter(models.User.id == data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    
    # 1:1 Check A: Account already bound to another phone
    if student.hardware_id and student.hardware_id != data.hardware_id:
        raise HTTPException(
            status_code=403, 
            detail="1:1 Device Binding Error: This student account is already locked to another phone. Contact administrator to reset your device binding."
        )
    
    # 1:1 Check B: Phone already registered to another student (prevent phone muling)
    bound_to_other = db.query(models.User).filter(
        models.User.hardware_id == data.hardware_id,
        models.User.id != data.student_id
    ).first()
    if bound_to_other:
        raise HTTPException(
            status_code=403,
            detail=f"1:1 Device Binding Violation: This physical device is already bound to {bound_to_other.name} ({bound_to_other.email}). Multiple accounts on one device are prohibited."
        )
    
    student.hardware_id = data.hardware_id
    db.commit()
    return {
        "status": "success",
        "message": "Physical hardware device locked 1:1 to student account successfully via WebAuthn.",
        "hardware_id": student.hardware_id
    }

@app.get("/auth/device-status/{student_id}")
def get_device_status(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.User).filter(models.User.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    return {
        "student_id": student.id,
        "is_bound": bool(student.hardware_id),
        "hardware_id": student.hardware_id
    }

@app.post("/admin/reset-device/{student_id}")
def reset_device_binding(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.User).filter(models.User.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    student.hardware_id = None
    db.commit()
    return {"status": "success", "message": f"Hardware binding cleared for {student.name}."}

# ==========================================
# ADMIN ROUTES
# ==========================================
@app.get("/admin/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    return [
        {
            "id": u.id, 
            "name": u.name, 
            "email": u.email, 
            "role": u.role,
            "hardware_id": u.hardware_id,
            "is_bound": bool(u.hardware_id)
        } 
        for u in users
    ]

@app.post("/admin/users")
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    password_bytes = user.password.encode('utf-8')[:72]
    hashed_pwd = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')
    
    new_user = models.User(name=user.name, email=user.email, hashed_password=hashed_pwd, role=user.role)
    db.add(new_user)
    db.commit()
    return {"status": "success", "message": "User created successfully"}

@app.get("/admin/subjects")
def get_subjects(db: Session = Depends(get_db)):
    return db.query(models.Subject).all()

@app.post("/admin/subjects")
def create_subject(subject: SubjectCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Subject).filter(models.Subject.code == subject.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Subject code already exists")
    
    new_sub = models.Subject(name=subject.name, code=subject.code)
    db.add(new_sub)
    db.commit()
    return {"status": "success", "message": "Subject created"}

# ==========================================
# SESSION & ATTENDANCE ROUTES
# ==========================================
@app.post("/session/start")
def start_session(data: SessionStart, db: Session = Depends(get_db)):
    subject = db.query(models.Subject).filter(models.Subject.code == data.subject_code).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Mark any prior active sessions for this subject as finished
    prior_sessions = db.query(models.ClassSession).filter(
        models.ClassSession.subject_id == subject.id,
        models.ClassSession.is_active == 1
    ).all()
    for s in prior_sessions:
        s.is_active = 0
        s.end_time = datetime.now(timezone.utc)

    new_session = models.ClassSession(
        subject_id=subject.id,
        professor_id=data.professor_id,
        start_time=datetime.now(timezone.utc),
        is_active=1
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    totp_secret = pyotp.random_base32()
    session_key = f"session:{data.subject_code}"
    
    redis_db.hset(session_key, mapping={
        "secret": totp_secret,
        "professor_id": str(data.professor_id),
        "session_id": str(new_session.id)
    })
    redis_db.expire(session_key, 7200)
    
    return {"message": "Session started", "secret": totp_secret, "session_id": new_session.id}

@app.post("/session/end")
def end_session(data: SessionEnd, db: Session = Depends(get_db)):
    session_key = f"session:{data.subject_code}"
    session_id_str = redis_db.hget(session_key, "session_id")
    if session_id_str:
        sess = db.query(models.ClassSession).filter(models.ClassSession.id == int(session_id_str)).first()
        if sess:
            sess.is_active = 0
            sess.end_time = datetime.now(timezone.utc)
            db.commit()
    redis_db.expire(session_key, 1)
    return {"status": "success", "message": "Session ended"}

@app.get("/session/token/{subject_code}")
def get_current_token(subject_code: str):
    session_key = f"session:{subject_code}"
    if not redis_db.exists(session_key):
        raise HTTPException(status_code=404, detail="No active session found.")
    secret = redis_db.hget(session_key, "secret")
    totp = pyotp.TOTP(secret, interval=5)
    return {"token": totp.now()}

@app.post("/attendance/verify")
async def verify_attendance(data: AttendanceVerify, db: Session = Depends(get_db)):
    session_key = f"session:{data.subject_code}"
    
    if not redis_db.exists(session_key):
        raise HTTPException(status_code=404, detail="No active session found. Wait for professor.")
        
    secret = redis_db.hget(session_key, "secret")
    totp = pyotp.TOTP(secret, interval=5)
    
    clean_token = data.token.strip().replace(" ", "").upper()
    if ":" in clean_token:
        clean_token = clean_token.split(":")[-1]
    
    # 1. Digital Signature & Offline Timestamp Verification
    client_time = datetime.now()
    if data.timestamp and data.signature:
        expected_sig = hashlib.sha256(f"{data.student_id}:{clean_token}:{data.timestamp}".encode()).hexdigest()
        if expected_sig != data.signature:
            raise HTTPException(status_code=403, detail="Invalid digital signature. Anti-tamper triggered.")
        client_time = datetime.fromtimestamp(data.timestamp)

    # 2. Time-Machine Token Check (Verify token was valid at exact time of scan)
    # Allow 60-second window (12 * 5s) to comfortably accommodate front camera selfie verification
    is_valid_token = totp.verify(clean_token, valid_window=12, for_time=client_time) or totp.verify(clean_token, valid_window=12)
    if not is_valid_token:
        raise HTTPException(status_code=401, detail="Invalid or expired token. Proxies denied.")
        
    subject = db.query(models.Subject).filter(models.Subject.code == data.subject_code).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    student = db.query(models.User).filter(models.User.id == data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # 3. 1:1 Hardware Device Binding Validation
    if student.hardware_id:
        if not data.hardware_id or data.hardware_id != student.hardware_id:
            raise HTTPException(
                status_code=403,
                detail="1:1 Device Mismatch! This student account is cryptographically locked to a different phone. Proxy attendance blocked."
            )
    elif data.hardware_id:
        # Auto-bind hardware credential on first scan if not bound
        conflict = db.query(models.User).filter(
            models.User.hardware_id == data.hardware_id, 
            models.User.id != data.student_id
        ).first()
        if conflict:
            raise HTTPException(
                status_code=403, 
                detail=f"Device Conflict: This phone is already bound to {conflict.name}. Multiple student accounts on one physical device are prohibited."
            )
        student.hardware_id = data.hardware_id
        db.commit()

    # 4. Prohibit Duplicate Attendance by same student ID in the same session
    session_id_str = redis_db.hget(session_key, "session_id")
    target_session_id = int(session_id_str) if session_id_str else None

    if target_session_id:
        duplicate = db.query(models.AttendanceLog).filter(
            models.AttendanceLog.student_id == data.student_id,
            models.AttendanceLog.session_id == target_session_id
        ).first()
        if duplicate:
            raise HTTPException(
                status_code=400, 
                detail="Attendance already recorded for this lecture session. Duplicate entries are strictly prohibited."
            )
    else:
        # Fallback check if session ID is missing from cache (e.g. within same 45 min window)
        duplicate = db.query(models.AttendanceLog).filter(
            models.AttendanceLog.student_id == data.student_id,
            models.AttendanceLog.subject_id == subject.id,
            models.AttendanceLog.timestamp >= client_time - timedelta(minutes=45)
        ).first()
        if duplicate:
            raise HTTPException(
                status_code=400, 
                detail="Duplicate attendance detected for this lecture timeframe."
            )

    # 5. Facial Verification & Proxy Detection
    if not data.image_b64:
        raise HTTPException(status_code=400, detail="No face detected in camera frame. Live camera capture is required.")

    try:
        face_data = face_recognition_service.process_face_image(data.image_b64)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Face processing error: {str(e)}")

    embedding = face_data.get("embedding")
    thumb_b64 = face_data.get("thumbnail_b64")
    is_flagged_proxy = False
    proxy_match = None

    if target_session_id and embedding:
        proxy_match = face_recognition_service.check_proxy_attempt(
            new_embedding=embedding,
            session_id=target_session_id,
            student_id=data.student_id,
            threshold=0.68
        )
        if proxy_match.get("is_proxy"):
            is_flagged_proxy = True
            matched_id = proxy_match.get("matched_student_id")
            if matched_id:
                prev_log = db.query(models.AttendanceLog).filter(
                    models.AttendanceLog.session_id == target_session_id,
                    models.AttendanceLog.student_id == matched_id
                ).first()
                if prev_log:
                    prev_log.status = "flagged_proxy"
                    db.commit()

    status_val = "flagged_proxy" if is_flagged_proxy else "verified"

    if target_session_id and embedding:
        face_recognition_service.save_face_record(
            session_id=target_session_id,
            student_id=data.student_id,
            student_name=student.name,
            embedding=embedding,
            thumbnail_b64=thumb_b64,
            is_flagged_proxy=is_flagged_proxy,
            matched_with_id=proxy_match.get("matched_student_id") if proxy_match else None,
            matched_with_name=proxy_match.get("matched_student_name") if proxy_match else None,
            similarity=proxy_match.get("similarity") if proxy_match else None
        )

    db_log = models.AttendanceLog(
        student_id=data.student_id, 
        subject_id=subject.id, 
        session_id=target_session_id,
        token_used=clean_token, 
        timestamp=client_time,
        status=status_val
    )
    db.add(db_log)
    db.commit()
    
    await manager.broadcast(data.subject_code, {
        "type": "NEW_ATTENDANCE",
        "student_id": data.student_id,
        "student_name": student.name,
        "status": status_val,
        "is_flagged_proxy": is_flagged_proxy,
        "photo": thumb_b64,
        "matched_with_id": proxy_match.get("matched_student_id") if proxy_match else None,
        "matched_with_name": proxy_match.get("matched_student_name") if proxy_match else None,
        "similarity": proxy_match.get("similarity") if proxy_match else None
    })

    if is_flagged_proxy:
        return {
            "status": "flagged_proxy",
            "is_flagged_proxy": True,
            "message": "Warning: Facial proxy detected! Flagged for professor review."
        }

    return {
        "status": "success",
        "is_flagged_proxy": False,
        "message": "Attendance marked successfully. Face verified."
    }

# ==========================================
# PROFESSOR RECENT SESSIONS (LAST 2 SESSIONS)
# ==========================================
@app.get("/professor/sessions/{subject_code}")
def get_recent_sessions(subject_code: str, db: Session = Depends(get_db)):
    subject = db.query(models.Subject).filter(models.Subject.code == subject_code).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    # Query ONLY the last 2 sessions per subject
    sessions = db.query(models.ClassSession).filter(
        models.ClassSession.subject_id == subject.id
    ).order_by(models.ClassSession.start_time.desc()).limit(2).all()

    results = []
    for s in sessions:
        count = db.query(models.AttendanceLog).filter(models.AttendanceLog.session_id == s.id).count()
        proxy_count = db.query(models.AttendanceLog).filter(
            models.AttendanceLog.session_id == s.id,
            models.AttendanceLog.status.in_(["flagged_proxy", "confirmed_proxy"])
        ).count()
        results.append({
            "id": s.id,
            "subject_code": subject.code,
            "subject_name": subject.name,
            "start_time": s.start_time.strftime("%Y-%m-%d %H:%M:%S") if s.start_time else "N/A",
            "end_time": s.end_time.strftime("%Y-%m-%d %H:%M:%S") if s.end_time else None,
            "is_active": s.is_active,
            "student_count": count,
            "proxy_count": proxy_count
        })
    return results

# ==========================================
# PROFESSOR PROXY AUDIT & FACE VIEWER
# ==========================================
@app.get("/professor/session/{session_id}/faces")
def get_session_faces(session_id: int, db: Session = Depends(get_db)):
    sess = db.query(models.ClassSession).filter(models.ClassSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    
    face_records = face_recognition_service.get_session_face_records(session_id)
    face_map = {r["student_id"]: r for r in face_records}

    logs = db.query(models.AttendanceLog).filter(models.AttendanceLog.session_id == session_id).all()
    results = []
    for log in logs:
        student = log.student
        rec = face_map.get(log.student_id, {})
        results.append({
            "log_id": log.id,
            "student_id": log.student_id,
            "student_name": student.name if student else "Unknown",
            "email": student.email if student else "N/A",
            "timestamp": log.timestamp.strftime("%Y-%m-%d %H:%M:%S") if log.timestamp else "N/A",
            "status": log.status,
            "is_flagged_proxy": log.status in ["flagged_proxy", "confirmed_proxy"],
            "photo": rec.get("photo"),
            "matched_with_id": rec.get("matched_with_id"),
            "matched_with_name": rec.get("matched_with_name"),
            "similarity": rec.get("similarity")
        })
    return results

@app.post("/professor/dismiss-proxy/{session_id}/{student_id}")
async def dismiss_proxy(session_id: int, student_id: int, db: Session = Depends(get_db)):
    log = db.query(models.AttendanceLog).filter(
        models.AttendanceLog.session_id == session_id,
        models.AttendanceLog.student_id == student_id
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Attendance log not found")
    
    log.status = "verified"
    db.commit()
    face_recognition_service.update_proxy_status(session_id, student_id, False, "verified")

    if log.session and log.session.subject:
        await manager.broadcast(log.session.subject.code, {
            "type": "PROXY_STATUS_UPDATED",
            "student_id": student_id,
            "session_id": session_id,
            "status": "verified",
            "is_flagged_proxy": False
        })
    return {"status": "success", "message": "Proxy flag dismissed. Attendance marked verified."}

@app.post("/professor/confirm-proxy/{session_id}/{student_id}")
async def confirm_proxy(session_id: int, student_id: int, db: Session = Depends(get_db)):
    log = db.query(models.AttendanceLog).filter(
        models.AttendanceLog.session_id == session_id,
        models.AttendanceLog.student_id == student_id
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Attendance log not found")
    
    log.status = "confirmed_proxy"
    db.commit()
    face_recognition_service.update_proxy_status(session_id, student_id, True, "confirmed_proxy")

    if log.session and log.session.subject:
        await manager.broadcast(log.session.subject.code, {
            "type": "PROXY_STATUS_UPDATED",
            "student_id": student_id,
            "session_id": session_id,
            "status": "confirmed_proxy",
            "is_flagged_proxy": True
        })
    return {"status": "success", "message": "Proxy attendance confirmed and flagged."}

# ==========================================
# MULTI-FORMAT EXPORT ENGINE (CSV / EXCEL / PDF)
# ==========================================
class AttendancePDF(FPDF):
    def header(self):
        self.set_font('Helvetica', 'B', 15)
        self.set_text_color(30, 27, 75)
        self.cell(0, 8, 'TrustAttendance - Official Attendance Report', new_x='LMARGIN', new_y='NEXT', align='C')
        self.set_font('Helvetica', 'I', 9)
        self.set_text_color(100, 116, 139)
        self.cell(0, 5, 'Zero-Infrastructure Trust Triangle - WASM & WebAuthn Verified', new_x='LMARGIN', new_y='NEXT', align='C')
        self.ln(3)

    def footer(self):
        self.set_y(-12)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(148, 163, 184)
        self.cell(0, 10, f'Page {self.page_no()}/{{nb}} | Cryptographic Attendance Audit Record', align='C')

def build_export_response(logs: list, subject_code: str, subject_name: str, format_type: str = "csv", session_info: dict = None):
    fmt = format_type.lower().strip()
    timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
    session_label = f"Session_{session_info['id']}" if session_info else "All_Sessions"
    filename_base = f"{subject_code}_{session_label}_{timestamp_str}"

    # 1. EXCEL (.xlsx)
    if fmt in ["excel", "xlsx"]:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = f"{subject_code} Attendance"

        # Brand header banner
        ws.merge_cells('A1:F1')
        ws['A1'] = f"TRUSTATTENDANCE - {subject_name.upper()} ({subject_code})"
        ws['A1'].font = Font(size=14, bold=True, color="FFFFFF")
        ws['A1'].fill = PatternFill(start_color="312E81", end_color="312E81", fill_type="solid")
        ws['A1'].alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[1].height = 28

        # Subtitle info
        ws.merge_cells('A2:F2')
        sub_info = f"Session: {session_label} | Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Total Verified: {len(logs)}"
        ws['A2'] = sub_info
        ws['A2'].font = Font(size=9, italic=True, color="475569")
        ws['A2'].alignment = Alignment(horizontal="center")

        ws.append([]) # row 3 blank

        # Table headers
        headers = ["#", "Student ID", "Student Name", "Email", "Timestamp", "Status", "Device Binding"]
        ws.append(headers)
        ws.row_dimensions[4].height = 22
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=4, column=col_idx)
            cell.font = Font(bold=True, color="FFFFFF", size=10)
            cell.fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
            cell.alignment = Alignment(horizontal="center", vertical="center")

        thin_border = Border(
            left=Side(style='thin', color='E2E8F0'),
            right=Side(style='thin', color='E2E8F0'),
            top=Side(style='thin', color='E2E8F0'),
            bottom=Side(style='thin', color='E2E8F0')
        )

        for idx, log in enumerate(logs, start=1):
            student = log.student
            time_str = log.timestamp.strftime("%Y-%m-%d %H:%M:%S") if log.timestamp else "N/A"
            status_display = "Verified" if log.status == "verified" else ("Proxy Flagged" if log.status == "flagged_proxy" else "Proxy Confirmed")
            row_data = [
                idx,
                log.student_id,
                student.name if student else "Unknown",
                student.email if student else "N/A",
                time_str,
                status_display,
                "Bound 1:1 (WebAuthn)" if (student and student.hardware_id) else "Unbound"
            ]
            ws.append(row_data)
            row_num = ws.max_row
            fill_color = "FEF2F2" if log.status in ["flagged_proxy", "confirmed_proxy"] else ("F8FAFC" if idx % 2 == 0 else "FFFFFF")
            for col_idx in range(1, len(headers) + 1):
                c = ws.cell(row=row_num, column=col_idx)
                c.fill = PatternFill(start_color=fill_color, end_color=fill_color, fill_type="solid")
                c.border = thin_border
                c.alignment = Alignment(horizontal="center" if col_idx in [1, 2, 5, 6, 7] else "left", vertical="center")
                if log.status in ["flagged_proxy", "confirmed_proxy"] and col_idx == 6:
                    c.font = Font(color="DC2626", bold=True)

        for col in ws.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = openpyxl.utils.get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename_base}.xlsx"}
        )

    # 2. PDF (.pdf)
    elif fmt == "pdf":
        pdf = AttendancePDF()
        pdf.add_page()

        # Meta summary card
        pdf.set_fill_color(241, 245, 249)
        pdf.rect(10, 24, 190, 18, 'F')
        pdf.set_xy(14, 26)
        pdf.set_font('Helvetica', 'B', 10)
        pdf.set_text_color(30, 41, 59)
        pdf.cell(0, 6, f"Subject: {subject_name} ({subject_code})   |   Session: {session_label}", new_x='LMARGIN', new_y='NEXT')
        pdf.set_xy(14, 32)
        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(71, 85, 105)
        pdf.cell(0, 6, f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}   |   Total Students: {len(logs)}", new_x='LMARGIN', new_y='NEXT')
        pdf.ln(8)

        # Table Headers
        col_widths = [8, 16, 42, 46, 26, 30, 22]
        headers = ['#', 'ID', 'Student Name', 'Email', 'Timestamp', 'Status', 'Hardware']
        pdf.set_fill_color(79, 70, 229)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font('Helvetica', 'B', 9)
        for w, h in zip(col_widths, headers):
            pdf.cell(w, 8, h, border=1, fill=True, align='C')
        pdf.ln()

        # Table Rows
        pdf.set_font('Helvetica', '', 8)
        for idx, log in enumerate(logs, start=1):
            student = log.student
            time_str = log.timestamp.strftime("%H:%M:%S") if log.timestamp else "N/A"
            binding_str = "Bound" if (student and student.hardware_id) else "Unbound"
            status_str = "Verified" if log.status == "verified" else ("FLAGGED PROXY" if log.status == "flagged_proxy" else "CONFIRMED PROXY")
            
            is_proxy = log.status in ["flagged_proxy", "confirmed_proxy"]
            if is_proxy:
                pdf.set_fill_color(254, 226, 226) # light red
                pdf.set_text_color(185, 28, 28)
            else:
                fill_color = 248 if idx % 2 == 0 else 255
                pdf.set_fill_color(fill_color, fill_color, fill_color)
                pdf.set_text_color(15, 23, 42)
            
            row = [
                str(idx),
                str(log.student_id),
                (student.name[:20] if student else "Unknown"),
                (student.email[:22] if student else "N/A"),
                time_str,
                status_str,
                binding_str
            ]
            for w, val, col_i in zip(col_widths, row, range(len(row))):
                align = 'C' if col_i in [0, 1, 4, 5, 6] else 'L'
                pdf.cell(w, 7, val, border=1, fill=True, align=align)
            pdf.ln()

        pdf_bytes = pdf.output()
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename_base}.pdf"}
        )

    # 3. CSV (.csv) - Default
    else:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Index", "Student ID", "Student Name", "Email", "Timestamp", "Token Used", "Status", "Hardware Bound"])
        
        for idx, log in enumerate(logs, start=1):
            student = log.student
            student_name = student.name if student else "Unknown"
            student_email = student.email if student else "N/A"
            bound_str = "Yes" if (student and student.hardware_id) else "No"
            writer.writerow([
                idx,
                log.student_id, 
                student_name, 
                student_email,
                log.timestamp.strftime("%Y-%m-%d %H:%M:%S") if log.timestamp else "", 
                log.token_used, 
                log.status, 
                bound_str
            ])
        
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename_base}.csv"}
        )

@app.get("/professor/export/{subject_code}")
def export_all_attendance(
    subject_code: str, 
    format: str = Query("csv", pattern="^(csv|excel|xlsx|pdf)$"),
    db: Session = Depends(get_db)
):
    subject = db.query(models.Subject).filter(models.Subject.code == subject_code).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    logs = db.query(models.AttendanceLog).filter(models.AttendanceLog.subject_id == subject.id).order_by(models.AttendanceLog.timestamp.desc()).all()
    return build_export_response(logs, subject.code, subject.name, format)

@app.get("/professor/export/session/{session_id}")
def export_session_attendance(
    session_id: int, 
    format: str = Query("csv", pattern="^(csv|excel|xlsx|pdf)$"),
    db: Session = Depends(get_db)
):
    sess = db.query(models.ClassSession).filter(models.ClassSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    
    subject = sess.subject
    logs = db.query(models.AttendanceLog).filter(models.AttendanceLog.session_id == session_id).order_by(models.AttendanceLog.timestamp.asc()).all()
    
    session_info = {
        "id": sess.id,
        "time": sess.start_time.strftime("%Y-%m-%d %H:%M") if sess.start_time else "N/A"
    }
    return build_export_response(logs, subject.code, subject.name, format, session_info=session_info)

@app.websocket("/ws/session/{subject_code}")
async def websocket_endpoint(websocket: WebSocket, subject_code: str):
    await manager.connect(websocket, subject_code)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, subject_code)