#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, symbol_short, Address, Env, Map, String, Symbol,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum WebAuthError {
    MissingAccount = 1,
    MissingServerAccount = 2,
}

#[contract]
pub struct WebAuthContract;

#[contractimpl]
impl WebAuthContract {
    pub fn web_auth_verify(env: Env, arguments: Map<Symbol, String>) -> Result<(), WebAuthError> {
        let account = arguments
            .get(symbol_short!("account"))
            .ok_or(WebAuthError::MissingAccount)?;
        let server = arguments
            .get(Symbol::new(&env, "web_auth_domain_account"))
            .ok_or(WebAuthError::MissingServerAccount)?;

        Address::from_string(&account).require_auth();
        Address::from_string(&server).require_auth();

        if let Some(client_domain_account) =
            arguments.get(Symbol::new(&env, "client_domain_account"))
        {
            Address::from_string(&client_domain_account).require_auth();
        }
        Ok(())
    }
}

#[cfg(test)]
mod test;
