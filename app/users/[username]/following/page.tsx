import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "../../../../lib/prisma";
import UserList, { type UserListItem } from "../../UserList";

export default async function FollowingPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const { userId: viewerUserId } = await auth();
  const t = await getTranslations("Members");

  const target = await prisma.user.findUnique({
    where: { username: decodeURIComponent(username) },
    select: { id: true, username: true, displayName: true },
  });
  if (!target) notFound();

  const [rows, viewerFollowing] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: target.id },
      orderBy: { createdAt: "desc" },
      select: { following: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    }),
    viewerUserId
      ? prisma.follow.findMany({ where: { followerId: viewerUserId }, select: { followingId: true } })
      : Promise.resolve([]),
  ]);

  const users: UserListItem[] = rows.map((r) => r.following);
  const followingSet = new Set(viewerFollowing.map((f) => f.followingId));

  return (
    <main className="p-8 max-w-3xl mx-auto flex-1 w-full">
      <Link href={`/users/${target.username}`} className="text-xs text-yellow-500 hover:text-yellow-400 font-medium">
        ← {target.displayName || target.username}
      </Link>
      <h2 className="text-2xl font-semibold mt-2 mb-6 border-l-4 border-yellow-500 pl-3">{t("followingTitle")}</h2>
      <UserList users={users} followingSet={followingSet} viewerUserId={viewerUserId ?? null} emptyLabel={t("followingEmpty")} />
    </main>
  );
}
