// ENS resolution utilities using ensdata.net (CORS-friendly alternative to eth.merkle.io)

/**
 * Resolve an ENS name to an Ethereum address
 */
export async function resolveENSName(name: string): Promise<string | null> {
  try {
    const response = await fetch(`https://ensdata.net/${name}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.address || null;
  } catch (error) {
    console.warn("ENS resolution failed:", error);
    return null;
  }
}

/**
 * Get ENS avatar URL for a name
 */
export async function getENSAvatar(name: string): Promise<string | null> {
  try {
    const response = await fetch(`https://ensdata.net/media/avatar/${name}`, {
      method: "GET",
    });

    if (!response.ok) {
      return null;
    }

    return `https://ensdata.net/media/avatar/${name}`;
  } catch (error) {
    console.warn("ENS avatar resolution failed:", error);
    return null;
  }
}

/**
 * Get complete ENS data for a name
 */
export async function getENSData(name: string): Promise<any | null> {
  try {
    const response = await fetch(`https://ensdata.net/${name}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn("ENS data fetch failed:", error);
    return null;
  }
}

/**
 * Resolve an Ethereum address to ENS name
 */
export async function resolveENSAddress(
  address: string,
): Promise<string | null> {
  try {
    const response = await fetch(`https://ensdata.net/${address}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.name || null;
  } catch (error) {
    console.warn("ENS reverse resolution failed:", error);
    return null;
  }
}
