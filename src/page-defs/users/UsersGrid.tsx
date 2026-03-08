import { resolveClientText } from "@/lib/i18n/runtime";
import { tx } from "@/lib/i18n/types";
import { DataGridDef } from "@/platform/core/DataGridDef";
import type { Row } from "@/platform/core/types";
import { useEffect, useState } from "react";
import { UserDataSource } from "./UserDataSource";

export class UsersGrid extends DataGridDef {
  constructor(form?: any) {
    super({ key: "users", pageSize: 0 }, form);
    this.dataSource = new UserDataSource();
  }

  async loadColumns() {
    await super.loadColumns();

    this.getColumn("domains")?.applyOptions({ hidden: true });
    this.getColumn("locale")?.applyOptions({ hidden: true });
    this.getColumn("street1")?.applyOptions({ hidden: true });
    this.getColumn("street2")?.applyOptions({ hidden: true });
    this.getColumn("city")?.applyOptions({ hidden: true });
    this.getColumn("state")?.applyOptions({ hidden: true });
    this.getColumn("postal_code")?.applyOptions({ hidden: true });
    this.getColumn("country")?.applyOptions({ hidden: true });
    this.getColumn("cell_phone")?.applyOptions({ hidden: true });
    this.getColumn("phone")?.applyOptions({ hidden: true });
    this.getColumn("employee_number")?.applyOptions({ hidden: true });
    this.getColumn("expire_date")?.applyOptions({ hidden: true });
    this.getColumn("last_login")?.applyOptions({ hidden: true });
    this.getColumn("supervisor_id")?.applyOptions({ hidden: true });
    this.getColumn("delegate_id")?.applyOptions({ hidden: true });
    this.getColumn("approval_limit")?.applyOptions({ hidden: true });
  }

  renderCard(row: Row, isSelected: boolean) {
    const isActive = row.is_active === true || row.is_active === 1 || row.is_active === "true";

    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px",
        borderBottom: "1px solid var(--border-light, var(--border))",
        background: isSelected ? "var(--bg-selected, rgba(14,134,202,0.08))" : "transparent",
        cursor: "pointer",
      }}>
        <UserCardAvatar oid={String(row.oid ?? "")} fullName={String(row.full_name ?? "")} userId={String(row.user_id ?? "")} isSelected={isSelected} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {(row.full_name as string) || (row.user_id as string)}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.user_id as string}{row.email ? ` · ${row.email}` : ""}
          </div>
        </div>

        <div style={{
          fontSize: "0.65rem", fontWeight: 600, padding: "2px 7px", borderRadius: 10, flexShrink: 0,
          background: isActive ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.10)",
          color: isActive ? "rgb(22,163,74)" : "rgb(220,38,38)",
        }}>
          {isActive
            ? resolveClientText(tx("users.status.active", "Active"))
            : resolveClientText(tx("users.status.inactive", "Inactive"))}
        </div>
      </div>
    );
  }
}

function UserCardAvatar({ oid, fullName, userId, isSelected }: { oid: string; fullName: string; userId: string; isSelected: boolean }) {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [oid]);

  const initials = (fullName || userId || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const src = oid ? `/api/users/photo?oid=${encodeURIComponent(oid)}` : "";

  if (!src || error) {
    return (
      <div style={{
        width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
        background: isSelected ? "var(--accent)" : "var(--bg-surface-alt)",
        border: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.8rem", fontWeight: 600,
        color: isSelected ? "#fff" : "var(--text-secondary)",
        overflow: "hidden",
      }}>
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={fullName || userId}
      onError={() => setError(true)}
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        flexShrink: 0,
        objectFit: "cover",
        border: "1px solid var(--border)",
        background: "var(--bg-surface-alt)",
      }}
    />
  );
}
