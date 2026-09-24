import type { Product } from "@repo/types";

export const PRODUCTS: readonly Product[] = [] as const;

export function getProductById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}
