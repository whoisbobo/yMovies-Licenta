import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const hasUpstashConfig =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasUpstashConfig ? Redis.fromEnv() : null;

function makeLimiter(requests: number, window: `${number} ${"s" | "m" | "h"}`) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
  });
}

// Limite distincte per acțiune, identificate după userId Clerk
const reviewLimiter = makeLimiter(5, "1 m");
const watchlistLimiter = makeLimiter(20, "1 m");
const deleteLimiter = makeLimiter(10, "1 m");
// Mai restrictiv: fiecare apel creează un Customer/Checkout Session la Stripe
const checkoutLimiter = makeLimiter(5, "1 m");

async function enforce(
  limiter: Ratelimit | null,
  userId: string,
  action: string
) {
  if (!limiter) return; // Upstash neconfigurat (ex: dev local) — nu blocăm

  const { success } = await limiter.limit(`${action}:${userId}`);
  if (!success) {
    throw new Error("Prea multe cereri. Încearcă din nou în câteva momente.");
  }
}

export const limitReview = (userId: string) => enforce(reviewLimiter, userId, "review");
export const limitWatchlist = (userId: string) => enforce(watchlistLimiter, userId, "watchlist");
export const limitDelete = (userId: string) => enforce(deleteLimiter, userId, "delete");
export const limitCheckout = (userId: string) => enforce(checkoutLimiter, userId, "checkout");
