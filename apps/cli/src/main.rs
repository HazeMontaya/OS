use os_runtime::RuntimeCatalog;

fn main() {
    let command = std::env::args().nth(1).unwrap_or_else(|| "doctor".into());
    match command.as_str() {
        "doctor" | "status" => {
            let snapshot = RuntimeCatalog::with_defaults().snapshot();
            println!(
                "{}",
                serde_json::to_string_pretty(&snapshot).expect("runtime snapshot serializes")
            );
        }
        "surfaces" => {
            for surface in RuntimeCatalog::with_defaults().snapshot().surfaces {
                println!("{surface}");
            }
        }
        _ => {
            eprintln!("usage: os-cli [doctor|status|surfaces]");
            std::process::exit(2);
        }
    }
}
