"use client";

import { useState } from "react";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart, type CartItem } from "../cart";
import { Button, cn } from "../ui";

export function AddToCartButton({ item, compact, withQty, disabled, className }: { item: Omit<CartItem, "qty">; compact?: boolean; withQty?: boolean; disabled?: string | false; className?: string }) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const soldOut = item.stock <= 0;
  const max = Number.isFinite(item.stock) ? item.stock : 99;
  const blocked = soldOut || !!disabled;

  const onAdd = () => {
    add(item, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <div className={cn("flex gap-2", className)}>
      {withQty && !blocked && (
        <div className="flex items-center rounded-full bg-white/75 shadow-sm ring-1 ring-white">
          <button className="p-2.5 text-zinc-500 hover:text-zinc-900" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuir">
            <Minus className="size-4" />
          </button>
          <span className="w-8 text-center text-sm font-medium">{Math.min(qty, max)}</span>
          <button className="p-2.5 text-zinc-500 hover:text-zinc-900" onClick={() => setQty((q) => Math.min(max, q + 1))} aria-label="Aumentar">
            <Plus className="size-4" />
          </button>
        </div>
      )}
      <Button variant={compact ? "primary" : "brand"} disabled={blocked} onClick={onAdd} className={cn("flex-1", compact ? "py-2 text-xs" : "py-3")}>
        {added ? <Check className="size-4" /> : <ShoppingBag className="size-4" />}
        {disabled || (soldOut ? "Esgotado" : added ? "Adicionado!" : compact ? "Adicionar" : "Adicionar ao carrinho")}
      </Button>
    </div>
  );
}
