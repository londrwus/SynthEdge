"""Pydantic models for API request/response."""

from pydantic import BaseModel


class KellyRequest(BaseModel):
    asset: str
    direction: str = "long"
    entry: float
    tp: float
    sl: float
    horizon: str = "24h"
    fraction: float = 0.5


class KellyResponse(BaseModel):
    kelly_fraction: float
    win_probability: float
    loss_probability: float
    avg_win_pct: float
    avg_loss_pct: float
    recommended_position_pct: float


class LiquidationRiskRequest(BaseModel):
    asset: str
    entry_price: float
    leverage: float
    direction: str = "long"
    horizon: str = "24h"
