import os
import cv2
import numpy as np
import base64
import json
from typing import Optional, Dict, Any, List
import onnxruntime as ort

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
RECORDS_DIR = os.path.join(DATA_DIR, "face_records")
os.makedirs(RECORDS_DIR, exist_ok=True)

CASCADE_PATH = os.path.join(DATA_DIR, "haarcascade_frontalface_default.xml")
MODEL_PATH = os.path.join(DATA_DIR, ".deepface", "weights", "face_recognition_sface_2021dec.onnx")

# Initialize models once
face_cascade = cv2.CascadeClassifier(CASCADE_PATH)

ort_session = None
input_name = None

def get_ort_session():
    global ort_session, input_name
    if ort_session is None and os.path.exists(MODEL_PATH):
        try:
            # Silence internal ONNX runtime warnings
            opts = ort.SessionOptions()
            opts.log_severity_level = 3
            ort_session = ort.InferenceSession(MODEL_PATH, opts)
            input_name = ort_session.get_inputs()[0].name
        except Exception as e:
            print("Warning: Failed to load SFace ONNX session:", e)
    return ort_session, input_name

# In-memory session cache: session_id -> list of records
_session_cache: Dict[int, List[Dict[str, Any]]] = {}

def load_session_records(session_id: int) -> List[Dict[str, Any]]:
    if session_id in _session_cache:
        return _session_cache[session_id]
    
    file_path = os.path.join(RECORDS_DIR, f"session_{session_id}.json")
    if os.path.exists(file_path):
        try:
            with open(file_path, "r") as f:
                records = json.load(f)
                _session_cache[session_id] = records
                return records
        except Exception:
            pass
    _session_cache[session_id] = []
    return []

def persist_session_records(session_id: int):
    records = _session_cache.get(session_id, [])
    file_path = os.path.join(RECORDS_DIR, f"session_{session_id}.json")
    try:
        with open(file_path, "w") as f:
            json.dump(records, f)
    except Exception as e:
        print("Error saving session face records:", e)

def process_face_image(image_b64: str) -> Dict[str, Any]:
    """
    Decodes base64 image data, verifies face presence using OpenCV Haar cascades,
    and extracts a 128-dimensional normalized embedding vector.
    Raises ValueError('No face detected in camera frame') if no face is visible.
    """
    if not image_b64:
        raise ValueError("No camera frame provided.")

    if "," in image_b64:
        image_b64 = image_b64.split(",")[1]

    try:
        img_bytes = base64.b64decode(image_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    except Exception as e:
        raise ValueError("Invalid image encoding: " + str(e))

    if img is None:
        raise ValueError("Could not decode camera image frame.")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray_eq = cv2.equalizeHist(gray)

    # 1. Primary frontal face detection
    faces = face_cascade.detectMultiScale(
        gray_eq,
        scaleFactor=1.1,
        minNeighbors=4,
        minSize=(35, 35)
    )

    # 2. Relaxed threshold fallback for mobile angles/lighting
    if len(faces) == 0:
        faces = face_cascade.detectMultiScale(
            gray_eq,
            scaleFactor=1.05,
            minNeighbors=2,
            minSize=(25, 25)
        )

    # 3. If no face detected, try non-equalized gray (some direct sunlight can over-saturate equalized gray)
    if len(faces) == 0:
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.05,
            minNeighbors=2,
            minSize=(25, 25)
        )

    # 4. Mobile orientation fallback (if phone sent 90deg rotated canvas buffer)
    if len(faces) == 0:
        for rot in [cv2.ROTATE_90_CLOCKWISE, cv2.ROTATE_90_COUNTERCLOCKWISE]:
            rot_gray = cv2.rotate(gray_eq, rot)
            rot_faces = face_cascade.detectMultiScale(
                rot_gray,
                scaleFactor=1.08,
                minNeighbors=2,
                minSize=(25, 25)
            )
            if len(rot_faces) > 0:
                faces = rot_faces
                img = cv2.rotate(img, rot)
                gray = cv2.rotate(gray, rot)
                break

    if len(faces) == 0:
        raise ValueError("No face detected in camera frame. Please ensure your face is well-lit and directly facing the camera.")

    # Select the largest face by area
    largest_face = max(faces, key=lambda f: f[2] * f[3])
    x, y, w, h = largest_face

    # Crop and extract embedding using SFace
    sess, in_name = get_ort_session()
    embedding = None

    if sess and in_name:
        try:
            # Crop face region with 10% margin
            margin_x = int(w * 0.1)
            margin_y = int(h * 0.1)
            x1 = max(0, x - margin_x)
            y1 = max(0, y - margin_y)
            x2 = min(img.shape[1], x + w + margin_x)
            y2 = min(img.shape[0], y + h + margin_y)

            face_crop = img[y1:y2, x1:x2]
            face_resized = cv2.resize(face_crop, (112, 112))
            input_blob = face_resized[..., ::-1].transpose(2, 0, 1)  # BGR to RGB, CHW
            input_blob = np.expand_dims(input_blob, axis=0).astype(np.float32)

            raw_emb = sess.run(None, {in_name: input_blob})[0][0]
            norm = np.linalg.norm(raw_emb)
            if norm > 0:
                embedding = (raw_emb / norm).tolist()
        except Exception as e:
            print("Error in SFace ONNX inference:", e)

    # Fallback embedding if ONNX is unavailable (normalized grayscale histogram vector)
    if embedding is None:
        face_crop = cv2.resize(gray[y:y+h, x:x+w], (32, 32))
        hist = cv2.calcHist([face_crop], [0], None, [128], [0, 256]).flatten()
        norm = np.linalg.norm(hist)
        embedding = (hist / (norm if norm > 0 else 1.0)).tolist()

    # Create optimized thumbnail for storage
    thumb = cv2.resize(img, (320, 240))
    # Draw green bounding box around detected face
    cv2.rectangle(thumb, (int(x * 320 / img.shape[1]), int(y * 240 / img.shape[0])), 
                  (int((x + w) * 320 / img.shape[1]), int((y + h) * 240 / img.shape[0])), (79, 229, 70), 2)
    _, buffer = cv2.imencode('.jpg', thumb, [cv2.IMWRITE_JPEG_QUALITY, 80])
    thumb_b64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')

    return {
        "embedding": embedding,
        "box": [int(x), int(y), int(w), int(h)],
        "thumbnail_b64": thumb_b64
    }

def check_proxy_attempt(new_embedding: List[float], session_id: int, student_id: int, threshold: float = 0.68) -> Dict[str, Any]:
    """
    Compares the incoming face embedding vector against all existing face embeddings in the active session.
    If similarity >= threshold with a DIFFERENT student ID, flags as a proxy attempt.
    """
    records = load_session_records(session_id)
    new_v = np.array(new_embedding, dtype=np.float32)
    new_norm = np.linalg.norm(new_v)
    if new_norm > 0:
        new_v = new_v / new_norm

    highest_sim = 0.0
    matched_record = None

    for rec in records:
        if rec.get("student_id") == student_id:
            continue  # Same student (duplicate handled elsewhere)

        prev_emb = rec.get("embedding")
        if not prev_emb:
            continue

        prev_v = np.array(prev_emb, dtype=np.float32)
        prev_norm = np.linalg.norm(prev_v)
        if prev_norm > 0:
            prev_v = prev_v / prev_norm

        # Cosine similarity
        sim = float(np.dot(new_v, prev_v))
        if sim > highest_sim:
            highest_sim = sim
            matched_record = rec

    is_proxy = highest_sim >= threshold
    if is_proxy and matched_record:
        # Flag the previous record as well
        matched_record["is_flagged_proxy"] = True
        matched_record["status"] = "flagged_proxy"
        matched_record["matched_with_id"] = student_id
        persist_session_records(session_id)

    return {
        "is_proxy": is_proxy,
        "similarity": round(highest_sim, 3),
        "matched_student_id": matched_record["student_id"] if matched_record and is_proxy else None,
        "matched_student_name": matched_record.get("student_name") if matched_record and is_proxy else None,
        "matched_photo": matched_record.get("photo") if matched_record and is_proxy else None
    }

def save_face_record(
    session_id: int,
    student_id: int,
    student_name: str,
    embedding: List[float],
    thumbnail_b64: str,
    is_flagged_proxy: bool,
    matched_with_id: Optional[int] = None,
    matched_with_name: Optional[str] = None,
    similarity: Optional[float] = None
):
    records = load_session_records(session_id)

    # Remove any existing record for this student in this session (e.g. retry)
    records = [r for r in records if r.get("student_id") != student_id]

    records.append({
        "student_id": student_id,
        "student_name": student_name,
        "embedding": embedding,
        "photo": thumbnail_b64,
        "is_flagged_proxy": is_flagged_proxy,
        "status": "flagged_proxy" if is_flagged_proxy else "verified",
        "matched_with_id": matched_with_id,
        "matched_with_name": matched_with_name,
        "similarity": similarity
    })
    _session_cache[session_id] = records
    persist_session_records(session_id)

def get_session_face_records(session_id: int) -> List[Dict[str, Any]]:
    records = load_session_records(session_id)
    # Return viewable metadata for professor dashboard
    return [
        {
            "student_id": r.get("student_id"),
            "student_name": r.get("student_name"),
            "photo": r.get("photo"),
            "is_flagged_proxy": r.get("is_flagged_proxy", False),
            "status": r.get("status", "verified"),
            "matched_with_id": r.get("matched_with_id"),
            "matched_with_name": r.get("matched_with_name"),
            "similarity": r.get("similarity")
        }
        for r in records
    ]

def update_proxy_status(session_id: int, student_id: int, is_flagged: bool, new_status: str):
    records = load_session_records(session_id)
    for r in records:
        if r.get("student_id") == student_id:
            r["is_flagged_proxy"] = is_flagged
            r["status"] = new_status
    _session_cache[session_id] = records
    persist_session_records(session_id)
