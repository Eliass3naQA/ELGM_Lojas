"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "../ui";

export function LogoutButton({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await api("/api/auth/logout", "POST");
        router.push(redirectTo);
        router.refresh();
      }}
    >
      <LogOut className="size-4" /> Sair
    </Button>
  );
}
