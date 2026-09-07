import pyotp
import json
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from database import engine, Base, get_db
from redis_client import redis_db
import models

# Tells SQLAlchemy to create the tables in your Neon database if they don't exist
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="TrustAttendance API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local testing (restrict to your frontend URL in production)
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)

# ==========================================
# WEBSOCKET MANAGER (For Live Headcount)
# ==========================================
class ConnectionManager:
    def __init__(self):
        # Stores active websocket connections mapped by subject_code
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
# PYDANTIC SCHEMAS (Data Validation)
# ==========================================
class SessionStart(BaseModel):
    subject_code: str
    professor_id: int

class AttendanceVerify(BaseModel):
    subject_code: str
    student_id: int
    token: str

# ==========================================
# API ROUTES
# ==========================================

@app.get("/")
def read_root():
    return {"message": "TrustAttendance API is running"}

@app.get("/health/db")
def test_db_connection(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "success", "message": "Successfully connected to Neon PostgreSQL!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")

# 1. PROFESSOR STARTS A SESSION
@app.post("/session/start")
def start_session(data: SessionStart):
    # Generate a unique cryptographic seed for this specific class session
    totp_secret = pyotp.random_base32()
    
    # Store the session data in Redis (Lightning fast, auto-expires in 2 hours)
    session_key = f"session:{data.subject_code}"
    redis_db.hset(session_key, mapping={
        "secret": totp_secret,
        "professor_id": str(data.professor_id)
    })
    redis_db.expire(session_key, 7200) # 7200 seconds = 2 hours

    return {
        "message": "Session started successfully", 
        "subject_code": data.subject_code, 
        "secret": totp_secret
    }

# 2. STUDENT VERIFIES ATTENDANCE
@app.post("/attendance/verify")
async def verify_attendance(data: AttendanceVerify, db: Session = Depends(get_db)):
    session_key = f"session:{data.subject_code}"
    
    # Check if the class is actually in session
    if not redis_db.exists(session_key):
        raise HTTPException(status_code=404, detail="No active session found for this subject. Did the professor start the class?")
        
    secret = redis_db.hget(session_key, "secret")
    
    # Verify the dynamic token (interval=5 matches our 5-second QR refresh rate)
    # valid_window=1 allows 1 previous interval to account for slight network/camera delays
    totp = pyotp.TOTP(secret, interval=5)
    
    if not totp.verify(data.token, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid or expired TOTP token. Proxies denied.")
        
    # Log the successful attendance to the permanent Neon Postgres DB
    # (Assuming subject_id=1 for this prototype; normally you'd query the Subject table first)
    db_log = models.AttendanceLog(
        student_id=data.student_id,
        subject_id=1, 
        token_used=data.token,
        status="verified"
    )
    db.add(db_log)
    db.commit()
    
    # Push Live Update to the Professor's screen via WebSocket
    await manager.broadcast(data.subject_code, {
        "type": "NEW_ATTENDANCE",
        "student_id": data.student_id,
        "message": "Student successfully verified"
    })

    return {"status": "success", "message": "Attendance marked and saved securely!"}

# 3. PROFESSOR WEBSOCKET LISTENER
@app.websocket("/ws/session/{subject_code}")
async def websocket_endpoint(websocket: WebSocket, subject_code: str):
    await manager.connect(websocket, subject_code)
    try:
        while True:
            # Keep the connection open to push updates
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, subject_code)