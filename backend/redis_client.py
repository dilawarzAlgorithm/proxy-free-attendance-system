import os
import time
import redis
from dotenv import load_dotenv

load_dotenv()

# Uses local Redis by default or Upstash URL if configured
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

class InMemoryRedis:
    """Lightweight in-memory Redis fallback if Redis server/Upstash is unavailable."""
    def __init__(self):
        self._store = {}
        self._expiry = {}

    def _is_expired(self, key):
        if key in self._expiry and time.time() > self._expiry[key]:
            self._store.pop(key, None)
            self._expiry.pop(key, None)
            return True
        return False

    def hset(self, key, mapping=None, **kwargs):
        self._is_expired(key)
        if key not in self._store or not isinstance(self._store[key], dict):
            self._store[key] = {}
        if mapping:
            self._store[key].update(mapping)
        if kwargs:
            self._store[key].update(kwargs)
        return len(mapping or kwargs)

    def hget(self, key, field):
        if self._is_expired(key):
            return None
        return self._store.get(key, {}).get(field)

    def exists(self, key):
        if self._is_expired(key):
            return 0
        return 1 if key in self._store else 0

    def expire(self, key, seconds):
        if key in self._store:
            self._expiry[key] = time.time() + seconds
            return True
        return False

    def ping(self):
        return True

try:
    client = redis.from_url(REDIS_URL, decode_responses=True, socket_timeout=2)
    client.ping()
    redis_db = client
except Exception as e:
    print(f"Notice: Redis connection to {REDIS_URL} failed ({e}). Using in-memory fallback store.")
    redis_db = InMemoryRedis()