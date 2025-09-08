import os
import json
import datetime as dt
from pathlib import Path
import re

from flask import Flask, request, jsonify, g, make_response
from flask_cors import CORS
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

from dotenv import load_dotenv
import jwt

from config import Config

# Explicitly load .env next to app.py
load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

app = Flask(__name__)
app.config.from_object(Config)

# ---- Catch-all for CORS preflights ----
@app.route("/api/<path:_any>", methods=["OPTIONS"])
def _cors_preflight_api(_any):
    # Empty 204 is enough; Flask-CORS will add the Access-Control-Allow-* headers
    return make_response("", 204)

@app.route("/api/v1/<path:_any>", methods=["OPTIONS"])
def _cors_preflight_api_v1(_any):
    return make_response("", 204)


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
db_url = (
    os.getenv("DATABASE_URL_POOLED")  # preferred: Supabase Pooler (transaction) URL
    or app.config.get("DATABASE_URL")
    or os.getenv("DATABASE_URL", "")
)
if not db_url:
    raise RuntimeError("DATABASE_URL is not defined. Check backend/.env")

# If someone pasted a pooler host on 5432, force transaction port 6543
if "pooler.supabase.com" in db_url and ":5432" in db_url:
    db_url = db_url.replace(":5432", ":6543")


def _mask(url: str) -> str:
    # Mask password in URL: postgresql+psycopg2://user:***@host:port/db
    return re.sub(r'(://[^:@/]+):[^@/]+@', r'\1:***@', url)

print("[DB] Using DATABASE_URL:", _mask(db_url))

# CORS — allow preflight and auth header explicitly (case-insensitive)
CORS(
    app,
    resources={r"/api/*": {"origins": CORS_ALLOWED}},
    supports_credentials=False,  # using Authorization header, not cookies
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "authorization", "Content-Type", "content-type"],
    expose_headers=["Content-Type"],
    max_age=86400,
)

# DB engine (SQLAlchemy Core)
engine = create_engine(
    db_url,
    pool_pre_ping=True,
    future=True,
    poolclass=NullPool  # let PgBouncer handle pooling
)
app.config["ENGINE"] = engine

# ---- Blueprints (Inventory, Orders) ----
from blueprints.inventory import bp as inventory_bp, init_schema as inventory_init_schema
from blueprints.orders import bp as orders_bp, init_schema as orders_init_schema
from blueprints.clients import bp as clients_bp, init_schema as clients_init_schema

app.register_blueprint(inventory_bp, url_prefix="/api/v1")
with app.app_context():
    inventory_init_schema(engine)

app.register_blueprint(clients_bp, url_prefix="/api/v1")
with app.app_context():
    clients_init_schema(engine)

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

        # Expose user info for downstream checks (e.g., manager)
        g.user_id = payload.get("sub") or payload.get("user_id")
        g.email = payload.get("email")
        g.user_profile = payload.get("profile")
        g.user = {"id": g.user_id, "email": g.email, "profile": g.user_profile}

        return fn(*args, **kwargs)
    return wrapper

from werkzeug.exceptions import HTTPException, NotFound

@app.errorhandler(NotFound)
def _not_found(e):
    # If this was a CORS preflight to any /api/* URL, treat as OK to satisfy the browser
    if request.method == "OPTIONS" and request.path.startswith("/api/"):
        return make_response("", 204)
    return jsonify({"error": "Not found"}), 404

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

# --- Admin/Manager user management endpoints ---------------------------------
from uuid import UUID

def _is_admin_or_manager():
    prof = getattr(g, "user_profile", None)
    return prof in ("admin", "manager")

@app.get("/api/v1/admin/users")
@require_auth
def admin_list_users():
    if not _is_admin_or_manager():
        return jsonify({"error": "No autorizado"}), 403
    with engine.begin() as conn:
        rows = conn.execute(text("""
            select id, nombre_completo, email, profile, created_at
            from public.usuarios
            order by created_at desc
            limit 500
        """)).mappings().all()
    return jsonify([dict(r) for r in rows])

@app.post("/api/v1/admin/users")
@require_auth
def admin_create_user():
    if not _is_admin_or_manager():
        return jsonify({"error": "No autorizado"}), 403

    body = request.get_json(silent=True) or {}
    nombre = (body.get("nombre_completo") or "").strip()
    email = (body.get("email") or "").strip().lower()
    password = (body.get("password") or "").strip()
    profile = (body.get("profile") or "viewer").strip()

    if not (nombre and email and password):
        return jsonify({"error":"nombre_completo, email y password son requeridos"}), 400
    if profile not in ("viewer","seller","manager","admin"):
        return jsonify({"error":"perfil inválido"}), 400

    with engine.begin() as conn:
        # Unicidad de email
        exists = conn.execute(text("select 1 from public.usuarios where email = :e"), {"e": email}).scalar()
        if exists:
            return jsonify({"error":"Ya existe un usuario con ese email"}), 409

        # Asegurar pgcrypto (orders.init_schema la crea, pero por si acaso)
        conn.execute(text("create extension if not exists pgcrypto"))

        row = conn.execute(text("""
            insert into public.usuarios (nombre_completo, email, password_hash, profile)
            values (:n, :e, crypt(:p, gen_salt('bf')), :pr)
            returning id, nombre_completo, email, profile, created_at
        """), {"n": nombre, "e": email, "p": password, "pr": profile}).mappings().first()

    return jsonify(dict(row)), 201

@app.delete("/api/v1/admin/users/<uuid:user_id>")
@require_auth
def admin_delete_user(user_id):
    if not _is_admin_or_manager():
        return jsonify({"error": "No autorizado"}), 403
    # Evitar borrarse a sí mismo
    if str(user_id) == str(g.user_id):
        return jsonify({"error":"No puedes borrar tu propio usuario"}), 400

    with engine.begin() as conn:
        # Borrar preferencias primero (FK sin ON DELETE CASCADE)
        conn.execute(text("delete from public.usuarios_prefs where user_id = :uid"), {"uid": str(user_id)})
        gone = conn.execute(text("delete from public.usuarios where id = :uid returning id"), {"uid": str(user_id)}).first()
        if not gone:
            return jsonify({"error":"Usuario no encontrado"}), 404

    return jsonify({"ok": True})


if __name__ == "__main__":
    # Bind to 0.0.0.0 and pick PORT from env/config with a safe default
    port = int(os.environ.get("PORT", app.config.get("PORT", 5000)))
    app.run(host="0.0.0.0", port=port, debug=True)

