import os
import json
import datetime as dt

from flask import Flask, request, jsonify, g
from flask_cors import CORS
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import jwt

from config import Config

load_dotenv()

app = Flask(__name__)
app.config.from_object(Config)

# CORS
CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"].split(",")}})

# DB engine (SQLAlchemy Core)
engine = create_engine(app.config["DATABASE_URL"], pool_pre_ping=True, future=True)

# Helpers
def create_token(user_id, email):
    now = dt.datetime.utcnow()
    payload = {
        "sub": str(user_id),
        "email": email,
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
            return jsonify({"error":"No autorizado"}), 401
        token = auth.removeprefix("Bearer ").strip()
        try:
            payload = jwt.decode(token, app.config["JWT_SECRET"], algorithms=["HS256"])
        except Exception:
            return jsonify({"error":"Token inválido o expirado"}), 401
        g.user_id = payload.get("sub")
        g.email = payload.get("email")
        return fn(*args, **kwargs)
    return wrapper

# Routes
@app.get("/api/v1/health")
def health():
    return jsonify({"ok": True})

@app.post("/api/v1/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "")

    if not email or not password:
        return jsonify({"error":"Email y contraseña son requeridos"}), 400

    # Verificación segura con pgcrypto (bcrypt): password_hash = crypt(password, password_hash)
    sql = text("""
        select u.id, u.nombre_completo, u.email
        from public.usuarios u
        where u.email = :email
          and u.password_hash = crypt(:password, u.password_hash)
        limit 1
    """)
    with engine.begin() as conn:
        row = conn.execute(sql, {"email": email, "password": password}).mappings().first()
        if not row:
            return jsonify({"error":"Credenciales inválidas"}), 401

        # Asegurar registro de prefs
        prefs_row = conn.execute(
            text("select prefs from public.usuarios_prefs where user_id = :uid"),
            {"uid": row["id"]}
        ).first()
        if not prefs_row:
            # crear prefs por defecto
            default_prefs = {"colorMode":"light","accent":"teal","font":"Inter","uiScale":1.0,"radius":"md"}
            conn.execute(
                text("insert into public.usuarios_prefs (user_id, prefs) values (:uid, :prefs)"),
                {"uid": row["id"], "prefs": json.dumps(default_prefs)}
            )
            prefs = default_prefs
        else:
            prefs = prefs_row[0] or {}

    token = create_token(row["id"], row["email"])
    return jsonify({
        "token": token,
        "user": {
            "id": row["id"],
            "nombre_completo": row["nombre_completo"],
            "email": row["email"],
        },
        "prefs": prefs
    })

@app.get("/api/v1/me")
@require_auth
def me():
    with engine.begin() as conn:
        user = conn.execute(
            text("select id, nombre_completo, email from public.usuarios where id = :uid limit 1"),
            {"uid": g.user_id}
        ).mappings().first()
        if not user:
            return jsonify({"error":"Usuario no encontrado"}), 404

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
        return jsonify({"error":"Formato de prefs inválido"}), 400

    with engine.begin() as conn:
        # Upsert
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
    app.run(host="0.0.0.0", port=app.config["PORT"])
