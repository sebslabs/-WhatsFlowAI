"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function ThemeReset() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith("/dashboard")) {
      document.documentElement.classList.remove("dark");
    }
  }, [pathname]);

  return null;
}
