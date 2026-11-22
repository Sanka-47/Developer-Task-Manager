import type { DashboardSummary } from "@taskapp/shared";

import { apiRequest } from "./client";

export const dashboardApi = {
  getSummary(): Promise<DashboardSummary> {
    return apiRequest<DashboardSummary>("/dashboard").then(
      (response) => response.data,
    );
  },
};
