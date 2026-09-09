#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, symbol_short, Env, Symbol,
};

/// Status of the demonstration counter.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CounterStatus {
    Empty = 0,
    Counting = 1,
}

/// Current count and its status.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CounterSummary {
    pub count: u32,
    pub status: CounterStatus,
}

/// Errors returned by the demonstration counter.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum CounterError {
    /// The increment must be greater than zero.
    InvalidIncrement = 1,
    /// The counter cannot exceed 100.
    LimitExceeded = 2,
}

/// Emitted after the counter changes; action can be used in event filters.
#[contractevent(topics = ["count_changed"])]
pub struct CountChanged {
    #[topic]
    pub action: Symbol,
    pub old_count: u32,
    pub new_count: u32,
}

/// A deliberately small fixture for inspecting generated clients.
#[contract]
pub struct BindingsDemo;

#[contractimpl]
impl BindingsDemo {
    /// Read the current count, initially zero.
    pub fn get_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&symbol_short!("count"))
            .unwrap_or(0)
    }

    /// Increase the count by a positive amount, up to a maximum of 100.
    pub fn increment(env: Env, by: u32) -> Result<u32, CounterError> {
        if by == 0 {
            return Err(CounterError::InvalidIncrement);
        }
        let old_count = Self::get_count(env.clone());
        let new_count = old_count
            .checked_add(by)
            .filter(|value| *value <= 100)
            .ok_or(CounterError::LimitExceeded)?;
        env.storage()
            .instance()
            .set(&symbol_short!("count"), &new_count);
        CountChanged {
            action: symbol_short!("increment"),
            old_count,
            new_count,
        }
        .publish(&env);
        Ok(new_count)
    }

    /// Read a structured summary with a named status enum.
    pub fn summary(env: Env) -> CounterSummary {
        let count = Self::get_count(env);
        CounterSummary {
            count,
            status: if count == 0 {
                CounterStatus::Empty
            } else {
                CounterStatus::Counting
            },
        }
    }

    /// Return a summary unchanged to exercise named input and output types.
    pub fn echo_summary(summary: CounterSummary) -> CounterSummary {
        summary
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Events, vec, IntoVal, Map, Val};

    #[test]
    fn counter_state_errors_and_events() {
        let env = Env::default();
        let id = env.register(BindingsDemo, ());
        let client = BindingsDemoClient::new(&env, &id);
        assert_eq!(client.get_count(), 0);
        assert_eq!(client.increment(&3), 3);
        let mut data = Map::<Symbol, Val>::new(&env);
        data.set(Symbol::new(&env, "old_count"), 0u32.into_val(&env));
        data.set(Symbol::new(&env, "new_count"), 3u32.into_val(&env));
        assert_eq!(
            env.events().all(),
            vec![
                &env,
                (
                    id,
                    (
                        Symbol::new(&env, "count_changed"),
                        symbol_short!("increment")
                    )
                        .into_val(&env),
                    data.into_val(&env),
                )
            ]
        );
        let summary = CounterSummary {
            count: 3,
            status: CounterStatus::Counting,
        };
        assert_eq!(client.summary(), summary);
        assert_eq!(client.echo_summary(&summary), summary);
        assert_eq!(
            client.try_increment(&0),
            Err(Ok(CounterError::InvalidIncrement))
        );
        assert_eq!(
            client.try_increment(&100),
            Err(Ok(CounterError::LimitExceeded))
        );
        assert_eq!(client.get_count(), 3);
    }
}
