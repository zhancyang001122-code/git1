"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface DemoCartValue {
  quantities: Readonly<Record<string, number>>;
  itemCount: number;
  add: (productId: string) => void;
  decrease: (productId: string) => void;
  clear: () => void;
}

const DemoCartContext = createContext<DemoCartValue | null>(null);

export function DemoCartProvider({ children }: { children: ReactNode }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const value = useMemo<DemoCartValue>(
    () => ({
      quantities,
      itemCount: Object.values(quantities).reduce(
        (sum, quantity) => sum + quantity,
        0,
      ),
      add(productId) {
        setQuantities((current) => ({
          ...current,
          [productId]: (current[productId] ?? 0) + 1,
        }));
      },
      decrease(productId) {
        setQuantities((current) => {
          const next = { ...current };
          const quantity = (next[productId] ?? 0) - 1;
          if (quantity <= 0) delete next[productId];
          else next[productId] = quantity;
          return next;
        });
      },
      clear() {
        setQuantities({});
      },
    }),
    [quantities],
  );

  return (
    <DemoCartContext.Provider value={value}>
      {children}
    </DemoCartContext.Provider>
  );
}

export function useDemoCart() {
  const value = useContext(DemoCartContext);
  if (!value)
    throw new Error("useDemoCart must be used within DemoCartProvider");
  return value;
}
