import { DetailShell } from "@/components/layout/detail-shell";
import { NearbyExperience } from "@/components/market/nearby-experience";
import { publicEnv } from "@/lib/env";

export default async function NearbyPage() {
  const configuration = publicEnv();
  return (
    <DetailShell title="周边服务" backHref="/">
      <NearbyExperience
        defaultLocation={{
          name: configuration.NEXT_PUBLIC_DEFAULT_LOCATION_NAME,
          city: configuration.NEXT_PUBLIC_DEFAULT_CITY,
          point: {
            longitude: configuration.NEXT_PUBLIC_DEFAULT_LONGITUDE,
            latitude: configuration.NEXT_PUBLIC_DEFAULT_LATITUDE,
          },
        }}
      />
    </DetailShell>
  );
}
