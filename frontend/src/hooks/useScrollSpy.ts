"use client";

import { useEffect, useState } from "react";

/** 
 * Returns the id of the section currently active under the anchor island,
 * with explicit bottom-of-page detection for the last section (e.g. reviews).
 */
export function useScrollSpy(ids: string[], offsetTop = 130): [string, (id: string) => void] {
  const [active, setActive] = useState(ids[0] ?? "");

  useEffect(() => {
    const handleScroll = () => {
      // 1. If reached bottom of page, activate the last section immediately
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 80
      ) {
        const lastId = ids[ids.length - 1];
        if (lastId) {
          setActive(lastId);
          return;
        }
      }

      // 2. Find section that is closest to or just above offsetTop
      let current = ids[0] ?? "";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= offsetTop + 60) {
          current = id;
        }
      }
      setActive(current);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [ids, offsetTop]);

  return [active, setActive];
}

/** True once the page has scrolled past `threshold` px. */
export function useScrolledPast(threshold = 250): boolean {
  const [past, setPast] = useState(false);

  useEffect(() => {
    const onScroll = () => setPast(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return past;
}
