// The environment variables are loaded in hardhat.config.ts
const mnemonic = process.env.MNEMONIC;
if (!mnemonic) {
  throw new Error("Please set your MNEMONIC in a .env file");
}

module.exports = {
  istanbulReporter: ["html", "lcov", "cobertura"],
  providerOptions: {
    mnemonic,
  },
  skipFiles: ["mocks", "test", "echidna"],
  // to don't get stack too deep: https://github.com/sc-forks/solidity-coverage/blob/master/docs/faq.md#running-out-of-stack
  configureYulOptimizer: true,
  solcOptimizerDetails: {
    yul: true,
    yulDetails: {
      optimizerSteps:
        "dhfoDgvlfnTUtnIf" + // None of these can make stack problems worse
        "[" +
        "xa[r]EsLM" + // Turn into SSA and simplify
        "CTUtTOntnfDIl" + // Perform structural simplification
        "Ll" + // Simplify again
        "Vl [j]" + // Reverse SSA
        // should have good "compilability" property here.

        "Tpel" + // Run functional expression inliner
        "xa[rl]" + // Prune a bit more in SSA
        "xa[r]L" + // Turn into SSA again and simplify
        "gvf" + // Run full inliner
        "CTUa[r]LSsTFOtfDna[r]Il" + // SSA plus simplify
        "]" +
        "jml[jl] VTOl jml : fDnTO",
    },
  },
  mocha: {
    grep: /.*gas estimation.*/i,
    invert: true,
  },
};
