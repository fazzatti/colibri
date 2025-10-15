#![cfg(test)]

extern crate std;

use soroban_sdk::{ testutils::Address as _, Address, Env, String };

use crate::contract::{ ColibriToken, ColibriTokenClient };

#[test]
fn initial_state() {
    let env = Env::default();

    let contract_addr = env.register(ColibriToken, (Address::generate(&env),Address::generate(&env)));
    let client = ColibriTokenClient::new(&env, &contract_addr);

    assert_eq!(client.name(), String::from_str(&env, "ColibriToken"));
}

// Add more tests bellow
