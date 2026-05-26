"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "../lib/prisma";
import { revalidatePath } from "next/cache";

export async function submitReview(formData: FormData) {
  // 1. Verificăm cine trimite recenzia
  const { userId } = await auth();
  if (!userId) throw new Error("Neautorizat");

  // 2. Preluăm datele din formular
  const movieId = parseInt(formData.get("movieId") as string);
  const movieTitle = formData.get("movieTitle") as string;
  const rating = parseInt(formData.get("rating") as string);
  const comment = formData.get("comment") as string;

  // 3. Creăm o categorie generică (obligatorie pentru relația din schema Prisma)
  const category = await prisma.category.upsert({
    where: { name: "General" },
    update: {},
    create: { name: "General" }
  });

  // 4. Salvăm filmul în Supabase (dacă e prima dată când cineva îi dă review)
  await prisma.movie.upsert({
    where: { id: movieId },
    update: {}, // Dacă există deja, nu-i facem nimic
    create: {
      id: movieId,
      title: movieTitle,
      categoryId: category.id,
    }
  });

  // 5. Salvăm recenzia
  // Funcția 'findUnique' se asigură că nu lăsăm 2 recenzii la același film, așa cum e setat în schema ta
  const existingReview = await prisma.review.findUnique({
    where: {
      userId_movieId: {
        userId: userId,
        movieId: movieId
      }
    }
  });

  if (existingReview) {
    // Dacă utilizatorul a mai lăsat o recenzie, o actualizăm
    await prisma.review.update({
      where: { id: existingReview.id },
      data: { rating, comment }
    });
  } else {
    // Dacă e prima dată, o creăm
    await prisma.review.create({
      data: { rating, comment, userId, movieId }
    });
  }

  // 6. Dăm un refresh automat paginii filmului pentru a vedea datele noi
  revalidatePath(`/movie/${movieId}`);
}