import type { WorkspaceId } from "@os/protocol";
import { WORKSPACES } from "@os/visualization";
import "./workspaces.css";

type Props = {
  active: WorkspaceId;
  onChange: (workspace: WorkspaceId) => void;
};

export default function WorkspaceDock({ active, onChange }: Props) {
  return (
    <nav className="workspace-dock glass" aria-label="OS spatial workspaces">
      <div className="workspace-rail" aria-hidden="true" />
      {WORKSPACES.map((workspace, index) => (
        <button
          key={workspace.id}
          type="button"
          className={active === workspace.id ? "active" : ""}
          onClick={() => onChange(workspace.id)}
          title={`${workspace.label} — ${workspace.purpose}`}
          aria-pressed={active === workspace.id}
        >
          <span className="workspace-index">{String(index + 1).padStart(2, "0")}</span>
          <span className="workspace-glyph" aria-hidden="true">{workspace.glyph}</span>
          <span className="workspace-label">{workspace.shortLabel}</span>
        </button>
      ))}
    </nav>
  );
}
