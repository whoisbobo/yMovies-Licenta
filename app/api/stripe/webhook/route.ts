import { NextResponse } from "next/server";
import { getStripe } from "../../../../lib/stripe";
import { prisma } from "../../../../lib/prisma";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

async function setPremiumByCustomerId(customerId: string, isPremium: boolean, subscriptionId?: string | null) {
  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      isPremium,
      stripeSubscriptionId: subscriptionId ?? (isPremium ? undefined : null),
    },
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Lipsește semnătura Stripe" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET || "");
  } catch (error) {
    console.error("Semnătură webhook invalidă:", error);
    return NextResponse.json({ error: "Semnătură invalidă" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.customer && typeof session.customer === "string") {
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : null;
        await setPremiumByCustomerId(session.customer, true, subscriptionId);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
      if (customerId) {
        const isActive = subscription.status === "active" || subscription.status === "trialing";
        await setPremiumByCustomerId(customerId, isActive, subscription.id);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
      if (customerId) {
        await setPremiumByCustomerId(customerId, false, null);
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
