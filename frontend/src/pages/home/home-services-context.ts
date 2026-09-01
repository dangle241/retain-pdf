// Combination root distribution channel: Page-level Context(Master Plan "status strategy" item 3).
// entry.jsx creates composition first, Retry <HomeServicesProvider> Inject into component tree;
// No per-feature Context.

import { createContext, useContext } from "react";
import type { HomeServices } from "./composition/types.js";

export const HomeServicesContext = createContext<HomeServices | null>(null);
export const HomeServicesProvider = HomeServicesContext.Provider;

export function useHomeServices(): HomeServices {
  const services = useContext(HomeServicesContext);
  if (!services) {
    throw new Error("useHomeServices Required <HomeServicesProvider> Internal use(entry.jsx create first composition)");
  }
  return services;
}
