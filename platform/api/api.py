from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.auth import router as auth_router
from routers.batches import router as batches_router
from routers.coins import router as coins_router
from routers.grading import router as grading_router
from routers.variety import router as variety_router

app = FastAPI(
    title="Coin Catalog API",
    version="0.1.0",
    description="Coin submission and cataloguing platform",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(coins_router)
app.include_router(batches_router)
app.include_router(variety_router)
app.include_router(grading_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "coin-catalog-api"}
