"use client";

import { useState } from "react";
import { UserProfile } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import FavoritesEditor, { type FavoriteSlot } from "../FavoritesEditor";
import ProfileDetailsEditor from "../ProfileDetailsEditor";

interface ProfileEditTabsProps {
  initialSlots: FavoriteSlot[];
  limit: number;
  initialDisplayName: string | null;
  initialBio: string | null;
  initialLocation: string | null;
  initialWebsite: string | null;
  initialGenres: string[];
  username: string;
}

type Tab = "profile" | "account";

export default function ProfileEditTabs({
  initialSlots,
  limit,
  initialDisplayName,
  initialBio,
  initialLocation,
  initialWebsite,
  initialGenres,
  username,
}: ProfileEditTabsProps) {
  const t = useTranslations("Profile");
  const [tab, setTab] = useState<Tab>("profile");

  const tabs: { id: Tab; label: string }[] = [
    { id: "profile", label: t("favoritesTitle") },
    { id: "account", label: t("accountTab") },
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-8">
      <nav className="flex sm:flex-col gap-1 sm:w-48 flex-shrink-0">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === item.id
                ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/30"
                : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-w-0">
        {tab === "profile" ? (
          <div className="space-y-8">
            <ProfileDetailsEditor
              initialDisplayName={initialDisplayName}
              initialBio={initialBio}
              initialLocation={initialLocation}
              initialWebsite={initialWebsite}
              initialGenres={initialGenres}
              username={username}
            />
            <FavoritesEditor initialSlots={initialSlots} limit={limit} />
          </div>
        ) : (
          <UserProfile routing="hash" />
        )}
      </div>
    </div>
  );
}
