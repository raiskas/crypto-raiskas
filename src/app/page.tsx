"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  
  useEffect(() => {
    if (loading) return;
    
    if (user) {
      router.push("/home");
    } else {
      router.push("/signin");
    }
  }, [user, loading, router]);
  
  return null;
}
