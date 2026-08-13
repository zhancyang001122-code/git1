"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  parseStoredLocation,
  SELECTED_LOCATION_STORAGE_KEY,
  selectedLocationSchema,
  type SelectedLocation,
} from "@/features/location/selected-location";
import { gcj02ToWgs84 } from "@/features/maps/coordinate-systems";

interface SelectedLocationValue {
  location: SelectedLocation;
  ready: boolean;
  setLocation(location: SelectedLocation): void;
  resetLocation(): void;
}

const FALLBACK_LOCATION: SelectedLocation = {
  name: "武林广场",
  city: "杭州",
  point: { longitude: 120.163102, latitude: 30.274085 },
  wgs84Point: gcj02ToWgs84({ longitude: 120.163102, latitude: 30.274085 }),
  source: "default",
};

const LOCATION_CHANGE_EVENT = "xiaozhi:selected-location-change";

function serverLocationSnapshot(): null {
  return null;
}

const SelectedLocationContext = createContext<SelectedLocationValue>({
  location: FALLBACK_LOCATION,
  ready: true,
  setLocation() {},
  resetLocation() {},
});

export function SelectedLocationProvider({
  children,
  defaultLocation,
}: {
  children: ReactNode;
  defaultLocation: SelectedLocation;
}) {
  const safeDefault = useMemo(
    () => selectedLocationSchema.parse(defaultLocation),
    [defaultLocation],
  );
  const subscribe = useCallback((onStoreChange: () => void) => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === SELECTED_LOCATION_STORAGE_KEY) onStoreChange();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(LOCATION_CHANGE_EVENT, onStoreChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(LOCATION_CHANGE_EVENT, onStoreChange);
    };
  }, []);
  const storedValue = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(SELECTED_LOCATION_STORAGE_KEY),
    serverLocationSnapshot,
  );
  const location = useMemo(
    () => parseStoredLocation(storedValue) ?? safeDefault,
    [safeDefault, storedValue],
  );

  const setLocation = useCallback((next: SelectedLocation) => {
    const parsed = selectedLocationSchema.parse(next);
    window.localStorage.setItem(
      SELECTED_LOCATION_STORAGE_KEY,
      JSON.stringify(parsed),
    );
    window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
  }, []);

  const resetLocation = useCallback(() => {
    window.localStorage.removeItem(SELECTED_LOCATION_STORAGE_KEY);
    window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
  }, []);

  const value = useMemo<SelectedLocationValue>(
    () => ({ location, ready: true, setLocation, resetLocation }),
    [location, resetLocation, setLocation],
  );

  return (
    <SelectedLocationContext.Provider value={value}>
      {children}
    </SelectedLocationContext.Provider>
  );
}

export function useSelectedLocation(): SelectedLocationValue {
  return useContext(SelectedLocationContext);
}
