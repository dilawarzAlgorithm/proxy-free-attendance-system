import os
import redis
from dotenv import load_dotenv

load_dotenv()

# Uses local Redis by default. You can replace this in your .env later 
# with an Upstash or Render Redis URL for production.
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# decode_responses=True ensures we get strings back from Redis instead of raw bytes
redis_db = redis.from_url(REDIS_URL, decode_responses=True)