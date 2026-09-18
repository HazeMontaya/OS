use std::{fs::{File, OpenOptions}, io::{self, BufRead, BufReader, Write}, path::Path};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Event {
 TaskQueued{task_id:String,agent:String},TaskStarted{task_id:String},ToolCalled{task_id:String,tool:String},ToolCompleted{task_id:String,tool:String,success:bool},TaskCompleted{task_id:String},TaskBlocked{task_id:String,reason:String},HeartbeatStarted{agent:String},HeartbeatFinished{agent:String,status:String},RevenueStageAdvanced{opportunity_id:String,stage:String},RevenueRecorded{cents:i64,memo:String},ExpenseRecorded{cents:i64,memo:String}
}
#[derive(Clone,Debug,Default)]pub struct EventLog{events:Vec<Event>}
impl EventLog{
 pub fn push(&mut self,e:Event){self.events.push(e)}
 pub fn all(&self)->&[Event]{&self.events}
 pub fn len(&self)->usize{self.events.len()}
 pub fn append_journal(&self,path:impl AsRef<Path>)->io::Result<()> {let Some(e)=self.events.last() else{return Ok(())};let mut f=OpenOptions::new().create(true).append(true).open(path)?;writeln!(f,"{}",encode(e))}
 pub fn load_journal(path:impl AsRef<Path>)->io::Result<Self>{let f=match File::open(path){Ok(f)=>f,Err(e) if e.kind()==io::ErrorKind::NotFound=>return Ok(Self::default()),Err(e)=>return Err(e)};let mut l=Self::default();for line in BufReader::new(f).lines(){if let Some(e)=decode(&line?){l.events.push(e)}}Ok(l)}
}
fn esc(s:&str)->String{s.replace('\\',"\\\\").replace('\t',"\\t").replace('\n',"\\n").replace('\r',"\\r")}
fn unesc(s:&str)->String{let mut o=String::new();let mut c=s.chars();while let Some(x)=c.next(){if x=='\\'{match c.next(){Some('t')=>o.push('\t'),Some('n')=>o.push('\n'),Some('r')=>o.push('\r'),Some('\\')=>o.push('\\'),Some(y)=>{o.push('\\');o.push(y)},None=>o.push('\\')}}else{o.push(x)}}o}
fn encode(e:&Event)->String{match e{
 Event::TaskQueued{task_id,agent}=>format!("TaskQueued\t{}\t{}",esc(task_id),esc(agent)),
 Event::TaskStarted{task_id}=>format!("TaskStarted\t{}",esc(task_id)),Event::ToolCalled{task_id,tool}=>format!("ToolCalled\t{}\t{}",esc(task_id),esc(tool)),
 Event::ToolCompleted{task_id,tool,success}=>format!("ToolCompleted\t{}\t{}\t{}",esc(task_id),esc(tool),success),
 Event::TaskCompleted{task_id}=>format!("TaskCompleted\t{}",esc(task_id)),Event::TaskBlocked{task_id,reason}=>format!("TaskBlocked\t{}\t{}",esc(task_id),esc(reason)),
 Event::HeartbeatStarted{agent}=>format!("HeartbeatStarted\t{}",esc(agent)),Event::HeartbeatFinished{agent,status}=>format!("HeartbeatFinished\t{}\t{}",esc(agent),esc(status)),
 Event::RevenueStageAdvanced{opportunity_id,stage}=>format!("RevenueStageAdvanced\t{}\t{}",esc(opportunity_id),esc(stage)),
 Event::RevenueRecorded{cents,memo}=>format!("RevenueRecorded\t{}\t{}",cents,esc(memo)),Event::ExpenseRecorded{cents,memo}=>format!("ExpenseRecorded\t{}\t{}",cents,esc(memo))}}
fn decode(line:&str)->Option<Event>{let mut p=line.split('\t');let k=p.next()?;let u=|x:Option<&str>|x.map(unesc);Some(match k{
 "TaskQueued"=>Event::TaskQueued{task_id:u(p.next())?,agent:u(p.next())?},"TaskStarted"=>Event::TaskStarted{task_id:u(p.next())?},"ToolCalled"=>Event::ToolCalled{task_id:u(p.next())?,tool:u(p.next())?},
 "ToolCompleted"=>Event::ToolCompleted{task_id:u(p.next())?,tool:u(p.next())?,success:p.next()?.parse().ok()?},"TaskCompleted"=>Event::TaskCompleted{task_id:u(p.next())},
 "TaskBlocked"=>Event::TaskBlocked{task_id:u(p.next())?,reason:u(p.next())?},"HeartbeatStarted"=>Event::HeartbeatStarted{agent:u(p.next())?},"HeartbeatFinished"=>Event::HeartbeatFinished{agent:u(p.next())?,status:u(p.next())?},
 "RevenueStageAdvanced"=>Event::RevenueStageAdvanced{opportunity_id:u(p.next())?,stage:u(p.next())?},"RevenueRecorded"=>Event::RevenueRecorded{cents:p.next()?.parse().ok()?,memo:u(p.next())?},"ExpenseRecorded"=>Event::ExpenseRecorded{cents:p.next()?.parse().ok()?,memo:u(p.next())},_=>return None})}
#[cfg(test)]mod tests{use super::*;#[test]fn journal_roundtrip(){let path=std::env::temp_dir().join(format!("haze-events-{}.log",std::process::id()));let mut l=EventLog::default();l.push(Event::RevenueRecorded{cents:42,memo:"a\tb".into()});l.append_journal(&path).unwrap();let loaded=EventLog::load_journal(&path).unwrap();assert_eq!(loaded.all(),l.all());let _=std::fs::remove_file(path);}}