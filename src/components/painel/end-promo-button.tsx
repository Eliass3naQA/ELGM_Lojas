"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "../ui";

export function EndPromoButton({ slug, productId }: { slug: string; productId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="ghost"
      className="px-2 py-1 text-xs text-zinc-500"
      disabled={loading}
      onClick={async () => {
        if (!confirm("Encerrar esta promoção agora?")) return;
        setLoading(true);
        await api(`/api/stores/${slug}/products/${productId}`, "PATCH", { promo: null });
        router.refresh();
      }}
    >
      {loading && <Loader2 className="size-3 animate-spin" />} Encerrar
    </Button>
  );
}
