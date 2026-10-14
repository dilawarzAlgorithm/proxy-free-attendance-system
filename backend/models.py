from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String, nullable=False) # admin, professor, student
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    hardware_id = Column(String, nullable=True) # for device binding
    department = Column(String, nullable=True)
    batch_year = Column(Integer, nullable=True)
    requires_password_change = Column(Boolean, default=False)

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, index=True, nullable=False)
    department = Column(String, nullable=False)
    professor_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    professor = relationship("User")

class AttendanceLog(Base):
    __tablename__ = "attendance_logs"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    token_used = Column(String, nullable=True)
    status = Column(String, nullable=False)

    student = relationship("User")
    subject = relationship("Subject")