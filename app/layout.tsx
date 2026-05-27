import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import Navbar from "../components/Navbar"; // <--- Importul noului tău Navbar

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "yMovies",
  description: "Platformă digitală pentru recenzii de filme",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="ro" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
        <body className="min-h-full bg-[#141414] text-white flex flex-col">
          <Navbar /> {/* <--- Acum Navbar-ul va sta aici nemișcat */}
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}