import { redirect } from "next/navigation";

import { HOME_ROUTE } from "@/lib/config/routes";
import { getServerSession } from "@/lib/supabase/async-cookies";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const session = await getServerSession();

  if (session) {
    redirect(HOME_ROUTE);
  }

  redirect("/signin?redirect=%2F");
}
