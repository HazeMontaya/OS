use os_runtime::RuntimeCatalog;

fn main() {
    let runtime = RuntimeCatalog::with_defaults();
    let snapshot = runtime.snapshot();
    println!("OS developer diagnostics");
    println!(
        "platform: {} / {}",
        snapshot.platform, snapshot.architecture
    );
    println!("agents: {}", snapshot.agent_count);
    println!("tools: {}", snapshot.tool_count);
    println!("automations: {}", snapshot.automation_count);
    println!("surfaces: {}", snapshot.surfaces.join(", "));
}
