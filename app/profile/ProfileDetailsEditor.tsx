"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { updateProfileDetails } from "../actions";
import { MOVIE_GENRES, FAVORITE_GENRES_LIMIT } from "../../lib/constants";

interface ProfileDetailsEditorProps {
  initialDisplayName: string | null;
  initialBio: string | null;
  initialLocation: string | null;
  initialWebsite: string | null;
  initialGenres: string[];
  username: string;
}

const BIO_MAX = 500;

export default function ProfileDetailsEditor({
  initialDisplayName,
  initialBio,
  initialLocation,
  initialWebsite,
  initialGenres,
  username,
}: ProfileDetailsEditorProps) {
  const t = useTranslations("Profile");
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [bio, setBio] = useState(initialBio ?? "");
  const [location, setLocation] = useState(initialLocation ?? "");
  const [website, setWebsite] = useState(initialWebsite ?? "");
  const [genres, setGenres] = useState<string[]>(initialGenres);
  const [saved, setSaved] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const touch = () => setSaved(false);

  const toggleGenre = (g: string) => {
    setGenres((prev) => {
      if (prev.includes(g)) return prev.filter((x) => x !== g);
      if (prev.length >= FAVORITE_GENRES_LIMIT) return prev; // limită atinsă
      return [...prev, g];
    });
    touch();
  };

  const handleSave = async () => {
    setPending(true);
    setError(null);
    try {
      await updateProfileDetails(displayName, bio, location, website, genres);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("displayNameError"));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="max-w-lg space-y-5">
      <div>
        <label className="block text-xs text-zinc-500 mb-1">{t("displayNameLabel")}</label>
        <input
          type="text"
          value={displayName}
          placeholder={username}
          maxLength={50}
          onChange={(e) => {
            setDisplayName(e.target.value);
            touch();
          }}
          className="w-full bg-[#141414] text-white border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
        />
      </div>

      <div>
        <label className="block text-xs text-zinc-500 mb-1">{t("bioLabel")}</label>
        <textarea
          value={bio}
          placeholder={t("bioPlaceholder")}
          maxLength={BIO_MAX}
          rows={4}
          onChange={(e) => {
            setBio(e.target.value);
            touch();
          }}
          className="w-full bg-[#141414] text-white border border-zinc-700 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:border-yellow-500"
        />
        <p className="text-[11px] text-zinc-600 mt-1 text-right">
          {bio.length}/{BIO_MAX}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">{t("locationLabel")}</label>
          <input
            type="text"
            value={location}
            placeholder={t("locationPlaceholder")}
            maxLength={80}
            onChange={(e) => {
              setLocation(e.target.value);
              touch();
            }}
            className="w-full bg-[#141414] text-white border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">{t("websiteLabel")}</label>
          <input
            type="url"
            value={website}
            placeholder="https://..."
            maxLength={200}
            onChange={(e) => {
              setWebsite(e.target.value);
              touch();
            }}
            className="w-full bg-[#141414] text-white border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-zinc-500 mb-2">
          {t("genresLabel")} <span className="text-zinc-600">({genres.length}/{FAVORITE_GENRES_LIMIT})</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {MOVIE_GENRES.map((g) => {
            const active = genres.includes(g);
            const disabled = !active && genres.length >= FAVORITE_GENRES_LIMIT;
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleGenre(g)}
                disabled={disabled}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? "bg-yellow-500/15 text-yellow-500 border-yellow-500/40"
                    : disabled
                      ? "text-zinc-600 border-zinc-800 cursor-not-allowed"
                      : "text-zinc-400 border-zinc-700 hover:text-white hover:border-zinc-500"
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={pending || saved}
        className="px-5 py-2 rounded-lg bg-yellow-500 text-zinc-900 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition"
      >
        {t("saveLabel")}
      </button>
    </div>
  );
}
