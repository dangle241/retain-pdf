// 组合根下发通道:单个页级 Context(总计划「状态策略」第 3 条)。
// entry.jsx 先建 composition,再经 <HomeServicesProvider> 灌给组件树;
// 不做 per-feature Context。

import { createContext, useContext } from "react";
import type { HomeServices } from "./composition/types.js";

export const HomeServicesContext = createContext<HomeServices | null>(null);
export const HomeServicesProvider = HomeServicesContext.Provider;

export function useHomeServices(): HomeServices {
  const services = useContext(HomeServicesContext);
  if (!services) {
    throw new Error("useHomeServices 必须在 <HomeServicesProvider> 内使用(entry.jsx 先建 composition)");
  }
  return services;
}
