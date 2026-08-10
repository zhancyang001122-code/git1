import type {
  MapsService,
  NearbySearchInput,
  PlaceResult,
  WalkingRouteResult,
} from "@/features/maps/types";

interface LocatedCandidate {
  id: string;
  location: NearbySearchInput["center"];
}

export interface CandidateNearbyResult {
  candidateId: string;
  places: readonly PlaceResult[];
}

export interface CandidateMapEvaluation extends CandidateNearbyResult {
  walkingRoute: WalkingRouteResult | null;
}

export async function searchNearbyForCandidates(
  service: MapsService,
  candidates: readonly LocatedCandidate[],
  input: Omit<NearbySearchInput, "center">,
  signal?: AbortSignal,
): Promise<CandidateNearbyResult[]> {
  const pending = candidates.slice(0, 5);
  const results: CandidateNearbyResult[] = new Array(pending.length);
  let cursor = 0;

  async function worker() {
    while (cursor < pending.length) {
      signal?.throwIfAborted();
      const index = cursor;
      cursor += 1;
      const candidate = pending[index];
      if (!candidate) return;
      const places = await service.searchNearby(
        { ...input, center: candidate.location },
        signal,
      );
      results[index] = { candidateId: candidate.id, places };
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(3, pending.length) }, () => worker()),
  );
  return results.filter(
    (value): value is CandidateNearbyResult => value !== undefined,
  );
}

export async function evaluateNearbyForCandidates(
  service: MapsService,
  candidates: readonly LocatedCandidate[],
  input: Omit<NearbySearchInput, "center">,
  signal?: AbortSignal,
): Promise<CandidateMapEvaluation[]> {
  const nearby = await searchNearbyForCandidates(
    service,
    candidates,
    input,
    signal,
  );
  const candidateById = new Map(
    candidates.slice(0, 5).map((candidate) => [candidate.id, candidate]),
  );
  const eligible = nearby
    .filter((result) => result.places.length > 0)
    .sort(
      (left, right) =>
        (left.places[0]?.distanceM ?? Number.POSITIVE_INFINITY) -
        (right.places[0]?.distanceM ?? Number.POSITIVE_INFINITY),
    )
    .slice(0, 3);
  const routes = new Map<string, WalkingRouteResult | null>();
  await Promise.all(
    eligible.map(async (result) => {
      const candidate = candidateById.get(result.candidateId);
      const place = result.places[0];
      if (!candidate || !place) return;
      const route = await service.walkingRoute(
        { origin: candidate.location, destination: place.location },
        signal,
      );
      routes.set(result.candidateId, route);
    }),
  );
  return nearby.map((result) => ({
    ...result,
    walkingRoute: routes.get(result.candidateId) ?? null,
  }));
}
