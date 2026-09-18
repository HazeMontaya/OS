use os_revenue::Opportunity;
use os_runtime::Runtime;
use std::io::{self, BufRead};
use std::sync::{Arc,atomic::{AtomicBool,Ordering}};
use std::thread;
use std::time::Duration;

fn main() {
    let mut runtime = Runtime::new(100_000);\n    let state = std::path::PathBuf::from(".os/state.tsv");\n    let events = std::path::PathBuf::from(".os/events.log");\n    let memory = std::path::PathBuf::from(".os/memory.log");\n    if let Err(e) = runtime.load_state(&state) { eprintln!("state recovery warning: {e}"); }
    if !runtime.opportunities.iter().any(|p| p.opportunity.id == "bootstrap-product") {
        runtime.register_opportunity(Opportunity {
            id: "bootstrap-product".into(),
            name: "Bootstrap Product".into(),
            hypothesis: "A small validated digital service can fund the runtime.".into(),
            expected_revenue_cents: 25_000,
            expected_cost_cents: 2_000,
            confidence_bps: 6_000,
        });
    }

    let snapshot = runtime.snapshot();
    println!("HazeMontaya OS");
    println!("agents: {}", snapshot.agents.len());
    println!("treasury: {} cents", snapshot.treasury.balance_cents);
    println!("runway: {:?}", snapshot.treasury.runway_days);
    println!("mode: {:?}", snapshot.treasury.mode);
    println!("survival: {:?}", snapshot.survival);
    println!();
    println!("AUTONOMOUS LOOP: running continuously.");
    println!("Type 'stop' and press Enter to stop cleanly.");

    let stop = Arc::new(AtomicBool::new(false));
    let stop_input = Arc::clone(&stop);
    thread::spawn(move || {
        let stdin = io::stdin();
        for line in stdin.lock().lines() {
            match line {
                Ok(line) if line.trim().eq_ignore_ascii_case("stop") => {
                    stop_input.store(true, Ordering::Relaxed);
                    break;
                }
                Ok(_) => {}
                Err(_) => {
                    stop_input.store(true, Ordering::Relaxed);
                    break;
                }
            }
        }
    });

    let mut cycles = 0usize;\n    while !stop.load(Ordering::Relaxed) {\n        let _ = runtime.run_cycle();\n        cycles += 1;\n        if let Err(e) = runtime.checkpoint(&state, &events, &memory) { eprintln!("checkpoint warning: {e}"); }\n        let mut waited = Duration::ZERO;\n        while waited < Duration::from_secs(2) && !stop.load(Ordering::Relaxed) {\n            let slice = (Duration::from_secs(2) - waited).min(Duration::from_millis(250));\n            thread::sleep(slice);\n            waited += slice;\n        }\n    }
    println!();
    println!("Stopped after {cycles} autonomous cycles.");
    let final_snapshot = runtime.snapshot();
    println!("events: {}", final_snapshot.events);
    println!("treasury: {} cents", final_snapshot.treasury.balance_cents);
    println!("runway: {:?}", final_snapshot.treasury.runway_days);
    println!("mode: {:?}", final_snapshot.treasury.mode);
}
