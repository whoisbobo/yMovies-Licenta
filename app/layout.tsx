import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { prisma } from "../lib/prisma";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  const { userId } = await auth();
  const isAdmin = userId
    ? (await prisma.user.findUnique({ where: { id: userId }, select: { role: true } }))?.role === "ADMIN"
    : false;

  return (
    <ClerkProvider>
      <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} h-full`}>
        <body className="min-h-full bg-[#141414] text-white flex flex-col">
          <NextIntlClientProvider locale={locale} messages={messages}>
            <Navbar isAdmin={isAdmin} /> {/* <--- Acum Navbar-ul va sta aici nemișcat */}
            {children}
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}