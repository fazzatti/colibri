#![no_std]

use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contracterror, contractimpl, contracttype,
    crypto::Hash,
    Address, Env, Vec,
};

#[contracttype]
enum DataKey {
    NestedDelegates,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidDelegateCount = 1,
    UnknownDelegate = 2,
}

/// A reusable custom-account node that delegates authorization to one or more
/// addresses. Because every configured delegate can be another instance of
/// this contract, callers can compose arbitrary recursive CAP-71 topologies.
#[contract]
pub struct RecursiveDelegateAccount;

#[contractimpl]
impl RecursiveDelegateAccount {
    pub fn __constructor(env: Env, nested_delegates: Vec<Address>) {
        env.storage()
            .instance()
            .set(&DataKey::NestedDelegates, &nested_delegates);
    }

    pub fn nested_delegates(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::NestedDelegates)
            .expect("nested delegates are initialized")
    }
}

#[contractimpl]
impl CustomAccountInterface for RecursiveDelegateAccount {
    type Signature = ();
    type Error = Error;

    fn __check_auth(
        env: Env,
        _signature_payload: Hash<32>,
        _signature: (),
        _auth_contexts: Vec<Context>,
    ) -> Result<(), Error> {
        let supplied = env.custom_account().get_delegated_signers();
        let expected = Self::nested_delegates(env.clone());

        if supplied.len() != expected.len() {
            return Err(Error::InvalidDelegateCount);
        }

        for delegate in supplied.iter() {
            let mut found = false;
            for expected_delegate in expected.iter() {
                if delegate == expected_delegate {
                    found = true;
                    break;
                }
            }
            if !found {
                return Err(Error::UnknownDelegate);
            }
            env.custom_account().delegate_auth(&delegate);
        }

        Ok(())
    }
}

#[cfg(test)]
mod test {
    use super::{RecursiveDelegateAccount, RecursiveDelegateAccountClient};
    use soroban_sdk::{testutils::Address as _, vec, Address, Env};

    #[test]
    fn stores_one_nested_delegate() {
        let env = Env::default();
        let delegate = Address::generate(&env);
        let account = env.register(RecursiveDelegateAccount, (vec![&env, delegate.clone()],));
        let client = RecursiveDelegateAccountClient::new(&env, &account);

        assert_eq!(client.nested_delegates(), vec![&env, delegate]);
    }

    #[test]
    fn stores_multiple_nested_delegates() {
        let env = Env::default();
        let first = Address::generate(&env);
        let second = Address::generate(&env);
        let delegates = vec![&env, first, second];
        let account = env.register(RecursiveDelegateAccount, (delegates.clone(),));
        let client = RecursiveDelegateAccountClient::new(&env, &account);

        assert_eq!(client.nested_delegates(), delegates);
    }
}
