//! Emit declarations with JSR's pinned deno_graph fast-check implementation.
//! Input is an already-resolved, local graph. This process never fetches or publishes.
use anyhow::{Context, Result, bail};
use deno_ast::{EmitOptions, SourceMap, SourceMapOption, emit};
use deno_graph::source::{MemoryLoader, ResolutionKind, ResolveError, Resolver};
use deno_graph::{
    BuildFastCheckTypeGraphOptions, BuildOptions, GraphKind, ModuleGraph, ModuleSpecifier, Range,
    WorkspaceFastCheckOption, WorkspaceMember, resolve_import,
};
use serde::Deserialize;
use std::{
    collections::BTreeMap,
    io::{self, Read},
};

#[derive(Deserialize)]
struct Input {
    roots: Vec<ModuleSpecifier>,
    packages: Vec<WorkspaceMember>,
    modules: BTreeMap<String, String>,
    externals: Vec<String>,
    resolutions: BTreeMap<String, BTreeMap<String, String>>,
}

#[derive(Debug)]
struct Resolutions(BTreeMap<String, BTreeMap<String, String>>);
impl Resolver for Resolutions {
    fn resolve(
        &self,
        text: &str,
        range: &Range,
        _: ResolutionKind,
    ) -> Result<ModuleSpecifier, ResolveError> {
        let mapped = self
            .0
            .get(range.specifier.as_str())
            .and_then(|items| items.get(text));
        Ok(resolve_import(
            mapped.map(String::as_str).unwrap_or(text),
            &range.specifier,
        )?)
    }
}

fn main() -> Result<()> {
    let mut json = String::new();
    io::stdin().read_to_string(&mut json)?;
    let input: Input = serde_json::from_str(&json)?;
    let resolver = Resolutions(input.resolutions);
    let mut loader = MemoryLoader::default();
    for (specifier, source) in &input.modules {
        loader.add_source_with_text(specifier, source);
    }
    for specifier in &input.externals {
        loader.add_external_source(specifier);
    }
    let mut graph = ModuleGraph::new(GraphKind::All);
    futures::executor::block_on(graph.build(
        input.roots.clone(),
        vec![],
        &loader,
        BuildOptions {
            resolver: Some(&resolver),
            passthrough_jsr_specifiers: true,
            ..Default::default()
        },
    ));
    graph.valid().context("Invalid declaration input graph")?;
    graph.build_fast_check_type_graph(BuildFastCheckTypeGraphOptions {
        fast_check_dts: true,
        resolver: Some(&resolver),
        workspace_fast_check: WorkspaceFastCheckOption::Enabled(&input.packages),
        ..Default::default()
    });
    let mut declarations = BTreeMap::new();
    let mut diagnostics = BTreeMap::new();
    for module in graph.modules().filter_map(|module| module.js()) {
        if let Some(diagnostics) = module.fast_check_diagnostics() {
            bail!(
                "Fast-check failed for {}: {:?}",
                module.specifier,
                diagnostics
            );
        }
        let Some(fast) = module.fast_check_module() else {
            continue;
        };
        let dts = fast
            .dts
            .as_ref()
            .context("Missing fast-check declarations")?;
        if !dts.diagnostics.is_empty() {
            diagnostics.insert(
                module.specifier.to_string(),
                format!("{:?}", dts.diagnostics),
            );
        }
        let source_map =
            SourceMap::single(module.specifier.clone(), module.source.text.to_string());
        let output = emit(
            (&dts.program).into(),
            &dts.comments.as_single_threaded(),
            &source_map,
            &EmitOptions {
                source_map: SourceMapOption::None,
                ..Default::default()
            },
        )?;
        declarations.insert(module.specifier.to_string(), output.text);
    }
    for root in input.roots {
        if !declarations.contains_key(root.as_str()) {
            bail!("No declaration emitted for {root}");
        }
    }
    println!(
        "{}",
        serde_json::to_string(
            &serde_json::json!({ "declarations": declarations, "diagnostics": diagnostics })
        )?
    );
    Ok(())
}
