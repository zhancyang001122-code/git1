function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const key = required("AMAP_WEB_SERVICE_KEY");
const baseUrl = process.env.AMAP_BASE_URL?.trim() || "https://restapi.amap.com";

async function request(path, params) {
  const url = new URL(path, baseUrl);
  url.search = new URLSearchParams({ ...params, key }).toString();
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`AMap ${path} returned HTTP ${response.status}`);
  }
  const body = await response.json();
  if (body.status !== "1" || body.infocode !== "10000") {
    throw new Error(`AMap ${path} failed with infocode ${body.infocode}`);
  }
  return body;
}

function coordinate(value, label) {
  const [longitude, latitude] = String(value).split(",").map(Number);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new Error(`AMap returned an invalid ${label} coordinate`);
  }
  return { longitude, latitude };
}

const geocode = await request("/v3/geocode/geo", {
  address: "杭州市拱墅区武林广场",
  city: "杭州",
});
const centerText = geocode.geocodes?.[0]?.location;
if (!centerText) throw new Error("AMap geocoding returned no result");
const center = coordinate(centerText, "geocode");

const nearby = await request("/v3/place/around", {
  location: `${center.longitude},${center.latitude}`,
  keywords: "超市",
  city: "杭州",
  citylimit: "true",
  radius: "2000",
  offset: "5",
  page: "1",
  extensions: "base",
});
const destinationText = nearby.pois?.find((poi) => poi.location)?.location;
if (!destinationText)
  throw new Error("AMap nearby POI search returned no result");
const destination = coordinate(destinationText, "POI");

const walking = await request("/v3/direction/walking", {
  origin: `${center.longitude},${center.latitude}`,
  destination: `${destination.longitude},${destination.latitude}`,
});
const path = walking.route?.paths?.[0];
const distance = Number(path?.distance);
const duration = Number(path?.duration);
if (
  !path ||
  !Number.isFinite(distance) ||
  distance < 0 ||
  !Number.isFinite(duration) ||
  duration < 0
) {
  throw new Error("AMap walking route returned invalid distance or duration");
}

console.log(
  `PASS AMap geocoding, ${nearby.pois.length} nearby POIs and walking route (${Math.round(distance)}m).`,
);
