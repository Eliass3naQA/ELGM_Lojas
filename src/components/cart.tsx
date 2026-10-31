"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  productId: string;
  variantId: string | null;
  variantLabel: string | null;
  name: string;
  image: string;
  imageUrl: string | null;
  price: number; // só para exibição — o servidor recalcula no checkout
  qty: number;
  stock: number; // Infinity é serializado como null no localStorage
};

export const itemKey = (i: Pick<CartItem, "productId" | "variantId">) => `${i.productId}:${i.variantId ?? ""}`;

type Cart = {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  ready: boolean;
};

const CartContext = createContext<Cart | null>(null);
const cap = (qty: number, stock: number) => Math.max(1, Math.min(qty, Number.isFinite(stock) ? stock : 99));

// Um carrinho por loja, salvo no localStorage do comprador.
export function CartProvider({ storeSlug, children }: { storeSlug: string; children: React.ReactNode }) {
  const key = `lojaflow:cart:v2:${storeSlug}`;
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "[]") as CartItem[];
      setItems(saved.map((i) => ({ ...i, stock: i.stock ?? Infinity })));
    } catch {
      /* armazenamento indisponível: carrinho começa vazio */
    }
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {}
  }, [items, key, ready]);

  const add = useCallback<Cart["add"]>((item, qty = 1) => {
    setItems((prev) => {
      const k = itemKey(item);
      const found = prev.find((i) => itemKey(i) === k);
      if (found) return prev.map((i) => (itemKey(i) === k ? { ...i, ...item, qty: cap(i.qty + qty, item.stock) } : i));
      return [...prev, { ...item, qty: cap(qty, item.stock) }];
    });
  }, []);
  const setQty = useCallback<Cart["setQty"]>((k, qty) => setItems((prev) => prev.map((i) => (itemKey(i) === k ? { ...i, qty: cap(qty, i.stock) } : i))), []);
  const remove = useCallback<Cart["remove"]>((k) => setItems((prev) => prev.filter((i) => itemKey(i) !== k)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({
      items,
      count: items.reduce((s, i) => s + i.qty, 0),
      subtotal: Math.round(items.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100,
      add,
      setQty,
      remove,
      clear,
      ready,
    }),
    [items, add, setQty, remove, clear, ready],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart fora do CartProvider");
  return ctx;
}
