#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CustomerStage { Lead, Qualified, Proposal, Active, Churned }

#[derive(Clone, Debug)]
pub struct Customer {
    pub id: String,
    pub name: String,
    pub contact: String,
    pub stage: CustomerStage,
}

#[derive(Clone, Debug)]
pub struct Invoice {
    pub id: String,
    pub customer_id: String,
    pub amount_cents: i64,
    pub currency: String,
    pub paid: bool,
}

#[derive(Clone, Debug)]
pub enum PaymentIntent {
    CreateInvoice { invoice: Invoice },
    MarkPaid { invoice_id: String },
}

pub trait PaymentProvider: Send + Sync {
    fn execute(&self, intent: &PaymentIntent) -> Result<String, String>;
}

#[derive(Clone, Debug, Default)]
pub struct ManualApprovalPayments;
impl PaymentProvider for ManualApprovalPayments {
    fn execute(&self, _intent: &PaymentIntent) -> Result<String, String> {
        Err("payment execution requires explicit owner-approved provider integration".into())
    }
}

#[derive(Clone, Debug, Default)]
pub struct Commerce {
    pub customers: Vec<Customer>,
    pub invoices: Vec<Invoice>,
}
impl Commerce {
    pub fn add_customer(&mut self, customer: Customer) { self.customers.push(customer); }
    pub fn issue_invoice(&mut self, invoice: Invoice) -> Result<(), String> {
        if invoice.amount_cents <= 0 { return Err("invoice amount must be positive".into()); }
        if self.customers.iter().all(|c| c.id != invoice.customer_id) { return Err("unknown customer".into()); }
        self.invoices.push(invoice);
        Ok(())
    }
    pub fn outstanding_cents(&self) -> i64 {
        self.invoices.iter().filter(|i| !i.paid).map(|i| i.amount_cents).sum()
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn invoice_requires_customer() {
        let mut c = Commerce::default();
        assert!(c.issue_invoice(Invoice{id:"i".into(),customer_id:"missing".into(),amount_cents:100,currency:"EUR".into(),paid:false}).is_err());
    }
}
