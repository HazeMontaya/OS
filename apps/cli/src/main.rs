fn main() {
    let runtime = os_runtime::Runtime::new(100_000);
    let s = runtime.snapshot();
    println!("HazeMontaya OS");
    println!("agents: {}", s.agents.len());
    println!("treasury: {} cents", s.treasury.balance_cents);
    println!("runway: {:?}", s.treasury.runway_days);
    println!("mode: {:?}", s.treasury.mode);
    println!("survival: {:?}", s.survival);
}
