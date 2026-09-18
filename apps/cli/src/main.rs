use os_revenue::Opportunity;
use os_runtime::Runtime;
use std::io::{self, BufRead};
use std::sync::{Arc,atomic::{AtomicBool,Ordering}};
use std::thread;
use std::time::Duration;

fn main() {
    let mut runtime = Runtime::new(100_000);
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

    let cycles = runtime.run_until_stopped(&stop, Duration::from_secs(2));
    println!();
    println!("Stopped after {cycles} autonomous cycles.");
    let final_snapshot = runtime.snapshot();
    println!("events: {}", final_snapshot.events);
    println!("treasury: {} cents", final_snapshot.treasury.balance_cents);
    println!("runway: {:?}", final_snapshot.treasury.runway_days);
    println!("mode: {:?}", final_snapshot.treasury.mode);
}
