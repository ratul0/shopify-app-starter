import type { ActionFunctionArgs } from "react-router";
import db from "../db.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await authenticate.webhook(request);

  // Shopify sends this 48 hours after a shop uninstalls the app.
  // Delete all stored data for this shop to comply with GDPR.
  // If you add custom models later, delete those records here too.
  await db.session.deleteMany({ where: { shop } });

  return new Response();
};
