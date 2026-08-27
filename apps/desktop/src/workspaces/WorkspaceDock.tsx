import type { WorkspaceId } from "@os/protocol";
import { WORKSPACES } from "@os/visualization";
import "./workspaces.css";

type Props = {
  active: WorkspaceId;
  onChange: (workspace: WorkspaceId) => void;
};

export default function WorkspaceDock({ active, onChange }: Props) {
  return (
    <nav className="workspace-dock glass" aria-label="OS workspaces">
      {WORKSPACES.map((workspace) => (
        <button
          key={workspace.id}
          type="button"
          className={active === workspace.id ? "active" : ""}
          onClick={() => onChange(workspace.id)}
          title={`${workspace.label} — ${workspace.purpose}`}
          aria-pressed={active === workspace.id}
        >
          <span>{workspace.shortLabel}</span>
        </button>
      ))}
    </nav>
  );
}
