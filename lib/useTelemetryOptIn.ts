"use client";

import { useSyncExternalStore } from "react";
import {
  setTelemetryEnabled,
  subscribeTelemetry,
  telemetryEnabled,
} from "@/lib/telemetry";

export function useTelemetryOptIn(): [boolean, (v: boolean) => void] {
  const enabled = useSyncExternalStore(
    subscribeTelemetry,
    () => telemetryEnabled(),
    () => false,
  );
  return [enabled, setTelemetryEnabled];
}