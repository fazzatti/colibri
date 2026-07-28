#![no_std]

use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contracterror, contractimpl, Env, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum SignaturelessError {
    Rejected = 1,
}

#[contract]
pub struct SignaturelessAccount;

#[contractimpl]
impl CustomAccountInterface for SignaturelessAccount {
    type Signature = ();
    type Error = SignaturelessError;

    fn __check_auth(
        _env: Env,
        _signature_payload: soroban_sdk::crypto::Hash<32>,
        _signature: (),
        _auth_contexts: Vec<Context>,
    ) -> Result<(), SignaturelessError> {
        Ok(())
    }
}

#[cfg(test)]
mod test;
