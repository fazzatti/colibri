# #configuration parameters

CONTRACT_NAME = fungible_token_contract
NETWORK = testnet
SOURCE_ACCOUNT = admin
WASM_PATH = ../../../target/wasm32v1-none/release/$(CONTRACT_NAME).wasm
BINDINGS_DIR = ./.bindings

# scripts
UPLOAD_AND_DEPLOY_SCRIPT = ./src/deploy/upload-and-deploy.ts

CYAN = [36m
GREEN = [32m
YELLOW = [33m
BLUE = [34m
RESET = [0m

help h: 
	@echo  make build      build the contract wasm
	@echo make deploy      deploy the contract to $(NETWORK)
	@echo make bindings    generate TypeScript bindings
	@echo make clean       remove build artifacts

build:
	stellar contract build

deploy: 
	stellar contract deploy \
		--wasm $(WASM_PATH) \
		--network $(NETWORK) \
		--source-account $(SOURCE_ACCOUNT) \
		-- --recipient $(SOURCE_ACCOUNT) --owner $(SOURCE_ACCOUNT)

bindings: 
	stellar contract bindings typescript \
		--wasm $(WASM_PATH) \
		--output-dir $(BINDINGS_DIR) \
		--overwrite

clean:
	cargo clean
	rm -rf $(BINDINGS_DIR)