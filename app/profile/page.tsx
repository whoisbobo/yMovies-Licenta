import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import ProfileContent from "./ProfileContent";

export default async function ProfilePage() {
  const { userId } = await auth();
  const t = await getTranslations("Profile");

  if (!userId) {
    return (
      <main className="p-8 text-center mt-20 text-xl text-zinc-400">
        {t("mustLogin")}
      </main>
    );
  }

  return <ProfileContent targetUserId={userId} viewerUserId={userId} />;
}
