import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import ProfileContent from "../../profile/ProfileContent";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const { userId: viewerUserId } = await auth();

  const target = await prisma.user.findUnique({
    where: { username: decodeURIComponent(username) },
    select: { id: true },
  });

  if (!target) notFound();

  return <ProfileContent targetUserId={target.id} viewerUserId={viewerUserId ?? null} />;
}
