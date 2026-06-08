export interface SignerHealth {
  status: string;
  process: string;
  address: string;
  gasBalance: string;
  chain: string;
}

export interface SignTransferParams {
  chain: string;
  tokenAddress: string;
  to: string;
  amountWei: string;
  action: string;
  agentId: string;
  userId: string;
  suggestionId: string;
  description: string;
}

export interface SignMintParams {
  chain: string;
  nftContract: string;
  metadataUri: string;
  recipients: Array<{ address: string; percentAllocation: number }>;
  agentId: string;
  userId: string;
  suggestionId: string;
}

export interface SignContractParams {
  chain: string;
  to: string;
  data: string;
  value?: string;
  agentId: string;
  userId: string;
  suggestionId: string;
  description: string;
}

export interface SignerTransferResult {
  success: true;
  txHash: string;
  explorerUrl: string;
}

export interface SignerMintResult {
  success: true;
  txHash: string;
  tokenId: string;
  explorerUrl: string;
}

export interface SignerErrorResult {
  success: false;
  error: string;
  code: string;
}

export interface SignerHealthResult {
  status: string;
  process: string;
  address: string;
  gasBalance: string;
  chain: string;
}

export class SignerClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "x-signer-key": this.apiKey,
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorResult = data as SignerErrorResult;
      throw new Error(
        errorResult.error || `Signer returned HTTP ${response.status}`,
      );
    }

    return data as T;
  }

  async signTransfer(
    params: SignTransferParams,
  ): Promise<SignerTransferResult | SignerErrorResult> {
    return this.request<SignerTransferResult | SignerErrorResult>(
      "POST",
      "/sign/transfer",
      params,
    );
  }

  async signMint(
    params: SignMintParams,
  ): Promise<SignerMintResult | SignerErrorResult> {
    return this.request<SignerMintResult | SignerErrorResult>(
      "POST",
      "/sign/mint",
      params,
    );
  }

  async signContract(
    params: SignContractParams,
  ): Promise<SignerTransferResult | SignerErrorResult> {
    return this.request<SignerTransferResult | SignerErrorResult>(
      "POST",
      "/sign/contract",
      params,
    );
  }

  async health(): Promise<SignerHealthResult> {
    return this.request<SignerHealthResult>("GET", "/health");
  }
}

let signerClientInstance: SignerClient | null = null;

export function getSignerClient(): SignerClient | null {
  const url = process.env.SIGNER_URL;
  const key = process.env.SIGNER_API_KEY;

  if (!url || !key) {
    return null;
  }

  if (!signerClientInstance) {
    signerClientInstance = new SignerClient(url, key);
  }

  return signerClientInstance;
}

export function createSignerClient(
  baseUrl: string,
  apiKey: string,
): SignerClient {
  return new SignerClient(baseUrl, apiKey);
}
