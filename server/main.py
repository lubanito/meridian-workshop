import os
import re
import uuid
from datetime import date, datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator
from mock_data import inventory_items, orders, demand_forecasts, backlog_items, spending_summary, monthly_spending, category_spending, recent_transactions, purchase_orders, tasks

app = FastAPI(title="Factory Inventory Management System")

# Quarter mapping for date filtering. Hardcoded to 2025 for the demo
# dataset — Q*-2024 / Q*-2026 etc. fall through to the unrecognized-quarter
# branch in filter_by_month and return [] (empty result, no error).
QUARTER_MAP = {
    'Q1-2025': ['2025-01', '2025-02', '2025-03'],
    'Q2-2025': ['2025-04', '2025-05', '2025-06'],
    'Q3-2025': ['2025-07', '2025-08', '2025-09'],
    'Q4-2025': ['2025-10', '2025-11', '2025-12']
}

def _month_prefix(value: str) -> str:
    """Return the YYYY-MM portion of an order_date, ignoring any time
    component or timezone suffix (e.g. '2025-01-15T00:00:00Z' -> '2025-01').
    Robust to bare 'YYYY-MM-DD' as well as ISO 8601 datetimes."""
    return (value or '')[:7]

# Accepted shapes: 'YYYY-MM' (zero-padded month) or 'Q[1-4]-YYYY' (quarter).
# Anything else returns [] from filter_by_month rather than 422-ing because
# the value comes from a query string we can't gate at the schema level for
# legacy callers, but at least we don't pretend partial matches succeeded.
_MONTH_FILTER_RE = re.compile(r'^\d{4}-(0[1-9]|1[0-2])$')

def filter_by_month(items: list, month: Optional[str]) -> list:
    """Filter items by month/quarter based on order_date field"""
    if not month or month == 'all':
        return items

    if month.startswith('Q'):
        quarter_months = QUARTER_MAP.get(month)
        if not quarter_months:
            return []  # unrecognized quarter — return empty rather than leaking all records
        wanted = set(quarter_months)
        return [item for item in items if _month_prefix(item.get('order_date', '')) in wanted]
    else:
        # Direct month match using a YYYY-MM slice avoids '2025-1' colliding
        # with '2025-10' and tolerates ISO 8601 datetime suffixes.
        if not _MONTH_FILTER_RE.match(month):
            return []  # malformed month filter — return empty rather than partial matches
        return [item for item in items if _month_prefix(item.get('order_date', '')) == month]

def apply_filters(items: list, warehouse: Optional[str] = None, category: Optional[str] = None,
                 status: Optional[str] = None) -> list:
    """Apply common filters to a list of items"""
    filtered = items

    if warehouse and warehouse != 'all':
        filtered = [item for item in filtered if item.get('warehouse') == warehouse]

    if category and category != 'all':
        filtered = [item for item in filtered if item.get('category', '').lower() == category.lower()]

    if status and status != 'all':
        filtered = [item for item in filtered if item.get('status', '').lower() == status.lower()]

    return filtered

# CORS middleware. ALLOWED_ORIGINS env var lets a deploy override the
# wildcard (e.g. "https://meridian.example.com,https://staging.example.com").
# Wildcard is dev-only; allow_credentials must be False with "*" — browsers
# reject the credentialed-wildcard combination per the CORS spec.
_ALLOWED_ORIGINS_RAW = os.getenv("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS = [o.strip() for o in _ALLOWED_ORIGINS_RAW.split(",") if o.strip()]
# Fail loud on a misconfigured env var (e.g. ALLOWED_ORIGINS="" or ",,,")
# rather than starting up with an empty allowlist that silently rejects every
# origin while still flipping allow_credentials on.
if not ALLOWED_ORIGINS:
    raise RuntimeError(
        "ALLOWED_ORIGINS resolved to an empty list. Set it to '*' for dev or "
        "to a comma-separated list of origins for production."
    )
_IS_WILDCARD = ALLOWED_ORIGINS == ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=not _IS_WILDCARD,
    # Wildcard origin (dev) keeps the permissive method/header set for
    # quick iteration. Once a real allowlist is configured, narrow the
    # surface to only the methods + headers this app actually uses, so a
    # compromised allowed origin can't probe arbitrary verbs/headers.
    allow_methods=["*"] if _IS_WILDCARD else ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"] if _IS_WILDCARD else ["Content-Type", "Authorization"],
)

# Data models
class InventoryItem(BaseModel):
    id: str
    sku: str
    name: str
    category: str
    warehouse: str
    quantity_on_hand: int
    reorder_point: int
    unit_cost: float
    location: str
    last_updated: str

class Order(BaseModel):
    id: str
    order_number: str
    customer: str
    items: List[dict]
    status: str
    order_date: str
    expected_delivery: str
    total_value: float
    actual_delivery: Optional[str] = None
    warehouse: Optional[str] = None
    category: Optional[str] = None

class DemandForecast(BaseModel):
    id: str
    item_sku: str
    item_name: str
    current_demand: int
    forecasted_demand: int
    trend: str
    period: str

class BacklogItem(BaseModel):
    id: str
    order_id: str
    item_sku: str
    item_name: str
    quantity_needed: int
    quantity_available: int
    days_delayed: int
    priority: str
    has_purchase_order: Optional[bool] = False

class PurchaseOrder(BaseModel):
    id: str
    backlog_item_id: str
    supplier_name: str
    quantity: int
    unit_cost: float
    expected_delivery_date: str
    status: str
    created_date: str
    notes: Optional[str] = None

# ISO 8601 calendar date validators. A bare regex like ^\d{4}-\d{2}-\d{2}$
# accepts '2025-13-99' / '2025-02-30' — full calendar validity needs a real
# parse. We keep the wire type as str so the rest of the codebase doesn't
# need to change, but route through date.fromisoformat() so invalid
# calendar dates get a 422 with a useful error.
def _validate_iso_date(value: str) -> str:
    try:
        date.fromisoformat(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"expected ISO 8601 date (YYYY-MM-DD), got {value!r}") from exc
    return value

class CreatePurchaseOrderRequest(BaseModel):
    backlog_item_id: str
    supplier_name: str = Field(..., min_length=1, max_length=200)
    quantity: int = Field(..., gt=0)
    unit_cost: float = Field(..., gt=0)
    expected_delivery_date: str
    notes: Optional[str] = Field(default=None, max_length=2000)

    @field_validator('expected_delivery_date')
    @classmethod
    def _check_delivery_date(cls, v: str) -> str:
        return _validate_iso_date(v)

class Task(BaseModel):
    id: str
    title: str
    priority: str
    due_date: Optional[str] = None
    completed: bool = False
    created_date: str

class CreateTaskRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    priority: Literal['low', 'medium', 'high'] = 'medium'
    due_date: Optional[str] = None

    @field_validator('due_date')
    @classmethod
    def _check_due_date(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _validate_iso_date(v)

# API endpoints
@app.get("/")
def root():
    return {"message": "Factory Inventory Management System API", "version": "1.0.0"}

@app.get("/api/inventory", response_model=List[InventoryItem])
def get_inventory(
    warehouse: Optional[str] = None,
    category: Optional[str] = None
):
    """Get all inventory items with optional filtering"""
    return apply_filters(inventory_items, warehouse, category)

@app.get("/api/inventory/{item_id}", response_model=InventoryItem)
def get_inventory_item(item_id: str):
    """Get a specific inventory item"""
    item = next((item for item in inventory_items if item["id"] == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@app.get("/api/orders", response_model=List[Order])
def get_orders(
    warehouse: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    month: Optional[str] = None
):
    """Get all orders with optional filtering"""
    filtered_orders = apply_filters(orders, warehouse, category, status)
    filtered_orders = filter_by_month(filtered_orders, month)
    return filtered_orders

@app.get("/api/orders/{order_id}", response_model=Order)
def get_order(order_id: str):
    """Get a specific order"""
    order = next((order for order in orders if order["id"] == order_id), None)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@app.get("/api/demand", response_model=List[DemandForecast])
def get_demand_forecasts():
    """Get demand forecasts"""
    return demand_forecasts

@app.get("/api/backlog", response_model=List[BacklogItem])
def get_backlog():
    """Get backlog items with purchase order status"""
    # Add has_purchase_order flag to each backlog item
    result = []
    for item in backlog_items:
        item_dict = dict(item)
        # Check if this backlog item has a purchase order
        has_po = any(po["backlog_item_id"] == item["id"] for po in purchase_orders)
        item_dict["has_purchase_order"] = has_po
        result.append(item_dict)
    return result

@app.get("/api/dashboard/summary")
def get_dashboard_summary(
    warehouse: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    month: Optional[str] = None
):
    """Get summary statistics for dashboard with optional filtering"""
    # Filter inventory
    filtered_inventory = apply_filters(inventory_items, warehouse, category)

    # Filter orders
    filtered_orders = apply_filters(orders, warehouse, category, status)
    filtered_orders = filter_by_month(filtered_orders, month)

    total_inventory_value = sum(item["quantity_on_hand"] * item["unit_cost"] for item in filtered_inventory)
    low_stock_items = len([item for item in filtered_inventory if item["quantity_on_hand"] <= item["reorder_point"]])
    # Compare lowercased on both sides — apply_filters does the same, so the
    # count stays correct regardless of casing in the source data.
    pending_orders = len([order for order in filtered_orders if order.get("status", "").lower() in ("processing", "backordered")])
    total_backlog_items = len(backlog_items)

    return {
        "total_inventory_value": round(total_inventory_value, 2),
        "low_stock_items": low_stock_items,
        "pending_orders": pending_orders,
        "total_backlog_items": total_backlog_items,
        "total_orders_value": sum(order["total_value"] for order in filtered_orders)
    }

@app.get("/api/spending/summary")
def get_spending_summary():
    """Get spending summary statistics"""
    return spending_summary

@app.get("/api/spending/monthly")
def get_monthly_spending():
    """Get monthly spending breakdown"""
    return monthly_spending

@app.get("/api/spending/categories")
def get_category_spending():
    """Get spending by category"""
    return category_spending

@app.get("/api/spending/transactions")
def get_recent_transactions():
    """Get recent transactions"""
    return recent_transactions

@app.get("/api/reports/quarterly")
def get_quarterly_reports(
    warehouse: Optional[str] = None,
    category: Optional[str] = None,
    month: Optional[str] = None
):
    """Get quarterly performance reports with optional filtering"""
    filtered_orders = apply_filters(orders, warehouse, category)
    # Only apply quarter-level filters (Q1-Q4); skip individual month filters so a
    # single-month selection doesn't make one quarter appear to have missing months.
    if month and month != 'all' and month.startswith('Q'):
        filtered_orders = filter_by_month(filtered_orders, month)

    quarters = {}
    for order in filtered_orders:
        order_date = order.get('order_date', '')
        # Year-agnostic: parse YYYY-MM and bucket into Q1..Q4 of that year.
        # Use month_num here — `month` is the function parameter (the
        # quarter/month filter), and shadowing it would be confusing.
        try:
            year = order_date[:4]
            month_num = int(order_date[5:7])
        except (ValueError, IndexError):
            continue
        if not (1 <= month_num <= 12):
            continue
        quarter = f'Q{(month_num - 1) // 3 + 1}-{year}'

        if quarter not in quarters:
            quarters[quarter] = {'quarter': quarter, 'total_orders': 0, 'total_revenue': 0, 'delivered_orders': 0, 'avg_order_value': 0}

        quarters[quarter]['total_orders'] += 1
        quarters[quarter]['total_revenue'] += order.get('total_value', 0)
        if order.get('status', '').lower() == 'delivered':
            quarters[quarter]['delivered_orders'] += 1

    result = []
    for q, data in quarters.items():
        if data['total_orders'] > 0:
            data['avg_order_value'] = round(data['total_revenue'] / data['total_orders'], 2)
            data['fulfillment_rate'] = round((data['delivered_orders'] / data['total_orders']) * 100, 1)
        result.append(data)

    # Sort chronologically by (year, quarter-num) tuple. A naive
    # lexicographic sort on the 'Q1-2025' string would break across years —
    # 'Q4-2025' sorts after 'Q1-2026' alphabetically.
    def _quarter_key(row):
        q = row['quarter']  # 'Q1-2025'
        try:
            num, year = q[1:].split('-')
            return (int(year), int(num))
        except (ValueError, IndexError):
            return (0, 0)
    result.sort(key=_quarter_key)
    return result

@app.get("/api/reports/monthly-trends")
def get_monthly_trends(
    warehouse: Optional[str] = None,
    category: Optional[str] = None,
    month: Optional[str] = None
):
    """Get month-over-month trends with optional filtering"""
    filtered_orders = apply_filters(orders, warehouse, category)
    filtered_orders = filter_by_month(filtered_orders, month)

    months = {}
    for order in filtered_orders:
        order_date = order.get('order_date', '')
        if not order_date:
            continue
        m = order_date[:7]
        if m not in months:
            months[m] = {'month': m, 'order_count': 0, 'revenue': 0, 'delivered_count': 0}
        months[m]['order_count'] += 1
        months[m]['revenue'] += order.get('total_value', 0)
        if order.get('status', '').lower() == 'delivered':
            months[m]['delivered_count'] += 1

    result = list(months.values())
    result.sort(key=lambda x: x['month'])
    return result

# FIXME(auth): Task and purchase-order endpoints have no authentication.
# Before any production deployment, add auth middleware (e.g. OAuth2 bearer token check).
# FIXME(persistence): tasks/purchase_orders are module-level Python lists; any
# state created via the API is wiped on server restart. Move to a real store
# (SQLite / Postgres) before anything beyond the demo.
# FIXME(concurrency): the duplicate-PO check in create_purchase_order is
# read-then-append on a shared list, not atomic. Two concurrent POSTs for the
# same backlog_item_id (single uvicorn worker with overlapping awaits, or any
# multi-worker setup) can both pass the check and both append, defeating the
# 409. The DB-backed replacement should rely on a UNIQUE constraint on
# backlog_item_id rather than an application-level scan.
@app.get("/api/tasks", response_model=List[Task])
def get_tasks():
    """Get all tasks"""
    return tasks

@app.post("/api/tasks", response_model=Task, status_code=201)
def create_task(req: CreateTaskRequest):
    """Create a new task"""
    task = {
        "id": f"task-{uuid.uuid4()}",
        "title": req.title,
        "priority": req.priority,
        "due_date": req.due_date,
        "completed": False,
        "created_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
    }
    tasks.append(task)
    return task

@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: str):
    """Delete a task"""
    idx = next((i for i, t in enumerate(tasks) if t["id"] == task_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    tasks.pop(idx)

@app.patch("/api/tasks/{task_id}", response_model=Task)
def toggle_task(task_id: str):
    """Toggle task completed state"""
    task = next((t for t in tasks if t["id"] == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    task["completed"] = not task["completed"]
    return task

@app.post("/api/purchase-orders", response_model=PurchaseOrder, status_code=201)
def create_purchase_order(req: CreatePurchaseOrderRequest):
    """Create a purchase order for a backlog item.
    Rejects duplicates: a backlog item can have at most one open PO. The
    paired GET endpoint only returns the first match, so silently allowing a
    second PO would hide it from the UI."""
    backlog = next((b for b in backlog_items if b["id"] == req.backlog_item_id), None)
    if not backlog:
        raise HTTPException(status_code=404, detail=f"Backlog item {req.backlog_item_id} not found")
    if any(p["backlog_item_id"] == req.backlog_item_id for p in purchase_orders):
        raise HTTPException(status_code=409, detail=f"A purchase order already exists for backlog item {req.backlog_item_id}")
    po = {
        "id": f"PO-{uuid.uuid4()}",
        "backlog_item_id": req.backlog_item_id,
        "supplier_name": req.supplier_name,
        "quantity": req.quantity,
        "unit_cost": req.unit_cost,
        "expected_delivery_date": req.expected_delivery_date,
        "status": "Pending",
        "created_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "notes": req.notes
    }
    purchase_orders.append(po)
    return po

@app.get("/api/backlog/{backlog_item_id}/purchase-order", response_model=PurchaseOrder)
def get_purchase_order_for_backlog_item(backlog_item_id: str):
    """Get the purchase order for a specific backlog item.

    Path is nested under /api/backlog/{id}/... rather than
    /api/purchase-orders/{id} so the route key matches the resource it
    addresses (backlog item) and a future GET /api/purchase-orders/{po_id}
    by PO id won't collide with this one.

    Returns the first match; the create endpoint enforces one PO per
    backlog item via a 409, so this stays single-valued in normal use."""
    po = next((p for p in purchase_orders if p["backlog_item_id"] == backlog_item_id), None)
    if not po:
        raise HTTPException(status_code=404, detail=f"No purchase order found for backlog item {backlog_item_id}")
    return po

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
