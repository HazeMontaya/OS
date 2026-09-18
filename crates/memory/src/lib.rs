use std::{fs::{File, OpenOptions}, io::{self, BufRead, BufReader, Write}, path::Path};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemoryEntry { pub timestamp: u64, pub agent: String, pub kind: String, pub content: String }
#[derive(Clone, Debug, Default)]
pub struct Memory { entries: Vec<MemoryEntry> }

impl Memory {
    pub fn remember(&mut self, agent: impl Into<String>, kind: impl Into<String>, content: impl Into<String>) {
        self.entries.push(MemoryEntry { timestamp: unix_seconds(), agent: agent.into(), kind: kind.into(), content: content.into() });
    }
    pub fn all(&self) -> &[MemoryEntry] { &self.entries }
    pub fn recent(&self, limit: usize) -> &[MemoryEntry] { let start=self.entries.len().saturating_sub(limit); &self.entries[start..] }

    pub fn append_journal(&self, path: impl AsRef<Path>) -> io::Result<()> {
        let Some(e)=self.entries.last() else { return Ok(()); };
        let mut file=OpenOptions::new().create(true).append(true).open(path)?;
        writeln!(file,"{}\t{}\t{}\t{}",e.timestamp,escape(&e.agent),escape(&e.kind),escape(&e.content))
    }
    pub fn load_journal(path: impl AsRef<Path>) -> io::Result<Self> {
        let file=match File::open(path){Ok(f)=>f,Err(e) if e.kind()==io::ErrorKind::NotFound=>return Ok(Self::default()),Err(e)=>return Err(e)};
        let mut memory=Self::default();
        for line in BufReader::new(file).lines() {
            let line=line?; let mut p=line.splitn(4,'\t');
            let (Some(ts),Some(agent),Some(kind),Some(content))=(p.next(),p.next(),p.next(),p.next()) else {continue};
            let Ok(timestamp)=ts.parse() else {continue};
            memory.entries.push(MemoryEntry{timestamp,agent:unescape(agent),kind:unescape(kind),content:unescape(content)});
        }
        Ok(memory)
    }
    pub fn append_jsonl(&self,path:impl AsRef<Path>)->io::Result<()> { self.append_journal(path) }
}
fn escape(s:&str)->String{s.replace('\\',"\\\\").replace('\t',"\\t").replace('\n',"\\n").replace('\r',"\\r")}
fn unescape(s:&str)->String{let mut out=String::new();let mut c=s.chars();while let Some(x)=c.next(){if x=='\\'{match c.next(){Some('t')=>out.push('\t'),Some('n')=>out.push('\n'),Some('r')=>out.push('\r'),Some('\\')=>out.push('\\'),Some(y)=>{out.push('\\');out.push(y)},None=>out.push('\\')}}else{out.push(x)}}out}
fn unix_seconds()->u64{std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()}

#[cfg(test)]mod tests{
 use super::*;
 #[test]fn stores_and_reads_recent_memory(){let mut m=Memory::default();m.remember("agent-1","observation","hello");m.remember("agent-2","observation","world");assert_eq!(m.recent(1)[0].content,"world")}
 #[test]fn journal_roundtrip(){let path=std::env::temp_dir().join(format!("haze-memory-{}.log",std::process::id()));let mut m=Memory::default();m.remember("agent-1","note","hello\nworld");m.append_journal(&path).unwrap();let loaded=Memory::load_journal(&path).unwrap();assert_eq!(loaded.all()[0],m.all()[0]);let _=std::fs::remove_file(path)}
}