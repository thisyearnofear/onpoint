// IPFS client for uploading files to Pinata

import lighthouse from '@lighthouse-web3/sdk';

export interface IPFSUploadResult {
  uri: string;
  cid: string;
  url: string;
}

/**
 * Uploads data to IPFS using Lighthouse (Filecoin-backed)
 * Eligible for Protocol Labs Genesis Hackathon
 */
export async function uploadToIPFS(
  data: Buffer | string | Blob,
  fileName: string = 'onpoint-capture.jpg'
): Promise<IPFSUploadResult> {
  const apiKey = process.env.LIGHTHOUSE_API_KEY;
  if (!apiKey) {
    throw new Error('LIGHTHOUSE_API_KEY is not configured');
  }

  try {
    let uploadResponse;

    if (Buffer.isBuffer(data)) {
      uploadResponse = await lighthouse.uploadBuffer(data, apiKey);
    } else if (typeof data === 'string') {
      // If it's a string, treat it as text/json
      uploadResponse = await lighthouse.uploadBuffer(Buffer.from(data), apiKey);
    } else {
      // For Blobs/Files in some environments, we might need to convert to Buffer
      const arrayBuffer = await (data as Blob).arrayBuffer();
      uploadResponse = await lighthouse.uploadBuffer(Buffer.from(arrayBuffer), apiKey);
    }

    const cid = uploadResponse.data.Hash;
    const uri = `ipfs://${cid}`;
    const url = `https://gateway.lighthouse.storage/ipfs/${cid}`;

    return { uri, cid, url };
  } catch (error) {
    console.error('Lighthouse upload error:', error);
    throw error;
  }
}