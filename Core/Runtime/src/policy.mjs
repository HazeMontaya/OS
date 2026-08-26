const MUTATING = new Set(['write', 'execute', 'network', 'admin']);

export function createPolicy(config, audit) {
  const policy = config.policy || {};

  function check(capability, context = {}) {
    if (capability === 'write' && !policy.allowWriteInsideRoot) {
      return { allowed: false, reason: 'File writes are disabled by policy' };
    }
    if (capability === 'execute' && !policy.allowShell) {
      return { allowed: false, reason: 'Shell execution is disabled by policy' };
    }
    if (capability === 'network' && !policy.allowNetworkTools) {
      return { allowed: false, reason: 'Network tools are disabled by policy' };
    }
    if (capability === 'execute' && Array.isArray(policy.allowedShellCommands) && policy.allowedShellCommands.length) {
      if (!policy.allowedShellCommands.includes(String(context.command || ''))) {
        return { allowed: false, reason: 'Command is not on the shell allowlist' };
      }
    }
    if (MUTATING.has(capability) && policy.requireApprovalForMutations && context.approved !== true) {
      return { allowed: false, reason: 'Explicit approval is required for mutating actions', approvalRequired: true };
    }
    return { allowed: true };
  }

  function enforce(capability, context = {}) {
    const decision = check(capability, context);
    audit?.append('policy.decision', { capability, allowed: decision.allowed, reason: decision.reason || null, subject: context.subject || null });
    if (!decision.allowed) {
      const error = new Error(decision.reason);
      error.code = decision.approvalRequired ? 'APPROVAL_REQUIRED' : 'POLICY_DENIED';
      throw error;
    }
    return decision;
  }

  return {
    check,
    enforce,
    snapshot: () => ({
      mode: config.autonomy?.mode || 'supervised',
      allowWriteInsideRoot: Boolean(policy.allowWriteInsideRoot),
      allowShell: Boolean(policy.allowShell),
      allowNetworkTools: Boolean(policy.allowNetworkTools),
      requireApprovalForMutations: Boolean(policy.requireApprovalForMutations),
      allowedShellCommands: [...(policy.allowedShellCommands || [])]
    })
  };
}
