use crate::{WebAuthContract, WebAuthContractClient, WebAuthError};
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    vec, Address, Env, IntoVal, Map, String, Symbol,
};

fn arguments(
    env: &Env,
    account: &Address,
    server: Option<&Address>,
    client_domain: Option<&Address>,
) -> Map<Symbol, String> {
    let mut values = Map::new(env);
    values.set(symbol_short!("account"), account.to_string());
    if let Some(server) = server {
        values.set(
            Symbol::new(env, "web_auth_domain_account"),
            server.to_string(),
        );
    }
    if let Some(client_domain) = client_domain {
        values.set(
            Symbol::new(env, "client_domain_account"),
            client_domain.to_string(),
        );
    }
    values
}

#[test]
fn requires_client_and_server_auth() {
    let env = Env::default();
    let id = env.register(WebAuthContract, ());
    let client = WebAuthContractClient::new(&env, &id);
    let account = Address::generate(&env);
    let server = Address::generate(&env);
    let args = arguments(&env, &account, Some(&server), None);

    client
        .mock_auths(&[
            MockAuth {
                address: &account,
                invoke: &MockAuthInvoke {
                    contract: &id,
                    fn_name: "web_auth_verify",
                    args: vec![&env, args.clone().into_val(&env)],
                    sub_invokes: &[],
                },
            },
            MockAuth {
                address: &server,
                invoke: &MockAuthInvoke {
                    contract: &id,
                    fn_name: "web_auth_verify",
                    args: vec![&env, args.clone().into_val(&env)],
                    sub_invokes: &[],
                },
            },
        ])
        .web_auth_verify(&args);
}

#[test]
fn requires_optional_client_domain_auth() {
    let env = Env::default();
    let id = env.register(WebAuthContract, ());
    let client = WebAuthContractClient::new(&env, &id);
    let account = Address::generate(&env);
    let server = Address::generate(&env);
    let domain = Address::generate(&env);
    let args = arguments(&env, &account, Some(&server), Some(&domain));
    env.mock_all_auths();

    client.web_auth_verify(&args);
    assert_eq!(env.auths().len(), 3);
}

#[test]
fn reports_missing_required_arguments() {
    let env = Env::default();
    let id = env.register(WebAuthContract, ());
    let client = WebAuthContractClient::new(&env, &id);
    let empty = Map::<Symbol, String>::new(&env);
    assert_eq!(
        client.try_web_auth_verify(&empty),
        Err(Ok(WebAuthError::MissingAccount))
    );

    let account = Address::generate(&env);
    let no_server = arguments(&env, &account, None, None);
    assert_eq!(
        client.try_web_auth_verify(&no_server),
        Err(Ok(WebAuthError::MissingServerAccount))
    );
}
