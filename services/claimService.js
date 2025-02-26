const Claim = require('../models/Claim');
const { ethers } = require('ethers');

class ClaimService {
  async generateClaimIdentifier(transactionId) {
    const claimId = ethers.utils.id(`${transactionId}-${Date.now()}`);
    const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days expiry
    const claim = await Claim.create({ claimId, transactionId, expiryDate });
    return claim;
  }

  async verifySignature(claimId, signature) {
    const claim = await Claim.findOne({ claimId });
    // Verify signature logic (depends on your smart contract)
    claim.signature = signature;
    claim.status = 'claimed';
    await claim.save();
    return claim;
  }

  async checkClaimExpiry() {
    const expiredClaims = await Claim.find({ expiryDate: { $lt: new Date() }, status: 'pending' });
    for (const claim of expiredClaims) {
      claim.status = 'expired';
      await claim.save();
    }
  }
}

module.exports = new ClaimService();
