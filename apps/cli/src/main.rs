use os_governance::DecisionClass;
use os_revenue::Opportunity;
use os_execution::ToolRequest;
use std::path::PathBuf;

fn main() {
    let mut runtime = os_runtime::Runtime::new(100_000);
    runtime.register_opportunity(Opportunity {
        id: "bootstrap-product".into(),
        name: "Bootstrap Product".into(),
        hypothesis: "A small validated digital service can fund the runtime.".into(),
        expected_revenue_cents: 25_000,
        expected_cost_cents: 2_000,
        confidence_bps: 6_000,
    });

    let snapshot = runtime.snapshot();
    println!("HazeMontaya OS");
    println!("agents: {}", snapshot.agents.len());
    println!("treasury: {} cents", snapshot.treasury.balance_cents);
    println!("runway: {:?}", snapshot.treasury.runway_days);
    println!("mode: {:?}", snapshot.treasury.mode);
    println!("survival: {:?}", snapshot.survival);

    if let Some(index) = runtime.next_revenue_project() {
        println!("selected opportunity: {}", runtime.opportunities[index].opportunity.name);
        println!("stage: {:?}", runtime.advance_best_revenue_project());
    }

    let result = runtime.heartbeat(
        "agent-02",
        DecisionClass::ReadOnly,
        0,
        ToolRequest::RunCommand {
            program: "rustc".into(),
            args: vec!["--version".into()],
        },
        false,
    );
    println!("heartbeat: {:?} — {}", result.status, result.message);
    println!("events: {}", runtime.snapshot().events);
}
