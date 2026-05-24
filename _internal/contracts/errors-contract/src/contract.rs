use soroban_sdk::{
    assert_with_error, contract, contracterror, contractimpl, symbol_short, Address, Env, String,
    Symbol,
};

#[contract]
pub struct ErrorsContract;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// Minimal documented contract error used to verify error doc extraction.
    One = 1,
    /// The requested operation cannot continue because the test contract emitted error code 265.
    TwoHundredSixtyFive = 265,
    /// Cross-contract diagnostic path used when verifying larger contract error codes.
    ThreeThousandFourHundredSeventySeven = 3477,
    SixtyFiveThousandFiveHundredThirtyFive = 65_535,
    SevenHundredThousandOne = 700_001,
}

#[contractimpl]
impl ErrorsContract {
    pub fn trigger_cross_contract_by_code(
        env: Env,
        target_contract: Address,
        error_code: u32,
    ) -> Symbol {
        let client = ErrorsContractClient::new(&env, &target_contract);
        client.trigger_by_code(&error_code)
    }

    pub fn trigger_cross_contract_generic(
        env: Env,
        target_contract: Address,
        message: String,
    ) -> Symbol {
        let client = ErrorsContractClient::new(&env, &target_contract);
        client.trigger_generic(&message)
    }

    pub fn trigger_cross_rethrow_code(
        env: Env,
        target_contract: Address,
        target_error_code: u32,
        rethrow_error_code: u32,
    ) -> Symbol {
        let client = ErrorsContractClient::new(&env, &target_contract);

        match client.try_trigger_by_code(&target_error_code) {
            Ok(_) => symbol_short!("ok"),
            Err(_) => Self::trigger_by_code(env, rethrow_error_code),
        }
    }

    pub fn trigger_by_code(env: Env, error_code: u32) -> Symbol {
        match error_code {
            0 => return symbol_short!("ok"),
            1 => assert_with_error!(env, false, Error::One),
            265 => assert_with_error!(env, false, Error::TwoHundredSixtyFive),
            3477 => assert_with_error!(env, false, Error::ThreeThousandFourHundredSeventySeven),
            65_535 => assert_with_error!(env, false, Error::SixtyFiveThousandFiveHundredThirtyFive),
            700_001 => assert_with_error!(env, false, Error::SevenHundredThousandOne),
            _ => {
                let message = String::from_str(&env, "unmapped error code");
                Self::trigger_generic(env, message);
            }
        }

        symbol_short!("err")
    }

    pub fn trigger_generic(_env: Env, message: String) -> Symbol {
        const MAX_MESSAGE_BYTES: usize = 128;

        let message_len = message.len() as usize;
        if message_len > MAX_MESSAGE_BYTES {
            panic!("unstructured errors contract panic: message too long")
        }

        let mut message_bytes = [0u8; MAX_MESSAGE_BYTES];
        message.copy_into_slice(&mut message_bytes[..message_len]);
        let message =
            core::str::from_utf8(&message_bytes[..message_len]).unwrap_or("invalid utf-8 message");

        panic!("unstructured errors contract panic: {}", message)
    }
}
