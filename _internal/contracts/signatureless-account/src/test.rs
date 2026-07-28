extern crate std;

use crate::{SignaturelessAccount, SignaturelessError};
use soroban_sdk::{vec, BytesN, Env, IntoVal};

#[test]
fn accepts_empty_authorization() {
    let env = Env::default();
    let account = env.register(SignaturelessAccount, ());
    let payload = BytesN::from_array(&env, &[7; 32]);

    assert_eq!(
        env.try_invoke_contract_check_auth::<SignaturelessError>(
            &account,
            &payload,
            ().into_val(&env),
            &vec![&env],
        ),
        Ok(()),
    );
}
