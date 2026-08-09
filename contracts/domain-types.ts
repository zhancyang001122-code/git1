/** Canonical domain contracts. Copy into web/src/lib/contracts/domain.ts. */

export type UUID = string;
export type ISODateTime = string;

export type DataSource = "supabase_mock" | "amap" | "knowledge_base" | "user_memory";
export type ToolStatus = "queued" | "running" | "succeeded" | "failed" | "timed_out";
export type KnowledgeStatus = "draft" | "reviewing" | "published" | "archived" | "rejected";

export interface GeoPoint {
  longitude: number;
  latitude: number;
}

export interface SourceBadge {
  source: DataSource;
  label: string;
  isDemo: boolean;
}

export interface House {
  id: UUID;
  name: string;
  city: string;
  district: string;
  address: string;
  priceMonthly: number;
  roomType: string;
  areaSqm: number;
  petsAllowed: boolean;
  available: boolean;
  subwayDistanceM: number | null;
  location: GeoPoint;
  description: string;
  imageUrls: string[];
  tags: string[];
  isDemo: true;
}

export interface Deal {
  id: UUID;
  title: string;
  merchantName: string;
  category: string;
  originalPrice: number;
  salePrice: number;
  refundPolicyLabel: string;
  validUntil: string;
  address: string;
  location: GeoPoint;
  imageUrl: string;
  tags: string[];
  isDemo: true;
}

export interface Product {
  id: UUID;
  storeId: UUID;
  name: string;
  category: string;
  price: number;
  stock: number;
  deliveryMinutes: number | null;
  imageUrl: string;
  tags: string[];
  isDemo: true;
}

export interface CommunityPost {
  id: UUID;
  title: string;
  category: string;
  excerpt: string;
  authorName: string;
  locationLabel: string | null;
  coverImageUrl: string;
  likeCount: number;
  commentCount: number;
  tags: string[];
  isDemo: true;
}

export interface UserPreferences {
  maxHousingBudget: number | null;
  pets: string[];
  preferredAreas: string[];
  dietaryRestrictions: string[];
  transportModes: string[];
  familyProfile: string[];
  allowLongTermMemory: boolean;
}

export interface KnowledgeCitation {
  articleId: UUID;
  versionId: UUID;
  chunkId: UUID;
  title: string;
  versionLabel: string;
  effectiveFrom: string | null;
  excerpt: string;
  score: number;
}

export type ResultCard =
  | { kind: "house"; data: House }
  | { kind: "deal"; data: Deal }
  | { kind: "product"; data: Product }
  | {
      kind: "place";
      data: {
        id: string;
        name: string;
        address: string;
        distanceM: number | null;
        type: string;
        location: GeoPoint;
        source: "amap";
      };
    };

export interface PublicToolProgress {
  id: string;
  label: string;
  status: ToolStatus;
  source: DataSource;
  startedAt: ISODateTime;
  completedAt: ISODateTime | null;
}

export interface DebugToolRun extends PublicToolProgress {
  toolName: string;
  inputSummary: Record<string, unknown>;
  durationMs: number | null;
  errorCode: string | null;
}

export type ChatStreamEvent =
  | { type: "session"; sessionId: UUID; messageId: UUID }
  | { type: "assistant_delta"; delta: string }
  | { type: "tool_progress"; progress: PublicToolProgress }
  | { type: "result_cards"; cards: ResultCard[] }
  | { type: "citations"; citations: KnowledgeCitation[] }
  | { type: "debug_tool_run"; run: DebugToolRun }
  | { type: "warning"; code: string; message: string }
  | { type: "done"; finishReason: "stop" | "tool_limit" | "fallback" }
  | { type: "error"; code: string; message: string; retryable: boolean };
