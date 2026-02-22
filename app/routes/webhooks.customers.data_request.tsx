import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.webhook(request);

  // Shopify sends this when a customer requests their stored data.
  // This app only stores OAuth session data (name, email) — no additional
  // customer data. Acknowledge receipt; Shopify handles the merchant-facing
  // data export. If you add custom customer data models later, compile and
  // send the relevant records to the merchant within 30 days.

  return new Response();
};
