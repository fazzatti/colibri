#![no_std]

use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contracterror, contractimpl, contracttype,
    crypto::Hash,
    token, Address, Env, Vec,
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
    InvalidAmount = 3,
}

/// A top-level custom account that owns assets and delegates authorization to
/// a caller-configured set of direct delegates.
#[contract]
pub struct DelegatedAssetAccount;

#[contractimpl]
impl DelegatedAssetAccount {
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

    pub fn withdraw(env: Env, token: Address, to: Address, amount: i128) -> Result<(), Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let account = env.current_contract_address();
        account.require_auth();
        token::Client::new(&env, &token).transfer(&account, &to, &amount);
        Ok(())
    }
}

#[contractimpl]
impl CustomAccountInterface for DelegatedAssetAccount {
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
    use super::{DelegatedAssetAccount, DelegatedAssetAccountClient, Error};
    use soroban_sdk::{testutils::Address as _, token, vec, Address, Env};

    #[test]
    fn stores_nested_delegates() {
        let env = Env::default();
        let first = Address::generate(&env);
        let second = Address::generate(&env);
        let delegates = vec![&env, first, second];
        let account = env.register(DelegatedAssetAccount, (delegates.clone(),));
        let client = DelegatedAssetAccountClient::new(&env, &account);

        assert_eq!(client.nested_delegates(), delegates);
    }

    #[test]
    fn rejects_non_positive_withdrawals_before_auth() {
        let env = Env::default();
        let delegate = Address::generate(&env);
        let account = env.register(DelegatedAssetAccount, (vec![&env, delegate],));
        let client = DelegatedAssetAccountClient::new(&env, &account);

        assert_eq!(
            client.try_withdraw(&Address::generate(&env), &Address::generate(&env), &0,),
            Err(Ok(Error::InvalidAmount))
        );
    }

    #[test]
    fn transfers_tokens_when_auth_is_mocked() {
        let env = Env::default();
        env.mock_all_auths();

        let delegate = Address::generate(&env);
        let account = env.register(DelegatedAssetAccount, (vec![&env, delegate],));
        let recipient = Address::generate(&env);
        let admin = Address::generate(&env);
        let token_contract = env.register_stellar_asset_contract_v2(admin);
        let token_client = token::Client::new(&env, &token_contract.address());
        let admin_client = token::StellarAssetClient::new(&env, &token_contract.address());
        admin_client.mint(&account, &100);

        DelegatedAssetAccountClient::new(&env, &account).withdraw(
            &token_contract.address(),
            &recipient,
            &40,
        );

        assert_eq!(token_client.balance(&account), 60);
        assert_eq!(token_client.balance(&recipient), 40);
    }
}
