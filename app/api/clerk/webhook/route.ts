import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Webhook Clerk: sincronizează userii în baza de date la înregistrare / actualizare / ștergere,
 * ca să apară imediat în aplicație (ex. în Members) fără să aștepte prima acțiune pe site.
 * Necesită env CLERK_WEBHOOK_SIGNING_SECRET (Signing secret al endpoint-ului din Clerk).
 */
export async function POST(request: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(request);
  } catch (error) {
    console.error("Semnătură webhook Clerk invalidă:", error);
    return NextResponse.json({ error: "Semnătură invalidă" }, { status: 400 });
  }

  switch (evt.type) {
    case "user.created":
    case "user.updated": {
      const data = evt.data;
      // Aceleași fallback-uri unice ca la sincronizarea din pagina principală.
      const username = data.username || `user_${data.id.replace(/^user_/, "")}`;
      const email = data.email_addresses?.[0]?.email_address || `${data.id}@no-email.local`;
      await prisma.user.upsert({
        where: { id: data.id },
        update: { email, username, avatarUrl: data.image_url },
        create: { id: data.id, email, username, avatarUrl: data.image_url },
      });
      break;
    }

    case "user.deleted": {
      // Relațiile User au onDelete: Cascade → se șterg și datele asociate.
      // deleteMany nu aruncă dacă userul nu a fost niciodată sincronizat în DB.
      if (evt.data.id) {
        await prisma.user.deleteMany({ where: { id: evt.data.id } });
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
