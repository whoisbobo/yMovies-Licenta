# Security Audit Report: yMovies

**Date:** May 30, 2026  
**Scope:** Entire yMovies Codebase (Next.js App Router, Prisma, Clerk)  

## Executive Summary
This report outlines the findings of a security audit conducted on the yMovies codebase. The application implements good baseline security practices, such as proper IDOR (Insecure Direct Object Reference) protection on review deletion and CSRF protection via Next.js Server Actions. However, several vulnerabilities and reliability issues were identified, ranging from Server-Side Parameter Injection to Data Integrity flaws.

Below is a detailed breakdown of the vulnerabilities found, their attack vectors, and instructions on how to fix them.

---

## Findings

### 1. Server-Side Parameter Injection (SSRF Variant)
**Severity:** Medium  
**Location:** `app/page.tsx`  

**Description:**  
The application takes the `query` and `genreId` parameters directly from the URL's `searchParams` and interpolates them into the TMDB API request URL without URL encoding them.

```typescript
// app/page.tsx
if (query) {
  endpoint = `https://api.themoviedb.org/3/search/multi?api_key=${process.env.TMDB_API_KEY}&language=${tmdbLang}&query=${query}&page=${page}`;
}
```

**Attack Vector:**  
An attacker can craft a malicious URL (e.g., `/?search=Batman&include_adult=true`) which injects unauthorized query parameters into the backend TMDB API request. This could bypass application logic or cause unexpected behavior from the third-party API.

**How to Fix:**  
Wrap the parameters in `encodeURIComponent()` before interpolating them into the URL string.

```typescript
// Fix in app/page.tsx
if (query) {
  endpoint = `https://api.themoviedb.org/3/search/multi?api_key=${process.env.TMDB_API_KEY}&language=${tmdbLang}&query=${encodeURIComponent(query)}&page=${page}`;
} else if (genreId) {
  endpoint = `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.TMDB_API_KEY}&language=${tmdbLang}&with_genres=${encodeURIComponent(genreId)}&page=${page}`;
}
```

---

### 2. Missing User Record Validation (Data Integrity / DoS)
**Severity:** High  
**Location:** `app/actions.ts` (`submitReview` and `toggleWatchlist`)  

**Description:**  
The application relies on `app/page.tsx` (the home page) to upsert the user into the Prisma database upon login. If a user logs in and directly navigates to a movie page (e.g., via a direct link) without visiting the home page, their `User` record won't exist in the database. When they try to submit a review, Prisma will throw a Foreign Key Constraint violation because the `userId` doesn't exist in the `User` table, resulting in an unhandled 500 Internal Server Error.

**Attack Vector:**  
A user (or an attacker automating requests) can repeatedly hit the Server Actions with a valid Clerk session but no DB record, causing unhandled server errors and potentially degrading server performance.

**How to Fix:**  
The most robust fix is to use **Clerk Webhooks** (`user.created`, `user.updated`) to sync users to the database asynchronously. 
Alternatively, ensure `submitReview` and `toggleWatchlist` check for and create the user record if it doesn't exist before inserting the review:

```typescript
// Fix in app/actions.ts (add this before creating a review/watchlist item)
const userRecord = await prisma.user.findUnique({ where: { id: userId } });
if (!userRecord) {
  const clerkUser = await currentUser(); // import from @clerk/nextjs/server
  await prisma.user.create({
    data: {
      id: userId,
      email: clerkUser?.emailAddresses[0].emailAddress || "",
      username: clerkUser?.username || `user_${userId.slice(0, 5)}`,
      avatarUrl: clerkUser?.imageUrl,
    }
  });
}
```

---

### 3. Insufficient Input Validation & Type Checking
**Severity:** Medium  
**Location:** `app/actions.ts` (`submitReview`)  

**Description:**  
The `movieId` and `rating` are parsed using `parseInt(formData.get("...") as string)`. If the input is not a valid number, `parseInt` returns `NaN`. Passing `NaN` to Prisma causes a runtime exception. Furthermore, `rating` is not validated to be within the expected range (1 to 10), and `comment` length is not restricted.

**Attack Vector:**  
An attacker can intercept the form submission and send non-numeric values to cause a 500 error. They can also submit a rating of `1000` or a 10MB string for the comment, leading to data corruption, UI display issues, or database bloat.

**How to Fix:**  
Use a validation library like `zod` to validate the `FormData` strictly.

```typescript
// Fix in app/actions.ts
import { z } from "zod";

const reviewSchema = z.object({
  movieId: z.coerce.number().int().positive(),
  rating: z.coerce.number().int().min(1).max(10),
  comment: z.string().max(2000, "Comentariul este prea lung"),
});

export async function submitReview(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  const parsed = reviewSchema.safeParse({
    movieId: formData.get("movieId"),
    rating: formData.get("rating"),
    comment: formData.get("comment"),
  });

  if (!parsed.success) {
    throw new Error("Date invalide");
  }

  const { movieId, rating, comment } = parsed.data;
  // ... continue with database logic
}
```

---

### 4. Client-Side Trust for Database Population
**Severity:** Low / Medium  
**Location:** `app/actions.ts` (`submitReview` and `toggleWatchlist`)  

**Description:**  
When a movie is first reviewed or added to a watchlist, it is created in the database using the `movieTitle` provided by the client in the `FormData`.

**Attack Vector:**  
An attacker can modify the `movieTitle` in the form payload before submission. Since the server trusts this input, the movie will be saved in the database with a malicious or incorrect title. While the app currently fetches titles from TMDB for display, if the database title is ever used in the future (e.g., for search or admin panels), it will display the injected title.

**How to Fix:**  
Do not trust the client-provided `movieTitle`. Instead, fetch the movie details from the TMDB API on the server side using the `movieId` to verify its existence and retrieve its official title before saving it to the database.

---

### 5. Race Condition in Watchlist Toggle
**Severity:** Low  
**Location:** `app/actions.ts` (`toggleWatchlist`)  

**Description:**  
The function checks if a watchlist item exists using `findUnique` and then conditionally creates or deletes it. In a concurrent scenario (e.g., a user double-clicking the button quickly), two requests might both evaluate `existingItem` as false and attempt to create the record. The second one will fail due to the `@@unique([userId, movieId])` constraint.

**How to Fix:**  
Wrap the creation logic in a `try-catch` block to gracefully handle the Prisma `P2002` (Unique constraint failed) error.

```typescript
try {
  await prisma.watchlistItem.create({ ... });
} catch (error: any) {
  if (error.code === 'P2002') {
    // Already exists, ignore or handle gracefully
  } else {
    throw error;
  }
}
```

---

### 6. Lack of Rate Limiting on Server Actions
**Severity:** Low  
**Location:** `app/actions.ts`  

**Description:**  
There is no rate limiting on the Server Actions (`submitReview`, `toggleWatchlist`).

**Attack Vector:**  
An authenticated attacker can write a script to spam the endpoints, filling the database with junk data or consuming server resources.

**How to Fix:**  
Implement rate limiting (e.g., using Upstash Ratelimit or a custom Redis solution) to restrict the number of actions a user can perform within a specific timeframe (e.g., max 10 reviews per minute).
