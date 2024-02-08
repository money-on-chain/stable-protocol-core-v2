# MOC main protocol

Money On Chain is a decentralized protocol that balances economic forces to provide stable tokens, while also allowing collateral positions to gain margin through the absorption of market volatility.

The main components of the Money On Chain (MoC) protocol can be summarized as follows:

- *Price Provider*: MoC relies on off-chain oracles to provide asset prices. Although not part of this repository, Oracles are an sciential part of this system, see more of Moc Oracle solution in [Amphiraos-Oracle](https://github.com/money-on-chain/Amphiraos-Oracle) and [OMoC Decentralized Oracle](https://github.com/money-on-chain/OMoC-Decentralized-Oracle).
- *Core*: A set of contracts chained heritage that maintains the system state, enforce business rules, and enable users to interact with the protocol. In addition to an external contract *MocCoreExpansion* to which delegates calls are forwarded to overcome the 24kb contract size limit.
- *Token Pegged (TP)*: TP contracts are RC20 tokens that track the value of certain external assets. They are "pegged" to the value of the underlying asset. There can be multiple TP contracts within a single MoC Core solution.
- *Token Collateral (TC)*: TC is also an RC20 contract that represents the collateral of the system. It absorbs fluctuations in the exchange rate between the collateral asset itself and the pegged assets.
- *Moc Queue*: Moc Queue is a deferring mechanism that imposes a block based delay on each Operation, getting them queued to later on be executed on batches following FIFO order.

## Basic architecture

![basic architecture](./resources/basic-architecture.png?raw=true "basic architecture")

Moc main protocol allows two different implementation options depending on the collateral asset/s (CA) you choose:

- *Moc CA Coinbase*: it uses the network underlining asset, coinbase as collateral asset.
- *Moc CA RC20*: it uses a single RC20 Token as collateral asset.

## Public actions

We distinguish three types of interactions to be performed on the SC:

- *View actions*: methods to query system state variables
- *User actions*: methods oriented to MoC's wider user base, allowing them to interact with Tokens and Investment instruments.
- *Process actions*: methods that allow the system to evolve under time and/or Price rules
  
Let's explore this last two in more detail.

### User actions

Users can mint and redeem their desired tokens with a variety of methods and combinations, depending on the system state. Besides network fees, they'll need to cover both the platform and execution fees.

System state is ruled by the global Coverage value, and it's relation with the Target Coverage (Cobj) of each Pegged Token.

- Above target coverage
- Below target coverage
- Bellow protected Threshold
- Below Liquidation threshold (*)

  (*) If coverage falls below last threshold (currently 1.04) and liquidation is enabled, the contracts are locked allowing*only* the redemption of remaining TPs at the last available price.
  Although TP Tokens can still be transferred freely, CT on the other hand is permanently paused, as it has lost all of its value.
  This state is irreversible, once the liquidation state is achieved on the contract, there is no coming back even if the price and/or coverage recovers.

  | operation | > ctargCA | < ctargCA | < protThrld |
  | :---      | :----:  | :---: | :---: |
  | mintTC |✓|✓|✗|
  | redeemTC |✓|✗|✗|
  | mintTP |✓|✗|✗|
  | redeemTP |✓|✓|✗|
  | mintTCandTP |✓|✓|✓|
  | redeemTCandTP |✓|✓|✓|
  | swapTPforTP |✓|(*)|✗|
  | swapTPforTC |✓|✓|✗|
  | swapTCforTP |✓|✗|✗|

(*) depends if you are swapping from a high coverage TP to a "weaker" one, if that's the case, ctargCA is evaluated.

#### Operation Sequence

Let's explore a mint TP Operation, as a reference of the protocol mechanics and interactions:

![mint tp sequence](./resources/sequence-mint-tp.png?raw=true "mint tp sequence")

1. Bob wants to mint 10 TP using his collateral asset holdings, which cost 10 times less than TP.
2. Bob sends approval for CA Token to MocCore, with the amount he is willing to spend. In this case he sends 105, the extra 5 is to cover platform fees and to account for any price slippage variation when the operation is processed.
3. Bob registers a mintTP operation on MocCore, asking for 10 TP, he also sends the corresponding coinbase amount to cover the mint TP execution fee. Vendor address in this case is assumed to be `0x0` to simplify.
4. MocCore executes a transferFrom of Bob's CA to itself, locking the qACmax funds.
5. MocCore queues the Operation on MocQueue, which will emit an *OperationQueued* event with the assigned OperationId.
6. After *minOperWaitingBlk* blocks, a whitelisted executor executes the queue.
7. MocQueue loops through all the Operations, calling MocCore with the corresponding params for each one.
8. Bob's mintTP is processed by MocCore, it emits *TPMinted* event with the operation results. And the 10 TP are minted to him.
9. MocQueue emits an *OperationExecuted* event with the *OperationId*.
10. Alter loop ends, the sum of all execution fees is transferred to the executor provided account.

#### Moc Vendors

Another way that users can interact with the protocol is through *Vendors*, each operation type has a vendor parameter that accepts a vendor address, indicating he is operating the protocol though it. Using address `0x0` as vendor, indicates no vendor will be used.

Vendors, can pre-defined a markup that will be applied on top of the platform fee using *MocVendors* contract.

This way, integrators have a way to earn a profit while boosting and enhancing dapp user experience; and users can freely choose to use either the protocol directly or pay this extra markup for the services the different Vendors provide.

### Process actions

#### Queue execution

Whitelisted accounts, can execute the queue at any time, if there are Orders ready to be processed (*minOperWaitingBlk* condition met) it will execute them sequentially, and collect the execution fee reserved by each one.

There are two possible outcomes for each Operation, that will yield the corresponding events, either the Order is valid and will emit the corresponding Operation Type event (for example, a *mintTC*, will generate a *TCMinted* event), or the execution fails, emitting *OperationError*  or *UnhandledError*. Note that a failed Operation, won't block the queue nor revert the transaction, but the user's funds will be unlocked and returned to the user.

#### Settlement

Settlements are a time[^1] based recurrent process which relies on block number to allow/reject execution. Currently, in contrast to previous models, settlement only executes success fee payments.

[^1]: based on a given number of blocks dependent on the network's mining rate.

#### Update Emas

The system relies on price moving averages to smooth out any price spike for coverage calculations, for this, it uses the[Exponential_smoothing](https://en.wikipedia.org/wiki/Exponential_smoothing) technic as approximation. Which needs for periodic calculation on each og the pegged prices.

#### System Liquidation

If the TP/Collateral price drops drastically, an none of the incentive mechanisms along the coverage dropping prevents it to cross the liquidation threshold (currently: coverage < 1.04) the system will enter the liquidation state and, if liquidation enabled, the liquidation function will be available to be executed.

Although there is an specific method to evaluate liquidation (`evalLiquidation`), to guarantee this process is executed, the same logic is evaluated and, if needed, executed in every MoC state changing method.

Liquidation process will invalidate the TC Token (it cannot be transfer any more) as a precaution measure as it has no more Assets backing it, it has no value. Users can redeem all of their TPs at once, valued at the liquidation price.

#### Collateral injection

Collateral injection is the operation of adding collateral to the system's reserves without minting Collateral Tokens. This come in handy when reserves are running low and there is a need of Stable token minting.

This injection is made by sending funds directly to the main MoC Contract on the coinbase option, this will result in executing the fallback function which will update the internal values according to the sent value. For ERC20 solutions, and extra method will be needed to be execute, `refreshACBalance()`.
