# iSolutions Migration Scripts

Scripts to migrate an existing iPurchase client from OpenEdge to the new iSolutions PostgreSQL database.

## Prerequisites

- Python 3.10+
- `pyodbc` (OpenEdge ODBC driver configured)
- `psycopg2`
- Access to the client's OpenEdge database (wdm) via ODBC
- PostgreSQL 16+ with `citext` extension

## Usage

Each script is self-contained and idempotent (safe to re-run).

```bash
# First run: creates the isolutions database and all tables
python3 001_users.py --oe-host 127.0.0.1 --oe-port 20100 --oe-db wdm \
                     --pg-host localhost --pg-port 5432 --pg-db isolutions \
                     --pg-user ipurchase --pg-password ipurchase
```

## Scripts

| #   | Script       | Table(s)    | Source (OpenEdge)        | Description                    |
|-----|-------------|-------------|--------------------------|--------------------------------|
| 001 | 001_users.py | users       | wus_mstr                 | User accounts and profiles     |

## Design Principles

- **citext everywhere** — all text columns are case-insensitive
- **Idempotent** — every script can be re-run safely (uses TRUNCATE + re-insert)
- **ID fields lowercased** — user_id, supervisor_id, delegate_id, etc. stored lowercase
- **Clean column names** — no prefixes, human-readable (e.g., `full_name` not `wus_name`)
- **Timestamps with timezone** — all dates stored as `timestamptz`
- **NOT NULL with defaults** — text columns default to `''`, not NULL
