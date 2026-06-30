"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toggleFollow } from "../actions";

export default function FollowButton({
  targetUserId,
  initialIsFollowing,
  size = "md",
}: {
  targetUserId: string;
  initialIsFollowing: boolean;
  size?: "sm" | "md";
}) {
  const t = useTranslations("Follow");
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    const prev = isFollowing;
    setIsFollowing(!prev);
    setPending(true);
    try {
      const result = await toggleFollow(targetUserId);
      setIsFollowing(result);
    } catch {
      setIsFollowing(prev);
    } finally {
      setPending(false);
    }
  };

  const pad = size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={`rounded-full font-semibold transition-colors disabled:opacity-50 ${pad} ${
        isFollowing
          ? "bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:border-red-400/40 hover:bg-red-500/10"
          : "bg-yellow-500 text-zinc-900 hover:brightness-110"
      }`}
    >
      {isFollowing ? t("following") : t("follow")}
    </button>
  );
}
