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
const favoriteLimiter = makeLimiter(20, "1 m");
const watchedLimiter = makeLimiter(20, "1 m");
const likeLimiter = makeLimiter(20, "1 m");
const deleteLimiter = makeLimiter(10, "1 m");
const profileLimiter = makeLimiter(10, "1 m");
const followLimiter = makeLimiter(30, "1 m");
const commentLimiter = makeLimiter(15, "1 m");
// Mai restrictiv: fiecare apel creează un Customer/Checkout Session la Stripe
const checkoutLimiter = makeLimiter(5, "1 m");
// Endpoint public de sugestii (lovește TMDB la fiecare apel) — cheie = userId sau IP
const searchLimiter = makeLimiter(60, "1 m");

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
export const limitFavorite = (userId: string) => enforce(favoriteLimiter, userId, "favorite");
export const limitWatched = (userId: string) => enforce(watchedLimiter, userId, "watched");
export const limitLike = (userId: string) => enforce(likeLimiter, userId, "like");
export const limitDelete = (userId: string) => enforce(deleteLimiter, userId, "delete");
export const limitProfile = (userId: string) => enforce(profileLimiter, userId, "profile");
export const limitFollow = (userId: string) => enforce(followLimiter, userId, "follow");
export const limitComment = (userId: string) => enforce(commentLimiter, userId, "comment");
export const limitCheckout = (userId: string) => enforce(checkoutLimiter, userId, "checkout");
export const limitSearch = (identifier: string) => enforce(searchLimiter, identifier, "search");
