from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    role = Column(String, index=True) # 'admin', 'professor', or 'student'
    name = Column(String)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    hardware_id = Column(String, nullable=True) # Used for WebAuthn/Phone binding

class Subject(Base):
    __tablename__ = "subjects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    code = Column(String, unique=True, index=True) # e.g., 'CS301'

class AttendanceLog(Base):
    __tablename__ = "attendance_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    token_used = Column(String)
    status = Column(String, default="verified")

    # Relationships to easily query associated data
    student = relationship("User")
    subject = relationship("Subject")