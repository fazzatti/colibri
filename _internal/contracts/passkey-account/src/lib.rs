#![no_std]

use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contracterror, contractimpl, contracttype, Bytes, BytesN, Env, Vec,
};

const RP_ID: &[u8] = b"colibri.test";
const TYPE_FIELD: &[u8] = b"\"type\":\"webauthn.get\"";
const ORIGIN_FIELD: &[u8] = b"\"origin\":\"https://colibri.test\"";
const CLIENT_DATA_PREFIX: &[u8] = b"{\"type\":\"webauthn.get\",\"challenge\":\"";
const CLIENT_DATA_SUFFIX: &[u8] = b"\",\"origin\":\"https://colibri.test\",\"crossOrigin\":false}";
const BASE64URL: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PasskeySignature {
    pub authenticator_data: Bytes,
    pub client_data_json: Bytes,
    pub signature: BytesN<64>,
}

#[contracttype]
enum DataKey {
    PublicKey,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum PasskeyError {
    InvalidAuthenticatorData = 1,
    InvalidRpId = 2,
    UserPresenceRequired = 3,
    UserVerificationRequired = 4,
    InvalidClientDataType = 5,
    InvalidOrigin = 6,
    InvalidChallenge = 7,
    InvalidClientData = 8,
}

#[contract]
pub struct PasskeyAccount;

fn contains(haystack: &Bytes, needle: &[u8]) -> bool {
    if needle.is_empty() || haystack.len() < needle.len() as u32 {
        return false;
    }
    let final_start = haystack.len() - needle.len() as u32;
    let mut start = 0;
    while start <= final_start {
        let mut index = 0;
        while index < needle.len() as u32
            && haystack.get_unchecked(start + index) == needle[index as usize]
        {
            index += 1;
        }
        if index == needle.len() as u32 {
            return true;
        }
        start += 1;
    }
    false
}

fn contains_bytes(haystack: &Bytes, needle: &Bytes) -> bool {
    if needle.len() == 0 || haystack.len() < needle.len() {
        return false;
    }
    let final_start = haystack.len() - needle.len();
    let mut start = 0;
    while start <= final_start {
        let mut index = 0;
        while index < needle.len()
            && haystack.get_unchecked(start + index) == needle.get_unchecked(index)
        {
            index += 1;
        }
        if index == needle.len() {
            return true;
        }
        start += 1;
    }
    false
}

fn push_base64url(value: &[u8; 32], output: &mut Bytes) {
    let mut index = 0;
    while index + 3 <= value.len() {
        let word = ((value[index] as u32) << 16)
            | ((value[index + 1] as u32) << 8)
            | value[index + 2] as u32;
        output.push_back(BASE64URL[((word >> 18) & 63) as usize]);
        output.push_back(BASE64URL[((word >> 12) & 63) as usize]);
        output.push_back(BASE64URL[((word >> 6) & 63) as usize]);
        output.push_back(BASE64URL[(word & 63) as usize]);
        index += 3;
    }
    let word = (value[index] as u32) << 16 | (value[index + 1] as u32) << 8;
    output.push_back(BASE64URL[((word >> 18) & 63) as usize]);
    output.push_back(BASE64URL[((word >> 12) & 63) as usize]);
    output.push_back(BASE64URL[((word >> 6) & 63) as usize]);
}

fn expected_client_data(env: &Env, payload: &[u8; 32]) -> Bytes {
    let mut data = Bytes::from_slice(env, CLIENT_DATA_PREFIX);
    push_base64url(payload, &mut data);
    data.extend_from_slice(CLIENT_DATA_SUFFIX);
    data
}

fn same_prefix(value: &Bytes, expected: &[u8; 32]) -> bool {
    let mut index = 0;
    while index < 32 {
        if value.get_unchecked(index) != expected[index as usize] {
            return false;
        }
        index += 1;
    }
    true
}

#[contractimpl]
impl PasskeyAccount {
    pub fn __constructor(env: Env, public_key: BytesN<65>) {
        env.storage()
            .instance()
            .set(&DataKey::PublicKey, &public_key);
    }

    pub fn public_key(env: Env) -> BytesN<65> {
        env.storage().instance().get(&DataKey::PublicKey).unwrap()
    }
}

#[contractimpl]
impl CustomAccountInterface for PasskeyAccount {
    type Signature = PasskeySignature;
    type Error = PasskeyError;

    fn __check_auth(
        env: Env,
        signature_payload: soroban_sdk::crypto::Hash<32>,
        signature: PasskeySignature,
        _auth_contexts: Vec<Context>,
    ) -> Result<(), PasskeyError> {
        if signature.authenticator_data.len() != 37 {
            return Err(PasskeyError::InvalidAuthenticatorData);
        }
        let rp_hash = env
            .crypto()
            .sha256(&Bytes::from_slice(&env, RP_ID))
            .to_array();
        if !same_prefix(&signature.authenticator_data, &rp_hash) {
            return Err(PasskeyError::InvalidRpId);
        }
        let flags = signature.authenticator_data.get_unchecked(32);
        if flags & 0x01 == 0 {
            return Err(PasskeyError::UserPresenceRequired);
        }
        if flags & 0x04 == 0 {
            return Err(PasskeyError::UserVerificationRequired);
        }

        let payload = signature_payload.to_array();
        let expected = expected_client_data(&env, &payload);
        if signature.client_data_json != expected {
            if !contains(&signature.client_data_json, TYPE_FIELD) {
                return Err(PasskeyError::InvalidClientDataType);
            }
            if !contains(&signature.client_data_json, ORIGIN_FIELD) {
                return Err(PasskeyError::InvalidOrigin);
            }
            let mut challenge = Bytes::from_slice(&env, b"\"challenge\":\"");
            push_base64url(&payload, &mut challenge);
            challenge.push_back(b'"');
            if !contains_bytes(&signature.client_data_json, &challenge) {
                return Err(PasskeyError::InvalidChallenge);
            }
            return Err(PasskeyError::InvalidClientData);
        }

        let client_data_hash = env.crypto().sha256(&signature.client_data_json);
        let mut signed_data = signature.authenticator_data.clone();
        signed_data.extend_from_array(&client_data_hash.to_array());
        let digest = env.crypto().sha256(&signed_data);
        let public_key = env
            .storage()
            .instance()
            .get::<_, BytesN<65>>(&DataKey::PublicKey)
            .unwrap();
        env.crypto()
            .secp256r1_verify(&public_key, &digest, &signature.signature);
        Ok(())
    }
}

#[cfg(test)]
mod test;
