"use client";

// A bare /join has no code, so send the player to the lobby where the code
// box lives.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function JoinIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/lobby");
  }, [router]);
  return null;
}
