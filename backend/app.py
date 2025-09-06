import os
import json
import datetime as dt
from pathlib import Path
import re

from flask import Flask, request, jsonify, g
from flask_cors import CORS
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import jwt

from config import Config

# Explicitly load .env next to app.py
load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

app = Flask(__name__)
app.config.from_object(Config)
def _parse_cors(origins):
    # Accept list or comma-separated string
    if isinstance(origins, (list, tuple)):
        return [o.strip() for o in origins if o and str(o).strip()]
    if isinstance(origins, str):
        return [o.strip() for o in origins.split(",") if o.strip()]
    return []

CORS_ALLOWED = _parse_cors(Config.CORS_ORIGINS)
print("[CORS] Allowed origins:", CORS_ALLOWED)


# Validate DATABASE_URL and mask password in logs
db_url = app.config.get("DATABASE_URL") or os.getenv("DATABASE_URL", "")
if not db_url:
    raise RuntimeError("DATABASE_URL is not defined. Check backend/.env")

def _mask(url: str) -> str:
    # Mask password in URL: postgresql+psycopg2://user:***@host:port/db
    return re.sub(r'(://[^:@/]+):[^@/]+@', r'\1:***@', url)

print("[DB] Using DATABASE_URL:", _mask(db_url))

# CORS — use parsed list of origins
CORS(
    app,
    resources={r"/api/*": {"origins": CORS_ALLOWED}},
    supports_credentials=False,  # using Authorization header, not cookies
)

# DB engine (SQLAlchemy Core)
engine = create_engine(db_url, pool_pre_ping=True, future=True)
app.config["ENGINE"] = engine

# ---- Blueprints (Inventory, Orders) ----
from blueprints.inventory import bp as inventory_bp, init_schema as inventory_init_schema
from blueprints.orders import bp as orders_bp, init_schema as orders_init_schema

# Register under /api/v1
app.register_blueprint(inventory_bp, url_prefix="/api/v1")
with app.app_context():
    inventory_init_schema(engine)

app.register_blueprint(orders_bp, url_prefix="/api/v1")
with app.app_context():
    orders_init_schema(engine)

# ---- Helpers (Auth) ----
def create_token(user_id, email, profile):
    now = dt.datetime.utcnow()
    payload = {
        "sub": str(user_id),
        "email": email,
        "profile": profile,
        "iat": now,
        "exp": now + dt.timedelta(days=7)
    }
    token = jwt.encode(payload, app.config["JWT_SECRET"], algorithm="HS256")
    return token

def require_auth(fn):
    from functools import wraps
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "No autorizado"}), 401
        token = auth.removeprefix("Bearer ").strip()
        try:
            payload = jwt.decode(token, app.config["JWT_SECRET"], algorithms=["HS256"])
        except Exception:
            return jsonify({"error": "Token inválido o expirado"}), 401
        g.user_id = payload.get("sub")
        g.email = payload.get("email")
        return fn(*args, **kwargs)
    return wrapper

from werkzeug.exceptions import HTTPException

@app.errorhandler(Exception)
def _json_errors(e):
    if isinstance(e, HTTPException):
        return jsonify({"error": e.description}), e.code
    # Log full stack for debugging
    app.logger.exception(e)
    return jsonify({"error": "Internal server error"}), 500

@app.get("/api/v1/debug/config")
def debug_config():
    # DO NOT expose secrets; mask DB
    return jsonify({
        "cors_allowed": CORS_ALLOWED,
        "database_url_masked": _mask(db_url),
        "env_seen": {
            "DATABASE_URL": bool(os.environ.get("DATABASE_URL")),
            "JWT_SECRET": bool(os.environ.get("JWT_SECRET")),
            "CORS_ORIGINS": os.environ.get("CORS_ORIGINS"),
        },
    })


# ---- Routes ----
@app.get("/")
def root():
    # Friendly root to avoid 404s on provider health probes
    return jsonify({"ok": True, "health": "/api/v1/health"}), 200

@app.get("/api/v1/health")
def health():
    return jsonify({"ok": True})

@app.post("/api/v1/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "")

    if not email or not password:
        return jsonify({"error": "Email y contraseña son requeridos"}), 400

    # Secure verification with pgcrypto (bcrypt): password_hash = crypt(password, password_hash)
    sql = text("""
        select u.id, u.nombre_completo, u.email, u.profile
        from public.usuarios u
        where u.email = :email
        and u.password_hash = crypt(:password, u.password_hash)
        limit 1
    """)
    with engine.begin() as conn:
        row = conn.execute(sql, {"email": email, "password": password}).mappings().first()
        if not row:
            return jsonify({"error": "Credenciales inválidas"}), 401

        # Ensure prefs record
        prefs_row = conn.execute(
            text("select prefs from public.usuarios_prefs where user_id = :uid"),
            {"uid": row["id"]}
        ).first()
        if not prefs_row:
            default_prefs = {"colorMode": "light", "accent": "teal", "font": "Inter", "uiScale": 1.0, "radius": "md"}
            conn.execute(
                text("insert into public.usuarios_prefs (user_id, prefs) values (:uid, :prefs)"),
                {"uid": row["id"], "prefs": json.dumps(default_prefs)}
            )
            prefs = default_prefs
        else:
            prefs = prefs_row[0] or {}

    token = create_token(row["id"], row["email"], row["profile"])
    return jsonify({
        "token": token,
        "user": {
            "id": row["id"],
            "nombre_completo": row["nombre_completo"],
            "email": row["email"],
            "profile": row["profile"],
        },
        "prefs": prefs
    })

@app.get("/api/v1/me")
@require_auth
def me():
    with engine.begin() as conn:
        user = conn.execute(
            text("select id, nombre_completo, email, profile from public.usuarios where id = :uid limit 1"),
            {"uid": g.user_id}
        ).mappings().first()
        if not user:
            return jsonify({"error": "Usuario no encontrado"}), 404

        prefs_row = conn.execute(
            text("select prefs from public.usuarios_prefs where user_id = :uid"),
            {"uid": g.user_id}
        ).first()
        prefs = (prefs_row[0] if prefs_row else {}) or {}

    return jsonify({
        "user": dict(user),
        "prefs": prefs
    })

@app.put("/api/v1/users/me/prefs")
@require_auth
def update_prefs():
    data = request.get_json(silent=True) or {}
    prefs = data.get("prefs")
    if not isinstance(prefs, dict):
        return jsonify({"error": "Formato de prefs inválido"}), 400

    with engine.begin() as conn:
        conn.execute(
            text("""
                insert into public.usuarios_prefs (user_id, prefs, updated_at)
                values (:uid, :prefs, now())
                on conflict (user_id) do update
                  set prefs = excluded.prefs,
                      updated_at = now()
            """),
            {"uid": g.user_id, "prefs": json.dumps(prefs)}
        )
    return jsonify({"ok": True, "prefs": prefs})

if __name__ == "__main__":
    # Bind to 0.0.0.0 and pick PORT from env/config with a safe default
    port = int(os.environ.get("PORT", app.config.get("PORT", 5000)))
    app.run(host="0.0.0.0", port=port, debug=True)
