import Redis from "ioredis";

export const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: () => null
});

redis.on("error", error => {
  if (process.env.NODE_ENV === "production") {
    console.error("[redis] connection error:", error);
  }
});

let isRedisUnavailable = false;
let lastConnectAttempt = 0;
const RECONNECT_COOLDOWN_MS = 60000; // 1 minute
let lastWarningLoggedAt = 0;
const WARNING_COOLDOWN_MS = 300000; // 5 minutes

export async function safeRedis<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  const now = Date.now();
  const needsConnect = redis.status === "wait" || redis.status === "end" || redis.status === "close";

  if (needsConnect && isRedisUnavailable && (now - lastConnectAttempt < RECONNECT_COOLDOWN_MS)) {
    return fallback;
  }

  try {
    if (needsConnect) {
      lastConnectAttempt = now;
      try {
        await redis.connect();
        isRedisUnavailable = false;
      } catch (connErr) {
        isRedisUnavailable = true;
        throw connErr;
      }
    }

    if (redis.status !== "ready") {
      isRedisUnavailable = true;
      return fallback;
    }

    const result = await operation();
    isRedisUnavailable = false;
    return result;
  } catch (error) {
    isRedisUnavailable = true;
    
    if (now - lastWarningLoggedAt > WARNING_COOLDOWN_MS) {
      lastWarningLoggedAt = now;
      if (process.env.NODE_ENV === "production") {
        console.error("[redis] Error during Redis operation in production, falling back:", error instanceof Error ? error.stack || error.message : error);
      } else {
        console.warn("[redis] Falling back because Redis is unavailable (throttled):", error instanceof Error ? error.message : error);
      }
    }
    return fallback;
  }
}
