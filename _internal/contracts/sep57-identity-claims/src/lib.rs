#![no_std]
// ABI-only regression fixture, NOT an identity or authorization implementation.
// Keep Claim in the SEP's declaration order: the Rust SDK must independently
// emit its canonical alphabetical named-field order into the Wasm specification.
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, BytesN, Env, String, Vec};

#[contracttype]
#[derive(Clone)]
pub struct Claim {
    pub topic: u32,
    pub scheme: u32,
    pub issuer: Address,
    pub signature: Bytes,
    pub data: Bytes,
    pub uri: String,
}

#[contract]
pub struct IdentityClaims;

#[contractimpl]
impl IdentityClaims {
    pub fn add_claim(
        env: Env,
        topic: u32,
        scheme: u32,
        issuer: Address,
        signature: Bytes,
        data: Bytes,
        uri: String,
    ) -> BytesN<32> {
        let _ = (topic, scheme, issuer, signature, data, uri);
        BytesN::from_array(&env, &[0; 32])
    }

    pub fn get_claim(env: Env, claim_id: BytesN<32>) -> Claim {
        let _ = claim_id;
        Claim {
            topic: 0,
            scheme: 0,
            issuer: env.current_contract_address(),
            signature: Bytes::new(&env),
            data: Bytes::new(&env),
            uri: String::from_str(&env, ""),
        }
    }

    pub fn get_claim_ids_by_topic(env: Env, topic: u32) -> Vec<BytesN<32>> {
        let _ = topic;
        Vec::new(&env)
    }
}
