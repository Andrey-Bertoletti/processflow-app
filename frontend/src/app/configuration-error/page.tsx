"use client";

import ConfigurationErrorScreen from "@/components/config/ConfigurationErrorScreen";

export default function ConfigurationErrorPage() {
  return <ConfigurationErrorScreen mode={process.env.NODE_ENV === "production" ? "production" : "development"} />;
}

