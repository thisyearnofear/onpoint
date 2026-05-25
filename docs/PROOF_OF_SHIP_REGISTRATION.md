# Proof of Ship Registration Guide

Step-by-step guide to register OnPoint for Celo Proof of Ship Season 2.

## Prerequisites

- GitHub account with OnPoint repository
- Celo wallet address (the deployer wallet)
- Project deployed on Celo mainnet with verified contracts

## Registration Steps

### Step 1: Create Builder Profile on Talent App

1. Go to [talent.app](https://talent.app)
2. Click "Sign Up" or "Connect Wallet"
3. Connect your Celo wallet
4. Complete your builder profile:
   - Add your name/handle
   - Add social links (Twitter, GitHub, etc.)
   - Add a bio describing your background

### Step 2: Create Project Page

1. On talent.app, go to your profile
2. Click "Create Project"
3. Fill in project details:
   - **Name**: OnPoint
   - **Description**: AI-Powered Personal Styling Agent with autonomous decision-making, spending controls, and transparent reasoning trails
   - **Website**: https://onpoint-web-647723858538.us-central1.run.app
   - **Category**: AI Agents / B2C Apps
   - **GitHub**: https://github.com/thisyearnofear/onpoint

4. Add team members (if applicable):
   - Each contributor needs their own talent.app profile
   - Add their wallet addresses as contributors

### Step 3: Add Smart Contracts

1. In your project page, go to "Contracts" section
2. Add the OnPointNFT contract:
   - **Network**: Celo Mainnet
   - **Address**: `0x8e0a3BcF07Ec8133408A3837DD2DCe398A42f576`
   - **Name**: OnPointNFT
   - **Description**: ERC-721A NFT for minted looks, outfits, and style moments

3. Verify the contract (if not already verified):
   - Go to [Celoscan](https://celoscan.io)
   - Search for the contract address
   - Click "Verify and Publish"
   - Follow the verification steps

### Step 4: Add GitHub Repository

1. In your project page, go to "Repositories" section
2. Add the GitHub repository:
   - **URL**: https://github.com/thisyearnofear/onpoint
   - **Branch**: master (or main)
   - Ensure the repository is public (required for leaderboard tracking)

### Step 5: Enroll in Proof of Ship

1. Go to [Proof of Ship campaign page](https://talent.app/~/earn/celo-proof-of-ship)
2. Find OnPoint in the list of your projects
3. Click "Enroll" or "Register"
4. Confirm enrollment

### Step 6: Apply for AI Agent Track (Separate)

The AI Agent prize pool ($1,000 USDT) requires separate application:

1. Fill out the [AI Agent Track Form](https://docs.google.com/forms/d/e/1FAIpQLScNUXE54uA-XkmynIZSMHg7W7ZtlKZ7rwgxZRX5MH6nFC-OiA/viewform?usp=dialog)
2. Provide:
   - Project name: OnPoint
   - GitHub repository link
   - Description of AI agent functionality
   - How it meets AI agent requirements:
     - Agent with autonomous decision-making
     - Spending controls and approval workflows
     - Transparent reasoning trails

## AI Agent Requirements

For the AI Agent track, ensure your project demonstrates:

1. **Agent Autonomy**
   - AI makes decisions independently
   - Has configurable autonomy thresholds
   - Small actions auto-execute, large ones require approval

2. **Onchain Integration**
   - Wallet with onchain transactions
   - Smart contract interactions
   - Fee abstraction support (MiniPay)

3. **Transparency**
   - Visible reasoning trail for decisions
   - Audit trail of agent actions
   - User can see why agent made each suggestion

4. **Use Cases for MiniPay**
   - "Pay as you go" access to AI services
   - Alternative to subscriptions
   - Real utility for MiniPay users

## After Registration

### Leaderboard Tracking

Your project will be evaluated based on:

- **Onchain Activity**
  - Transaction count on Celo mainnet
  - Unique active users
  - Fees generated

- **GitHub Activity**
  - Unique days with contributions
  - Total number of contributions
  - MiniPay-specific code usage

- **NPM Downloads**
  - Package downloads from your published packages

### Monthly Rhythm

- **Week 1 (Scope)**: Define what you're building, get feedback
- **Week 2 (Ship)**: Build and share progress
- **Week 3 (Refine)**: Iterate based on data and feedback
- **Week 4 (Present)**: Define growth strategy, practice pitch

### Maximizing Your Score

1. **Keep GitHub Active**
   - Commit regularly (at least a few times per week)
   - Use meaningful commit messages
   - Reference issues and PRs

2. **Drive Onchain Activity**
   - Get real users testing the app
   - Generate actual transactions on Celo
   - Use cUSD/USDT for payments

3. **Implement MiniPay Hook**
   - ✅ Already done! This counts as a Booster

4. **Publish NPM Packages**
   - Consider publishing reusable components
   - Track download metrics

## Important Dates

- **Submission Deadline**: May 25th at 23:59 GMT (passed for this month)
- **Projects Review**: May 26-28
- **Leaderboard Definition**: May 29th
- **Next Month**: June 4-29 (Season 2 runs through June 30th, 2026)

## Resources

- [Proof of Ship Page](https://talent.app/~/earn/celo-proof-of-ship)
- [Celopedia](https://celopedia.celo.org)
- [MiniPay Quickstart](https://docs.celo.org/developer/build-on-minipay/overview)
- [Celo Faucet](https://faucet.celo.org/alfajores)
- [Telegram Group](https://t.me/proofofship)

## Troubleshooting

### Project Not Appearing on Leaderboard

1. Ensure all requirements are met:
   - Smart contract verified on Celoscan
   - GitHub repository is public
   - Project enrolled in Proof of Ship

2. Wait 24 hours for leaderboard update

3. Check talent.app for any error messages

### Contract Verification Failed

1. Ensure you have the correct compiler version (0.8.20)
2. Include all constructor arguments
3. Flatten the contract if needed

### MiniPay Not Detecting

1. Ensure you're testing in MiniPay app (not regular browser)
2. Enable Developer Mode in MiniPay settings
3. Use ngrok for local testing

## Contact

- Telegram: https://t.me/proofofship
- Twitter: https://x.com/CeloDevs
- Talent App Support: Open ticket on talent.app
