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

    def hset(self, name, key=None, value=None, mapping=None, **kwargs):
        self._is_expired(name)
        if name not in self._store or not isinstance(self._store[name], dict):
            self._store[name] = {}
        count = 0
        if key is not None and value is not None:
            self._store[name][str(key)] = str(value)
            count += 1
        if mapping:
            self._store[name].update({str(k): str(v) for k, v in mapping.items()})
            count += len(mapping)
        if kwargs:
            self._store[name].update({str(k): str(v) for k, v in kwargs.items()})
            count += len(kwargs)
        return count

    def hget(self, key, field):
        if self._is_expired(key):
            return None
        return self._store.get(key, {}).get(field)

    def delete(self, *keys):
        count = 0
        for k in keys:
            if k in self._store:
                self._store.pop(k, None)
                self._expiry.pop(k, None)
                count += 1
        return count

    def hdel(self, key, *fields):
        if key in self._store and isinstance(self._store[key], dict):
            count = 0
            for f in fields:
                if f in self._store[key]:
                    self._store[key].pop(f, None)
                    count += 1
            return count
        return 0

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