# ADR 0002: Soroban Contract Integration Approach

## Status

Accepted

## Context

StellarStream requires integration with Soroban smart contracts for on-chain payment streaming functionality. The system needs to interact with the Soroban contract for operations such as creating streams, claiming vested tokens, and canceling streams. A key architectural decision is how to handle transaction signing: should transactions be signed by the backend server or by the client using wallet providers like Freighter?

## Decision

We have chosen a **backend-signed transaction approach** for Soroban contract integration, with a hybrid model for different operations.

### Server-Side Signing Architecture

The backend server holds a Stellar keypair (configured via `SERVER_PRIVATE_KEY` environment variable) and is responsible for signing and submitting Soroban transactions to the blockchain.

**Implementation Pattern:**
1. The server initializes a Stellar keypair from the `SERVER_PRIVATE_KEY` environment variable
2. For operations requiring server authorization (e.g., `create_stream`), the server:
   - Builds the Soroban transaction using the Stellar SDK
   - Signs the transaction with the server's keypair
   - Submits the transaction to the Soroban RPC endpoint
3. The configuration is validated at startup via `backend/src/config/validateEnv.ts`

**Key Implementation Details:**
```typescript
// From backend/src/services/streamStore.ts
serverKeypair = Keypair.fromSecret(process.env.SERVER_PRIVATE_KEY);

// Server builds, signs, and submits transactions
const built = await rpcServer.prepareTransaction(
  new TransactionBuilder(sourceAccount, {
    fee: "1000",
    networkPassphrase: netPass,
  })
    .addOperation(tx)
    .setTimeout(30)
    .build(),
);

built.sign(serverKeypair);
const sendRes = await retryWithBackoff(() => rpcServer!.sendTransaction(built));
```

### Why Server-Side Signing vs. Client-Side (Freighter)

#### Advantages of Server-Side Signing

1. **Better User Experience**: Users don't need to approve every transaction in their wallet, reducing friction
2. **Centralized Control**: The server can implement business logic, rate limiting, and validation before blockchain submission
3. **Simplified Error Handling**: The server can handle transaction failures, retries, and edge cases consistently
4. **Reduced Client Complexity**: Frontend doesn't need to integrate wallet signing libraries for all operations
5. **Operational Oversight**: Server can monitor, log, and audit all blockchain interactions

#### Advantages of Client-Side Signing (Freighter)

1. **Enhanced Security**: Private keys never leave the user's wallet
2. **User Sovereignty**: Users maintain full control over their transactions
3. **Reduced Server Trust**: Users don't need to trust the server with transaction signing
4. **Non-Custodial**: Aligns with Web3 principles of self-custody

#### Trade-offs and Security Considerations

**Server-Side Signing Risks:**
- The server holds a private key that could be compromised
- Centralized point of trust and failure
- Requires robust security infrastructure for key management

**Mitigations Implemented:**
- The server key is configured via environment variables, not hardcoded
- Configuration validation ensures proper key format (56 characters, starts with 'S')
- The server key is used only for specific operations (create_stream, administrative functions)
- Local development can disable Soroban entirely via `SOROBAN_DISABLED=true`
- Key usage is logged and monitored through the application

**Client-Side Signing Challenges:**
- Increased frontend complexity and wallet integration overhead
- User experience friction from wallet approvals
- Inconsistent wallet behavior across different providers
- Harder to implement server-side business logic and validation

### Hybrid Approach: Server Creates, Client Claims

Our architecture uses a hybrid approach that balances security, UX, and operational requirements:

1. **Server-Created Streams**: The server handles `create_stream` operations using server-side signing
   - Server validates input parameters
   - Server builds and signs the transaction
   - Server submits to the blockchain
   - This allows the server to enforce business rules and maintain data consistency

2. **Client Claims (Future On-Chain)**: The claim operation is designed to be client-initiated
   - Currently implemented as a local database operation (MVP simplification)
   - Designed to support future on-chain claiming with client-side signing
   - This gives users control over when and how they claim vested tokens

**Current Implementation Note:**
The claim endpoint (`POST /api/streams/:id/claim`) currently records claims in the local database only. As documented in `backend/src/index.ts`:

```typescript
// Record the claim event in the local DB.
// In a full on-chain implementation this would submit a `claim` Soroban tx.
```

This hybrid approach provides:
- Server control over stream creation (ensuring validity and consistency)
- User autonomy over claiming their vested tokens
- Flexibility to evolve the claiming mechanism as the product matures

### STELLAR_SECRET_KEY Server Keypair Pattern

The `SERVER_PRIVATE_KEY` environment variable follows a specific pattern:

**Configuration Requirements:**
- Must be exactly 56 characters
- Must start with 'S' (Stellar secret key format)
- Validated at startup via Zod schema in `backend/src/config/validateEnv.ts`

**Environment Setup:**
```bash
# Required for Soroban operations
CONTRACT_ID=C... (56 characters, starts with C)
SERVER_PRIVATE_KEY=S... (56 characters, starts with S)
RPC_URL=https://soroban-testnet.stellar.org:443
NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Optional: Disable Soroban for local development
SOROBAN_DISABLED=true
```

**Security Best Practices:**
1. Never commit the actual private key to version control
2. Use secret management systems (e.g., AWS Secrets Manager, Vault) in production
3. Rotate the server key periodically
4. Use different keys for different environments (dev, staging, production)
5. Implement key access logging and monitoring
6. Limit key permissions to only necessary operations

**Development Mode:**
For local development without blockchain interaction, set `SOROBAN_DISABLED=true`. This allows the application to run without requiring a valid `SERVER_PRIVATE_KEY` or `CONTRACT_ID`.

## Consequences

### Positive Consequences

1. **Simplified User Experience**: Users can create streams without wallet interaction
2. **Consistent Behavior**: Server-side logic ensures uniform transaction handling
3. **Better Error Recovery**: Server can implement retry logic and handle network issues
4. **Operational Control**: Team can monitor and manage blockchain interactions centrally
5. **Flexibility**: Hybrid approach allows evolution toward more client-side control where appropriate

### Negative Consequences

1. **Security Risk**: Server compromise could expose the private key
2. **Centralization**: Contrasts with pure Web3 decentralized philosophy
3. **Infrastructure Complexity**: Requires robust key management and security practices
4. **Single Point of Failure**: Server issues can block all blockchain operations
5. **Trust Requirement**: Users must trust the server to sign transactions correctly

### Mitigation Strategies

1. **Key Management**: Use professional secret management solutions in production
2. **Monitoring**: Implement comprehensive logging and alerting for key usage
3. **Rate Limiting**: Prevent abuse through API rate limiting
4. **Validation**: Multi-layer validation before transaction submission
5. **Incident Response**: Have clear procedures for key rotation in case of compromise
6. **Transparency**: Document the approach clearly (this ADR) for user awareness

## Alternatives Considered

### Alternative 1: Pure Client-Side Signing
All transactions signed by user wallets via Freighter or similar providers.

**Rejected Because:**
- Increased complexity for users (wallet approvals for every operation)
- Inconsistent wallet behavior across providers
- Harder to implement server-side business logic
- Poorer user experience for frequent operations

### Alternative 2: Multi-Signature Approach
Require signatures from both server and client for critical operations.

**Rejected Because:**
- Added complexity without clear benefit for current use case
- Increased transaction costs and latency
- More complex user experience (coordinated signing)
- Over-engineering for current MVP requirements

## References

- Implementation: `backend/src/services/streamStore.ts` (createStream function)
- Configuration validation: `backend/src/config/validateEnv.ts`
- Claim endpoint: `backend/src/index.ts` (POST /api/streams/:id/claim)
- Stellar SDK documentation: https://stellar.github.io/js-stellar-sdk/
- Soroban documentation: https://developers.stellar.org/docs/build/smart-contracts/