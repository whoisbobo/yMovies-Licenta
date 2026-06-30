/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import FollowButton from "./FollowButton";

export type UserListItem = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export default function UserList({
  users,
  followingSet,
  viewerUserId,
  emptyLabel,
}: {
  users: UserListItem[];
  followingSet: Set<string>;
  viewerUserId: string | null;
  emptyLabel: string;
}) {
  if (users.length === 0) {
    return <p className="text-zinc-500 text-sm italic">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {users.map((u) => (
        <div
          key={u.id}
          className="flex items-center justify-between gap-4 bg-[#1f1f1f] p-3 rounded-lg border border-zinc-800"
        >
          <Link href={`/users/${u.username}`} className="flex items-center gap-3 min-w-0">
            {u.avatarUrl ? (
              <img src={u.avatarUrl} alt={u.username} className="w-11 h-11 rounded-full border border-zinc-700 object-cover" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-500">
                {u.username.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-zinc-200 truncate hover:text-yellow-500 transition-colors">
                {u.displayName || u.username}
              </p>
              <p className="text-xs text-zinc-500 truncate">@{u.username}</p>
            </div>
          </Link>

          {viewerUserId && viewerUserId !== u.id && (
            <FollowButton targetUserId={u.id} initialIsFollowing={followingSet.has(u.id)} size="sm" />
          )}
        </div>
      ))}
    </div>
  );
}
