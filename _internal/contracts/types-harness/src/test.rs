#![cfg(test)]
use crate::contract::{Choice, TypesHarness, TypesHarnessClient, User};
use soroban_sdk::{
    symbol_short, testutils::Address as _, Address, Bytes, Duration, Env, IntoVal, Map, String,
    Symbol, Timepoint, TryFromVal, Val, Vec, I256, U256,
};

#[test]
fn roundtrip_scalars_and_simple() {
    let env = Env::default();
    let id = env.register(TypesHarness, ());
    let client = TypesHarnessClient::new(&env, &id);

    assert_eq!(client.bool(&true), true);
    assert_eq!(client.u32(&7), 7);
    assert_eq!(client.i32(&-7), -7);
    assert_eq!(client.u64(&77), 77);
    assert_eq!(client.i64(&-77), -77);

    let tp = Timepoint::from_unix(&env, 1_725_000_000);
    let du = Duration::from_seconds(&env, 3600);
    assert_eq!(client.timepoint(&tp), tp);
    assert_eq!(client.duration(&du), du);

    assert_eq!(client.u128(&123u128), 123u128);
    assert_eq!(client.i128(&-123i128), -123i128);
    let u256 = U256::from_u128(&env, 1_000_000_000_000_000_000u128);
    let i256 = I256::from_i128(&env, -1_000_000_000_000_000_000i128);
    assert_eq!(client.u256(&u256), u256);
    assert_eq!(client.i256(&i256), i256);

    let bytes = Bytes::from_slice(&env, b"hi");
    let s = String::from_str(&env, "hello");
    let sym = symbol_short!("ok");
    let addr = Address::generate(&env);
    assert_eq!(client.bytes(&bytes), bytes);
    assert_eq!(client.string(&s), s);
    assert_eq!(client.symbol(&sym), sym);
    assert_eq!(client.address(&addr), addr);
}

#[test]
fn roundtrip_containers() {
    let env = Env::default();
    let id = env.register(TypesHarness, ());
    let client = TypesHarnessClient::new(&env, &id);

    let vi = Vec::from_array(&env, [1i128, 2, 3]);
    assert_eq!(client.vec_i128(&vi), vi);

    let a1 = Address::generate(&env);
    let a2 = Address::generate(&env);
    let va = Vec::from_array(&env, [a1.clone(), a2.clone()]);
    assert_eq!(client.vec_address(&va), va);

    let mut m1: Map<Symbol, i128> = Map::new(&env);
    m1.set(symbol_short!("x"), 10);
    m1.set(symbol_short!("y"), 20);
    assert_eq!(client.map_sym_i128(&m1), m1);

    let mut m2: Map<Symbol, Vec<Address>> = Map::new(&env);
    m2.set(symbol_short!("owners"), va.clone());
    assert_eq!(client.map_sym_vec_addr(&m2), m2);

    let any_sym: Val = symbol_short!("any").into_val(&env);
    let any_vec: Vec<Val> = Vec::from_array(&env, [1i128.into_val(&env), any_sym.clone()]);
    let mut any_map: Map<Symbol, Val> = Map::new(&env);
    any_map.set(symbol_short!("k"), any_sym.clone());

    let out_any = client.any(&any_sym);
    let out_any_sym: Symbol = Symbol::try_from_val(&env, &out_any).unwrap();
    assert_eq!(out_any_sym, symbol_short!("any"));

    let out_vec = client.vec_any(&any_vec);
    assert_eq!(out_vec.len(), 2);
    let v0: Val = out_vec.get(0).unwrap();
    let v0_i: i128 = i128::try_from_val(&env, &v0).unwrap();
    assert_eq!(v0_i, 1i128);
    let v1: Val = out_vec.get(1).unwrap();
    let v1_sym: Symbol = Symbol::try_from_val(&env, &v1).unwrap();
    assert_eq!(v1_sym, symbol_short!("any"));

    let out_map = client.map_sym_any(&any_map);
    let got = out_map.get(symbol_short!("k")).unwrap();
    let got_sym: Symbol = Symbol::try_from_val(&env, &got).unwrap();
    assert_eq!(got_sym, symbol_short!("any"));
}

#[test]
fn roundtrip_udts() {
    let env = Env::default();
    let id = env.register(TypesHarness, ());
    let client = TypesHarnessClient::new(&env, &id);

    let user = User {
        id: 1,
        name: String::from_str(&env, "Fifo"),
        tags: Vec::from_array(&env, [symbol_short!("dev"), symbol_short!("sdk")]),
    };
    assert_eq!(client.user(&user), user.clone());

    let choice_a = Choice::None;
    let choice_b = Choice::Count(9);
    let choice_c = Choice::Label(String::from_str(&env, "ok"));
    assert_eq!(client.choice(&choice_a), choice_a);
    assert_eq!(client.choice(&choice_b), choice_b);
    assert_eq!(client.choice(&choice_c), choice_c);

    let vu = Vec::from_array(&env, [user.clone()]);
    assert_eq!(client.vec_user(&vu), vu);

    let mut mu: Map<Address, User> = Map::new(&env);
    let addr = Address::generate(&env);
    mu.set(addr, user.clone());
    assert_eq!(client.map_addr_user(&mu), mu);
}
