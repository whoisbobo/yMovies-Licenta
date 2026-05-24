import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "../lib/prisma";

export default async function Home() {
  // 1. Verificăm cine este pe pagină
  const { userId } = await auth();

  // 2. Podul invizibil: Dacă avem un userId, îl salvăm în baza de date Supabase
  if (userId) {
    // Aducem toate detaliile contului de la Clerk (email, username etc.)
    const user = await currentUser();
    
    if (user) {
      // Folosim funcția upsert pentru a sincroniza baza de date
      await prisma.user.upsert({
        where: { id: userId },
        update: {
          email: user.emailAddresses[0].emailAddress,
          // Dacă din vreun motiv lipsește username-ul de la Clerk, generăm unul de rezervă
          username: user.username || `user_${userId.slice(0, 5)}`, 
        },
        create: {
          id: userId,
          email: user.emailAddresses[0].emailAddress,
          username: user.username || `user_${userId.slice(0, 5)}`,
        }
      });
    }
  }

  return (
    <main className="min-h-screen p-8 bg-zinc-950 text-white">
      <nav className="flex justify-between items-center bg-zinc-900 p-4 rounded-lg mb-8 shadow-lg">
        <h1 className="text-3xl font-extrabold text-red-600 tracking-wider">
          yMovies
        </h1>

        <div>
          {!userId ? (
            <div className="flex gap-4">
              <SignInButton mode="modal">
                <button className="px-5 py-2 bg-zinc-800 text-zinc-200 font-semibold rounded hover:bg-zinc-700 transition-colors">
                  Autentificare
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-5 py-2 bg-red-600 text-white font-semibold rounded hover:bg-red-700 transition-colors">
                  Cont Nou
                </button>
              </SignUpButton>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-zinc-400 font-medium">Salutare!</span>
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox: "w-10 h-10 border-2 border-red-600"
                  }
                }}
              />
            </div>
          )}
        </div>
      </nav>

      <div className="text-center mt-32">
        <h2 className="text-4xl font-bold mb-4">Bun venit pe platforma ta!</h2>
        <p className="text-zinc-400 text-lg">
          Autentifică-te pentru a vedea magia. Aici vor apărea în curând afișele filmelor direct din baza de date.
        </p>
      </div>
    </main>
  );
}