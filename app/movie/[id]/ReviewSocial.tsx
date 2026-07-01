"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { addReviewComment, deleteReviewComment, toggleReviewLike, type ReviewCommentDTO } from "../../actions";

export default function ReviewSocial({
  reviewId,
  initialLikeCount,
  initialLiked,
  initialComments,
  isLoggedIn,
  currentUserId,
  isAdmin,
  isReviewOwner,
}: {
  reviewId: number;
  initialLikeCount: number;
  initialLiked: boolean;
  initialComments: ReviewCommentDTO[];
  isLoggedIn: boolean;
  currentUserId: string | null;
  isAdmin: boolean;
  isReviewOwner: boolean;
}) {
  const t = useTranslations("ReviewSocial");
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [comments, setComments] = useState<ReviewCommentDTO[]>(initialComments);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);

  const handleLike = async () => {
    if (!isLoggedIn) return;
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(prevCount + (prevLiked ? -1 : 1));
    try {
      const res = await toggleReviewLike(reviewId);
      setLiked(res.liked);
      setLikeCount(res.count);
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
    }
  };

  const handleAdd = async () => {
    const value = text.trim();
    if (!value || pending) return;
    setPending(true);
    try {
      const created = await addReviewComment(reviewId, value);
      setComments((prev) => [...prev, created]);
      setText("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Eroare");
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async (id: string) => {
    const prev = comments;
    setComments((c) => c.filter((x) => x.id !== id));
    try {
      await deleteReviewComment(id);
    } catch {
      setComments(prev);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-zinc-800/70">
      <div className="flex items-center gap-4 text-sm">
        <button
          type="button"
          onClick={handleLike}
          disabled={!isLoggedIn}
          className={`inline-flex items-center gap-1.5 transition-colors ${
            liked ? "text-rose-400" : "text-zinc-400 hover:text-rose-400"
          } ${!isLoggedIn ? "cursor-default opacity-70" : ""}`}
        >
          <svg className="w-4 h-4" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-yellow-500 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.9A7.96 7.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {t("comments")}
          {comments.length > 0 && <span>({comments.length})</span>}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          {comments.length === 0 ? (
            <p className="text-zinc-500 text-xs italic">{t("noComments")}</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-2.5">
                <Link href={`/users/${c.username}`} className="flex-shrink-0">
                  {c.avatarUrl ? (
                    <img src={c.avatarUrl} alt={c.username} className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-500">
                      {c.username.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/users/${c.username}`} className="text-sm font-semibold text-zinc-200 hover:text-yellow-500 transition-colors">
                      {c.displayName || c.username}
                    </Link>
                    <span className="text-[11px] text-zinc-600">{new Date(c.createdAt).toLocaleDateString()}</span>
                    {(currentUserId === c.userId || isReviewOwner || isAdmin) && (
                      <button type="button" onClick={() => handleDelete(c.id)} className="text-[11px] text-zinc-600 hover:text-red-400 transition-colors ml-auto">
                        {t("deleteLabel")}
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-zinc-300 mt-0.5 break-words">{c.text}</p>
                </div>
              </div>
            ))
          )}

          {isLoggedIn ? (
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                maxLength={1000}
                placeholder={t("addPlaceholder")}
                className="flex-1 bg-[#141414] text-white border border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-yellow-500"
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={pending || text.trim().length === 0}
                className="px-3 py-1.5 rounded-lg bg-yellow-500 text-zinc-900 text-sm font-semibold disabled:opacity-40 hover:brightness-110 transition"
              >
                {t("post")}
              </button>
            </div>
          ) : (
            <p className="text-zinc-500 text-xs italic">{t("loginToComment")}</p>
          )}
        </div>
      )}
    </div>
  );
}
