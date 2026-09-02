// Composition root distribution channel: a single page-level Context (master plan "Status Strategy", section 3).
// entry.jsx creates the composition first, then injects it into the component tree via <HomeServicesProvider>;
// no per-feature Context.

import { createContext, useContext } from "react";
import type { HomeServices } from "./composition/types.js";

export const HomeServicesContext = createContext<HomeServices | null>(null);
export const HomeServicesProvider = HomeServicesContext.Provider;

export function useHomeServices(): HomeServices {
  const services = useContext(HomeServicesContext);
  if (!services) {
    throw new Error("useHomeServices must be used inside <HomeServicesProvider> (entry.jsx creates the composition first)");
  }
  return services;
}



