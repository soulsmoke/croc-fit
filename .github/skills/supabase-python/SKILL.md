---
name: supabase-python
description: Patterns and critical rules for supabase-py v2 in Python projects. Load when querying, upserting, or configuring RLS policies on Supabase. Covers FK embeds, RLS service_role writes, RPC calls, and test mocking.
applyTo: "**"
---

## Context7

```
mcp_context7_resolve-library-id("supabase/supabase-py")
mcp_context7_query-docs(libraryId, topic="query / upsert / rpc")
```

---

## Stack

- `supabase-py >= 2.9.0`
- PostgreSQL with Row Level Security (RLS)

---

## ⚠️ Critical Rules (learned from real errors)

### 1. FK embed returns list OR dict — always guard both

`supabase-py` v2 returns embedded FK joins differently depending on cardinality:

```python
# many-to-one (e.g. contacts → accounts): returns dict
acc_raw = row.get("accounts")   # {"name": "Acme Corp"}

# one-to-many: returns list[dict]
contacts_raw = row.get("contacts")  # [{"name": "..."}, ...]
```

Always guard for both:

```python
acc_raw = row.get("accounts")
if isinstance(acc_raw, list):
    acc_name = acc_raw[0].get("name") if acc_raw else None
elif isinstance(acc_raw, dict):
    acc_name = acc_raw.get("name")
else:
    acc_name = None
```

### 2. RLS + service_role key for writes

In our recommended RLS setup, the `anon` role is granted SELECT only via policy. Writes (INSERT/UPDATE/DELETE) require the `service_role` key, which bypasses RLS.

```python
# ❌ Fails with: "new row violates row-level security policy"
client = create_client(url, anon_key)
client.table("accounts").upsert(data).execute()

# ✅ Use service_role key for writes
client = create_client(url, service_role_key)
client.table("accounts").upsert(data).execute()
```

**Never expose `service_role_key` in frontend code** — server-side only.

### 3. RLS policy syntax — no IF NOT EXISTS

```sql
-- ❌ Invalid PostgreSQL syntax
CREATE POLICY IF NOT EXISTS "name" ON table ...

-- ✅ Drop first, then create (idempotent)
DROP POLICY IF EXISTS "name" ON table;
CREATE POLICY "name" ON table FOR SELECT TO anon USING (true);
```

### 4. Use `.ilike()` for partial case-insensitive match

```python
# ✅ explicit and clear
query = query.ilike("name", f"%{name}%")
```

### 5. Composite PK upsert — `on_conflict` format

```python
# composite PK: comma-separated, no spaces
client.table("my_table").upsert(
    {"col_a": "x", "col_b": "y", "data": "..."},
    on_conflict="col_a,col_b",  # no spaces
).execute()
```

### 6. Seed scripts — pydantic-settings path

`pydantic-settings` resolves `.env.local` relative to cwd at `Settings()` instantiation time. In standalone scripts the cwd may differ.

```python
import os, sys
from pathlib import Path
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / ".env")

from mymodule.config import settings

# Read service_role key directly from os.environ (safe for scripts)
service_key = (
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or settings.supabase_service_role_key
)
```

### 7. mypy + supabase-py mock attributes

mypy cannot infer `.return_value` / `.side_effect` on typed supabase-py callable objects. Add `# type: ignore[attr-defined]` in tests:

```python
connector._client.table.return_value = chain          # type: ignore[attr-defined]
connector._client.rpc.return_value = MagicMock(...)   # type: ignore[attr-defined]
connector._client.rpc.side_effect = Exception("...")  # type: ignore[attr-defined]
```

### 8. maybe_single() — safe nullable access

```python
# ❌ AttributeError if no row found
result = client.table("items").select("*").eq("id", item_id).maybe_single().execute()
name = result.data.get("name")

# ✅ Guard for None
result = client.table("items").select("*").eq("id", item_id).maybe_single().execute()
name = result.data.get("name") if result.data is not None else None
```

### 9. mypy-safe casting for result.data

`result.data` is typed as `list[dict] | None` but mypy sometimes infers `object`. Always cast:

```python
from typing import Any, cast

result = client.table("items").select("*").execute()
rows = cast(list[dict[str, Any]], result.data) if result.data else []
```

### 10. Array `.contains()` for TEXT[] columns

```python
# Filter rows where tags array contains "important"
result = client.table("items").select("*").contains("tags", ["important"]).execute()
```

### 11. OR filter syntax

```python
# ❌ Wrong — two .eq() calls are AND
result = client.table("items").select("*").eq("status", "active").eq("status", "pending").execute()

# ✅ Correct — OR filter
result = client.table("items").select("*").or_(f"status.eq.active,status.eq.pending").execute()
```

### 12. Avoid `list` as method name — shadows built-in

```python
# ❌ Shadows built-in list()
class ItemRepository:
    def list(self, tenant_id: str) -> list[dict]: ...

# ✅ Use list_all or list_items
class ItemRepository:
    def list_all(self, tenant_id: str) -> list[dict]: ...
```

### 13. JSONB nullable fields — use `str | None` not `str`

JSONB columns can be null even when the column has a default. Always type as nullable:

```python
# ❌ Pydantic validation error if DB returns null
description: str = ""

# ✅ Handle null from DB
description: str | None = None
```

---

## Client Setup

```python
from supabase import Client, create_client

# anon key — for read-only operations
client: Client = create_client(supabase_url, supabase_anon_key)

# service_role key — for writes with RLS
service_client: Client = create_client(supabase_url, supabase_service_role_key)
```

---

## Query Patterns

### SELECT with filter

```python
# eq filter
result = client.table("items").select("*").eq("status", "active").execute()

# partial match (case-insensitive)
result = client.table("contacts").select("id,name,email").ilike("name", "%smith%").execute()

# multiple filters + order + limit
result = (
    client.table("items")
    .select("id,name,value,status")
    .eq("status", "active")
    .ilike("category", f"%{category}%")
    .order("value", desc=True)
    .limit(50)
    .execute()
)

data: list[dict] = result.data or []
```

### Pagination with `.range()`

```python
# Offset-based pagination — range(start, end) is inclusive
page_size = 25
page = 0

result = (
    client.table("items")
    .select("*", count="exact")
    .range(page * page_size, (page + 1) * page_size - 1)
    .execute()
)

rows = result.data or []
total = result.count  # total matching rows (requires count="exact")
```

### DELETE

```python
# ⚠️ Requires service_role key (RLS blocks deletes for anon)
service_client.table("items").delete().eq("id", item_id).execute()
```

### FK embed (JOIN)

```python
# Select contacts with their account name (many-to-one → returns dict)
result = (
    client.table("contacts")
    .select("id,name,email,accounts(name)")
    .order("name")
    .limit(25)
    .execute()
)
# result.data[0]["accounts"] → {"name": "Acme Corp"}  (dict, not list)
```

### UPSERT

```python
from typing import Any

rows: list[dict[str, Any]] = [
    {"id": "uuid-...", "name": "Item 1", "value": 42},
]
client.table("items").upsert(rows, on_conflict="id").execute()
```

### UPSERT on composite PK

```python
import json
from datetime import UTC, datetime

service_client.table("my_table").upsert(
    {
        "session_id": session_id,
        "user_id": user_id,
        "data": json.dumps(payload),
        "updated_at": datetime.now(tz=UTC).isoformat(),
    },
    on_conflict="session_id,user_id",  # composite PK — no spaces
).execute()
```

### RPC (PostgreSQL function)

```python
result = client.rpc("my_function_name").execute()
rows: list[dict] = result.data or []

# With parameters
result = client.rpc("fn_name", {"param1": value}).execute()
```

### Fallback when RPC function does not exist

```python
try:
    response = client.rpc("get_summary").execute()
    rows = response.data or []
except Exception:
    # Function not deployed — fall back to client-side aggregation
    rows = client.table("items").select("category,value").eq("status", "active").execute().data or []
    # aggregate in Python...
```

---

## RLS Schema Pattern

```sql
-- Enable RLS on all tables
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Read-only for anon/authenticated
DROP POLICY IF EXISTS "anon_read_items" ON items;
CREATE POLICY "anon_read_items"
    ON items FOR SELECT TO anon, authenticated USING (true);

-- Full write for service_role (seed scripts, admin operations)
DROP POLICY IF EXISTS "service_write_items" ON items;
CREATE POLICY "service_write_items"
    ON items FOR ALL TO service_role USING (true) WITH CHECK (true);
```

---

## RPC Function Pattern (PostgreSQL)

```sql
CREATE OR REPLACE FUNCTION get_summary()
RETURNS TABLE (category TEXT, count BIGINT, total_value NUMERIC)
LANGUAGE sql
STABLE
AS $$
    SELECT
        category,
        COUNT(*)      AS count,
        SUM(value)    AS total_value
    FROM items
    WHERE status = 'active'
    GROUP BY category
    ORDER BY total_value DESC NULLS LAST;
$$;
```

---

## Repository / Connector Pattern

```python
from supabase import Client, create_client
from mymodule.config import settings

class SupabaseRepository:
    def __init__(self) -> None:
        self._client: Client = create_client(
            settings.supabase_url,
            settings.supabase_anon_key,
        )
        self._write_client: Client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )

    def _table(self, name: str):
        return self._client.table(name)

    def get_active_items(
        self,
        category: str | None = None,
    ) -> list[dict]:
        query = self._table("items").select("*").eq("status", "active")
        if category:
            query = query.ilike("category", f"%{category}%")
        try:
            return query.order("value", desc=True).limit(50).execute().data or []
        except Exception:
            # Network error, timeout, or Supabase 500 — degrade gracefully
            return []

    def create_item(self, data: dict) -> dict:
        result = self._write_client.table("items").insert(data).execute()
        return result.data[0]
```

---

## Testing with MagicMock

```python
from unittest.mock import MagicMock, patch
import pytest

@pytest.fixture
def repo() -> SupabaseRepository:
    with patch("mymodule.repository.SupabaseRepository.__init__", return_value=None):
        r = SupabaseRepository.__new__(SupabaseRepository)
        r._client = MagicMock()
        r._write_client = MagicMock()
        return r

def _mock_table(repo: SupabaseRepository, data: list[dict]) -> MagicMock:
    chain = MagicMock()
    chain.execute.return_value = MagicMock(data=data)
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.ilike.return_value = chain
    chain.order.return_value = chain
    chain.limit.return_value = chain
    chain.insert.return_value = chain
    chain.upsert.return_value = chain
    repo._client.table.return_value = chain  # type: ignore[attr-defined]
    return chain
```
