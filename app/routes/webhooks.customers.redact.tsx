import type { ActionFunctionArgs } from "react-router";
import db from "../db.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop } = await authenticate.webhook(request);

  const customer = payload.customer as { id: number } | undefined;
  if (customer?.id) {
    // Redact PII from sessions belonging to this customer.
    // We null out personal fields rather than deleting the session so that
    // the shop's OAuth session remains functional.
    await db.session.updateMany({
      where: { userId: BigInt(customer.id), shop },
      data: {
        firstName: null,
        lastName: null,
        email: null,
      },
    });
  }

  return new Response();
};
