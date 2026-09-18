use os_events::Event;
use os_runtime::Runtime;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};

fn json_escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', "\\n").replace('\r', "\\r")
}
fn response(stream: &mut TcpStream, status: &str, content_type: &str, body: &str) {
    let header = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.as_bytes().len()
    );
    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(body.as_bytes());
}
fn agents_json(rt: &Runtime) -> String {
    rt.snapshot().agents.iter().map(|a| format!(
        "{{\"id\":\"{}\",\"role\":\"{}\"}}", json_escape(&a.id), json_escape(&a.role)
    )).collect::<Vec<_>>().join(",")
}
fn state_json(rt: &Runtime) -> String {
    let s = rt.snapshot();
    let runway = s.treasury.runway_days.map(|v| v.to_string()).unwrap_or_else(|| "null".into());
    let events = rt.events.all().iter().rev().take(30).map(|e| {
        let line = match e {
            Event::TaskQueued { task_id, agent } => format!("task queued: {task_id} / {agent}"),
            Event::TaskStarted { task_id } => format!("task started: {task_id}"),
            Event::ToolCalled { task_id, tool } => format!("tool: {task_id} / {tool}"),
            Event::ToolCompleted { task_id, tool, success } => format!("tool done: {task_id} / {tool} / {success}"),
            Event::TaskCompleted { task_id } => format!("task completed: {task_id}"),
            Event::TaskBlocked { task_id, reason } => format!("task blocked: {task_id} / {reason}"),
            Event::HeartbeatStarted { agent } => format!("heartbeat started: {agent}"),
            Event::HeartbeatFinished { agent, status } => format!("heartbeat finished: {agent} / {status}"),
            Event::AgentHandoff { work_item_id, from_agent, to_agent } => format!("handoff: {work_item_id} / {from_agent} -> {to_agent}"),
            Event::ModelRouted { task_kind, provider, model } => format!("model routed: {task_kind} / {provider} / {model}"),
            Event::ModelFailed { task_kind, provider, model, reason } => format!("model failed: {task_kind} / {provider} / {model} / {reason}"),
            Event::RevenueStageAdvanced { opportunity_id, stage } => format!("revenue: {opportunity_id} -> {stage}"),
            Event::RevenueRecorded { cents, memo } => format!("revenue: {cents}¢ / {memo}"),
            Event::ExpenseRecorded { cents, memo } => format!("expense: {cents}¢ / {memo}"),
        };
        format!("\"{}\"", json_escape(&line))
    }).collect::<Vec<_>>().join(",");
    format!(
        "{{\"treasury\":{{\"balance_cents\":{},\"reserved_cents\":{},\"revenue_cents\":{},\"expense_cents\":{},\"burn_rate_cents_per_day\":{},\"runway_days\":{},\"mode\":\"{:?}\"}},\"survival\":{{\"allow_experiments\":{},\"allow_new_workers\":{},\"allow_nonessential_compute\":{},\"max_experiment_cents\":{}}},\"opportunities\":{},\"changes\":{},\"events\":{},\"goals\":{},\"ready_goals\":{},\"active_goals\":{},\"completed_goals\":{},\"agents\":[{}],\"events_recent\":[{}]}}",
        s.treasury.balance_cents, s.treasury.reserved_cents, s.treasury.revenue_cents, s.treasury.expense_cents,
        s.treasury.burn_rate_cents_per_day, runway, s.treasury.mode,
        s.survival.allow_experiments, s.survival.allow_new_workers, s.survival.allow_nonessential_compute,
        s.survival.max_experiment_cents, s.opportunities, s.changes, s.events, s.goals, s.ready_goals, s.active_goals, s.completed_goals, agents_json(rt), events
    )
}


fn goals_json(rt:&Runtime)->String{
    rt.goals.goals.values().map(|g|format!("{{\"id\":\"{}\",\"title\":\"{}\",\"kind\":\"{:?}\",\"status\":\"{:?}\",\"action\":{},\"owner_agent\":{}}}",json_escape(&g.id),json_escape(&g.title),g.kind,g.status,g.action.map(|a|format!("\"{:?}\"",a)).unwrap_or_else(||"null".into()),g.owner_agent.as_ref().map(|a|format!("\"{}\"",json_escape(a))).unwrap_or_else(||"null".into()))).collect::<Vec<_>>().join(",")
}

fn workflow_json(rt: &Runtime) -> String {
    let nodes = rt.work_graph.nodes.values().map(|n| format!(
        "{{\"id\":\"{}\",\"label\":\"{}\",\"kind\":\"{:?}\",\"agent_id\":{},\"class\":\"{:?}\"}}",
        json_escape(&n.id), json_escape(&n.label),
        n.kind, n.agent_id.as_ref().map(|v| format!("\"{}\"", json_escape(v))).unwrap_or_else(|| "null".into()),
        n.class
    )).collect::<Vec<_>>().join(",");
    let edges = rt.work_graph.edges.iter().map(|e| format!(
        "{{\"from\":\"{}\",\"to\":\"{}\",\"max_hops\":{}}}",
        json_escape(&e.from), json_escape(&e.to), e.max_hops
    )).collect::<Vec<_>>().join(",");
    format!("{{\"nodes\":[{}],\"edges\":[{}],\"work_items\":{},\"workspaces\":{},\"decisions\":{}}}",
        nodes, edges, rt.work_items.len(), rt.workspaces.all().count(), rt.decisions.len())
}


fn system_json(rt: &Runtime) -> String {
    let entities = rt.system_model.entities.values().map(|e| format!(
        "{{\"id\":\"{}\",\"kind\":\"{:?}\",\"label\":\"{}\",\"evidence\":{}}}",
        json_escape(&e.id), e.kind, json_escape(&e.label), e.evidence_ids.len()
    )).collect::<Vec<_>>().join(",");
    let relations = rt.system_model.relations.iter().map(|r| format!(
        "{{\"from\":\"{}\",\"relation\":\"{}\",\"to\":\"{}\",\"evidence\":{}}}",
        json_escape(&r.from), json_escape(&r.relation), json_escape(&r.to), r.evidence_ids.len()
    )).collect::<Vec<_>>().join(",");
    format!("{{\"entities\":[{}],\"relations\":[{}],\"evidence\":{}}}",
        entities, relations, rt.system_model.evidence.len())
}

fn models_json(rt: &Runtime) -> String {
    let models = rt.model_router.candidates().iter().map(|c| format!(
        "{{\"provider\":\"{}\",\"model\":\"{}\",\"healthy\":{},\"quota_tokens\":{},\"cost_micros\":{},\"latency_ms\":{}}}",
        json_escape(&c.provider), json_escape(&c.model), c.healthy, c.remaining_quota_tokens,
        c.estimated_cost_micros, c.latency_ms
    )).collect::<Vec<_>>().join(",");
    format!("[{}]", models)
}

fn handle(mut stream: TcpStream, rt: &mut Runtime, index: &str) {
    let mut buf = [0u8; 8192];
    let n = stream.read(&mut buf).unwrap_or(0);
    let request = String::from_utf8_lossy(&buf[..n]);
    let first = request.lines().next().unwrap_or("");
    let mut parts = first.split_whitespace();
    let method = parts.next().unwrap_or("");
    let path = parts.next().unwrap_or("/");
    match (method, path) {
        ("GET", "/api/state") => response(&mut stream, "200 OK", "application/json", &state_json(rt)),
        ("GET", "/api/agents") => response(&mut stream, "200 OK", "application/json", &format!("[{}]", agents_json(rt))),
        ("GET", "/api/workflow") => response(&mut stream, "200 OK", "application/json", &workflow_json(rt)),
        ("GET", "/api/models") => response(&mut stream, "200 OK", "application/json", &models_json(rt)),
        ("GET", "/api/system") => response(&mut stream, "200 OK", "application/json", &system_json(rt)),
        ("GET", "/api/goals") => response(&mut stream, "200 OK", "application/json", &format!("[{}]", goals_json(rt))),
        ("GET", "/api/health") => response(&mut stream, "200 OK", "application/json", "{\"ok\":true}"),
        ("POST", "/api/tick") => {
            let cycle = rt.run_cycle();
            let body = format!(
                "{{\"success\":{},\"kind\":\"{}\",\"agent\":\"{}\",\"summary\":\"{}\"}}",
                cycle.success, json_escape(&cycle.kind), json_escape(&cycle.agent), json_escape(&cycle.summary)
            );
            response(&mut stream, "200 OK", "application/json", &body);
        }
        _ => response(&mut stream, "200 OK", "text/html; charset=utf-8", index),
    }
}
fn main() {
    let index = include_str!("../static/index.html");
    let mut runtime = Runtime::new(100_000);
    println!("HazeMontaya OS dashboard: http://127.0.0.1:8787");
    let listener = TcpListener::bind("127.0.0.1:8787").expect("bind dashboard");
    for stream in listener.incoming() {
        if let Ok(stream) = stream { handle(stream, &mut runtime, index); }
    }
}
