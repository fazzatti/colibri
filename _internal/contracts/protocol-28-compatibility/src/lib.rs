#![no_std]

use soroban_sdk::{contract, contractevent, contractimpl, contracttype, Address, Env};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct State {
    pub a: Option<u32>,
    pub b: u32,
    pub c: Option<u32>,
}

#[contractevent(topics = ["update"])]
pub struct SparseUpdate {
    pub a: Option<u32>,
    pub b: u32,
}

#[contractevent(topics = ["update"], sparse = false)]
pub struct DenseUpdate {
    pub a: Option<u32>,
    pub b: u32,
}

// SEP-57 0.4.0 event declarations share the transfer prefix deliberately.
#[contractevent]
pub struct Transfer {
    #[topic]
    pub from: Address,
    #[topic]
    pub to: Address,
    pub amount: i128,
}

#[contractevent(topics = ["transfer"])]
pub struct MuxedTransfer {
    #[topic]
    pub from: Address,
    #[topic]
    pub to: Address,
    pub to_muxed_id: Option<u64>,
    pub amount: i128,
}

#[contract]
pub struct Protocol28Compatibility;

#[contractimpl]
impl Protocol28Compatibility {
    pub fn echo(state: State) -> State {
        state
    }

    pub fn updates(env: Env, a: Option<u32>, b: u32) {
        SparseUpdate { a, b }.publish(&env);
        DenseUpdate { a, b }.publish(&env);
    }

    pub fn transfers(env: Env, from: Address, to: Address, id: Option<u64>) {
        Transfer {
            from: from.clone(),
            to: to.clone(),
            amount: 7,
        }
        .publish(&env);
        MuxedTransfer {
            from,
            to,
            to_muxed_id: id,
            amount: 7,
        }
        .publish(&env);
    }
}

#[cfg(test)]
mod test {
    extern crate std;
    use super::*;
    use soroban_sdk::{
        testutils::Events,
        xdr::{ContractEventBody, Limits, ScVal, WriteXdr},
    };

    #[test]
    fn sparse_and_dense_wire_evidence() {
        let env = Env::default();
        let id = env.register(Protocol28Compatibility, ());
        let client = Protocol28CompatibilityClient::new(&env, &id);
        client.updates(&None, &7);
        let mut events = env.events().all().events().to_vec();
        let address = Address::from_str(
            &env,
            "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        );
        client.transfers(&address, &address, &None);
        events.extend_from_slice(env.events().all().events());
        client.transfers(&address, &address, &Some(42));
        events.extend_from_slice(env.events().all().events());
        assert_eq!(events.len(), 6);
        for event in &events {
            let ContractEventBody::V0(body) = &event.body;
            let hex = |bytes: std::vec::Vec<u8>| -> std::string::String {
                bytes
                    .iter()
                    .map(|byte| std::format!("{byte:02x}"))
                    .collect()
            };
            std::println!(
                "COLIBRI_EVENT {} {}",
                hex(ScVal::Vec(Some(body.topics.clone().into()))
                    .to_xdr(Limits::none())
                    .unwrap()),
                hex(body.data.to_xdr(Limits::none()).unwrap())
            );
        }
        assert_eq!(
            client
                .echo(&State {
                    a: None,
                    b: 7,
                    c: None
                })
                .b,
            7
        );
    }
}
