# MOC main protocol

Money On Chain is a decentralized protocol that balances economic forces to provide stable tokens, while also allowing collateral positions to gain margin through the absorption of market volatility.

The main components of the Money On Chain (MoC) protocol can be summarized as follows:

- *Price Provider*: MoC relies on off-chain oracles to provide asset prices. Although not part of this repository, Oracles are an sciential part of this system, see more of Moc Oracle solution in [Amphiraos-Oracle](https://github.com/money-on-chain/Amphiraos-Oracle).
- *Core*: A set of contracts that maintain the system state, enforce business rules, and enable users to interact with the protocol.
- *Token Pegged (TP)*: TP contracts are RC20 tokens that track the value of certain external assets. They are "pegged" to the value of the underlying asset. There can be multiple TP contracts within a single MoC solution.
- *Token Collateral (TC)*: TC is also an RC20 contract that represents the collateral of the system. It absorbs fluctuations in the exchange rate between the collateral asset and the pegged asset.

## Basic architecture

![basic architecture](./resources/basic-arquitecture.png?raw=true "basic architecture")

Moc main protocol allows two different implementation options depending on the collateral asset/s (CA) you choose:

- *Moc CA Coinbase*: it uses the network underlining asset, coinbase as collateral asset.
- *Moc CA RC20*: it uses a single RC20 Token as collateral asset.

Leveraged by this last option, you can use a wrapped Token to bundle assets in a "bag" and use a third option, Moc CA Wrapper. That would allow for this Wrapped Token to act as collateral for *Moc CA RC20*, also allowing the use of the underlying assets to interact directly with the system.

![basic architecture](./resources/moc-ca-wrapper.png?raw=true "basic architecture")

### Collateral Bag implementation using MocWrapper

The collateral bag implementation uses RC20 tokens as collateral assets, specifically stablecoins (1:1 USD). The stablecoins used in the protocol are held in the contract we call MocWrapper. Because some of them may at some point lose their peg (i.e., the value of the coin fluctuates with respect to the dollar), we have the need to create a new token called TokenWCA that represents the percentage of ownership of the total dollar amount within the pool that an account holds. For example, if within the pool we have:

100 DoC at 1:1 USD
100 USDC at 1:0.9 USD
100 riff at 1:1 USD
The total USD amount is 290 USD, and the total supply of TokenWCA is 290 tokens, therefore the price of TokenWCA is 1:1. If a user holds 145 tokens, this is equivalent to 145 USD. If one of the stablecoins depreciates in value, for example, riff falls to 1:0.9 USD:

100 DoC at 1:1 USD
100 USDC at 1:0.9 USD
100 riff at 1:0.9 USD
The total USD amount is 280 USD, but since the total supply of TokenWCA is still 290 tokens, the price of TokenWCA decreases to 1:0.96, and the user who held 145 tokens now has 140 USD. This MocWrapper contract will primarily be used by the MocRC20 protocol so that a user can mint and redeem TC and TP tokens by contributing stablecoins to the collateral bag.

#### Price providers

As mentioned before, price providers are a key part of the Moc system. Without a reliable Oracle, nothing can work as designed. The Moc CA Wrapper option is no exception, but it has the peculiarity of using a token (WCAToken) as collateral, which was tailor-designed to represent a collateral "bag" of stablecoins. Each of these stablecoins is pegged to a single external asset, most likely the USD. However, even if under normal conditions the CA price should gravitate around a 1:1 ratio with the USD, that is not ubiquitous as the WCAToken has its own independent value. Therefore, when price providers for the MoCWrapper option report a price, they should do so in relation to the WCAToken, rather than the underlying asset.
To account for this, oracles will need to take an extra step to adjust the pACtp rate to the current price of the wrapped token held by the MoC Wrapper contract. They can either consult off-chain sources to obtain the spot price of the pegged token in relation to the WCAToken, or they can make an extra internal dynamic call to the wrapper contracts to determine the price. From the perspective of the MoC Core, this process is transparent, as it always receives the price as a relation to its CA, the WCAToken in this case.


#### Basics operations flows

Here we have a sequence diagram for Mint TC and Redeem TC but it is similar to the others operations
##### Mint TC

![mintTC](./resources/MocWrapper-mintTCSequence.png?raw=true "mintTC")

1. Alice wants to mint TC using DOC as the collateral asset.
2. Alice sends an approve for DOC to MocWrapper.
3. Alice sends a mintTC transaction to MocWrapper.
4. MocWrapper calculates how many TokenWAC are equivalent to that amount of DOC and mints them.
5. MocWrapper executes a transferFrom of Alice's DOC to itself.
6. MocWrapper executes the mintTC function in MocCore, sending the TokenWAC.
7. MocCore makes a transfer of TokenWAC to Moc Flow as payment for the fees.
8. MocCore inform to MocWrapper how many TokenWAC were used.
9. MocWrapper calculates how many DOC are equivalent to those TokenWAC and returns them to Alice
10. MocWrapper burns the unused TokenWAC.

##### Redeem TC

![redeemTC](./resources/MocWrapper-redeemTCSequence.png?raw=true "redeemTC")

1. Alice wants to redeem TC and receive DOC in return.
2. Alice sends an approve for TC to MocWrapper.
3. Alice sends a redeemTC transaction to MocWrapper.
4. MocWrapper executes a transferFrom of Alice's TC to itself.
5. MocWrapper executes the redeemTC function in MocCore.
6. MocCore makes a transfer of TokenWAC to Moc Flow as payment for the fees.
7. MocCore sends the equivalent TokenWAC for the redeemed TC to MocWrapper.
8. MocWrapper calculates how many DOC are equivalent to those TokenWAC.
9. MocWrapper makes a transfer of DOC to Alice
10. MocWrapper burns the TokenWAC.

## Public actions

We distinguish three types of interactions to be performed on the SC:

- *View actions*: methods to query system state variables
- *User actions*: methods oriented to MoC's wider user base, allowing them to interact with Tokens and Investment instruments.
- *Process actions*: methods that allow the system to evolve under time and/or Price rules
  
Let's explore this last two in more detail.

### User actions

Users can mint and redeem their desire tokens with a verity of methods and combinations, depending on system state.

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

### Process actions

#### Settlement

Settlements are a time[^1] based recurrent process which relies on block number to allow/reject execution. Currently, in contrast to previous models, settlement only executes success fee payments.

[^1]: based on a given number of blocks dependent on the network's mining rate.

#### Update Emas

The system relies on price moving averages to smooth out any price spike for coverage calculations, for this, it uses the[Exponential_smoothing](https://en.wikipedia.org/wiki/Exponential_smoothing) technic as approximation. Which needs for periodic calculation on each og the pegged prices.

#### System Liquidation

If the TP/Collateral price drops drastically, an none of the incentive mechanisms along the coverage dropping prevents it to cross the liquidation threshold (currently: coverage < 1.04) the system will enter the liquidation state and, if liquiadtion enabled, the liquidation function will be available to be executed.
Although there is an specific method to evaluate liquidation (`evalLiquidation`), to guarantee this process is executed, the same logic is evaluated and, if needed, executed in every MoC state changing method.
Liquidation process will invalidate the TC Token (it cannot be transfer any more) as a precaution measure as it has no more Assets backing it, it has no value. Users can redeem all of their TPs at once, valued at the liquidation price.

#### Collateral injection

Collateral injection is the operation of adding collateral to the system's reserves without minting Collateral Tokens. This come in handy when reserves are running low and there is a need of Stable token minting.

This injection is made by sending funds directly to the main MoC Contract on the coinbase option, this will result in executing the fallback function which will update the internal values according to the sent value. For ERC20 solutions, and extra method will be needed to be execute, `refreshACBalance()`.



