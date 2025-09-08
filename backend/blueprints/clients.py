from flask import Blueprint, request, jsonify, current_app
from sqlalchemy import text
import datetime

bp = Blueprint("clients", __name__)

def get_engine():
    eng = current_app.config.get("ENGINE")
    if not eng:
        raise RuntimeError("DB engine is not available in app.config['ENGINE']")
    return eng

def _auth_user_id():
    auth = request.headers.get("Authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    token = auth.split(" ", 1)[1]
    try:
        import jwt
        claims = jwt.decode(token, current_app.config["JWT_SECRET"], algorithms=["HS256"])
        return claims.get("sub") or claims.get("user_id")
    except Exception:
        return None

# ---- Schema bootstrap -------------------------------------------------------

def init_schema(engine=None):
    eng = engine or get_engine()
    with eng.begin() as conn:
        conn.execute(text("create extension if not exists pgcrypto"))

        conn.execute(text("""
        create table if not exists public.clientes (
          id uuid primary key default gen_random_uuid(),
          nombre text not null,
          direccion text,
          direccion_entrega text,
          email text,
          telefono text,
          persona_contacto text,
          ciudad text,
          pais text,
          created_at timestamptz not null default now()
        )
        """))

        conn.execute(text("create index if not exists idx_clientes_nombre on public.clientes (lower(nombre))"))

# ---- Endpoints --------------------------------------------------------------

@bp.get("/clientes")
def list_clients():
    # Require auth (consistent with other blueprints)
    if not _auth_user_id():
        return jsonify({"error": "Unauthorized"}), 401

    q = (request.args.get("q") or "").strip()
    limit = max(1, min(int(request.args.get("limit") or 20), 50))

    sql = """
      select id, nombre, direccion, direccion_entrega, email, telefono, persona_contacto, ciudad, pais
      from public.clientes
    """
    params = {}
    if q:
        sql += """
          where
            lower(nombre) like :p or
            lower(coalesce(email,'')) like :p or
            lower(coalesce(telefono,'')) like :p or
            lower(coalesce(persona_contacto,'')) like :p or
            lower(coalesce(ciudad,'')) like :p or
            lower(coalesce(pais,'')) like :p
        """
        params["p"] = f"%{q.lower()}%"

    sql += " order by lower(nombre) asc limit :lim"
    params["lim"] = limit

    eng = get_engine()
    with eng.begin() as conn:
        rows = conn.execute(text(sql), params).mappings().all()

    return jsonify([dict(r) for r in rows])

@bp.post("/clientes")
def create_client():
    uid = _auth_user_id()
    if not uid:
        return jsonify({"error": "Unauthorized"}), 401

    b = request.get_json(force=True) or {}
    nombre = (b.get("nombre") or "").strip()
    if not nombre:
        return jsonify({"error": "nombre requerido"}), 400

    eng = get_engine()
    with eng.begin() as conn:
        row = conn.execute(
            text("""
              insert into public.clientes
              (nombre, direccion, direccion_entrega, email, telefono, persona_contacto, ciudad, pais)
              values (:n, :d, :de, :e, :t, :pc, :c, :p)
              returning id
            """),
            {
                "n": nombre,
                "d": (b.get("direccion") or "").strip(),
                "de": (b.get("direccion_entrega") or "").strip(),
                "e": (b.get("email") or "").strip(),
                "t": (b.get("telefono") or "").strip(),
                "pc": (b.get("persona_contacto") or "").strip(),
                "c": (b.get("ciudad") or "").strip(),
                "p": (b.get("pais") or "").strip(),
            }
        ).first()

    return jsonify({"id": row[0]}), 201

@bp.get("/clientes/<uuid:cid>")
def get_client(cid):
    if not _auth_user_id():
        return jsonify({"error": "Unauthorized"}), 401

    eng = get_engine()
    with eng.begin() as conn:
        r = conn.execute(
            text("""
              select id, nombre, direccion, direccion_entrega, email, telefono, persona_contacto, ciudad, pais
              from public.clientes where id = :id
            """),
            {"id": str(cid)}
        ).mappings().first()

    if not r:
        return jsonify({"error": "No encontrado"}), 404
    return jsonify(dict(r))
