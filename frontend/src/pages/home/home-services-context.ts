// Kênh truyền xuống từ gốc composition: một Context cấp trang duy nhất (mục 3 "chiến lược trạng thái" trong kế hoạch tổng).
// entry.jsx tạo composition trước, sau đó cấp cho cây component qua <HomeServicesProvider>;
// không tạo Context theo từng feature.

import { createContext, useContext } from "react";
import type { HomeServices } from "./composition/types.js";

export const HomeServicesContext = createContext<HomeServices | null>(null);
export const HomeServicesProvider = HomeServicesContext.Provider;

export function useHomeServices(): HomeServices {
  const services = useContext(HomeServicesContext);
  if (!services) {
    throw new Error("useHomeServices phải được dùng bên trong <HomeServicesProvider> (entry.jsx tạo composition trước)");
  }
  return services;
}
