from flask import Blueprint, request, jsonify, current_app
from sqlalchemy import text
import jwt
import datetime
import json

bp = Blueprint("inventory", __name__)

ALLOWED_MOTIVES = {"Ingreso de mercancía", "venta", "deterioro", "devolución", "ajuste"}
ALLOWED_CLASSES = {"entrada", "salida"}

def get_engine():
    eng = current_app.config.get("ENGINE")
    if not eng:
        raise RuntimeError("DB engine is not available in app.config['ENGINE']")
    return eng

def auth_user_id():
    auth = request.headers.get("Authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    token = auth.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, current_app.config["JWT_SECRET"], algorithms=["HS256"])
        return payload.get("sub") or payload.get("user_id")
    except Exception:
        return None

def init_schema(engine=None):
    eng = engine or get_engine()
    with eng.begin() as conn:
        conn.execute(text("create extension if not exists pgcrypto"))
        conn.execute(text("""
        create table if not exists productos (
          id uuid primary key default gen_random_uuid(),
          referencia text unique not null,
          descripcion text not null,
          precio_lista numeric(12,2) not null default 0,
          caracteristicas jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now()
        )
        """))
        conn.execute(text("""
        create table if not exists inventario_movimientos (
          id uuid primary key default gen_random_uuid(),
          producto_id uuid not null references productos(id) on delete cascade,
          cantidad numeric(12,2) not null,
          clase text not null,
          tipo text not null,
          motivo text not null,
          usuario_id uuid not null,
          fecha_local date not null,
          hora_local time not null,
          ubicacion text not null default 'principal',
          created_at timestamptz not null default now()
        )
        """))

@bp.get("/inventario/resumen")
def inventory_summary():
    eng = get_engine()
    pedido_id = request.args.get("pedido_id")  # optional: exclude this order's reservations

    # Build the reserved CTE conditionally:
    # - no pedido_id: reserved = items from all draft/submitted orders
    # - with pedido_id: reserved = items from other orders only (exclude this one)
    where_extra = "and p.id <> :po" if pedido_id else ""
    sql = text(f"""
      with stock as (
        select producto_id,
               sum(case when clase='entrada' then cantidad else -cantidad end) as stock
        from public.inventario_movimientos
        group by producto_id
      ),
      reserved as (
        select i.producto_id, sum(i.cantidad) as reservado
        from public.pedido_items i
        join public.pedidos p on p.id = i.pedido_id
        where p.status in ('draft','submitted')
          {where_extra}
        group by i.producto_id
      )
      select
        p.id,
        p.referencia,
        p.descripcion,
        p.precio_lista,
        p.caracteristicas,
        coalesce(s.stock,0)                                   as cantidad_actual,
        coalesce(s.stock,0) - coalesce(r.reservado,0)         as cantidad_disponible
      from public.productos p
      left join stock s on s.producto_id = p.id
      left join reserved r on r.producto_id = p.id
      order by p.referencia asc
    """)
    params = {"po": str(pedido_id)} if pedido_id else {}
    with eng.begin() as conn:
        rows = conn.execute(sql, params).mappings().all()
    return jsonify([dict(r) for r in rows])


@bp.post("/inventario/movimientos")
def create_movement():
    user_id = auth_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    payload = request.get_json(force=True)
    cantidad = payload.get("cantidad")
    clase = payload.get("clase")
    tipo = payload.get("tipo") or "manual"
    motivo = payload.get("motivo")
    fecha_local = payload.get("fecha_local")
    hora_local = payload.get("hora_local")
    ubicacion = payload.get("ubicacion") or "principal"
    producto_id = payload.get("producto_id")
    referencia = payload.get("referencia")

    errors = []
    if not isinstance(cantidad, (int, float)) or float(cantidad) <= 0:
        errors.append("cantidad must be a number > 0")
    if clase not in ALLOWED_CLASSES:
        errors.append("clase must be 'entrada' or 'salida'")
    if motivo not in ALLOWED_MOTIVES:
        errors.append("motivo is invalid")
    try:
        datetime.date.fromisoformat(str(fecha_local))
    except Exception:
        errors.append("fecha_local invalid (YYYY-MM-DD)")
    try:
        datetime.time.fromisoformat(str(hora_local))
    except Exception:
        errors.append("hora_local invalid (HH:MM)")
    if not (producto_id or referencia):
        errors.append("You must send producto_id or referencia")

    if errors:
        return jsonify({"error": errors}), 400

    eng = get_engine()
    with eng.begin() as conn:
        if not producto_id:
            row = conn.execute(
                text("select id from productos where referencia = :r"),
                {"r": referencia}
            ).first()
            if not row:
                return jsonify({"error": "Product not found by referencia"}), 404
            producto_id = row[0]

        conn.execute(
            text("""
              insert into inventario_movimientos
              (producto_id, cantidad, clase, tipo, motivo, usuario_id, fecha_local, hora_local, ubicacion)
              values (:producto_id, :cantidad, :clase, :tipo, :motivo, :usuario_id, :fecha_local, :hora_local, :ubicacion)
            """),
            {
                "producto_id": producto_id,
                "cantidad": float(cantidad),
                "clase": clase,
                "tipo": tipo,
                "motivo": motivo,
                "usuario_id": user_id,
                "fecha_local": fecha_local,
                "hora_local": hora_local,
                "ubicacion": ubicacion
            }
        )

    return jsonify({"ok": True}), 201

@bp.post("/productos")
def create_product():
    user_id = auth_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    p = request.get_json(force=True)
    referencia = (p.get("referencia") or "").strip()
    descripcion = (p.get("descripcion") or "").strip()
    precio = p.get("precio_lista", 0)
    caract = p.get("caracteristicas") or {}

    if not referencia or not descripcion:
        return jsonify({"error": "referencia and descripcion are required"}), 400

    eng = get_engine()
    with eng.begin() as conn:
        conn.execute(
            text("""
              insert into productos (referencia, descripcion, precio_lista, caracteristicas)
              values (:r, :d, :pl, :c::jsonb)
            """),
            {"r": referencia, "d": descripcion, "pl": float(precio), "c": json.dumps(caract, ensure_ascii=False)}
        )
    return jsonify({"ok": True}), 201
