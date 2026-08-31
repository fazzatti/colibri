#![no_std]

use soroban_sdk::{contract, contractimpl, BytesN, Env};

#[contract]
pub struct BuildVerificationUpgradeable;

#[contractimpl]
impl BuildVerificationUpgradeable {
    /// Identifies which fixture Wasm currently backs a deployed instance.
    pub fn version() -> u32 {
        if cfg!(feature = "v2") {
            2
        } else {
            1
        }
    }

    /// Replaces this instance's executable with an already uploaded Wasm.
    ///
    /// This intentionally has no authorization policy because it exists only
    /// as an ephemeral integration fixture. Production upgradeable contracts
    /// must protect this operation with their own administrator policy.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

#[cfg(test)]
mod test {
    use super::{BuildVerificationUpgradeable, BuildVerificationUpgradeableClient};
    use soroban_sdk::Env;

    #[test]
    fn reports_the_compiled_fixture_version() {
        let env = Env::default();
        let contract = env.register(BuildVerificationUpgradeable, ());
        let client = BuildVerificationUpgradeableClient::new(&env, &contract);

        assert_eq!(client.version(), if cfg!(feature = "v2") { 2 } else { 1 });
    }
}
