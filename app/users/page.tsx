import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { prisma } from "../../lib/prisma";
import UserList, { type UserListItem } from "./UserList";

export default async function MembersPage() {
  const { userId: viewerUserId } = await auth();
  const t = await getTranslations("Members");

  const [users, following] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    }),
    viewerUserId
      ? prisma.follow.findMany({ where: { followerId: viewerUserId }, select: { followingId: true } })
      : Promise.resolve([]),
  ]);

  const followingSet = new Set(following.map((f) => f.followingId));
  const others: UserListItem[] = users.filter((u) => u.id !== viewerUserId);

  return (
    <main className="p-4 sm:p-8 max-w-3xl mx-auto flex-1 w-full">
      <h2 className="text-2xl font-semibold mb-6 border-l-4 border-yellow-500 pl-3">{t("title")}</h2>
      <UserList users={others} followingSet={followingSet} viewerUserId={viewerUserId ?? null} emptyLabel={t("empty")} />
    </main>
  );
}
