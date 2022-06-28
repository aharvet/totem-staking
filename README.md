# Totem Staking

This repo contains main 2 contracts.

1. BabyDolz: ERC 20 with a bridge role that allows to mint an burn tokens, and an upgrade mechanism for the bridge address that introduces a grace period to enable users to unexpose themselves in case they disagree with the update. The token can be freely minted with a minter role, and transfers are restricted to authorized senders and receivers.
2. Dolzchef: Staking contract that enables the owner to create staking pools for specific tokens with a number of options like deposit fee and reward per block. Users can then lock their tokens to get BabyDolz tokens as rewards.

The code is thoroughly documented.

## Environment

Hardhat has been used for that project. It is recommended that you make any hardhat command call with `npx hardhat` to use the correct version.

Make sure you rename .env.example to .env and fill its fields.

## Install packages

```
npm i
```

## Run tests

```
npm test
```

## Gas consumption report

Set the `showGasReporter` variable in `hardhat.config.js` to true to get report on gas consumption after tests.

## Get test coverage

```
npm run coverage
```
