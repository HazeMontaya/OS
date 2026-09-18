use os_events::Event;
use os_runtime::Runtime;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};

fn json_escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"").replace('
', "\
").replace('\r', "\\r")
}
fn state_json(rt: &Runtime) -> String {
    let s = rt.snapshot();
    let runway = s.treasury.runway_days.map(|v| v.to_string()).unwrap_or_else(|| "null".into());
    let events: Vec<String> = rt.events.all().iter().rev().take(30).map(|e| match e {
        Event::TaskQueued{task_id,agent} => format!("task queued: {task_id} / {agent}"),
        Event::TaskStarted{task_id} => format!("task started: {task_id}"),
        Event::ToolCalled{task_id,tool} => format!("tool: {task_id} / {tool}"),
        Event::ToolCompleted{task_id,tool,success} => format!("tool done: {task_id} / {tool} / {success}"),
        Event::TaskCompleted{task_id} => format!("task completed: {task_id}"),
        Event::TaskBlocked{task_id,reason} => format!("task blocked: {task_id} / {reason}"),
        Event::HeartbeatStarted{agent} => format!("heartbeat started: {agent}"),
        Event::HeartbeatFinished{agent,status} => format!("heartbeat finished: {agent} / {status}"),
        Event::RevenueStageAdvanced{opportunity_id,stage} => format!("revenue: {opportunity_id} -> {stage}"),
        Event::RevenueRecorded{cents,memo} => format!("revenue: {cents}¢ / {memo}"),
        Event::ExpenseRecorded{cents,memo} => format!("expense: {cents}¢ / {memo}"),
    }).map(|x| json_escape(&x)).collect();
    let agents = s.agents.iter().map(|a| format!(r#"{{"id":"{}","role":"{}"}}"#,json_escape(&a.id),json_escape(&a.role))).collect::<Vec<_>>().join(",");
    format!(r#"{{"treasury":{{"balance_cents":{},"reserved_cents":{},"revenue_cents":{},"expense_cents":{},"burn_rate_cents_per_day":{},"runway_days":{},"mode":"{:?}"}}, "survival":{{"allow_experiments":{},"allow_new_workers":{},"allow_nonessential_compute":{},"max_experiment_cents":{}}},"opportunities":{},"changes":{},"events":{},"agents":[{}],"events_recent":[{}]}}"#,
        s.treasury.balance_cents,s.treasury.reserved_cents,s.treasury.revenue_cents,s.treasury.expense_cents,s.treasury.burn_rate_cents_per_day,runway, s.treasury.mode,
        s.survival.allow_experiments,s.survival.allow_new_workers,s.survival.allow_nonessential_compute,s.survival.max_experiment_cents,
        s.opportunities,s.changes,s.events,agents,events.iter().map(|x|format!(r#""{}""#,x)).collect::<Vec<_>>().join(","))
}
fn response(stream:&mut TcpStream,status:&str,content_type:&str,body:&str){
    let h=format!("HTTP/1.1 {status}\r
Content-Type: {content_type}\r
Content-Length: {}\r
Connection: close\r
\r
",body.as_bytes().len());
    let _=stream.write_all(h.as_bytes()); let _=stream.write_all(body.as_bytes());
}
fn agents_json(rt:&Runtime)->String{rt.snapshot().agents.iter().map(|a|format!(r#"{{"id":"{}","role":"{}"}}"#,json_escape(&a.id),json_escape(&a.role))).collect::<Vec<_>>().join(",")}
fn handle(mut stream:TcpStream,rt:&mut Runtime,index:&str){
    let mut buf=[0u8;8192]; let n=stream.read(&mut buf).unwrap_or(0);
    let req=String::from_utf8_lossy(&buf[..n]);
    let first=req.lines().next().unwrap_or("");
    let path=first.split_whitespace().nth(1).unwrap_or("/");
    match (first.starts_with("POST /api/tick"),path) {
        (true,_)=>{let cycle=rt.run_cycle();let body=format!(r#"{{"success":{},"kind":"{}","agent":"{}","summary":"{}"}}"#,cycle.success,json_escape(&cycle.kind),json_escape(&cycle.agent),json_escape(&cycle.summary));response(&mut stream,"200 OK","application/json",&body)}
        (_, "/api/state")=>response(&mut stream,"200 OK","application/json",&state_json(rt)),
        (_, "/api/agents")=>response(&mut stream,"200 OK","application/json",&format!("[{}]",agents_json(rt))),
        (_, "/api/health")=>response(&mut stream,"200 OK","application/json",r#"{"ok":true}"#),
        _=>response(&mut stream,"200 OK","text/html; charset=utf-8",index),
    }
}
fn main(){
    let index=include_str!("static/index.html");
    let mut runtime=Runtime::new(100_000);
    println!("HazeMontaya OS dashboard: http://127.0.0.1:8787");
    let listener=TcpListener::bind("127.0.0.1:8787").expect("bind dashboard");
    for stream in listener.incoming(){if let Ok(stream)=stream{handle(stream,&mut runtime,index)}}
}
