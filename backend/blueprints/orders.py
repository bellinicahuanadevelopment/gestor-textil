from flask import Blueprint, request, jsonify, current_app, g
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
import jwt
import datetime
from decimal import Decimal
import json
import os

bp = Blueprint("orders", __name__)

ORDER_STATUSES = {"draft", "submitted", "approved", "cancelled"}

def get_engine():
    eng = current_app.config.get("ENGINE")
    if not eng:
        raise RuntimeError("DB engine not available")
    return eng

# --- Auth helpers ------------------------------------------------------------

def _jwt_claims():
    """Decode Authorization bearer token and return claims or {}."""
    auth = request.headers.get("Authorization", "")
    if not auth.lower().startswith("bearer "):
        return {}
    token = auth.split(" ", 1)[1].strip()
    try:
        return jwt.decode(token, current_app.config["JWT_SECRET"], algorithms=["HS256"])
    except Exception:
        return {}

def auth_user_id():
    claims = _jwt_claims()
    return claims.get("sub") or claims.get("user_id")

def _current_profile():
    # try Flask g first (when @require_auth was used)
    prof = getattr(g, "user_profile", None) or (getattr(g, "user", {}) or {}).get("profile")
    if prof:
        return prof
    # fallback: decode token directly (most endpoints in this bp handle auth manually)
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(token, current_app.config["JWT_SECRET"], algorithms=["HS256"])
            return payload.get("profile")
        except Exception:
            return None
    return None

def _require_approver():
    return _current_profile() in ("manager", "admin")

# --- Schema bootstrap --------------------------------------------------------

def init_schema(engine=None):
    eng = engine or get_engine()

    # Phase 1: enum setup in AUTOCOMMIT
    with eng.connect() as raw:
        conn = raw.execution_options(isolation_level="AUTOCOMMIT")
        conn.execute(text("create extension if not exists pgcrypto"))

        conn.execute(text("""
        do $do$
        begin
          if not exists (select 1 from pg_type where typname = 'order_status') then
            create type public.order_status as enum ('draft','submitted','approved','cancelled');
          end if;
        end
        $do$;
        """))
        for label in ("draft", "submitted", "approved", "cancelled"):
            conn.execute(text("""
            do $do$
            begin
              if not exists (
                select 1
                from pg_enum e
                join pg_type t on t.oid = e.enumtypid
                where t.typname = 'order_status' and e.enumlabel = :label
              ) then
                alter type public.order_status add value :label;
              end if;
            end
            $do$;
            """), {"label": label})

    # Phase 2: tables + approval audit columns
    with eng.begin() as conn:
        conn.execute(text("""
        create table if not exists public.pedidos (
          id uuid primary key default gen_random_uuid(),
          status public.order_status not null default 'draft'::public.order_status,
          cliente_nombre text not null,
          cliente_telefono text not null,
          direccion_entrega text not null,
          fecha_entrega date not null,
          fecha_local date not null default current_date,
          hora_local time not null default current_time,
          usuario_id uuid not null,
          created_at timestamptz not null default now()
        )
        """))

        conn.execute(text("""
            alter table if exists public.pedidos
            add column if not exists cliente_id uuid references public.clientes(id)
        """))


        conn.execute(text("""
        create table if not exists public.pedido_items (
          id uuid primary key default gen_random_uuid(),
          pedido_id uuid not null references public.pedidos(id) on delete cascade,
          producto_id uuid not null references public.productos(id) on delete restrict,
          referencia text not null,
          descripcion text not null,
          cantidad numeric(12,2) not null,
          precio numeric(12,2) not null,
          created_at timestamptz not null default now()
        )
        """))

        

        # --- approval audit columns (idempotent) ---
        conn.execute(text("alter table public.pedidos add column if not exists approved_at timestamptz"))
        conn.execute(text("alter table public.pedidos add column if not exists approved_by uuid"))
        conn.execute(text("alter table public.pedidos add column if not exists approved_fecha_local date"))
        conn.execute(text("alter table public.pedidos add column if not exists approved_hora_local time"))

        # FK for approved_by if missing
        conn.execute(text("""
        do $do$
        begin
          if not exists (
            select 1
            from information_schema.table_constraints
            where table_schema='public'
              and table_name='pedidos'
              and constraint_name='pedidos_approved_by_fkey'
          ) then
            alter table public.pedidos
              add constraint pedidos_approved_by_fkey
              foreign key (approved_by) references public.usuarios(id);
          end if;
        end
        $do$;
        """))

# --- Routes ------------------------------------------------------------------

@bp.post("/pedidos/<uuid:pedido_id>/approve")
def approve_order(pedido_id):
    # Must be manager
    if not _require_approver():
        return jsonify({"ok": False, "message": "No autorizado: requiere perfil manager"}), 403

    claims = _jwt_claims()
    approver_id = claims.get("sub") or claims.get("user_id")
    if not approver_id:
        return jsonify({"ok": False, "message": "Token inválido"}), 401

    engine = current_app.config["ENGINE"]

    # Allow flexible status labels unless explicitly set
    candidates = [os.environ.get("APPROVED_STATUS") or "approved", "aprobado", "Aprobado", "APPROVED", "APROBADO"]
    approved_labels = {c.lower() for c in candidates if c}
    try:
      with engine.begin() as conn:
        # Ensure order exists & not already approved
        head = conn.execute(
            text("select id, status from public.pedidos where id = :id"),
            {"id": str(pedido_id)}
        ).mappings().first()
        if not head:
            return jsonify({"ok": False, "message": "Pedido no encontrado"}), 404
        
        if str(head.get("status")).lower() in approved_labels:
            return jsonify({"ok": False, "message": "Pedido ya aprobado"}), 409

        # Try to set status + audit fields
        row = None
        last_err = None
        for st in [c for c in candidates if c]:
            try:
                r = conn.execute(
                    text("""
                      update public.pedidos
                      set status = :st,
                          approved_at = now(),
                          approved_by = :uid,
                          approved_fecha_local = current_date,
                          approved_hora_local = current_time
                      where id = :id
                      returning id, status, approved_at, approved_by, approved_fecha_local, approved_hora_local
                    """),
                    {"st": st, "id": str(pedido_id), "uid": str(approver_id)}
                )
                row = r.fetchone()
                if row:
                    break
            except SQLAlchemyError as e:
                last_err = e
                continue

        if not row:
            # Found but enum label not accepted
            if last_err:
                current_app.logger.warning("approve enum mismatch: %s", last_err)
            return jsonify({
                "ok": False,
                "message": "No se pudo actualizar el estado. Revise los valores del enum order_status o defina APPROVED_STATUS."
            }), 409

        # Serialize
        approved_at = row.approved_at.isoformat() if isinstance(row.approved_at, datetime.datetime) else None
        return jsonify({
            "ok": True,
            "pedido": {
                "id": str(row.id),
                "status": row.status,
                "approved_at": approved_at,
                "approved_by": str(row.approved_by) if row.approved_by else None,
                "approved_fecha_local": row.approved_fecha_local.isoformat() if isinstance(row.approved_fecha_local, datetime.date) else None,
                "approved_hora_local": row.approved_hora_local.isoformat(timespec="minutes") if isinstance(row.approved_hora_local, datetime.time) else None,
            }
        })
    except SQLAlchemyError:
        current_app.logger.exception("Error aprobando pedido")
        return jsonify({"ok": False, "message": "Error del servidor"}), 500

@bp.post("/pedidos/start")
def start_order():
    user_id = auth_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    b = request.get_json(force=True) or {}
    cliente_id = b.get("cliente_id")
    nombre = (b.get("cliente_nombre") or "").strip()
    tel = (b.get("cliente_telefono") or "").strip()
    dir_envio = (b.get("direccion_entrega") or "").strip()
    fecha_entrega = b.get("fecha_entrega")
    fecha_local = b.get("fecha_local")
    hora_local = b.get("hora_local")

    # If a client was selected, fill missing fields from clientes
    if cliente_id and not nombre:
        eng = get_engine()
        with eng.begin() as conn:
            row = conn.execute(
                text("""
                  select nombre, telefono, coalesce(direccion_entrega, direccion) as dir_ent
                  from public.clientes where id = :cid
                """),
                {"cid": str(cliente_id)}
            ).mappings().first()
        if not row:
            return jsonify({"error": "cliente_id inválido"}), 400
        nombre = row["nombre"] or nombre
        tel = tel or (row["telefono"] or "")
        dir_envio = dir_envio or (row["dir_ent"] or "")


    errs = []
    if not nombre:
        errs.append("cliente_nombre requerido (o cliente_id)")
    if not tel:
        errs.append("cliente_telefono requerido")
    if not dir_envio:
        errs.append("direccion_entrega requerida")

    try:
        datetime.date.fromisoformat(str(fecha_entrega))
    except Exception:
        errs.append("fecha_entrega inválida (YYYY-MM-DD)")
    if fecha_local:
        try: datetime.date.fromisoformat(str(fecha_local))
        except Exception: errs.append("fecha_local inválida (YYYY-MM-DD)")
    if hora_local:
        try: datetime.time.fromisoformat(str(hora_local))
        except Exception: errs.append("hora_local inválida (HH:MM)")

    if errs:
        return jsonify({"error": errs}), 400

    eng = get_engine()
    with eng.begin() as conn:
        row = conn.execute(
            text("""
              insert into public.pedidos
              (cliente_id, cliente_nombre, cliente_telefono, direccion_entrega, fecha_entrega, usuario_id, fecha_local, hora_local)
              values (:cid, :n, :t, :d, :fe, :uid, coalesce(:fl, current_date), coalesce(:hl, current_time))
              returning id
            """),
            {
              "cid": str(cliente_id) if cliente_id else None,
              "n": nombre,
              "t": tel,
              "d": dir_envio,
              "fe": fecha_entrega,
              "uid": user_id,
              "fl": fecha_local,
              "hl": hora_local
            }
        ).first()
    return jsonify({"pedido_id": row[0]}), 201

@bp.get("/pedidos")
def list_orders():
    user_id = auth_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    eng = get_engine()
    sql = text("""
      with totals as (
        select
          i.pedido_id,
          sum(i.cantidad) as items_count,
          sum(i.cantidad * i.precio) as total
        from public.pedido_items i
        group by i.pedido_id
      )
      select
        p.id, p.status, p.cliente_nombre, p.cliente_telefono, p.direccion_entrega,
        p.fecha_entrega, p.created_at,
        coalesce(t.items_count,0) as items_count,
        coalesce(t.total,0) as total
      from public.pedidos p
      left join totals t on t.pedido_id = p.id
      order by p.created_at desc
      limit 200
    """)
    with eng.begin() as conn:
        rows = conn.execute(sql).mappings().all()

    out = []
    for r in rows:
        d = dict(r)
        if isinstance(d.get("fecha_entrega"), datetime.date):
            d["fecha_entrega"] = d["fecha_entrega"].isoformat()
        if isinstance(d.get("created_at"), datetime.datetime):
            d["created_at"] = d["created_at"].isoformat()
        out.append(d)
    return jsonify(out)

@bp.get("/pedidos/<uuid:pedido_id>")
def get_order(pedido_id):
    user_id = auth_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    eng = get_engine()
    with eng.begin() as conn:
        head = conn.execute(
            text("""select id, status, cliente_nombre, cliente_telefono, direccion_entrega,
                           fecha_entrega, fecha_local, hora_local, created_at,
                           approved_at, approved_by, approved_fecha_local, approved_hora_local
                   from public.pedidos where id = :id"""),
            {"id": str(pedido_id)}
        ).mappings().first()
        if not head:
            return jsonify({"error": "Pedido no encontrado"}), 404

        items = conn.execute(
            text("""select id, pedido_id, producto_id, referencia, descripcion, cantidad, precio, created_at
                    from public.pedido_items where pedido_id = :id order by created_at asc"""),
            {"id": str(pedido_id)}
        ).mappings().all()

    # Serialize date/time fields to ISO strings
    h = dict(head)
    if isinstance(h.get("fecha_entrega"), datetime.date):
        h["fecha_entrega"] = h["fecha_entrega"].isoformat()
    if isinstance(h.get("fecha_local"), datetime.date):
        h["fecha_local"] = h["fecha_local"].isoformat()
    if isinstance(h.get("hora_local"), datetime.time):
        h["hora_local"] = h["hora_local"].isoformat(timespec="minutes")
    if isinstance(h.get("created_at"), datetime.datetime):
        h["created_at"] = h["created_at"].isoformat()
    if isinstance(h.get("approved_at"), datetime.datetime):
        h["approved_at"] = h["approved_at"].isoformat()
    if isinstance(h.get("approved_fecha_local"), datetime.date):
        h["approved_fecha_local"] = h["approved_fecha_local"].isoformat()
    if isinstance(h.get("approved_hora_local"), datetime.time):
        h["approved_hora_local"] = h["approved_hora_local"].isoformat(timespec="minutes")
    if h.get("approved_by"):
        h["approved_by"] = str(h["approved_by"])

    out_items = []
    for i in items:
        d = dict(i)
        if isinstance(d.get("created_at"), datetime.datetime):
            d["created_at"] = d["created_at"].isoformat()
        out_items.append(d)

    return jsonify({"pedido": h, "items": out_items})

def _available_for_order(conn, producto_id, pedido_id):
    stock = conn.execute(
        text("""select coalesce(sum(case when clase='entrada' then cantidad else -cantidad end),0)
                from public.inventario_movimientos
                where producto_id = :pid"""),
        {"pid": producto_id}
    ).scalar() or 0

    reserved_others = conn.execute(
        text("""select coalesce(sum(i.cantidad),0)
                from public.pedido_items i
                join public.pedidos p on p.id = i.pedido_id
                where i.producto_id = :pid
                  and p.status in ('draft','submitted')
                  and p.id <> :po"""),
        {"pid": producto_id, "po": str(pedido_id)}
    ).scalar() or 0

    return float(stock) - float(reserved_others)

@bp.post("/pedidos/<uuid:pedido_id>/items")
def add_or_update_item(pedido_id):
    user_id = auth_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    b = request.get_json(force=True) or {}
    cantidad = b.get("cantidad")
    precio = b.get("precio")
    producto_id = b.get("producto_id")
    referencia = b.get("referencia")

    if not isinstance(cantidad, (int, float)) or float(cantidad) <= 0:
        return jsonify({"error": "cantidad debe ser > 0"}), 400

    eng = get_engine()
    with eng.begin() as conn:
        if not producto_id:
            row = conn.execute(text("select id, referencia, descripcion, precio_lista from public.productos where referencia = :r"),
                               {"r": referencia}).mappings().first()
        else:
            row = conn.execute(text("select id, referencia, descripcion, precio_lista from public.productos where id = :id"),
                               {"id": producto_id}).mappings().first()
        if not row:
            return jsonify({"error": "Producto no encontrado"}), 404

        precio_final = float(precio if isinstance(precio, (int, float)) else row["precio_lista"])

        available = _available_for_order(conn, row["id"], pedido_id)
        existing = conn.execute(
            text("select id, cantidad from public.pedido_items where pedido_id = :po and producto_id = :pid"),
            {"po": str(pedido_id), "pid": row["id"]}
        ).mappings().first()
        existing_qty = float(existing["cantidad"]) if existing else 0.0

        if float(cantidad) > available:
            return jsonify({"error": f"Cantidad solicitada supera el disponible ({available:g})"}), 400

        if existing:
            conn.execute(
                text("""update public.pedido_items
                        set cantidad = :c, precio = :p
                        where id = :id"""),
                {"c": float(cantidad), "p": precio_final, "id": existing["id"]}
            )
            item_id = existing["id"]
        else:
            item_id = conn.execute(
                text("""insert into public.pedido_items
                        (pedido_id, producto_id, referencia, descripcion, cantidad, precio)
                        values (:po, :pid, :ref, :desc, :c, :p)
                        returning id"""),
                {"po": str(pedido_id), "pid": row["id"], "ref": row["referencia"], "desc": row["descripcion"],
                 "c": float(cantidad), "p": precio_final}
            ).scalar()

    return jsonify({"ok": True, "item_id": item_id}), 201

@bp.put("/pedidos/<uuid:pedido_id>/items/<uuid:item_id>")
def update_item(pedido_id, item_id):
    user_id = auth_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    b = request.get_json(force=True) or {}
    cantidad = b.get("cantidad")
    precio = b.get("precio")
    if cantidad is None and precio is None:
        return jsonify({"error": "nada que actualizar"}), 400

    eng = get_engine()
    with eng.begin() as conn:
        item = conn.execute(
            text("select id, producto_id, cantidad, precio from public.pedido_items where id = :id and pedido_id = :po"),
            {"id": str(item_id), "po": str(pedido_id)}
        ).mappings().first()
        if not item:
            return jsonify({"error": "Ítem no encontrado"}), 404

        new_qty = float(cantidad if isinstance(cantidad, (int, float)) else item["cantidad"])
        new_price = float(precio if isinstance(precio, (int, float)) else item["precio"])

        available = _available_for_order(conn, item["producto_id"], pedido_id)
        if new_qty > available:
            return jsonify({"error": f"Cantidad solicitada supera el disponible ({available:g})"}), 400

        conn.execute(
            text("update public.pedido_items set cantidad = :c, precio = :p where id = :id"),
            {"c": new_qty, "p": new_price, "id": str(item_id)}
        )

    return jsonify({"ok": True})

@bp.delete("/pedidos/<uuid:pedido_id>/items/<uuid:item_id>")
def delete_item(pedido_id, item_id):
    user_id = auth_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    eng = get_engine()
    with eng.begin() as conn:
        conn.execute(
            text("delete from public.pedido_items where id = :id and pedido_id = :po"),
            {"id": str(item_id), "po": str(pedido_id)}
        )
    return jsonify({"ok": True})

@bp.post("/pedidos/<uuid:pedido_id>/submit")
def submit_order(pedido_id):
    user_id = auth_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    eng = get_engine()
    with eng.begin() as conn:
        conn.execute(
            text("update public.pedidos set status = 'submitted' where id = :id"),
            {"id": str(pedido_id)}
        )
    return jsonify({"ok": True})

# REPLACE the existing delete endpoint with this one

@bp.route("/pedidos/<uuid:pedido_id>", methods=["DELETE"])
@bp.route("/pedidos/<pedido_id>", methods=["DELETE"])  # also accept string ids
def delete_order(pedido_id):
    user_id = auth_user_id()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Coerce UUID or string to str for SQL
    pid = str(pedido_id)

    eng = get_engine()
    with eng.begin() as conn:
        # remove items first (in case FK doesn't cascade)
        conn.execute(text("delete from public.pedido_items where pedido_id = :pid"), {"pid": pid})
        gone = conn.execute(
            text("delete from public.pedidos where id = :pid returning id"),
            {"pid": pid}
        ).first()
        if not gone:
            return jsonify({"error": "Pedido no encontrado"}), 404

    return jsonify({"ok": True})

