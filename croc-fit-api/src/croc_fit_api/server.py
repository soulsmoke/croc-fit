"""FastAPI server entry point for CrocFit Coach AI.

Run with:
    uv run python -m croc_fit_api.server
or:
    uvicorn croc_fit_api.server:app --reload
"""

import uvicorn

from croc_fit_api.app import create_app

app = create_app()

if __name__ == "__main__":
    uvicorn.run(
        "croc_fit_api.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
