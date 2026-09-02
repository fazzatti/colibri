#![no_std]

use soroban_sdk::{contract, contractimpl, BytesN, Env, String};

#[contract]
pub struct ExecutableRefManager;

#[contractimpl]
impl ExecutableRefManager {
    pub fn set(env: Env, tag: String, wasm_hash: BytesN<32>) {
        env.executable_refs().set(&tag, &wasm_hash);
    }

    pub fn get(env: Env, tag: String) -> Option<BytesN<32>> {
        env.executable_refs().get(&tag)
    }
}

#[cfg(test)]
mod test {
    use super::{ExecutableRefManager, ExecutableRefManagerClient};
    use soroban_sdk::{Env, String};

    const TARGET_WASM: &[u8] =
        include_bytes!("../../../build-verification/fixtures/upgradeable-v1.wasm");

    #[test]
    fn stores_and_resolves_an_executable_reference() {
        let env = Env::default();
        let contract_id = env.register(ExecutableRefManager, ());
        let client = ExecutableRefManagerClient::new(&env, &contract_id);
        let tag = String::from_str(&env, "stable");
        let wasm_hash = env.deployer().upload_contract_wasm(TARGET_WASM);

        client.set(&tag, &wasm_hash);

        assert_eq!(client.get(&tag), Some(wasm_hash));
    }
}
