---
name: datagen
description: Skill for generating synthetic data for any Spanner schema using Faker and AI.
---

# Generic Data Generation Skill

Use this skill to generate synthetic, realistic data for any Google Cloud Spanner database schema. This approach combines traditional procedural generation (using `Faker`) for structured data with Generative AI (using `Gemini`) for unstructured content like reviews or social media posts.

## Prerequisites

Before running any script, install the following Pip packages:
```bash
pip install faker google-cloud-spanner
```
If using AI generation:
```bash
pip install google-genai
```

---

## Methodology

Follow these 4 phases to design and execute data generation.

### Phase 1: Schema Discovery
Inspect the existing schema to understand the graph of tables and their relationships.
1.  **List Tables**: `.mcp_spanner_list_tables()` or query `INFORMATION_SCHEMA.TABLES`.
2.  **Identify Columns**: For each table, determine column names, types (e.g. `STRING`, `INT64`, `TIMESTAMP`, `ARRAY`), and **Foreign Key** or **Interleave** constraints.

### Phase 2: Formulate Strategy
Map every column to a specific data generation technique.

| Category | Examples | Generation Strategy |
| :--- | :--- | :--- |
| **Identifiers** | `CustomerId`, `OrderId` | `str(uuid.uuid4())` |
| **System fields** | `CreateTime`, `SignupDate` | `spanner.COMMIT_TIMESTAMP` or relative `datetime` |
| **Standard Relational** | `Email`, `IP_Address`, `Address` | Use Python `faker` library |
| **Domain Strings** | `ProductName`, `Vibe`, `Caption` | Use `random.choice` from a list or **Vertex AI** / **Gemini** prompts |
| **Embeddings** | `EmbedVector` | Generate text -> Call Embedding API |

### Phase 3: Define Ordering (DAG)
Respect database integrity. Generate parent entities *before* child entities to populate foreign keys.
-   **Correct Pattern**: `Customers` $\rightarrow$ `Orders` $\rightarrow$ `OrderItems`
-   **Inversion Error**: Creating `OrderItems` before choosing a valid `OrderId` from existing items.

---

## Code Template

Add this template structure into a new script (e.g., `seed_custom.py`).

```python
import uuid
import random
from datetime import datetime, timezone, timedelta
from faker import Faker
from google.cloud import spanner

fake = Faker()

def seed_parents(db, count=10) -> list[str]:
    """Generates standalone entities (e.g., Customers)"""
    entities = []
    for _ in range(count):
        # 1. Generate via faker
        row = (
            str(uuid.uuid4()),  # Id
            fake.email(),
            fake.ipv4(),
            spanner.COMMIT_TIMESTAMP
        )
        entities.append(row)
        
    with db.batch() as batch:
        batch.insert(
            table="Customers",
            columns=("Id", "Email", "IP", "Created"),
            values=entities
        )
    return [e[0] for e in entities] # Return IDs for children

def seed_children(db, parent_ids, count_per_parent=2):
    """Generates dependent entities (e.g., Orders)"""
    children = []
    for pid in parent_ids:
        for _ in range(count_per_parent):
            children.append((
                pid,               # ForeignKey
                str(uuid.uuid4()), # ChildId
                fake.date_time()
            ))
            
    with db.batch() as batch:
        batch.insert(table="Orders", columns=("CustomerId", "OrderId", "OrderTime"), values=children)

# usage
# db = get_db()
# p_ids = seed_parents(db)
# seed_children(db, p_ids)
```

## Best Practices
1.  **Use `db.batch()`**: In Spanner, batch mutations inside `with db.batch()` are strictly more efficient than standalone inserts for high-volume seeders.
2.  **Fractional Fraud Rings**: Hardcode consistent details (e.g., matching address or IP) in a small subset (e.g., $<5\%$) to trigger fraud detection algorithms or test security scenarios.
