#![no_std]

use soroban_sdk::{
    contract, contractevent, contractimpl, token::TokenInterface, Address, Env, MuxedAddress,
    String,
};
use stellar_tokens::fungible::Base;

#[contract]
pub struct Sep41Token;

#[contractevent(topics = ["mint"])]
pub struct MintWithReference {
    #[topic]
    pub to: Address,
    pub amount: i128,
    pub reference: String,
}

#[contractimpl]
impl Sep41Token {
    pub fn __constructor(env: &Env, recipient: Address) {
        Base::set_metadata(
            env,
            7,
            String::from_str(env, "Colibri SEP-41 Test Token"),
            String::from_str(env, "CLB41"),
        );
        Base::mint(env, &recipient, 1_000_000_000);
    }

    pub fn mint_with_reference(env: &Env, to: Address, amount: i128, reference: String) {
        Base::mint(env, &to, amount);
        MintWithReference {
            to,
            amount,
            reference,
        }
        .publish(env);
    }
}

#[contractimpl]
impl TokenInterface for Sep41Token {
    fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        Base::allowance(&env, &from, &spender)
    }

    fn approve(env: Env, from: Address, spender: Address, amount: i128, live_until_ledger: u32) {
        Base::approve(&env, &from, &spender, amount, live_until_ledger);
    }

    fn balance(env: Env, id: Address) -> i128 {
        Base::balance(&env, &id)
    }

    fn transfer(env: Env, from: Address, to: MuxedAddress, amount: i128) {
        Base::transfer(&env, &from, &to, amount);
    }

    fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        Base::transfer_from(&env, &spender, &from, &to, amount);
    }

    fn burn(env: Env, from: Address, amount: i128) {
        Base::burn(&env, &from, amount);
    }

    fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        Base::burn_from(&env, &spender, &from, amount);
    }

    fn decimals(env: Env) -> u32 {
        Base::decimals(&env)
    }

    fn name(env: Env) -> String {
        Base::name(&env)
    }

    fn symbol(env: Env) -> String {
        Base::symbol(&env)
    }
}
