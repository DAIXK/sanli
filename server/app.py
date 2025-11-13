from __future__ import annotations

import os
from pathlib import Path

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from .material_config import MATERIAL_CONFIG

SERVER_DIR = Path(__file__).resolve().parent
MODELS_DIR = SERVER_DIR / "models"

app = Flask(__name__, static_folder=None, static_url_path=None)
CORS(app, resources={r"/api/.*": {"origins": "*"}, r"/static/.*": {"origins": "*"}})


@app.get("/api/materials")
def get_material_config():
    """Return MATERIAL_CONFIG used by the front-end."""
    return jsonify(MATERIAL_CONFIG)


@app.get("/static/models/<path:filename>")
def serve_model_asset(filename: str):
    """Serve GLB/PNG assets from the models directory."""
    return send_from_directory(MODELS_DIR, filename)


@app.get("/")
def index():
    return {
        "message": "Bracelet material service is running",
        "endpoints": ["/api/materials", "/static/models/<asset>"],
    }


def create_app() -> Flask:
    """Factory for use with WSGI servers."""
    return app


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug_flag = os.environ.get("FLASK_DEBUG", "1") not in {"0", "false", "False"}
    app.run(host="0.0.0.0", port=port, debug=debug_flag)
