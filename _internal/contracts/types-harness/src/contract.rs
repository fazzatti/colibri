use soroban_sdk::{
    assert_with_error, contract, contracterror, contractimpl, contracttype, Address, Bytes,
    Duration, Env, Map, String, Symbol, Timepoint, Val, Vec, I256, U256,
};

#[contract]
pub struct TypesHarness;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct User {
    pub id: u32,
    pub name: String,
    pub tags: Vec<Symbol>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NestedType {
    pub depth: u32,
    pub width: u32,
    pub nested: Vec<NestedType>,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    FailedWithCustomError = 123,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Choice {
    None,
    Count(u32),
    Label(String),
}

#[contractimpl]
impl TypesHarness {
    // Unit
    pub fn void(_env: Env) {}

    // Scalars
    pub fn bool(_env: Env, v: bool) -> bool {
        v
    }
    pub fn u32(_env: Env, v: u32) -> u32 {
        v
    }
    pub fn i32(_env: Env, v: i32) -> i32 {
        v
    }
    pub fn u64(_env: Env, v: u64) -> u64 {
        v
    }
    pub fn i64(_env: Env, v: i64) -> i64 {
        v
    }
    pub fn timepoint(_env: Env, v: Timepoint) -> Timepoint {
        v
    }
    pub fn duration(_env: Env, v: Duration) -> Duration {
        v
    }
    pub fn u128(_env: Env, v: u128) -> u128 {
        v
    }
    pub fn i128(_env: Env, v: i128) -> i128 {
        v
    }
    pub fn u256(_env: Env, v: U256) -> U256 {
        v
    }
    pub fn i256(_env: Env, v: I256) -> I256 {
        v
    }

    // Bytes, strings, symbols, address
    pub fn bytes(_env: Env, v: Bytes) -> Bytes {
        v
    }
    pub fn string(_env: Env, v: String) -> String {
        v
    }
    pub fn symbol(_env: Env, v: Symbol) -> Symbol {
        v
    }
    pub fn address(_env: Env, v: Address) -> Address {
        v
    }

    // Containers with concrete element types
    pub fn vec_i128(_env: Env, v: Vec<i128>) -> Vec<i128> {
        v
    }
    pub fn vec_address(_env: Env, v: Vec<Address>) -> Vec<Address> {
        v
    }
    pub fn map_sym_i128(_env: Env, m: Map<Symbol, i128>) -> Map<Symbol, i128> {
        m
    }
    pub fn map_sym_vec_addr(_env: Env, m: Map<Symbol, Vec<Address>>) -> Map<Symbol, Vec<Address>> {
        m
    }

    // Dynamic containers for mixed types and UDTs
    pub fn any(_env: Env, v: Val) -> Val {
        v
    }
    pub fn vec_any(_env: Env, v: Vec<Val>) -> Vec<Val> {
        v
    }
    pub fn map_sym_any(_env: Env, m: Map<Symbol, Val>) -> Map<Symbol, Val> {
        m
    }

    // UDT struct and enum
    pub fn user(_env: Env, u: User) -> User {
        u
    }
    pub fn choice(_env: Env, c: Choice) -> Choice {
        c
    }
    pub fn vec_user(_env: Env, v: Vec<User>) -> Vec<User> {
        v
    }
    pub fn map_addr_user(_env: Env, m: Map<Address, User>) -> Map<Address, User> {
        m
    }

    // Option types
    pub fn option_u32(_env: Env, v: Option<u32>) -> Option<u32> {
        v
    }
    pub fn option_address(_env: Env, v: Option<Address>) -> Option<Address> {
        v
    }
    pub fn option_user(_env: Env, v: Option<User>) -> Option<User> {
        v
    }

    // Nested UDT
    pub fn nested_type(_env: Env, v: NestedType) -> NestedType {
        v
    }

    pub fn flatten_nested_type(env: Env, v: NestedType) -> Vec<NestedType> {
        let mut flat_vec = Vec::new(&env);
        flatten_helper(&env, &v, &mut flat_vec);
        flat_vec
    }

    // Error handling
    pub fn fail(env: Env, should_fail: bool) {
        assert_with_error!(env, !should_fail, Error::FailedWithCustomError);
    }
}

fn flatten_helper(env: &Env, v: &NestedType, acc: &mut Vec<NestedType>) {
    acc.push_back(v.clone());
    for child in v.nested.iter() {
        flatten_helper(env, &child, acc);
    }
}
