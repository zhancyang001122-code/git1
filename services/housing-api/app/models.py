from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SearchCenter(StrictModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    coordinate_system: Literal["WGS84"]
    label: str = Field(min_length=1, max_length=120)


class SearchFilters(StrictModel):
    price_min: int | None = Field(default=None, ge=0, le=200_000)
    price_max: int | None = Field(default=None, ge=0, le=200_000)
    rent_type: Literal["整租", "合租"] | None = None
    layout: str | None = Field(default=None, min_length=1, max_length=40)
    area_min: float | None = Field(default=None, ge=0, le=2_000)
    area_max: float | None = Field(default=None, ge=0, le=2_000)
    district: str | None = Field(default=None, min_length=1, max_length=40)

    @model_validator(mode="after")
    def ordered_ranges(self) -> SearchFilters:
        if (
            self.price_min is not None
            and self.price_max is not None
            and self.price_min > self.price_max
        ):
            raise ValueError("price_min 不能大于 price_max")
        if (
            self.area_min is not None
            and self.area_max is not None
            and self.area_min > self.area_max
        ):
            raise ValueError("area_min 不能大于 area_max")
        return self


class HouseSearchRequest(StrictModel):
    city: str = Field(min_length=1, max_length=40)
    center: SearchCenter
    radius_m: int = Field(default=2_000, ge=100, le=5_000)
    filters: SearchFilters = Field(default_factory=SearchFilters)
    sort: Literal["distance", "price_asc", "price_desc", "area_desc"] = (
        "distance"
    )
    limit: int = Field(default=5, ge=1, le=10)


class HouseItem(StrictModel):
    listing_id: str
    title: str
    community: str
    address: str
    district: str
    distance_m: float = Field(ge=0)
    monthly_rent: float = Field(ge=0)
    rent_type: str
    layout: str
    area_sqm: float = Field(ge=0)
    orientation: str
    floor: str
    source_url: str | None = None
    longitude: float = Field(ge=-180, le=180)
    latitude: float = Field(ge=-90, le=90)


class HouseSearchData(StrictModel):
    returned_count: int = Field(ge=0)
    items: list[HouseItem]


class SourceMetadata(StrictModel):
    label: str
    dataset_period: Literal["2024-11"] = "2024-11"
    is_historical: Literal[True] = True
    is_realtime: Literal[False] = False
    disclaimer: str


class ResponseMeta(StrictModel):
    request_id: str
    duration_ms: int = Field(ge=0)
    warnings: list[str] = Field(default_factory=list)


class HouseSearchResponse(StrictModel):
    ok: Literal[True] = True
    data: HouseSearchData
    source: SourceMetadata
    meta: ResponseMeta
