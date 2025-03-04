const { Account, Contract, ec, constants, RpcProvider } = require('starknet');
const { DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');
const { SigningStargateClient, coins } = require('@cosmjs/stargate');
const axios = require('axios');

// Placeholder values - replace with actual ones
// Minimal ERC20 ABI with just the transfer function
const USDC_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      {
        name: "recipient",
        type: "felt"
      },
      {
        name: "amount",
        type: "Uint256"
      }
    ],
    outputs: [
      {
        name: "success",
        type: "felt"
      }
    ],
    stateMutability: "external"
  }
];

const USDC_ADDRESS = '0x053b40A647CEDfca6cA84f542A0fe36736031905A9639a7f19A3C1e66bFd5080'; // Replace with actual USDC contract address on Starknet
const privateKey = process.env.AGENT_WALLET_STARKNET_PRIVATE_KEY;
const accountAddress = process.env.AGENT_WALLET_STARKNET_ADDRESS;

class BlockchainService {
  async transferUSDC(blockchain, toAddress, amount) {
    try {
      if (blockchain === 'Starknet') {
        const provider = new RpcProvider({ nodeUrl: constants.NetworkName.SN_SEPOLIA });
        const account = new Account(provider, accountAddress, privateKey);
        const usdcContract = new Contract(USDC_ABI, USDC_ADDRESS, provider);
        usdcContract.connect(account);

        const decimals = 6; // USDC typically has 6 decimals
        const amountInUnits = BigInt(Math.floor(amount * 10 ** decimals));
        const transferCall = usdcContract.populate('transfer', {
          recipient: toAddress,
          amount: { low: amountInUnits.toString(), high: '0' },
        });

        const { transaction_hash } = await account.execute(transferCall);
        await provider.waitForTransaction(transaction_hash);
        return { txHash: transaction_hash };
      } else if (blockchain === 'XION') {
        const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
          process.env.AGENT_WALLET_XION_MNEMONIC,
          { prefix: 'xion' }
        );
        const client = await SigningStargateClient.connectWithSigner(
          process.env.XION_RPC,
          wallet
        );

        const senderAddress = (await wallet.getAccounts())[0].address;
        const fee = {
          amount: coins(5000, process.env.XION_TOKEN_DENOM),
          gas: '200000',
        };

        const decimals = 6; // Assuming 6 decimals for XION token
        const amountInMicro = BigInt(Math.floor(amount * 10 ** decimals));
        const result = await client.sendTokens(
          senderAddress,
          toAddress,
          coins(amountInMicro, process.env.XION_TOKEN_DENOM),
          fee,
          'Funding wallet from fiat'
        );

        if (result.code === 0) {
          return { txHash: result.transactionHash };
        }
        throw new Error('XION transfer failed');
      }
      throw new Error('Unsupported blockchain');
    } catch (error) {
      console.error(`Error transferring USDC on ${blockchain}:`, error);
      throw error;
    }
  }

  async calculateUSDC(fiatAmount) {
    try {
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=usd'
      );
      const usdcRate = response.data['usd-coin'].usd;
      return fiatAmount / usdcRate;
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      return fiatAmount; // Fallback to 1:1 (consider a better fallback)
    }
  }
}

module.exports = new BlockchainService();
