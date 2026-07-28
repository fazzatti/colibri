extern crate std;

use crate::{
    contains, contains_bytes, expected_client_data, PasskeyAccount, PasskeyAccountClient,
    PasskeyError, PasskeySignature, RP_ID,
};
use p256::ecdsa::{signature::hazmat::PrehashSigner, Signature, SigningKey};
use soroban_sdk::{vec, Bytes, BytesN, Env, IntoVal};

const PRIVATE_KEY: [u8; 32] = [
    0x51, 0x9b, 0x42, 0x3d, 0x71, 0x5f, 0x8b, 0x58, 0x1f, 0x4f, 0xa8, 0xee, 0x59, 0xf4, 0x77, 0x1a,
    0x5b, 0x44, 0xc8, 0x13, 0x0b, 0x4e, 0x3e, 0xac, 0xca, 0x54, 0xa5, 0x6d, 0xda, 0x72, 0xb4, 0x64,
];

fn setup() -> (Env, soroban_sdk::Address, SigningKey, BytesN<32>) {
    let env = Env::default();
    let signing_key = SigningKey::from_bytes((&PRIVATE_KEY).into()).unwrap();
    let encoded = signing_key.verifying_key().to_encoded_point(false);
    let public_key: [u8; 65] = encoded.as_bytes().try_into().unwrap();
    let id = env.register(PasskeyAccount, (BytesN::from_array(&env, &public_key),));
    let payload = BytesN::from_array(&env, &[7; 32]);
    (env, id, signing_key, payload)
}

fn assertion(env: &Env, signing_key: &SigningKey, payload: &BytesN<32>) -> PasskeySignature {
    let rp_hash = env
        .crypto()
        .sha256(&Bytes::from_slice(env, RP_ID))
        .to_array();
    let mut authenticator_data = Bytes::from_array(env, &rp_hash);
    authenticator_data.push_back(0x05);
    authenticator_data.extend_from_array(&[0, 0, 0, 0]);
    let client_data_json = expected_client_data(env, &payload.to_array());
    let client_hash = env.crypto().sha256(&client_data_json).to_array();
    let mut signed = authenticator_data.clone();
    signed.extend_from_array(&client_hash);
    let digest = env.crypto().sha256(&signed).to_array();
    let signature: Signature = signing_key.sign_prehash(&digest).unwrap();
    let signature_bytes: [u8; 64] = signature.to_bytes().into();
    PasskeySignature {
        authenticator_data,
        client_data_json,
        signature: BytesN::from_array(env, &signature_bytes),
    }
}

fn check(
    env: &Env,
    account: &soroban_sdk::Address,
    payload: &BytesN<32>,
    signature: &PasskeySignature,
) -> Result<(), Result<PasskeyError, soroban_sdk::InvokeError>> {
    env.try_invoke_contract_check_auth::<PasskeyError>(
        account,
        payload,
        signature.clone().into_val(env),
        &vec![env],
    )
}

#[test]
fn accepts_valid_webauthn_assertion() {
    let (env, account, signing_key, payload) = setup();
    let signature = assertion(&env, &signing_key, &payload);
    assert_eq!(check(&env, &account, &payload, &signature), Ok(()));
    let client = PasskeyAccountClient::new(&env, &account);
    assert_eq!(client.address, account);
    assert_eq!(client.public_key().len(), 65);
}

#[test]
fn byte_searches_reject_empty_or_oversized_needles() {
    let env = Env::default();
    let empty = Bytes::new(&env);
    let short = Bytes::from_slice(&env, b"x");
    let long = Bytes::from_slice(&env, b"long");
    assert!(!contains(&short, b""));
    assert!(!contains(&short, b"long"));
    assert!(!contains_bytes(&short, &empty));
    assert!(!contains_bytes(&short, &long));
}

#[test]
fn rejects_authenticator_shape_rp_and_flags() {
    let (env, account, signing_key, payload) = setup();
    let valid = assertion(&env, &signing_key, &payload);
    let mut short = valid.clone();
    short.authenticator_data = Bytes::from_slice(&env, b"short");
    assert_eq!(
        check(&env, &account, &payload, &short),
        Err(Ok(PasskeyError::InvalidAuthenticatorData))
    );

    let mut rp = valid.clone();
    rp.authenticator_data.set(0, 0);
    assert_eq!(
        check(&env, &account, &payload, &rp),
        Err(Ok(PasskeyError::InvalidRpId))
    );

    let mut presence = valid.clone();
    presence.authenticator_data.set(32, 0x04);
    assert_eq!(
        check(&env, &account, &payload, &presence),
        Err(Ok(PasskeyError::UserPresenceRequired))
    );

    let mut verification = valid;
    verification.authenticator_data.set(32, 0x01);
    assert_eq!(
        check(&env, &account, &payload, &verification),
        Err(Ok(PasskeyError::UserVerificationRequired))
    );
}

#[test]
fn rejects_client_data_mutations() {
    let (env, account, signing_key, payload) = setup();
    let valid = assertion(&env, &signing_key, &payload);
    for (json, error) in [
        (
            b"{\"type\":\"wrong\",\"challenge\":\"x\",\"origin\":\"https://colibri.test\"}"
                .as_slice(),
            PasskeyError::InvalidClientDataType,
        ),
        (
            b"{\"type\":\"webauthn.get\",\"challenge\":\"x\",\"origin\":\"https://wrong.test\"}"
                .as_slice(),
            PasskeyError::InvalidOrigin,
        ),
        (
            b"{\"type\":\"webauthn.get\",\"challenge\":\"wrong\",\"origin\":\"https://colibri.test\"}"
                .as_slice(),
            PasskeyError::InvalidChallenge,
        ),
    ] {
        let mut changed = valid.clone();
        changed.client_data_json = Bytes::from_slice(&env, json);
        assert_eq!(
            check(&env, &account, &payload, &changed),
            Err(Ok(error))
        );
    }

    let mut malformed = valid;
    let mut json = malformed.client_data_json.clone();
    json.push_back(b' ');
    malformed.client_data_json = json;
    assert_eq!(
        check(&env, &account, &payload, &malformed),
        Err(Ok(PasskeyError::InvalidClientData))
    );
}

#[test]
fn rejects_wrong_signature() {
    let (env, account, signing_key, payload) = setup();
    let mut signature = assertion(&env, &signing_key, &payload);
    signature
        .signature
        .set(0, signature.signature.get(0).unwrap() ^ 1);
    assert!(check(&env, &account, &payload, &signature).is_err());
}
