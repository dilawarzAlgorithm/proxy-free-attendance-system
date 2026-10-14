import os
import csv
import io
import pyotp
import json
import bcrypt
import hashlib
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Header
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from database import engine, Base, get_db
from redis_client import redis_db
import models

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="TrustAttendance API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://proxy-free-attendance-system.vercel.app",
        "http://localhost:5173",
        "https://localhost:5173",
        "http://127.0.0.1:5173",
        "https://127.0.0.1:5173"
    ],
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
            self.active_connections[subject_code].remove(websocket)

    async def broadcast(self, subject_code: str, message: dict):
        if subject_code in self.active_connections:
            for connection in self.active_connections[subject_code]:
                await connection.send_text(json.dumps(message))

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
    department: Optional[str] = None
    batch_year: Optional[int] = None

class SubjectCreate(BaseModel):
    name: str
    code: str
    department: str
    professor_id: Optional[int] = None

class SessionStart(BaseModel):
    subject_code: str
    professor_id: int

class AttendanceVerify(BaseModel):
    subject_code: str
    student_id: int
    token: str
    timestamp: float = None
    signature: str = None

class PasswordChange(BaseModel):
    user_id: int
    new_password: str

class ResetUserPassword(BaseModel):
    new_password: str

# ==========================================
# AUTHENTICATION & USERS
# ==========================================
@app.post("/auth/login")
def login(credentials: LoginRequest, x_device_id: Optional[str] = Header(None), db: Session = Depends(get_db)):
    if credentials.email == os.getenv("ADMIN_EMAIL") and credentials.password == os.getenv("ADMIN_PASSWORD"):
        return {"id": 0, "role": "admin", "name": "System Admin", "email": credentials.email, "requires_password_change": False}
    
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
        
    try:
        password_bytes = credentials.password.encode('utf-8')[:72]
        if not bcrypt.checkpw(password_bytes, user.hashed_password.encode('utf-8')):
            raise HTTPException(status_code=401, detail="Invalid email or password.")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    
    # Device binding for students
    if user.role == "student" and x_device_id:
        if not user.hardware_id:
            user.hardware_id = x_device_id
            db.commit()
        elif user.hardware_id != x_device_id:
            raise HTTPException(status_code=403, detail="Login blocked: Device mismatch. Contact admin to unbind device.")

    return {
        "id": user.id, 
        "role": user.role, 
        "name": user.name, 
        "email": user.email,
        "requires_password_change": user.requires_password_change,
        "hardware_id": user.hardware_id,
        "department": user.department,
        "batch_year": user.batch_year
    }

@app.post("/auth/change-password")
def change_password(data: PasswordChange, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    password_bytes = data.new_password.encode('utf-8')[:72]
    hashed_pwd = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')
    
    user.hashed_password = hashed_pwd
    user.requires_password_change = False
    db.commit()
    return {"status": "success"}

# ==========================================
# ADMIN ROUTES
# ==========================================
@app.get("/admin/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    return [{
        "id": u.id, "name": u.name, "email": u.email, "role": u.role, 
        "department": u.department, "batch_year": u.batch_year,
        "hardware_id": u.hardware_id
    } for u in users]

@app.post("/admin/users")
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    password_bytes = user.password.encode('utf-8')[:72]
    hashed_pwd = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')
    
    new_user = models.User(
        name=user.name, 
        email=user.email, 
        hashed_password=hashed_pwd, 
        role=user.role,
        department=user.department,
        batch_year=user.batch_year,
        requires_password_change=True # Force change on first login
    )
    db.add(new_user)
    db.commit()
    return {"status": "success", "message": "User created successfully"}

@app.post("/admin/users/{user_id}/reset-password")
def admin_reset_password(user_id: int, data: ResetUserPassword, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    password_bytes = data.new_password.encode('utf-8')[:72]
    user.hashed_password = bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')
    user.requires_password_change = True
    db.commit()
    return {"status": "success", "message": "Password reset"}

@app.post("/admin/reset_db")
def reset_db(db: Session = Depends(get_db)):
    models.Base.metadata.drop_all(bind=engine)
    models.Base.metadata.create_all(bind=engine)
    return {"status": "success", "message": "Database completely reset"}

@app.get("/admin/subjects")
def get_subjects(db: Session = Depends(get_db)):
    subjects = db.query(models.Subject).all()
    res = []
    for s in subjects:
        prof = db.query(models.User).filter(models.User.id == s.professor_id).first() if s.professor_id else None
        res.append({
            "id": s.id, "name": s.name, "code": s.code, "department": s.department,
            "professor_id": s.professor_id,
            "professor_name": prof.name if prof else "Unassigned"
        })
    return res

@app.post("/admin/subjects")
def create_subject(subject: SubjectCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Subject).filter(models.Subject.code == subject.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Subject code already exists")
    
    new_sub = models.Subject(
        name=subject.name, 
        code=subject.code, 
        department=subject.department,
        professor_id=subject.professor_id
    )
    db.add(new_sub)
    db.commit()
    return {"status": "success", "message": "Subject created"}

# ==========================================
# SESSION & ATTENDANCE ROUTES
# ==========================================
@app.post("/session/start")
def start_session(data: SessionStart):
    totp_secret = pyotp.random_base32()
    session_key = f"session:{data.subject_code}"
    
    redis_db.hset(session_key, mapping={
        "secret": totp_secret,
        "professor_id": str(data.professor_id)
    })
    redis_db.expire(session_key, 7200)
    
    return {"message": "Session started", "secret": totp_secret}

@app.get("/session/token/{subject_code}")
def get_current_token(subject_code: str):
    session_key = f"session:{subject_code}"
    if not redis_db.exists(session_key):
        raise HTTPException(status_code=404, detail="No active session found.")
    secret = redis_db.hget(session_key, "secret")
    totp = pyotp.TOTP(secret, interval=5)
    return {"token": totp.now()}

@app.post("/attendance/verify")
async def verify_attendance(data: AttendanceVerify, x_device_id: Optional[str] = Header(None), db: Session = Depends(get_db)):
    # Verify Device ID matches student's bound hardware_id
    student = db.query(models.User).filter(models.User.id == data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if student.hardware_id and x_device_id and student.hardware_id != x_device_id:
        raise HTTPException(status_code=403, detail="Device mismatch. Proxy attendance detected.")

    session_key = f"session:{data.subject_code}"
    if not redis_db.exists(session_key):
        raise HTTPException(status_code=404, detail="No active session found. Wait for professor.")
        
    secret = redis_db.hget(session_key, "secret")
    totp = pyotp.TOTP(secret, interval=5)
    
    clean_token = data.token.strip().upper()
    if ":" in clean_token:
        clean_token = clean_token.split(":")[-1]
    
    client_time = datetime.now()
    if data.timestamp and data.signature:
        expected_sig = hashlib.sha256(f"{data.student_id}:{clean_token}:{data.timestamp}".encode()).hexdigest()
        if expected_sig != data.signature:
            raise HTTPException(status_code=403, detail="Invalid digital signature. Anti-tamper triggered.")
        client_time = datetime.fromtimestamp(data.timestamp)

    if not totp.verify(clean_token, valid_window=4, for_time=client_time):
        raise HTTPException(status_code=401, detail="Invalid or expired token. Proxies denied.")
        
    subject = db.query(models.Subject).filter(models.Subject.code == data.subject_code).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    existing_log = db.query(models.AttendanceLog).filter(
        models.AttendanceLog.student_id == data.student_id,
        models.AttendanceLog.subject_id == subject.id,
        models.AttendanceLog.token_used == clean_token
    ).first()

    if not existing_log:
        db_log = models.AttendanceLog(student_id=data.student_id, subject_id=subject.id, token_used=clean_token, timestamp=client_time, status="verified")
        db.add(db_log)
        db.commit()
    
    await manager.broadcast(data.subject_code, {
        "type": "NEW_ATTENDANCE",
        "student_id": data.student_id,
        "student_name": student.name
    })
    return {"status": "success"}

# ==========================================
# STUDENT DASHBOARD ROUTES
# ==========================================
@app.get("/student/attendance/{student_id}")
def get_student_attendance(student_id: int, db: Session = Depends(get_db)):
    logs = db.query(models.AttendanceLog).filter(models.AttendanceLog.student_id == student_id).all()
    res = []
    for log in logs:
        sub = db.query(models.Subject).filter(models.Subject.id == log.subject_id).first()
        res.append({
            "subject_code": sub.code if sub else "Unknown",
            "subject_name": sub.name if sub else "Unknown",
            "timestamp": log.timestamp.isoformat(),
            "status": log.status
        })
    return res

# ==========================================
# PROFESSOR EXPORT ROUTE
# ==========================================
@app.get("/professor/export/{subject_code}")
def export_attendance(subject_code: str, db: Session = Depends(get_db)):
    subject = db.query(models.Subject).filter(models.Subject.code == subject_code).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    logs = db.query(models.AttendanceLog).filter(models.AttendanceLog.subject_id == subject.id).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Student ID", "Student Name", "Timestamp", "Token Used", "Status", "Scan Type"])
    
    for log in logs:
        student = db.query(models.User).filter(models.User.id == log.student_id).first()
        student_name = student.name if student else "Unknown"
        scan_type = "Offline Synced" if log.status == "verified" else "Live"
        writer.writerow([log.student_id, student_name, log.timestamp.strftime("%Y-%m-%d %H:%M:%S"), log.token_used, log.status, scan_type])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={subject_code}_attendance.csv"}
    )

@app.websocket("/ws/session/{subject_code}")
async def websocket_endpoint(websocket: WebSocket, subject_code: str):
    await manager.connect(websocket, subject_code)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, subject_code)

# ==========================================
# STATIC FRONTEND SERVING (For Unified Docker Container)
# ==========================================
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(STATIC_DIR):
    from fastapi.staticfiles import StaticFiles
    from starlette.responses import FileResponse

    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))